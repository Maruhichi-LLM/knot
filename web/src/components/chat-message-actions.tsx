"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type ConversionTarget = "todo" | "accounting" | "document";

const ACTION_LABELS: Record<ConversionTarget, string> = {
  todo: "ToDoに変換",
  accounting: "会計の下書きに変換",
  document: "議事録として保存",
};

const RESULT_LABELS: Record<ConversionTarget, string> = {
  todo: "ToDo",
  accounting: "会計下書き",
  document: "議事録",
};

const ENDPOINTS: Record<ConversionTarget, string> = {
  todo: "/api/chat/convert/todo",
  accounting: "/api/chat/convert/accounting-draft",
  document: "/api/chat/convert/meeting-note",
};

type Props = {
  messageId: number;
  convertedTargets: Record<ConversionTarget, boolean>;
  menuAlign?: "left" | "right";
};

type ConversionResponse = {
  target: ConversionTarget;
  status: "created" | "exists";
  url?: string;
};

export function ChatMessageActions({
  messageId,
  convertedTargets,
  menuAlign = "right",
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState<ConversionTarget | null>(null);
  const [feedback, setFeedback] = useState<ConversionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState(convertedTargets);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [menuOpen]);

  const triggerConversion = useCallback(
    async (target: ConversionTarget) => {
      setPending(target);
      setError(null);
      setFeedback(null);
      try {
        const endpoint = ENDPOINTS[target];
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatMessageId: messageId }),
        });
        const data = (await response.json().catch(() => ({}))) as
          | ConversionResponse
          | { error?: string };
        if (!response.ok || !data || "error" in data || !data.target) {
          setError(
            "error" in data && data.error
              ? data.error
              : "変換に失敗しました。"
          );
          return;
        }
        setState((prev) => ({ ...prev, [target]: true }));
        setFeedback(data);
      } catch {
        setError("通信エラーが発生しました。");
      } finally {
        setPending(null);
        setMenuOpen(false);
      }
    },
    [messageId]
  );

  const alignRight = menuAlign === "right";

  return (
    <div
      className={`flex flex-col gap-2 text-xs text-zinc-600 ${
        alignRight ? "items-end" : "items-start"
      }`}
    >
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          className="rounded-full border border-zinc-200 px-2 py-1 text-base leading-none text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          ︙
        </button>
        {menuOpen ? (
          <div
            className={`absolute top-1/2 z-10 w-48 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-2 text-sm shadow-lg ${
              alignRight ? "right-full mr-3" : "left-full ml-3"
            }`}
          >
            {(
              Object.keys(ACTION_LABELS) as Array<ConversionTarget>
            ).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => triggerConversion(target)}
                disabled={state[target] || pending !== null}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                  state[target]
                    ? "text-zinc-400"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span>{ACTION_LABELS[target]}</span>
                {state[target] ? (
                  <span className="text-xs">済</span>
                ) : pending === target ? (
                  <span className="text-xs text-sky-600">処理中</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {feedback ? (
        <p className="text-xs text-emerald-700">
          {RESULT_LABELS[feedback.target]}
          {feedback.status === "exists" ? "は既に作成済みです。" : "を作成しました。"}
          {feedback.url ? (
            <>
              {" "}
              <Link href={feedback.url} className="underline">
                開く
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
