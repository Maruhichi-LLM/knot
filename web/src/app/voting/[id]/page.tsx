import Link from "next/link";
import { redirect } from "next/navigation";
import { VotingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";
import { ROLE_ADMIN } from "@/lib/roles";
import { buildResultsFromCounts, buildVoteHash } from "@/lib/voting";
import { VotingAnonymousBanner } from "@/components/voting-anonymous-banner";
import { VotingVotePanel } from "@/components/voting-vote-panel";
import { VotingCommentForm } from "@/components/voting-comment-form";
import { VotingAdminActions } from "@/components/voting-admin-actions";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

async function closeIfNeeded(votingId: number, groupId: number) {
  const voting = await prisma.voting.findFirst({
    where: { id: votingId, groupId },
    select: {
      id: true,
      status: true,
      deadlineAt: true,
      options: true,
    },
  });
  if (!voting) return null;
  if (
    voting.status === VotingStatus.OPEN &&
    voting.deadlineAt &&
    voting.deadlineAt.getTime() <= Date.now()
  ) {
    const counts = await prisma.votingVote.groupBy({
      by: ["choiceId"],
      where: { votingId },
      _count: { _all: true },
    });
    const countMap: Record<string, number> = {};
    counts.forEach((item) => {
      countMap[item.choiceId] = item._count._all;
    });
    const options = Array.isArray(voting.options)
      ? (voting.options as { id: string; label: string }[])
      : [];
    const { results, total } = buildResultsFromCounts(options, countMap);
    await prisma.voting.update({
      where: { id: votingId },
      data: {
        status: VotingStatus.CLOSED,
        results,
        totalVotes: total,
      },
    });
  }
  return prisma.voting.findFirst({
    where: { id: votingId, groupId },
    include: {
      createdBy: { select: { displayName: true } },
      comments: { orderBy: { createdAt: "desc" } },
    },
  });
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VotingDetailPage({ params }: PageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  await ensureModuleEnabled(session.groupId, "voting");

  const resolved = await params;
  const votingId = Number(resolved.id);
  if (!Number.isInteger(votingId)) {
    redirect("/voting");
  }

  const voting = await closeIfNeeded(votingId, session.groupId);
  if (!voting) {
    redirect("/voting");
  }

  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
    select: { role: true },
  });
  const isAdmin = member?.role === ROLE_ADMIN;
  const canManage =
    isAdmin || voting.createdByMemberId === session.memberId;

  let hasVoted = false;
  try {
    const voteHash = buildVoteHash(votingId, session.memberId);
    const existing = await prisma.votingVote.findUnique({
      where: { votingId_voteHash: { votingId, voteHash } },
      select: { id: true },
    });
    hasVoted = Boolean(existing);
  } catch {
    hasVoted = false;
  }

  const options = Array.isArray(voting.options)
    ? (voting.options as { id: string; label: string }[])
    : [];
  const resultMap = (voting.results ?? {}) as Record<string, number>;
  const { results, total } = buildResultsFromCounts(options, resultMap);

  return (
    <div className="min-h-screen py-10">
      <div className="page-shell space-y-8">
        <header className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">
                Knot Voting
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-zinc-900">
                {voting.title}
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                作成者: {voting.createdBy?.displayName ?? "不明"}
              </p>
              {voting.description ? (
                <p className="mt-3 text-sm text-zinc-700">
                  {voting.description}
                </p>
              ) : null}
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                voting.status === VotingStatus.CLOSED
                  ? "bg-zinc-100 text-zinc-600"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {voting.status === VotingStatus.CLOSED ? "締切済み" : "受付中"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-600">
            <span>
              締切:{" "}
              {voting.deadlineAt
                ? formatter.format(voting.deadlineAt)
                : "なし"}
            </span>
            <span>投票数: {voting.totalVotes}</span>
          </div>
        </header>

        <VotingAnonymousBanner />

        {voting.status === VotingStatus.OPEN && !hasVoted ? (
          <VotingVotePanel votingId={voting.id} options={options} />
        ) : null}

        {hasVoted ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            <p className="text-sm font-semibold">投票しました（匿名）</p>
            <p className="mt-2 text-sm text-emerald-800/90">
              補足があれば、匿名コメントを残せます。その後、必要ならチャットで整理できます。
            </p>
          </section>
        ) : null}

        {voting.status === VotingStatus.CLOSED && !hasVoted ? (
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-zinc-700">
            <p className="text-sm font-semibold">投票は締切済みです。</p>
            <p className="mt-2 text-sm text-zinc-600">
              集計結果は閲覧できます（匿名性は変わりません）。
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            {voting.status === VotingStatus.CLOSED
              ? "最終結果（締切済み）"
              : "現在の集計"}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            表示されるのは票数のみです（誰が投票したかは表示されません）。
          </p>
          <div className="mt-4 space-y-2">
            {options.map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-2 text-sm"
              >
                <span className="text-zinc-700">{option.label}</span>
                <span className="font-semibold text-zinc-900">
                  {results[option.id] ?? 0}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-2 text-sm text-zinc-600">
              <span>合計</span>
              <span className="font-semibold text-zinc-900">{total}</span>
            </div>
          </div>
        </section>

        <VotingCommentForm votingId={voting.id} />

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              匿名コメント一覧
            </h2>
            <span className="text-xs text-zinc-500">
              {voting.comments.length}件
            </span>
          </div>
          {voting.comments.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              まだ匿名コメントはありません。
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {voting.comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
                >
                  <p className="whitespace-pre-line">{comment.body}</p>
                  <p className="mt-2 text-xs text-zinc-400">
                    {formatter.format(comment.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {voting.threadId && !canManage ? (
          <section className="rounded-2xl border border-sky-200 bg-sky-50 p-6 text-sky-800">
            <p className="text-sm font-semibold">
              この投票はチャットに移行済みです。
            </p>
            <Link
              href={`/threads/${voting.threadId}`}
              className="mt-3 inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              チャットを開く
            </Link>
          </section>
        ) : null}

        {canManage ? (
          <VotingAdminActions
            votingId={voting.id}
            isClosed={voting.status === VotingStatus.CLOSED}
            threadId={voting.threadId}
          />
        ) : null}
      </div>
    </div>
  );
}
