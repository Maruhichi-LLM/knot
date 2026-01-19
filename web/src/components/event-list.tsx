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
  const [currentStatus, setCurrentStatus] = useState<"YES" | "NO" | "MAYBE">(
    existing?.status ?? "MAYBE"
  );
  const [currentComment, setCurrentComment] = useState(existing?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"YES" | "NO" | "MAYBE" | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    setCurrentStatus(existing?.status ?? "MAYBE");
    setCurrentComment(existing?.comment ?? "");
  }, [existing?.status, existing?.comment]);

  function openDialog(nextStatus: "YES" | "NO" | "MAYBE") {
    setPendingStatus(nextStatus);
    setCommentDraft(existing?.comment ?? "");
    setError(null);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setPendingStatus(null);
  }

  async function handleSubmit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!pendingStatus) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${event.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pendingStatus, comment: commentDraft }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "更新に失敗しました。");
        return;
      }
      setCurrentStatus(pendingStatus);
      setCurrentComment(commentDraft);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
      closeDialog();
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

      <div className="mt-4 space-y-3">
        <p className="text-sm text-zinc-500">参加状況を選択してください</p>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(statusLabels) as Array<"YES" | "NO" | "MAYBE">).map(
            (value) => (
              <button
                key={value}
                type="button"
                onClick={() => openDialog(value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  currentStatus === value
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-zinc-300 text-zinc-600 hover:border-sky-200 hover:text-sky-600"
                }`}
              >
                {statusLabels[value]}
              </button>
            )
          )}
        </div>
        {currentComment ? (
          <p className="text-sm text-zinc-600">
            最新のコメント: <span className="text-zinc-900">{currentComment}</span>
          </p>
        ) : (
          <p className="text-sm text-zinc-500">コメントは未入力です。</p>
        )}
      </div>

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

      {isDialogOpen && pendingStatus ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <p className="text-sm text-zinc-500">参加状況を更新します</p>
            <h3 className="mt-1 text-2xl font-semibold text-zinc-900">
              {statusLabels[pendingStatus]}
            </h3>
            <label className="mt-4 block text-sm text-zinc-600">
              コメント（任意）
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
            {error ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {isSubmitting ? "送信中..." : "更新する"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </article>
  );
}
