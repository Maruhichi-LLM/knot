import {
  AuditTargetType,
  InternalControlRule,
  InternalControlRuleType,
  InternalControlSeverity,
  LedgerStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type InternalControlItem = {
  targetType: AuditTargetType;
  targetId: number;
  summary: string;
  links?: { href: string; label: string }[];
};

export type InternalControlResult = {
  ruleId: number;
  ruleType: InternalControlRuleType;
  severity: InternalControlSeverity;
  name: string;
  description?: string | null;
  items: InternalControlItem[];
};

const DEFAULT_LOOKBACK_DAYS = 90;
const MIN_LOOKBACK_DAYS = 7;
const MAX_LOOKBACK_DAYS = 365;
const MAX_ITEMS_PER_RULE = 50;
const MAX_APPROVAL_ROWS = 200;

export async function runInternalControlChecks(groupId: number) {
  const rules = await prisma.internalControlRule.findMany({
    where: { groupId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const results: InternalControlResult[] = [];

  for (const rule of rules) {
    const detector = DETECTORS[rule.ruleType];
    if (!detector) continue;
    const items = await detector(groupId, rule);
    if (items.length === 0) continue;
    results.push({
      ruleId: rule.id,
      ruleType: rule.ruleType,
      severity: rule.severity,
      name: rule.name,
      description: rule.description,
      items,
    });
  }

  return results;
}

type DetectorFn = (
  groupId: number,
  rule: InternalControlRule
) => Promise<InternalControlItem[]>;

const DETECTORS: Record<InternalControlRuleType, DetectorFn> = {
  [InternalControlRuleType.SEGREGATION_OF_DUTIES]: detectSegregationOfDuties,
  [InternalControlRuleType.MULTI_APPROVAL_FOR_AMOUNT]: detectMultiApprovalForAmount,
  [InternalControlRuleType.NO_APPROVAL_NO_CONFIRM]: detectNoApprovalNoConfirm,
  [InternalControlRuleType.BUDGET_OVERAGE_ALERT]: async () => [],
  [InternalControlRuleType.MISSING_SOURCE_LINK]: detectMissingSourceLink,
};

function parseCondition(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function resolveNumber(
  value: unknown,
  fallback: number,
  options?: { min?: number; max?: number }
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options?.min !== undefined && parsed < options.min) {
    return options.min;
  }
  if (options?.max !== undefined && parsed > options.max) {
    return options.max;
  }
  return parsed;
}

function resolveLookback(condition: Record<string, unknown>) {
  return resolveNumber(condition.lookbackDays, DEFAULT_LOOKBACK_DAYS, {
    min: MIN_LOOKBACK_DAYS,
    max: MAX_LOOKBACK_DAYS,
  });
}

function buildSinceDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function detectSegregationOfDuties(
  groupId: number,
  rule: InternalControlRule
) {
  const condition = parseCondition(rule.conditionJson);
  const lookbackDays = resolveLookback(condition);
  const since = buildSinceDate(lookbackDays);

  const approvals = await prisma.approval.findMany({
    where: {
      ledger: { groupId, createdAt: { gte: since } },
    },
    include: {
      ledger: {
        select: {
          id: true,
          title: true,
          amount: true,
          createdAt: true,
          status: true,
          createdByMemberId: true,
          createdBy: {
            select: { displayName: true },
          },
        },
      },
      actedBy: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_APPROVAL_ROWS,
  });

  const items: InternalControlItem[] = [];
  for (const approval of approvals) {
    if (!approval.ledger) continue;
    if (approval.actedByMemberId !== approval.ledger.createdByMemberId) {
      continue;
    }
    if (items.find((item) => item.targetId === approval.ledger.id)) {
      continue;
    }
    items.push({
      targetType: AuditTargetType.LEDGER,
      targetId: approval.ledger.id,
      summary: `${approval.ledger.title} は作成者(${approval.ledger.createdBy?.displayName ?? ""})自身が承認しています。`,
      links: [
        {
          href: `/accounting?ledgerId=${approval.ledger.id}`,
          label: "会計詳細",
        },
      ],
    });
    if (items.length >= MAX_ITEMS_PER_RULE) break;
  }

  return items;
}

async function detectMultiApprovalForAmount(
  groupId: number,
  rule: InternalControlRule
) {
  const condition = parseCondition(rule.conditionJson);
  const lookbackDays = resolveLookback(condition);
  const since = buildSinceDate(lookbackDays);
  const threshold = resolveNumber(condition.amountGte, 50000, {
    min: 0,
    max: 100000000,
  });
  const requiredApprovals = resolveNumber(
    condition.requiredApprovals,
    2,
    { min: 1, max: 5 }
  );

  const ledgers = await prisma.ledger.findMany({
    where: {
      groupId,
      amount: { gte: Math.floor(threshold) },
      createdAt: { gte: since },
      status: { in: [LedgerStatus.PENDING, LedgerStatus.APPROVED] },
    },
    include: {
      approvals: {
        where: { action: "APPROVED" },
        select: {
          id: true,
          comment: true,
          actedBy: { select: { displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS_PER_RULE,
  });

  const items: InternalControlItem[] = [];
  for (const ledger of ledgers) {
    const approvalCount = ledger.approvals.length;
    if (approvalCount >= requiredApprovals) {
      continue;
    }
    items.push({
      targetType: AuditTargetType.LEDGER,
      targetId: ledger.id,
      summary: `${ledger.title} (¥${ledger.amount.toLocaleString()} ) の承認数 ${approvalCount}/${requiredApprovals}`,
      links: [
        {
          href: `/accounting?ledgerId=${ledger.id}`,
          label: "会計詳細",
        },
      ],
    });
  }

  return items;
}

async function detectNoApprovalNoConfirm(
  groupId: number,
  rule: InternalControlRule
) {
  const condition = parseCondition(rule.conditionJson);
  const lookbackDays = resolveLookback(condition);
  const since = buildSinceDate(lookbackDays);
  const minimumApproval = resolveNumber(
    condition.requireApprovalCount,
    1,
    { min: 1, max: 5 }
  );

  const ledgers = await prisma.ledger.findMany({
    where: {
      groupId,
      status: LedgerStatus.APPROVED,
      createdAt: { gte: since },
      approvals: {
        none: { action: "APPROVED" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS_PER_RULE,
  });

  return ledgers.map((ledger) => ({
    targetType: AuditTargetType.LEDGER,
    targetId: ledger.id,
    summary: `${ledger.title} は承認記録なしで確定ステータスになっています (必要: ${minimumApproval})。`,
    links: [
      {
        href: `/accounting?ledgerId=${ledger.id}`,
        label: "会計詳細",
      },
    ],
  }));
}

async function detectMissingSourceLink(
  groupId: number,
  rule: InternalControlRule
) {
  const condition = parseCondition(rule.conditionJson);
  if (condition.requireSourceLink === false) {
    return [];
  }
  const lookbackDays = resolveLookback(condition);
  const since = buildSinceDate(lookbackDays);

  const ledgers = await prisma.ledger.findMany({
    where: {
      groupId,
      createdAt: { gte: since },
      sourceThreadId: null,
      sourceChatMessageId: null,
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS_PER_RULE,
  });

  return ledgers.map((ledger) => ({
    targetType: AuditTargetType.LEDGER,
    targetId: ledger.id,
    summary: `${ledger.title} に紐づく議論スレッドが登録されていません。`,
    links: [
      {
        href: `/accounting?ledgerId=${ledger.id}`,
        label: "会計詳細",
      },
    ],
  }));
}
