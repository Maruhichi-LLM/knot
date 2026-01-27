"use client";

import { FormEvent, useState, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: number;
  displayName: string;
};

type Props = {
  threadId: string | number;
  members: Member[];
};

export function ChatInput({ threadId, members }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // フィルターされたメンバーリスト
  const filteredMembers = mentionQuery
    ? members.filter((m) =>
        m.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : members;

  // メンション候補を選択時
  function selectMention(member: Member) {
    if (mentionStartPos === null) return;
    const before = body.slice(0, mentionStartPos);
    const after = body.slice(textareaRef.current?.selectionStart ?? body.length);
    const newBody = `${before}@${member.displayName} ${after}`;
    setBody(newBody);
    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionStartPos(null);
    setSelectedMentionIndex(0);
    // フォーカスを戻す
    setTimeout(() => {
      textareaRef.current?.focus();
      const newPos = mentionStartPos + member.displayName.length + 2;
      textareaRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  }

  // テキスト変更時
  function handleTextChange(value: string) {
    setBody(value);
    const cursorPos = textareaRef.current?.selectionStart ?? 0;

    // @ を検出
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // @の後にスペースや改行がないかチェック
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
        return;
      }
    }

    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionStartPos(null);
  }

  // キーボード操作
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!showMentionDropdown) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedMentionIndex((prev) =>
        prev < filteredMembers.length - 1 ? prev + 1 : prev
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (event.key === "Enter") {
      if (filteredMembers.length > 0) {
        event.preventDefault();
        selectMention(filteredMembers[selectedMentionIndex]);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setShowMentionDropdown(false);
      setMentionQuery("");
      setMentionStartPos(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) {
      setError("メッセージを入力してください。");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "送信に失敗しました。");
        return;
      }
      setBody("");
      setShowMentionDropdown(false);
      setMentionQuery("");
      setMentionStartPos(null);
      router.refresh();
    } catch {
      setError("送信時にエラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          rows={3}
          placeholder="ここに意思決定につながるメッセージを残しましょう。@でメンバーにメンション"
          value={body}
          onChange={(event) => handleTextChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={pending}
        />

        {/* メンション候補ドロップダウン */}
        {showMentionDropdown && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 max-h-48 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
            {filteredMembers.map((member, index) => (
              <button
                key={member.id}
                type="button"
                onClick={() => selectMention(member)}
                className={`w-full px-4 py-2 text-left text-sm transition hover:bg-sky-50 ${
                  index === selectedMentionIndex
                    ? "bg-sky-100 text-sky-900"
                    : "text-zinc-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                    {member.displayName.charAt(0)}
                  </div>
                  <span className="font-medium">{member.displayName}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          {pending ? "送信中…" : "送信"}
        </button>
      </div>
    </form>
  );
}
