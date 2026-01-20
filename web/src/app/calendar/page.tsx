import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";

export default async function CalendarPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }

  await ensureModuleEnabled(session.groupId, "calendar");

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Knot Calendar
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            ここで予定がつながります
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            月間ビューや共有体験は現在準備中です。今は Knot Event で行事を登録し、
            参加状況を管理できます。
          </p>
          <Link
            href="/events"
            className="mt-4 inline-flex text-sm text-sky-600 underline"
          >
            ← Knot Event へ
          </Link>
        </header>

        <section className="min-h-[60vh] rounded-2xl border border-dashed border-zinc-200 bg-white/80 p-8 text-center shadow-sm">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Placeholder
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-zinc-900">
            Knot Calendar is coming soon.
          </h2>
          <p className="mt-4 text-sm text-zinc-600">
            行事の月間ビューやメンバーの予定共有を順次追加予定です。必要なモジュールだけを
            結びながら、いつでも切り替えられる設計にしていきます。
          </p>
        </section>
      </div>
    </div>
  );
}
