"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  votingId: number;
};

export function VotingCommentForm({ votingId }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) {
      setError("コメントを入力してください。");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/voting/${votingId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "コメントに失敗しました。");
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">
        匿名コメント（任意）
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        コメントは匿名で投稿されます。
        個人が特定される情報は書かないでください。
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={`例）賛成だけど、予算面が少し不安です\n例）反対。日程が合わない人が多いと思います`}
          rows={4}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          disabled={pending}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "送信中..." : "匿名でコメントする"}
        </button>
      </form>
    </section>
  );
}
