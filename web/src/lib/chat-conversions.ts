import { revalidatePath } from "next/cache";
import {
  DocumentCategory,
  LedgerStatus,
  TodoStatus,
} from "@prisma/client";
import { prisma } from "./prisma";
import { saveDocumentBytes } from "./document-storage";

export async function loadChatMessageForConversion(
  messageId: number,
  groupId: number
) {
  return prisma.chatMessage.findFirst({
    where: { id: messageId, groupId },
    include: {
      group: { select: { id: true, fiscalYearStartMonth: true } },
      thread: { select: { id: true, title: true } },
    },
  });
}

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

type ConversionMessage = NonNullable<
  Awaited<ReturnType<typeof loadChatMessageForConversion>>
>;

export async function convertMessageToTodo(
  message: ConversionMessage,
  actorMemberId: number
) {
  const existing = await prisma.todoItem.findUnique({
    where: { sourceChatMessageId: message.id },
  });
  if (existing) {
    return {
      target: "todo" as const,
      status: "exists" as const,
      url: `/todo?focus=${existing.id}`,
      todoId: existing.id,
      threadId: message.threadId,
    };
  }
  const todo = await prisma.todoItem.create({
    data: {
      groupId: message.groupId,
      createdByMemberId: actorMemberId,
      title: summarize(message.body, 80),
      body: message.body,
      status: TodoStatus.TODO,
      sourceChatMessageId: message.id,
      sourceThreadId: message.threadId,
    },
  });
  revalidatePath("/todo");
  revalidatePath(`/threads/${message.threadId}`);
  return {
    target: "todo" as const,
    status: "created" as const,
    url: `/todo?focus=${todo.id}`,
    todoId: todo.id,
    threadId: message.threadId,
  };
}

export async function convertMessageToLedgerDraft(
  message: ConversionMessage,
  actorMemberId: number
) {
  const existing = await prisma.ledger.findUnique({
    where: { sourceChatMessageId: message.id },
  });
  if (existing) {
    return {
      target: "accounting" as const,
      status: "exists" as const,
      url: `/accounting?focus=${existing.id}`,
      ledgerId: existing.id,
      threadId: message.threadId,
    };
  }
  const defaultAccount = await prisma.account.findFirst({
    where: { groupId: message.groupId, isArchived: false },
    orderBy: { order: "asc" },
  });
  const ledger = await prisma.ledger.create({
    data: {
      groupId: message.groupId,
      createdByMemberId: actorMemberId,
      title: summarize(message.body, 80),
      amount: 0,
      notes: message.body,
      status: LedgerStatus.DRAFT,
      sourceChatMessageId: message.id,
      sourceThreadId: message.threadId,
      accountId: defaultAccount?.id,
    },
  });
  revalidatePath("/accounting");
  revalidatePath(`/threads/${message.threadId}`);
  return {
    target: "accounting" as const,
    status: "created" as const,
    url: "/accounting",
    ledgerId: ledger.id,
    threadId: message.threadId,
  };
}

export async function convertMessageToDocument(
  message: ConversionMessage,
  actorMemberId: number
) {
  const existing = await prisma.document.findUnique({
    where: { sourceChatMessageId: message.id },
  });
  if (existing) {
    return {
      target: "document" as const,
      status: "exists" as const,
      url: `/documents/${existing.id}`,
      documentId: existing.id,
      threadId: message.threadId,
    };
  }
  const now = new Date();
  const fiscalYear = resolveFiscalYear(
    now,
    message.group.fiscalYearStartMonth || 4
  );
  const titleStamp = now.toLocaleString("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const document = await prisma.document.create({
    data: {
      groupId: message.groupId,
      title: `${titleStamp} ${message.thread.title} メモ`,
      category: DocumentCategory.MEETING_NOTE,
      fiscalYear,
      createdByMemberId: actorMemberId,
      sourceChatMessageId: message.id,
      sourceThreadId: message.threadId,
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
  revalidatePath(`/threads/${message.threadId}`);
  return {
    target: "document" as const,
    status: "created" as const,
    url: `/documents/${document.id}`,
    documentId: document.id,
    threadId: message.threadId,
  };
}
