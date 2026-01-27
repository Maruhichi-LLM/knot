import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ThreadSourceType, ThreadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";
import { ROLE_ADMIN } from "@/lib/roles";
import {
  assertSameOrigin,
  CSRF_ERROR_MESSAGE,
  RATE_LIMIT_ERROR_MESSAGE,
  checkRateLimit,
  getRateLimitRule,
  buildRateLimitKey,
} from "@/lib/security";
import { buildResultsFromCounts } from "@/lib/voting";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { error: CSRF_ERROR_MESSAGE },
      { status: 403 }
    );
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureModuleEnabled(session.groupId, "voting");
  await ensureModuleEnabled(session.groupId, "chat");

  const { limit, windowSec } = getRateLimitRule("write");
  const rate = checkRateLimit({
    key: buildRateLimitKey({
      scope: "write",
      request,
      memberId: session.memberId,
    }),
    limit,
    windowSec,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: RATE_LIMIT_ERROR_MESSAGE },
      {
        status: 429,
        headers: rate.retryAfterSec
          ? { "Retry-After": String(rate.retryAfterSec) }
          : undefined,
      }
    );
  }

  const { id } = await params;
  const votingId = Number(id);
  if (!Number.isInteger(votingId)) {
    return NextResponse.json(
      { error: "投票が見つかりません。" },
      { status: 404 }
    );
  }

  const [voting, member, comments] = await Promise.all([
    prisma.voting.findFirst({
      where: { id: votingId, groupId: session.groupId },
      select: {
        id: true,
        title: true,
        status: true,
        deadlineAt: true,
        options: true,
        createdByMemberId: true,
        threadId: true,
      },
    }),
    prisma.member.findUnique({
      where: { id: session.memberId },
      select: { role: true },
    }),
    prisma.votingComment.findMany({
      where: { votingId },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!voting) {
    return NextResponse.json(
      { error: "投票が見つかりません。" },
      { status: 404 }
    );
  }

  const isAdmin = member?.role === ROLE_ADMIN;
  if (!isAdmin && voting.createdByMemberId !== session.memberId) {
    return NextResponse.json(
      { error: "移行権限がありません。" },
      { status: 403 }
    );
  }

  if (voting.threadId) {
    return NextResponse.json(
      { error: "この投票はチャットに移行済みです。" },
      { status: 400 }
    );
  }

  const options = Array.isArray(voting.options)
    ? (voting.options as { id: string; label: string }[])
    : [];
  const counts = await prisma.votingVote.groupBy({
    by: ["choiceId"],
    where: { votingId },
    _count: { _all: true },
  });
  const countMap: Record<string, number> = {};
  counts.forEach((item) => {
    countMap[item.choiceId] = item._count._all;
  });
  const { results, total } = buildResultsFromCounts(options, countMap);

  const deadlineText = voting.deadlineAt
    ? formatter.format(voting.deadlineAt)
    : "なし";
  const resultLines = options.map((option) => {
    const count = results[option.id] ?? 0;
    return `・${option.label}: ${count}`;
  });
  const commentLines = comments.map((comment) => `- ${comment.body}`);
  const bodyLines = [
    `【投票】${voting.title}`,
    `状態: ${voting.status}`,
    `締切: ${deadlineText}`,
    "結果（票数）:",
    ...resultLines,
    `（合計: ${total}）`,
  ];
  if (commentLines.length > 0) {
    bodyLines.push("匿名コメント:");
    bodyLines.push(...commentLines);
  }

  const thread = await prisma.chatThread.create({
    data: {
      groupId: session.groupId,
      title: `投票: ${voting.title}`,
      sourceType: ThreadSourceType.VOTING,
      sourceId: votingId,
      status: ThreadStatus.OPEN,
    },
  });

  await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      groupId: session.groupId,
      authorId: session.memberId,
      body: bodyLines.join("\n"),
    },
  });

  await prisma.voting.update({
    where: { id: votingId },
    data: {
      threadId: thread.id,
      results,
      totalVotes: total,
    },
  });

  revalidatePath("/chat");
  revalidatePath("/voting");
  revalidatePath(`/voting/${votingId}`);

  return NextResponse.json({ thread });
}
