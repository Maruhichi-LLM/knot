import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureModuleEnabled } from "@/lib/modules";
import { getSessionFromCookies } from "@/lib/session";
import { isPlatformAdminEmail } from "@/lib/admin";
import {
  ROLE_ADMIN,
  ROLE_ACCOUNTANT,
  ROLE_AUDITOR,
} from "@/lib/roles";

export const AUDIT_VIEW_ROLES = [
  ROLE_ADMIN,
  ROLE_ACCOUNTANT,
  ROLE_AUDITOR,
];

function canViewAudit(role: string, email?: string | null) {
  return (
    AUDIT_VIEW_ROLES.includes(role) || isPlatformAdminEmail(email)
  );
}

export async function requireAuditViewer() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  await ensureModuleEnabled(session.groupId, "audit");

  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
    select: {
      id: true,
      role: true,
      email: true,
      displayName: true,
      groupId: true,
    },
  });

  if (!member) {
    redirect("/join");
  }

  if (!canViewAudit(member.role, member.email)) {
    throw new Error("監査ページへのアクセス権がありません。");
  }

  return { session, member };
}

export async function getAuditViewerForApi() {
  const session = await getSessionFromCookies();
  if (!session) {
    return null;
  }
  await ensureModuleEnabled(session.groupId, "audit");

  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
    select: {
      id: true,
      role: true,
      email: true,
      displayName: true,
      groupId: true,
    },
  });

  if (!member) {
    return null;
  }

  if (!canViewAudit(member.role, member.email)) {
    return null;
  }

  return { session, member };
}
