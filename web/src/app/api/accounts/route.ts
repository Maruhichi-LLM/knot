import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";

// 勘定科目一覧取得
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.account.findMany({
    where: {
      groupId: session.groupId,
      isArchived: false,
    },
    select: {
      id: true,
      name: true,
      type: true,
      order: true,
    },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(accounts);
}
