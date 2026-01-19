"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { EventForm } from "./event-form";

export type EventAttendanceDisplay = {
  eventId: number;
  memberId: number;
  memberName: string;
  status: "YES" | "NO" | "MAYBE";
  comment: string | null;
  respondedAt: string;
};

export type EventDisplay = {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  attendances: EventAttendanceDisplay[];
};

type Props = {
  events: EventDisplay[];
  memberId: number;
  canEdit?: boolean;
};

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

const statusLabels = {
  YES: "参加",
  MAYBE: "未定",
  NO: "不参加",
};

const statusSections: Array<{
  key: "YES" | "MAYBE" | "NO";
  label: string;
  accent: string;
  pill: string;
}> = [
  {
    key: "YES",
    label: "参加",
    accent: "text-emerald-700",
    pill: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "MAYBE",
    label: "未定",
    accent: "text-amber-700",
    pill: "bg-amber-50 text-amber-700",
  },
  {
    key: "NO",
    label: "不参加",
    accent: "text-rose-700",
    pill: "bg-rose-50 text-rose-700",
  },
];

export function EventList({ events, memberId, canEdit = false }: Props) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        予定されているイベントはありません。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          memberId={memberId}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}

type EventCardProps = {
  event: EventDisplay;
  memberId: number;
  canEdit: boolean;
};

function EventCard({ event, memberId, canEdit }: EventCardProps) {
  const router = useRouter();
  const existing = event.attendances.find((item) => item.memberId === memberId);
  const [status, setStatus] = useState<"YES" | "NO" | "MAYBE">(
    existing?.status ?? "MAYBE"
  );
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setStatus(existing?.status ?? "MAYBE");
    setComment(existing?.comment ?? "");
  }, [existing?.status, existing?.comment]);

  async function handleSubmit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${event.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "更新に失敗しました。");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  const counts = event.attendances.reduce(
    (acc, attendance) => {
      acc[attendance.status] += 1;
      return acc;
    },
    { YES: 0, NO: 0, MAYBE: 0 }
  );

  const attendancesByStatus = event.attendances.reduce(
    (acc, attendance) => {
      acc[attendance.status].push(attendance);
      return acc;
    },
    {
      YES: [] as EventAttendanceDisplay[],
      MAYBE: [] as EventAttendanceDisplay[],
      NO: [] as EventAttendanceDisplay[],
    }
  );

  return (
    <article
      id={`event-${event.id}`}
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            {formatter.format(new Date(event.startsAt))}
            {event.endsAt
              ? ` 〜 ${formatter.format(new Date(event.endsAt))}`
              : ""}
          </p>
          <h3 className="text-2xl font-semibold text-zinc-900">{event.title}</h3>
          {event.location ? (
            <p className="text-sm text-zinc-500">場所: {event.location}</p>
          ) : null}
        </div>
        <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
          <p>参加: {counts.YES}</p>
          <p>未定: {counts.MAYBE}</p>
          <p>不参加: {counts.NO}</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            {isEditing ? "編集を閉じる" : "編集"}
          </button>
        ) : null}
      </div>
      {event.description ? (
        <p className="mt-3 text-sm text-zinc-600">{event.description}</p>
      ) : null}

      {isEditing ? (
        <div className="mt-4">
          <EventForm
            mode="edit"
            event={event}
            onClose={() => setIsEditing(false)}
          />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {(Object.keys(statusLabels) as Array<"YES" | "NO" | "MAYBE">).map(
            (value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                  status === value
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-zinc-300 text-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  className="hidden"
                  checked={status === value}
                  onChange={() => setStatus(value)}
                />
                {statusLabels[value]}
              </label>
            )
          )}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="備考（任意）"
          rows={2}
        />
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-sky-600 py-2 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          {isSubmitting ? "送信中..." : "出欠を送信"}
        </button>
      </form>

      <div className="mt-4 rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-zinc-800">参加状況リスト</p>
          <p className="text-sm text-zinc-500">
            回答者 {event.attendances.length} 名
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {statusSections.map(({ key, label, accent, pill }) => (
            <section
              key={key}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <p className={`text-sm font-semibold ${accent}`}>{label}</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${pill}`}
                >
                  {counts[key]}名
                </span>
              </div>
              {attendancesByStatus[key].length > 0 ? (
                <ul className="mt-3 space-y-3 text-sm text-zinc-600">
                  {attendancesByStatus[key].map((attendance) => (
                    <li
                      key={`${attendance.eventId}-${attendance.memberId}`}
                      className="rounded-lg bg-zinc-50 p-3"
                    >
                      <p className="font-medium text-zinc-900">
                        {attendance.memberName}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatter.format(new Date(attendance.respondedAt))}
                        {attendance.comment
                          ? `｜${attendance.comment}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">まだ回答はありません。</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
