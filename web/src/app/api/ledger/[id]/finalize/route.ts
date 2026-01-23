import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ROLE_ADMIN } from "@/lib/roles";
import { revalidatePath } from "next/cache";

type FinalizeLedgerRequest = {
  amount?: number | string;
  accountId?: number | string;
  receiptUrl?: string;
  notes?: string;
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid ledger id" }, { status: 400 });
  }

  const payload = ((await request.json().catch(() => ({}))) ??
    {}) as FinalizeLedgerRequest;

  const amountNumber = Number(payload.amount);
  const accountIdNumber = Number(payload.accountId);

  if (
    !Number.isFinite(amountNumber) ||
    amountNumber <= 0 ||
    !Number.isInteger(accountIdNumber)
  ) {
    return NextResponse.json(
      { error: "金額と勘定科目を正しく入力してください。" },
      { status: 400 }
    );
  }

  const [ledger, member, account] = await Promise.all([
    prisma.ledger.findFirst({
      where: { id, groupId: session.groupId },
      select: {
        id: true,
        createdByMemberId: true,
        status: true,
      },
    }),
    prisma.member.findUnique({
      where: { id: session.memberId },
      select: { role: true },
    }),
    prisma.account.findFirst({
      where: {
        id: accountIdNumber,
        groupId: session.groupId,
        isArchived: false,
      },
      select: { id: true },
    }),
  ]);

  if (!ledger) {
    return NextResponse.json({ error: "対象が見つかりません。" }, { status: 404 });
  }

  if (ledger.status !== "DRAFT") {
    return NextResponse.json(
      { error: "この申請はすでに処理済みです。" },
      { status: 400 }
    );
  }

  const isCreator = ledger.createdByMemberId === session.memberId;
  const isAdmin = member?.role === ROLE_ADMIN;
  if (!isCreator && !isAdmin) {
    return NextResponse.json(
      { error: "下書きを申請に出す権限がありません。" },
      { status: 403 }
    );
  }

  if (!account) {
    return NextResponse.json(
      { error: "勘定科目が存在しません。" },
      { status: 400 }
    );
  }

  const receiptUrl =
    (payload.receiptUrl ? String(payload.receiptUrl).trim() : undefined) || null;
  const notes =
    (payload.notes ? String(payload.notes).trim() : undefined) || null;

  const updated = await prisma.ledger.update({
    where: { id: ledger.id },
    data: {
      amount: Math.round(amountNumber),
      accountId: account.id,
      receiptUrl,
      notes,
      status: "PENDING",
    },
    include: {
      approvals: {
        orderBy: { createdAt: "desc" },
        include: { actedBy: true },
      },
      createdBy: true,
      account: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  revalidatePath("/ledger");

  return NextResponse.json({ success: true, ledger: updated });
}
