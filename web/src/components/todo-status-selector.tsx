"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TodoStatus } from "@prisma/client";

const STATUS_LABELS: Record<TodoStatus, string> = {
  TODO: "未着手",
  IN_PROGRESS: "進行中",
  DONE: "完了",
};

type Props = {
  todoId: number;
  currentStatus: TodoStatus;
};

export function TodoStatusSelector({ todoId, currentStatus }: Props) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange(newStatus: TodoStatus) {
    if (newStatus === currentStatus) return;

    setIsUpdating(true);
    setError(null);
    setShowSuccess(false);

    try {
      const response = await fetch(`/api/todos/${todoId}/status`, {
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

      // Show success message
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

      // Re-fetch server data
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <label className="text-xs font-semibold text-zinc-500">
        状態
        <select
          value={currentStatus}
          onChange={(e) => handleStatusChange(e.target.value as TodoStatus)}
          disabled={isUpdating}
          className="mt-1 rounded-full border border-zinc-200 px-3 py-1.5 text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {showSuccess && (
        <span className="text-xs font-semibold text-emerald-600">
          更新しました。
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
