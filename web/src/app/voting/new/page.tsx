import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";
import { VotingAnonymousBanner } from "@/components/voting-anonymous-banner";
import { VotingCreateForm } from "@/components/voting-create-form";

export default async function VotingNewPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  await ensureModuleEnabled(session.groupId, "voting");

  return (
    <div className="min-h-screen py-10">
      <div className="page-shell space-y-8">
        <header className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Knot Voting
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            みんなの意思を集めて、結論を“見える化”します。
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            匿名投票です。誰がどれを選んだかは表示されません。
          </p>
        </header>

        <VotingAnonymousBanner />

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <VotingCreateForm />
        </section>
      </div>
    </div>
  );
}
