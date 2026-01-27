import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";
import {
  assertSameOrigin,
  CSRF_ERROR_MESSAGE,
  RATE_LIMIT_ERROR_MESSAGE,
  checkRateLimit,
  getRateLimitRule,
  buildRateLimitKey,
} from "@/lib/security";
import { VOTING_LIMITS } from "@/lib/voting";

type CommentPayload = {
  body?: string;
};

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

  const payload = (await request.json().catch(() => ({}))) as CommentPayload;
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) {
    return NextResponse.json(
      { error: "コメントを入力してください。" },
      { status: 400 }
    );
  }
  if (body.length > VOTING_LIMITS.commentMax) {
    return NextResponse.json(
      { error: `コメントは${VOTING_LIMITS.commentMax}文字以内で入力してください。` },
      { status: 400 }
    );
  }

  const voting = await prisma.voting.findFirst({
    where: { id: votingId, groupId: session.groupId },
    select: { id: true },
  });
  if (!voting) {
    return NextResponse.json(
      { error: "投票が見つかりません。" },
      { status: 404 }
    );
  }

  await prisma.votingComment.create({
    data: {
      votingId,
      body,
    },
  });

  revalidatePath(`/voting/${votingId}`);

  return NextResponse.json({ success: true });
}
