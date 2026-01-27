"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VotingOption = {
  id: string;
  label: string;
};

type Props = {
  votingId: number;
  options: VotingOption[];
};

export function VotingVotePanel({ votingId, options }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleVote(choiceId: string) {
    setPendingId(choiceId);
    setError(null);
    try {
      const response = await fetch(`/api/voting/${votingId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choiceId }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "投票に失敗しました。");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          あなたの1票を選んでください
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          匿名で投票できます。投票後は変更できません。
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          送信すると、あなたの投票は匿名で集計されます。
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => handleVote(option.id)}
            disabled={pendingId !== null}
            className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-5 text-lg font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingId === option.id ? "送信中..." : option.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
