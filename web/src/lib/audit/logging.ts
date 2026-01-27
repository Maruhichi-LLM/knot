import { AuditActionType, AuditTargetType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditLogInput = {
  groupId: number;
  actorMemberId?: number | null;
  actionType: AuditActionType;
  targetType: AuditTargetType;
  targetId?: number | null;
  beforeJson?: Prisma.InputJsonValue | null;
  afterJson?: Prisma.InputJsonValue | null;
  sourceThreadId?: number | null;
  sourceChatMessageId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function recordAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      groupId: input.groupId,
      actorMemberId: input.actorMemberId ?? null,
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      beforeJson: input.beforeJson != null ? input.beforeJson : Prisma.JsonNull,
      afterJson: input.afterJson != null ? input.afterJson : Prisma.JsonNull,
      sourceThreadId: input.sourceThreadId ?? null,
      sourceChatMessageId: input.sourceChatMessageId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export function extractClientMeta(
  request: Request | { headers: Headers }
) {
  const headers =
    "headers" in request ? request.headers : new Headers();
  const forwarded = headers.get("x-forwarded-for") || headers.get("x-real-ip");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? null;
  const userAgent = headers.get("user-agent") ?? null;
  return { ipAddress, userAgent };
}
