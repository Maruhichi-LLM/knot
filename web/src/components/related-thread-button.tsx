"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThreadSourceType } from "@prisma/client";

type Props = {
  groupId: number;
  sourceType: ThreadSourceType;
  sourceId: number;
  title: string;
  threadId?: number | null;
  className?: string;
};

export function RelatedThreadButton({
  groupId,
  sourceType,
  sourceId,
  title,
  threadId,
  className,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (threadId) {
    return (
      <div className={className}>
        <Link
          href={`/threads/${threadId}`}
          className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-sky-600 hover:border-sky-500"
        >
          関連Threadへ戻る
        </Link>
      </div>
    );
  }

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${groupId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          sourceType,
          sourceId,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Threadの作成に失敗しました。");
        return;
      }
      const data = (await response.json()) as { thread: { id: number } };
      router.push(`/threads/${data.thread.id}`);
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {pending ? "生成中..." : "この件について話す"}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
