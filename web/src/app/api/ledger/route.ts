import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { revalidatePath } from "next/cache";

type CreateLedgerRequest = {
  title?: string;
  amount?: number | string;
  receiptUrl?: string;
  notes?: string;
  accountId?: number | string;
};

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = ((await request.json().catch(() => ({}))) ??
    {}) as CreateLedgerRequest;

  const title = body.title?.trim();
  const receiptUrl = body.receiptUrl?.trim();
  const notes = body.notes?.trim();
  const amountNumber = Number(body.amount);
  const accountIdNumber = Number(body.accountId);

  if (
    !title ||
    !Number.isFinite(amountNumber) ||
    amountNumber <= 0 ||
    !Number.isInteger(accountIdNumber)
  ) {
    return NextResponse.json(
      { error: "内容・金額・勘定科目を正しく入力してください。" },
      { status: 400 }
    );
  }

  const account = await prisma.account.findFirst({
    where: { id: accountIdNumber, groupId: session.groupId, isArchived: false },
  });

  if (!account) {
    return NextResponse.json(
      { error: "勘定科目を選択してください。" },
      { status: 400 }
    );
  }

  const ledger = await prisma.ledger.create({
    data: {
      groupId: session.groupId,
      createdByMemberId: session.memberId,
      title,
      amount: Math.round(amountNumber),
      receiptUrl,
      notes,
      accountId: account.id,
    },
  });

  revalidatePath("/accounting");

  return NextResponse.json({ success: true, ledger });
}
