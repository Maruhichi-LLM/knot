import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getSessionFromCookies } from "./session";

const ADMIN_EMAIL =
  process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase() ?? "";

function assertAdminEmailConfigured() {
  if (!ADMIN_EMAIL) {
    throw new Error("PLATFORM_ADMIN_EMAIL is not configured");
  }
  return ADMIN_EMAIL;
}

export async function requirePlatformAdmin() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }

  const adminEmail = assertAdminEmailConfigured();

  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
    select: { id: true, email: true, displayName: true },
  });

  if (!member || !member.email) {
    redirect("/home");
  }

  if (member.email.toLowerCase() !== adminEmail) {
    redirect("/home");
  }

  return { session, member };
}
