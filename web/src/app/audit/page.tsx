import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AuditStatus,
  AuditType,
  AuditFindingCategory,
  AuditFindingSeverity,
  AuditFindingStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";
import { ROLE_ADMIN, ROLE_AUDITOR } from "@/lib/roles";

const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  FINANCIAL: "会計監査",
  ACTIVITY: "活動監査",
};

const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  PLANNED: "計画中",
  IN_PROGRESS: "実施中",
  COMPLETED: "完了",
};

const AUDIT_STATUS_STYLES: Record<AuditStatus, string> = {
  PLANNED: "bg-zinc-100 text-zinc-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

const FINDING_CATEGORY_LABELS: Record<AuditFindingCategory, string> = {
  ISSUE: "指摘",
  SUGGESTION: "提案",
  OBSERVATION: "所見",
};

const FINDING_SEVERITY_LABELS: Record<AuditFindingSeverity, string> = {
  HIGH: "重大",
  MEDIUM: "警戒",
  LOW: "注意",
};

const FINDING_STATUS_LABELS: Record<AuditFindingStatus, string> = {
  OPEN: "未対応",
  IN_PROGRESS: "対応中",
  RESOLVED: "完了",
};

function resolveFiscalYearDates(fiscalYear: number, startMonth: number) {
  const startDate = new Date(fiscalYear, startMonth - 1, 1);
  const endMonth = ((startMonth + 10) % 12) + 1;
  const endYear = endMonth < startMonth ? fiscalYear + 1 : fiscalYear;
  const endDate = new Date(endYear, endMonth, 0);
  return { startDate, endDate };
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchAuditPageData(groupId: number, memberId: number) {
  const [member, audits, auditLogs, group] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, role: true, displayName: true },
    }),
    prisma.audit.findMany({
      where: { groupId },
      include: {
        auditor: { select: { id: true, displayName: true } },
        findings: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { groupId },
      include: { member: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.group.findUnique({
      where: { id: groupId },
      select: { fiscalYearStartMonth: true },
    }),
  ]);

  const auditsSerialized = audits.map((audit) => ({
    ...audit,
    startDate: audit.startDate.toISOString(),
    endDate: audit.endDate.toISOString(),
    completedAt: audit.completedAt?.toISOString() ?? null,
    createdAt: audit.createdAt.toISOString(),
    updatedAt: audit.updatedAt.toISOString(),
    findings: audit.findings.map((finding) => ({
      ...finding,
      createdAt: finding.createdAt.toISOString(),
      updatedAt: finding.updatedAt.toISOString(),
    })),
  }));

  const logsSerialized = auditLogs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
  }));

  return {
    member,
    audits: auditsSerialized,
    auditLogs: logsSerialized,
    fiscalYearStartMonth: group?.fiscalYearStartMonth ?? 4,
  };
}

async function requireAuditManagerSession() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  await ensureModuleEnabled(session.groupId, "audit");
  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
  });
  if (
    !member ||
    (member.role !== ROLE_ADMIN && member.role !== ROLE_AUDITOR)
  ) {
    throw new Error("監査権限がありません。");
  }
  return { session, member };
}

async function recordAuditLog({
  groupId,
  memberId,
  action,
  targetType,
  targetId,
  previousValue,
  newValue,
}: {
  groupId: number;
  memberId: number;
  action: string;
  targetType: string;
  targetId?: number;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      groupId,
      memberId,
      action,
      targetType,
      targetId,
      previousValue,
      newValue,
    },
  });
}

export async function createAuditAction(formData: FormData) {
  "use server";
  const { session, member } = await requireAuditManagerSession();
  const typeInput = formData.get("type") as AuditType | null;
  const fiscalYear = Number(formData.get("fiscalYear"));
  const startDateInput = formData.get("startDate") as string | null;
  const endDateInput = formData.get("endDate") as string | null;

  if (!typeInput || !(typeInput in AUDIT_TYPE_LABELS)) {
    throw new Error("監査種別を選択してください。");
  }
  if (!Number.isInteger(fiscalYear)) {
    throw new Error("対象年度を入力してください。");
  }

  const group = await prisma.group.findUnique({
    where: { id: session.groupId },
    select: { fiscalYearStartMonth: true },
  });
  const fiscalYearStartMonth = group?.fiscalYearStartMonth ?? 4;
  const { startDate: fiscalStartDate, endDate: fiscalEndDate } =
    resolveFiscalYearDates(fiscalYear, fiscalYearStartMonth);

  const startDateValue = startDateInput
    ? new Date(startDateInput)
    : fiscalStartDate;
  const endDateValue = endDateInput
    ? new Date(endDateInput)
    : fiscalEndDate;

  const audit = await prisma.audit.create({
    data: {
      groupId: session.groupId,
      auditorId: member.id,
      type: typeInput,
      fiscalYear,
      startDate: startDateValue,
      endDate: endDateValue,
    },
  });

  await recordAuditLog({
    groupId: session.groupId,
    memberId: member.id,
    action: "CREATE_AUDIT",
    targetType: "Audit",
    targetId: audit.id,
    newValue: {
      id: audit.id,
      type: audit.type,
      fiscalYear: audit.fiscalYear,
    },
  });

  revalidatePath("/audit");
}

export async function addFindingAction(formData: FormData) {
  "use server";
  const { session, member } = await requireAuditManagerSession();
  const auditId = Number(formData.get("auditId"));
  const category = formData.get("category") as AuditFindingCategory | null;
  const severity = formData.get("severity") as AuditFindingSeverity | null;
  const description = (formData.get("description") as string | null)?.trim();
  const relatedRecordType = (formData.get("relatedRecordType") as string | null)?.trim();
  const relatedRecordIdInput = formData.get("relatedRecordId") as string | null;
  const recommendation = (formData.get("recommendation") as string | null)?.trim();

  if (!Number.isInteger(auditId)) {
    throw new Error("監査を選択してください。");
  }
  if (!category || !(category in FINDING_CATEGORY_LABELS)) {
    throw new Error("区分を選択してください。");
  }
  if (!severity || !(severity in FINDING_SEVERITY_LABELS)) {
    throw new Error("重要度を選択してください。");
  }
  if (!description) {
    throw new Error("指摘内容を入力してください。");
  }

  const relatedRecordIdRaw =
    relatedRecordIdInput && relatedRecordIdInput.trim().length > 0
      ? Number(relatedRecordIdInput)
      : null;
  const relatedRecordId =
    typeof relatedRecordIdRaw === "number" && Number.isFinite(relatedRecordIdRaw)
      ? relatedRecordIdRaw
      : null;

  const finding = await prisma.auditFinding.create({
    data: {
      auditId,
      category,
      severity,
      description,
      relatedRecordType: relatedRecordType || null,
      relatedRecordId,
      recommendation: recommendation || null,
    },
  });

  await recordAuditLog({
    groupId: session.groupId,
    memberId: member.id,
    action: "ADD_FINDING",
    targetType: "AuditFinding",
    targetId: finding.id,
    newValue: {
      auditId,
      category,
      severity,
    },
  });

  revalidatePath("/audit");
}

export async function updateFindingStatusAction(formData: FormData) {
  "use server";
  const { session, member } = await requireAuditManagerSession();
  const findingId = Number(formData.get("findingId"));
  const status = formData.get("status") as AuditFindingStatus | null;

  if (!Number.isInteger(findingId)) {
    throw new Error("指摘を特定できません。");
  }
  if (!status || !(status in FINDING_STATUS_LABELS)) {
    throw new Error("対応状況を選択してください。");
  }

  const previous = await prisma.auditFinding.findUnique({
    where: { id: findingId },
    select: { status: true, auditId: true },
  });
  if (!previous) {
    throw new Error("指摘が見つかりません。");
  }

  await prisma.auditFinding.update({
    where: { id: findingId },
    data: { status },
  });

  await recordAuditLog({
    groupId: session.groupId,
    memberId: member.id,
    action: "UPDATE_FINDING_STATUS",
    targetType: "AuditFinding",
    targetId: findingId,
    previousValue: { status: previous.status },
    newValue: { status },
  });

  revalidatePath("/audit");
}

export async function updateAuditStatusAction(formData: FormData) {
  "use server";
  const { session, member } = await requireAuditManagerSession();
  const auditId = Number(formData.get("auditId"));
  const status = formData.get("status") as AuditStatus | null;

  if (!Number.isInteger(auditId)) {
    throw new Error("監査を特定できません。");
  }
  if (!status || !(status in AUDIT_STATUS_LABELS)) {
    throw new Error("ステータスを選択してください。");
  }

  const previous = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { status: true },
  });
  if (!previous) {
    throw new Error("監査が見つかりません。");
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  await recordAuditLog({
    groupId: session.groupId,
    memberId: member.id,
    action: "UPDATE_AUDIT_STATUS",
    targetType: "Audit",
    targetId: auditId,
    previousValue: { status: previous.status },
    newValue: { status },
  });

  revalidatePath("/audit");
}

export async function saveAuditReportAction(formData: FormData) {
  "use server";
  const { session, member } = await requireAuditManagerSession();
  const auditId = Number(formData.get("auditId"));
  const report = (formData.get("report") as string | null)?.trim() ?? null;

  if (!Number.isInteger(auditId)) {
    throw new Error("監査を特定できません。");
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: { report: report && report.length > 0 ? report : null },
  });

  await recordAuditLog({
    groupId: session.groupId,
    memberId: member.id,
    action: "SAVE_AUDIT_REPORT",
    targetType: "Audit",
    targetId: auditId,
  });

  revalidatePath("/audit");
}

export default async function AuditPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  await ensureModuleEnabled(session.groupId, "audit");

  const { member, audits, auditLogs, fiscalYearStartMonth } =
    await fetchAuditPageData(
      session.groupId,
      session.memberId
    );
  if (!member) {
    redirect("/join");
  }

  const canManage =
    member.role === ROLE_ADMIN || member.role === ROLE_AUDITOR;

  const totalAudits = audits.length;
  const openAudits = audits.filter(
    (audit) => audit.status !== "COMPLETED"
  ).length;
  const totalFindings = audits.reduce(
    (sum, audit) => sum + audit.findings.length,
    0
  );
  const openFindings = audits.reduce(
    (sum, audit) =>
      sum +
      audit.findings.filter(
        (finding) => finding.status !== "RESOLVED"
      ).length,
    0
  );

  const defaultFiscalYear = new Date().getFullYear();
  const { startDate: defaultStartDate, endDate: defaultEndDate } =
    resolveFiscalYearDates(defaultFiscalYear, fiscalYearStartMonth);
  const defaultStartDateString = formatDateInput(defaultStartDate);
  const defaultEndDateString = formatDateInput(defaultEndDate);

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "—";
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
    }).format(new Date(value));
  };

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  return (
    <div className="min-h-screen py-10">
      <div className="page-shell space-y-8">
        <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Knot Audit
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-900">
            監査ハブ
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            会計と活動の監査を計画・管理し、指摘事項やレポートを一元化します。
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <p className="text-xs text-zinc-500">今年度監査</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">
                {totalAudits}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <p className="text-xs text-sky-600">進行中</p>
              <p className="mt-2 text-2xl font-semibold text-sky-900">
                {openAudits}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs text-amber-700">指摘数</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">
                {totalFindings}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-xs text-rose-600">未解決指摘</p>
              <p className="mt-2 text-2xl font-semibold text-rose-900">
                {openFindings}
              </p>
            </div>
          </div>
        </header>

        {canManage ? (
          <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">
              新しい監査を計画
            </h2>
            <form
              action={createAuditAction}
              className="mt-4 grid gap-4 lg:grid-cols-4 sm:grid-cols-2"
            >
              <label className="text-sm text-zinc-600">
                種別
                <select
                  name="type"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                >
                  {Object.entries(AUDIT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-zinc-600">
                対象年度
                <input
                  type="number"
                  name="fiscalYear"
                  defaultValue={new Date().getFullYear()}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </label>
                <label className="text-sm text-zinc-600">
                  期首
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={defaultStartDateString}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm text-zinc-600">
                  期末
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={defaultEndDateString}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </label>
              <div className="lg:col-span-4">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  監査を登録
                </button>
              </div>
            </form>
          </section>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            監査役または管理者のみが監査の登録・更新を実行できます。閲覧は全メンバーが可能です。
          </p>
        )}

        <section className="space-y-6">
          {audits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-sm text-zinc-500">
              まだ監査は登録されていません。
            </div>
          ) : (
            audits.map((audit) => (
              <article
                key={audit.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      {AUDIT_TYPE_LABELS[audit.type]}
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold text-zinc-900">
                      {audit.fiscalYear}年度 監査
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      期間: {formatDate(audit.startDate)} 〜{" "}
                      {formatDate(audit.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      担当: {audit.auditor.displayName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        AUDIT_STATUS_STYLES[audit.status]
                      }`}
                    >
                      {AUDIT_STATUS_LABELS[audit.status]}
                    </span>
                    {canManage ? (
                      <form
                        action={updateAuditStatusAction}
                        className="flex items-center gap-2 text-xs"
                      >
                        <input
                          type="hidden"
                          name="auditId"
                          value={audit.id}
                        />
                        <select
                          name="status"
                          defaultValue={audit.status}
                          className="rounded-lg border border-zinc-200 px-2 py-1"
                        >
                          {Object.entries(AUDIT_STATUS_LABELS).map(
                            ([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 transition hover:border-sky-400 hover:text-sky-600"
                        >
                          更新
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <h4 className="text-sm font-semibold text-zinc-800">
                      指摘事項
                    </h4>
                    {audit.findings.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-500">
                        まだ指摘は登録されていません。
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {audit.findings.map((finding) => (
                          <li
                            key={finding.id}
                            className="rounded-lg border border-zinc-200 bg-white p-3 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                                {FINDING_CATEGORY_LABELS[finding.category]}
                              </span>
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
                                {FINDING_SEVERITY_LABELS[finding.severity]}
                              </span>
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                                {FINDING_STATUS_LABELS[finding.status]}
                              </span>
                            </div>
                            <p className="mt-2 text-zinc-800">
                              {finding.description}
                            </p>
                            {finding.recommendation ? (
                              <p className="mt-2 text-xs text-emerald-700">
                                提案: {finding.recommendation}
                              </p>
                            ) : null}
                            {finding.relatedRecordType ? (
                              <p className="mt-1 text-xs text-zinc-500">
                                関連: {finding.relatedRecordType}#
                                {finding.relatedRecordId ?? "N/A"}
                              </p>
                            ) : null}
                            {canManage ? (
                              <form
                                action={updateFindingStatusAction}
                                className="mt-2 flex items-center gap-2 text-xs"
                              >
                                <input
                                  type="hidden"
                                  name="findingId"
                                  value={finding.id}
                                />
                                <select
                                  name="status"
                                  defaultValue={finding.status}
                                  className="rounded-lg border border-zinc-200 px-2 py-1"
                                >
                                  {Object.entries(FINDING_STATUS_LABELS).map(
                                    ([key, label]) => (
                                      <option key={key} value={key}>
                                        {label}
                                      </option>
                                    )
                                  )}
                                </select>
                                <button
                                  type="submit"
                                  className="rounded-lg border border-zinc-200 px-3 py-1 font-semibold text-zinc-600 transition hover:border-sky-400 hover:text-sky-600"
                                >
                                  反映
                                </button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {canManage ? (
                      <form
                        action={addFindingAction}
                        className="mt-4 space-y-2 rounded-lg border border-dashed border-zinc-300 bg-white/70 p-3 text-sm"
                      >
                        <input type="hidden" name="auditId" value={audit.id} />
                        <div className="flex flex-wrap gap-2">
                          <select
                            name="category"
                            className="flex-1 rounded-lg border border-zinc-300 px-2 py-1"
                          >
                            {Object.entries(FINDING_CATEGORY_LABELS).map(
                              ([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>
                          <select
                            name="severity"
                            className="rounded-lg border border-zinc-300 px-2 py-1"
                          >
                            {Object.entries(FINDING_SEVERITY_LABELS).map(
                              ([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                        <textarea
                          name="description"
                          rows={2}
                          placeholder="指摘内容"
                          className="w-full rounded-lg border border-zinc-300 px-2 py-1"
                        />
                        <input
                          type="text"
                          name="recommendation"
                          placeholder="改善提案 (任意)"
                          className="w-full rounded-lg border border-zinc-300 px-2 py-1"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            name="relatedRecordType"
                            placeholder="関連モジュール"
                            className="flex-1 rounded-lg border border-zinc-300 px-2 py-1"
                          />
                          <input
                            type="number"
                            name="relatedRecordId"
                            placeholder="ID"
                            className="w-24 rounded-lg border border-zinc-300 px-2 py-1"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-zinc-900 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700"
                        >
                          指摘を追加
                        </button>
                      </form>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <h4 className="text-sm font-semibold text-zinc-800">
                      監査レポート
                    </h4>
                    {canManage ? (
                      <form
                        action={saveAuditReportAction}
                        className="mt-3 space-y-2"
                      >
                        <input type="hidden" name="auditId" value={audit.id} />
                        <textarea
                          name="report"
                          rows={6}
                          defaultValue={audit.report ?? ""}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                          placeholder="監査結果報告や改善提案、フォローアップをここにまとめます。"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-sky-400 hover:text-sky-600"
                        >
                          レポートを保存
                        </button>
                      </form>
                    ) : (
                      <p className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
                        {audit.report
                          ? audit.report
                          : "監査レポートはまだ記入されていません。"}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            監査ログ
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            直近50件の監査操作ログ。監査役はこの記録を利用して監査証跡を保持できます。
          </p>
          {auditLogs.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
              ログはまだありません。
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 text-left">日時</th>
                    <th className="px-4 py-2 text-left">実行者</th>
                    <th className="px-4 py-2 text-left">アクション</th>
                    <th className="px-4 py-2 text-left">対象</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-t border-zinc-100">
                      <td className="px-4 py-2 text-zinc-600">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-2 text-zinc-800">
                        {log.member?.displayName ?? "システム"}
                      </td>
                      <td className="px-4 py-2 text-zinc-800">
                        {log.action}
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        {log.targetType}
                        {log.targetId ? ` #${log.targetId}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
