"use client";

import { LoginCard } from "@/components/login-card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-md">
        <LoginCard />
      </div>
    </div>
  );
}
