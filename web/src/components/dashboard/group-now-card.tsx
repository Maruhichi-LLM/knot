import Link from "next/link";
import { DashboardCard } from "./dashboard-card";

export type GroupEventSummary = {
  id: number;
  title: string;
  dateLabel: string;
  attendanceYes: number;
  attendanceUnanswered: number;
  attendanceTotal: number;
  href: string;
};

export type AccountingStatusSummary = {
  label: string;
  detail?: string;
  tone: "good" | "warn" | "bad";
  icon: string;
};

export type AnnouncementPreview = {
  id: number;
  title: string;
  updatedLabel: string;
  href: string;
};

type Props = {
  nextEvent: GroupEventSummary | null;
  accounting: AccountingStatusSummary;
  announcement: AnnouncementPreview | null;
};

const accountingToneStyles = {
  good: "text-emerald-700 bg-emerald-50",
  warn: "text-amber-700 bg-amber-50",
  bad: "text-rose-700 bg-rose-50",
} as const;

export function GroupNowCard({ nextEvent, accounting, announcement }: Props) {
  return (
    <DashboardCard title="団体の今" actionHref="/events">
      <NextEventSummary nextEvent={nextEvent} />
      <AccountingStatusSummaryView status={accounting} />
      <PinnedAnnouncementPreview announcement={announcement} />
    </DashboardCard>
  );
}

export function NextEventSummary({
  nextEvent,
}: {
  nextEvent: GroupEventSummary | null;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">次のイベント概要</h3>
        <Link
          href="/events"
          className="text-xs font-semibold text-sky-600 hover:text-sky-500"
        >
          イベント一覧へ
        </Link>
      </div>
      <div className="mt-3">
        {!nextEvent ? (
          <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
            <p>直近のイベントはありません</p>
            <Link
              href="/events"
              className="mt-2 inline-flex text-xs font-semibold text-sky-600 hover:text-sky-500"
            >
              イベントを作成 →
            </Link>
          </div>
        ) : (
          <Link
            href={nextEvent.href}
            className="block rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm transition hover:border-sky-200 hover:bg-sky-50"
          >
            <p className="text-xs text-zinc-500">{nextEvent.dateLabel}</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">
              {nextEvent.title}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
              <span className="rounded-full bg-white px-2 py-0.5 font-semibold">
                参加 {nextEvent.attendanceYes}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 font-semibold">
                未回答 {nextEvent.attendanceUnanswered}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 font-semibold">
                全体 {nextEvent.attendanceTotal}
              </span>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}

export function AccountingStatusSummaryView({
  status,
}: {
  status: AccountingStatusSummary;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">会計ステータス</h3>
        <Link
          href="/accounting"
          className="text-xs font-semibold text-sky-600 hover:text-sky-500"
        >
          会計へ
        </Link>
      </div>
      <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${accountingToneStyles[status.tone]}`}
          >
            {status.icon} {status.label}
          </span>
          {status.detail ? (
            <span className="text-xs text-zinc-500">{status.detail}</span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          金額の内訳は会計モジュールで確認してください。
        </p>
      </div>
    </section>
  );
}

export function PinnedAnnouncementPreview({
  announcement,
}: {
  announcement: AnnouncementPreview | null;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">お知らせ</h3>
        <Link
          href="/documents"
          className="text-xs font-semibold text-sky-600 hover:text-sky-500"
        >
          お知らせを見る
        </Link>
      </div>
      <div className="mt-3">
        {announcement ? (
          <Link
            href={announcement.href}
            className="block rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm transition hover:border-sky-200 hover:bg-sky-50"
          >
            <p className="text-xs text-zinc-500">{announcement.updatedLabel}</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">
              {announcement.title}
            </p>
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
            <p>お知らせはありません</p>
            <Link
              href="/documents"
              className="mt-2 inline-flex text-xs font-semibold text-sky-600 hover:text-sky-500"
            >
              お知らせを投稿 →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
