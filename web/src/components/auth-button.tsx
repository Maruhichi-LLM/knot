"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  emitAuthChange,
  subscribeAuthChange,
} from "@/lib/auth-events";

type Props = {
  initialSession: boolean;
};

export function AuthButton({ initialSession }: Props) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(initialSession);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoggedIn(initialSession);
  }, [initialSession]);

  useEffect(() => {
    const unsubscribe = subscribeAuthChange((detail) => {
      if (typeof detail?.authenticated === "boolean") {
        setIsLoggedIn(detail.authenticated);
      }
    });
    return unsubscribe;
  }, []);

  async function handleLogout() {
    setIsLoading(true);
    try {
      emitAuthChange(false);
      await fetch("/api/logout", { method: "POST" });
      router.replace("/join");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <button
        type="button"
        onClick={() => router.push("/login")}
        className="min-w-[120px] rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-700 text-center transition hover:bg-zinc-50"
      >
        ログイン
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="min-w-[120px] rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-700 text-center transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
