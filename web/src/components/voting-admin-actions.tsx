"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  votingId: number;
  isClosed: boolean;
  threadId?: number | null;
};

export function VotingAdminActions({
  votingId,
  isClosed,
  threadId,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<"close" | "convert" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    const confirmed = window.confirm(
      "締切ると、以後投票できません。集計結果は閲覧できます。（匿名性は変わりません）"
    );
    if (!confirmed) return;
    setPending("close");
    setError(null);
    try {
      const response = await fetch(`/api/voting/${votingId}/close`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "締切に失敗しました。");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(null);
    }
  }

  async function handleConvert() {
    const confirmed = window.confirm(
      "チャットに移行しますか？\n投票結果（集計）と匿名コメントを、新しいチャットスレッドにまとめます。\n投票の匿名性は保たれます（誰が投票したかは表示されません）。"
    );
    if (!confirmed) return;
    setPending("convert");
    setError(null);
    try {
      const response = await fetch(`/api/voting/${votingId}/convert-to-chat`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "チャット移行に失敗しました。");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">管理操作</h2>
      <div className="mt-3 flex flex-col gap-4">
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm font-semibold text-zinc-900">締切</p>
          <p className="mt-1 text-xs text-zinc-600">
            締切ると、以後投票できません。集計結果は閲覧できます。（匿名性は変わりません）
          </p>
          <button
            type="button"
            onClick={handleClose}
            disabled={isClosed || pending !== null}
            className="mt-3 inline-flex rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "close" ? "処理中..." : "投票を締切る"}
          </button>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm font-semibold text-zinc-900">Chat移行</p>
          <p className="mt-1 text-xs text-zinc-600">
            投票結果と匿名コメントをまとめて、チャットで次のアクションを決められます。
          </p>
          {threadId ? (
            <p className="mt-3 text-sm text-sky-600">
              この投票はチャットに移行済みです。{" "}
              <Link href={`/threads/${threadId}`} className="underline">
                チャットを開く
              </Link>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleConvert}
              disabled={pending !== null}
              className="mt-3 inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === "convert" ? "移行中..." : "投票をチャットに移行"}
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
