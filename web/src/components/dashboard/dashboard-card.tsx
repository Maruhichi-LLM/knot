import Link from "next/link";

type Props = {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
};

export function DashboardCard({
  title,
  actionHref,
  actionLabel = "開く",
  children,
}: Props) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        {actionHref ? (
          <Link
            href={actionHref}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-sky-200 hover:text-sky-700"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-4 space-y-6">{children}</div>
    </section>
  );
}
