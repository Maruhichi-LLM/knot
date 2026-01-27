"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type StepDraft = {
  approverRole: string;
  requireAll: boolean;
  conditions?: string;
};

export function RouteCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("承認ルート");
  const [steps, setSteps] = useState<StepDraft[]>([
    { approverRole: "ADMIN", requireAll: true },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...patch } : step))
    );
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { approverRole: "MEMBER", requireAll: true }]);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (steps.length === 0) {
      setError("少なくとも1つのステップを追加してください。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        steps: steps.map((step) => ({
          approverRole: step.approverRole.trim(),
          requireAll: step.requireAll,
          conditions: step.conditions && step.conditions.trim().length > 0
            ? JSON.parse(step.conditions)
            : null,
        })),
      };

      const res = await fetch("/api/approval/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "作成に失敗しました");
      }
      setName("承認ルート");
      setSteps([{ approverRole: "ADMIN", requireAll: true }]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4"
    >
      <div>
        <label className="text-sm font-medium text-zinc-700">ルート名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-3">
        <p className="text-sm font-semibold text-zinc-700">承認ステップ</p>
        {steps.map((step, index) => (
          <div
            key={index}
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm"
          >
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <span className="text-xs text-zinc-500">権限ラベル</span>
                <input
                  type="text"
                  value={step.approverRole}
                  onChange={(e) =>
                    updateStep(index, { approverRole: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1"
                />
              </label>
              <label className="text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={step.requireAll}
                  onChange={(e) =>
                    updateStep(index, { requireAll: e.target.checked })
                  }
                  className="mr-1"
                />
                全員承認
              </label>
            </div>
            <label className="mt-2 block text-xs text-zinc-500">
              条件JSON（任意）
              <textarea
                value={step.conditions ?? ""}
                onChange={(e) => updateStep(index, { conditions: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs"
                placeholder='{"minAmount":10000}'
              />
            </label>
            {steps.length > 1 ? (
              <button
                type="button"
                onClick={() => removeStep(index)}
                className="mt-2 text-xs text-rose-600 hover:underline"
              >
                このステップを削除
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={addStep}
          className="text-xs font-semibold text-sky-600 hover:underline"
        >
          ＋ ステップを追加
        </button>
      </div>
      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          {submitting ? "作成中..." : "ルートを作成"}
        </button>
      </div>
    </form>
  );
}
