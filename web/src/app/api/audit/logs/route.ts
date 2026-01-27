import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditViewerForApi } from "@/lib/audit/access";
import {
  AuditActionType,
  AuditTargetType,
  Prisma,
} from "@prisma/client";

const MAX_TAKE = 200;
const DEFAULT_TAKE = 50;

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isAuditTarget(value: string | null): value is AuditTargetType {
  if (!value) return false;
  return Object.values(AuditTargetType).includes(value as AuditTargetType);
}

function isAuditAction(value: string | null): value is AuditActionType {
  if (!value) return false;
  return Object.values(AuditActionType).includes(value as AuditActionType);
}

export async function GET(request: NextRequest) {
  const context = await getAuditViewerForApi();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { session } = context;

  const search = request.nextUrl.searchParams;
  const from = parseDate(search.get("from"));
  const to = parseDate(search.get("to"));
  const actorIdRaw = search.get("actorId");
  const targetTypeRaw = search.get("targetType");
  const query = (search.get("query") ?? "").trim();
  const cursorRaw = search.get("cursor");
  const takeRaw = Number(search.get("take"));

  const take = Number.isFinite(takeRaw)
    ? Math.max(1, Math.min(MAX_TAKE, Math.floor(takeRaw)))
    : DEFAULT_TAKE;

  const where: Prisma.AuditLogWhereInput = {
    groupId: session.groupId,
  };

  if (from || to) {
    where.createdAt = {};
    if (from) {
      where.createdAt.gte = from;
    }
    if (to) {
      where.createdAt.lte = to;
    }
  }

  const actorId = actorIdRaw ? Number(actorIdRaw) : null;
  if (actorId && Number.isInteger(actorId)) {
    where.actorMemberId = actorId;
  }

  if (isAuditTarget(targetTypeRaw)) {
    where.targetType = targetTypeRaw;
  }

  if (query) {
    const numeric = Number(query);
    const orFilters: Prisma.AuditLogWhereInput[] = [];
    if (!Number.isNaN(numeric)) {
      orFilters.push({ targetId: Math.floor(numeric) });
    }
    if (isAuditAction(query.toUpperCase())) {
      orFilters.push({ actionType: query.toUpperCase() as AuditActionType });
    }
    if (isAuditTarget(query.toUpperCase())) {
      orFilters.push({ targetType: query.toUpperCase() as AuditTargetType });
    }
    if (orFilters.length > 0) {
      where.OR = orFilters;
    }
  }

  const cursorId = cursorRaw ? Number(cursorRaw) : null;

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      actor: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
    skip: cursorId ? 1 : 0,
    cursor: cursorId ? { id: cursorId } : undefined,
  });

  const nextCursor = logs.length === take ? logs[logs.length - 1].id : null;

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      actor:
        log.actor?.displayName
          ? { id: log.actor.id, displayName: log.actor.displayName }
          : null,
      actionType: log.actionType,
      targetType: log.targetType,
      targetId: log.targetId,
      beforeJson: log.beforeJson,
      afterJson: log.afterJson,
      sourceThreadId: log.sourceThreadId,
      sourceChatMessageId: log.sourceChatMessageId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    })),
    nextCursor,
  });
}
