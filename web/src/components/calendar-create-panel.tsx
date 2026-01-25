"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  dateString: string;
  memberName: string;
  groupName: string;
  budgetEnabled?: boolean;
};

const TARGETS = [
  { value: "group", label: "所属団体のカレンダー" },
  { value: "personal", label: "自分だけのカレンダー" },
] as const;

export function CalendarCreatePanel({
  dateString,
  memberName,
  groupName,
  budgetEnabled,
}: Props) {
  const router = useRouter();
  const [target, setTarget] = useState<"group" | "personal">("group");
  const [title, setTitle] = useState("");
  const [createBudget, setCreateBudget] = useState(false);
  const defaultStart = `${dateString}T09:00`;
  const defaultEnd = `${dateString}T10:00`;
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const displayDate = new Date(dateString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  async function handlePersonalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/personal-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          startsAt,
          endsAt,
          color: "emerald",
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "予定の作成に失敗しました。");
        return;
      }
      router.push("/calendar");
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGroupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          startsAt,
          endsAt,
          ...(budgetEnabled ? { createBudget } : {}),
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "イベントの作成に失敗しました。");
        return;
      }
      router.push("/calendar");
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="rounded-3xl border border-sky-200 bg-white/90 p-6 shadow-lg"
      id="add-personal"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-sky-600">
            予定を追加
          </p>
          <h2 className="text-2xl font-semibold text-zinc-900">
            {displayDate}
          </h2>
          <p className="text-sm text-zinc-500">
            投稿者: {memberName} / {groupName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/calendar")}
          className="text-sm font-semibold text-zinc-500 hover:text-zinc-700"
        >
          キャンセル
        </button>
      </div>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold text-zinc-500">登録先を選択</p>
          <div className="mt-3 space-y-2">
            {TARGETS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-sky-200"
              >
                <input
                  type="radio"
                  name="calendar-target"
                  value={option.value}
                  checked={target === option.value}
                  onChange={() => setTarget(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        {target === "group" ? (
          <form
            onSubmit={handleGroupSubmit}
            className="space-y-3 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-sky-700">
              団体イベントを追加
            </p>
            <label className="block text-sm text-zinc-600">
              タイトル
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                required
              />
            </label>
            <label className="block text-sm text-zinc-600">
              説明
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                rows={2}
              />
            </label>
            <label className="block text-sm text-zinc-600">
              場所
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
            <label className="block text-sm text-zinc-600">
              開始日時
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                required
              />
            </label>
            <label className="block text-sm text-zinc-600">
              終了日時（任意）
              <input
                type="datetime-local"
                value={endsAt ?? ""}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
            {budgetEnabled ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-900">
                      イベント別収支管理
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      このイベントの収入・支出を個別に管理します
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateBudget(!createBudget)}
                    className="ml-4"
                    aria-label={
                      createBudget ? "収支管理を無効化" : "収支管理を有効化"
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        createBudget ? "bg-sky-600" : "bg-zinc-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                          createBudget ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-sky-600 py-2 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {isSubmitting ? "登録中..." : "この内容で登録する"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handlePersonalSubmit}
            className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-emerald-700">
              プライベート予定を追加
            </p>
            <label className="block text-sm text-zinc-600">
              タイトル
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </label>
            <label className="block text-sm text-zinc-600">
              メモ
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                rows={2}
              />
            </label>
            <label className="block text-sm text-zinc-600">
              場所
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="block text-sm text-zinc-600">
              開始日時
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </label>
            <label className="block text-sm text-zinc-600">
              終了日時（任意）
              <input
                type="datetime-local"
                value={endsAt ?? ""}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-emerald-600 py-2 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {isSubmitting ? "登録中..." : "この内容で登録する"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
