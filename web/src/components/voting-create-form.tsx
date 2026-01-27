"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_OPTIONS = ["賛成", "反対", "保留"];
const OPTION_LIMIT = 10;
const OPTION_MIN = 2;

export function VotingCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function addOption() {
    if (options.length >= OPTION_LIMIT) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= OPTION_MIN) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("タイトルを入力してください。");
      return;
    }
    const normalizedOptions = options
      .map((option) => option.trim())
      .filter((option) => option.length > 0);
    if (normalizedOptions.length < OPTION_MIN) {
      setError("選択肢を2つ以上入力してください。");
      return;
    }

    let deadlinePayload: string | null = null;
    if (deadlineAt) {
      const parsed = new Date(deadlineAt);
      if (Number.isNaN(parsed.getTime())) {
        setError("締切日時を正しく入力してください。");
        return;
      }
      deadlinePayload = parsed.toISOString();
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/voting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || null,
          options: normalizedOptions.map((label) => ({ label })),
          deadlineAt: deadlinePayload,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "作成に失敗しました。");
        return;
      }
      const data = (await response.json()) as { voting: { id: number } };
      router.push(`/voting/${data.voting.id}`);
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-zinc-700">
          タイトル <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例: 次回のミーティング日程を決める"
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          disabled={pending}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-zinc-700">
          説明
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="投票の背景や判断材料など（任意）"
          rows={4}
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          disabled={pending}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-zinc-700">
          選択肢
        </label>
        <div className="mt-2 space-y-3">
          {options.map((option, index) => (
            <div key={`${index}`} className="flex gap-2">
              <input
                type="text"
                value={option}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={`選択肢 ${index + 1}`}
                className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => removeOption(index)}
                disabled={pending || options.length <= OPTION_MIN}
                className="rounded-full border border-zinc-300 px-3 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            disabled={pending || options.length >= OPTION_LIMIT}
            className="inline-flex rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            + 選択肢を追加
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-zinc-700">
          締切日時（任意）
        </label>
        <input
          type="datetime-local"
          value={deadlineAt}
          onChange={(event) => setDeadlineAt(event.target.value)}
          className="mt-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          disabled={pending}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex rounded-full bg-sky-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "公開中..." : "投票を公開する"}
      </button>
    </form>
  );
}
