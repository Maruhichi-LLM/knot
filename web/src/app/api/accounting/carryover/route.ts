import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ROLE_ADMIN } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import {
  assertSameOrigin,
  CSRF_ERROR_MESSAGE,
} from "@/lib/security";

type CarryoverRequest = {
  carryoverAmount: number;
};

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { error: CSRF_ERROR_MESSAGE },
      { status: 403 }
    );
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
  });

  if (!member || member.role !== ROLE_ADMIN) {
    return NextResponse.json(
      { error: "権限がありません。" },
      { status: 403 }
    );
  }

  const body = ((await request.json().catch(() => ({}))) ?? {}) as CarryoverRequest;

  const amount = Number(body.carryoverAmount);
  if (!Number.isFinite(amount)) {
    return NextResponse.json(
      { error: "繰越金額を正しく指定してください。" },
      { status: 400 }
    );
  }

  const carryoverAmount = Math.round(amount);

  await prisma.accountingSetting.update({
    where: { groupId: session.groupId },
    data: { carryoverAmount },
  });

  revalidatePath("/accounting");

  return NextResponse.json({ success: true, carryoverAmount });
}
