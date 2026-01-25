"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  threadId: number;
  currentStatus: "OPEN" | "CLOSED";
};

export function ThreadStatusToggle({ threadId, currentStatus }: Props) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const newStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/threads/${threadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "ステータスの更新に失敗しました。");
        setIsUpdating(false);
        return;
      }

      // サーバー側のデータを再取得
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isUpdating}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          currentStatus === "OPEN"
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
        }`}
      >
        {isUpdating ? "更新中..." : currentStatus === "OPEN" ? "OPEN" : "CLOSED"}
      </button>
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : null}
    </div>
  );
}
