import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";

function parseThreadId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const threadId = parseThreadId(params.threadId);
  if (!threadId) {
    return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
  }
  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, groupId: session.groupId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, displayName: true } },
          todoItems: { select: { id: true } },
          ledgerEntries: { select: { id: true } },
          documents: { select: { id: true } },
        },
      },
    },
  });
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  return NextResponse.json({ thread });
}
