import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  DocumentCategory,
  LedgerStatus,
  TodoStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { saveDocumentBytes } from "@/lib/document-storage";

type ConversionTarget = "todo" | "accounting" | "document";

function summarize(text: string, length = 60) {
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length - 1)}…`;
}

function resolveFiscalYear(date: Date, startMonth: number) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= startMonth ? year : year - 1;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const messageId = Number(params.messageId);
  if (!Number.isInteger(messageId)) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }
  const payload = (await request.json().catch(() => ({}))) as {
    target?: ConversionTarget;
  };
  if (!payload.target || !["todo", "accounting", "document"].includes(payload.target)) {
    return NextResponse.json({ error: "Invalid conversion target" }, { status: 400 });
  }
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, groupId: session.groupId },
    include: {
      author: { select: { id: true, displayName: true } },
      group: { select: { id: true, fiscalYearStartMonth: true, name: true } },
    },
  });
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  try {
    switch (payload.target) {
      case "todo":
        return NextResponse.json(
          await convertToTodo(message.id, session.memberId, message)
        );
      case "accounting":
        return NextResponse.json(
          await convertToLedgerDraft(message.id, session.memberId, message)
        );
      case "document":
        return NextResponse.json(
          await convertToDocument(message.id, session.memberId, message)
        );
      default:
        return NextResponse.json({ error: "Unsupported target" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "変換処理に失敗しました。",
      },
      { status: 400 }
    );
  }
}

async function convertToTodo(
  messageId: number,
  actorMemberId: number,
  message: {
    groupId: number;
    body: string;
  }
) {
  const existing = await prisma.todoItem.findUnique({
    where: { sourceChatMessageId: messageId },
  });
  if (existing) {
    return {
      target: "todo",
      status: "exists",
      url: `/todo?focus=${existing.id}`,
    } as const;
  }
  const todo = await prisma.todoItem.create({
    data: {
      groupId: message.groupId,
      createdByMemberId: actorMemberId,
      title: summarize(message.body, 80),
      body: message.body,
      status: TodoStatus.TODO,
      sourceChatMessageId: messageId,
    },
  });
  revalidatePath("/todo");
  return {
    target: "todo" as const,
    status: "created" as const,
    url: `/todo?focus=${todo.id}`,
  };
}

async function convertToLedgerDraft(
  messageId: number,
  actorMemberId: number,
  message: {
    groupId: number;
    body: string;
  }
) {
  const existing = await prisma.ledger.findUnique({
    where: { sourceChatMessageId: messageId },
  });
  if (existing) {
    return {
      target: "accounting",
      status: "exists",
      url: "/ledger",
    } as const;
  }
  await prisma.ledger.create({
    data: {
      groupId: message.groupId,
      createdByMemberId: actorMemberId,
      title: summarize(message.body, 80),
      amount: 0,
      notes: message.body,
      status: LedgerStatus.DRAFT,
      sourceChatMessageId: messageId,
    },
  });
  revalidatePath("/ledger");
  return {
    target: "accounting" as const,
    status: "created" as const,
    url: "/ledger",
  };
}

async function convertToDocument(
  messageId: number,
  actorMemberId: number,
  message: {
    groupId: number;
    body: string;
    group: { fiscalYearStartMonth: number };
  }
) {
  const existing = await prisma.document.findUnique({
    where: { sourceChatMessageId: messageId },
  });
  if (existing) {
    return {
      target: "document",
      status: "exists",
      url: `/documents/${existing.id}`,
    } as const;
  }
  const now = new Date();
  const fiscalYear = resolveFiscalYear(
    now,
    message.group.fiscalYearStartMonth || 4
  );
  const document = await prisma.document.create({
    data: {
      groupId: message.groupId,
      title: `議事録 ${now.toLocaleString("ja-JP", {
        dateStyle: "short",
        timeStyle: "short",
      })}`,
      category: DocumentCategory.MEETING_NOTE,
      fiscalYear,
      createdByMemberId: actorMemberId,
      sourceChatMessageId: messageId,
    },
  });
  const buffer = Buffer.from(
    [
      "Knot Chat から自動作成された議事録",
      `作成日時: ${now.toLocaleString("ja-JP", {
        dateStyle: "full",
        timeStyle: "short",
      })}`,
      "",
      message.body,
    ].join("\n"),
    "utf8"
  );
  const version = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber: 1,
      originalFilename: `meeting-note-${document.id}.txt`,
      storedPath: "",
      mimeType: "text/plain",
      sizeBytes: buffer.byteLength,
      createdByMemberId: actorMemberId,
    },
  });
  try {
    const storedPath = await saveDocumentBytes(
      message.groupId,
      document.id,
      version.id,
      buffer
    );
    await prisma.documentVersion.update({
      where: { id: version.id },
      data: { storedPath },
    });
  } catch (error) {
    await prisma.document.delete({ where: { id: document.id } });
    throw error instanceof Error
      ? error
      : new Error("文書ファイルの保存に失敗しました。");
  }
  revalidatePath("/documents");
  revalidatePath(`/documents/${document.id}`);
  return {
    target: "document" as const,
    status: "created" as const,
    url: `/documents/${document.id}`,
  };
}
