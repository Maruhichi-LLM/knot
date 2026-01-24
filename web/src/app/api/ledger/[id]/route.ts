import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { revalidatePath } from "next/cache";

type UpdateLedgerRequest = {
  ledgerId?: number | string;
  action?: "approve" | "reject";
  comment?: string;
};

function resolveLedgerId(
  paramId?: string,
  fallback?: number | string | null
): number | null {
  const parse = (value: unknown) => {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };
  return parse(paramId) ?? parse(fallback);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = ((await request.json().catch(() => ({}))) ??
    {}) as UpdateLedgerRequest;
  const id = resolveLedgerId(params.id, body.ledgerId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid ledger id" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "承認または却下を指定してください。" },
      { status: 400 }
    );
  }

  const ledger = await prisma.ledger.findFirst({
    where: { id, groupId: session.groupId },
  });

  if (!ledger) {
    return NextResponse.json({ error: "対象が見つかりません。" }, { status: 404 });
  }

  if (ledger.status !== "PENDING") {
    return NextResponse.json(
      { error: "すでに処理済みです。" },
      { status: 400 }
    );
  }

  const status = action === "approve" ? "APPROVED" : "REJECTED";
  const approvalAction = action === "approve" ? "APPROVED" : "REJECTED";

  const updatedLedger = await prisma.$transaction(async (tx) => {
    await tx.approval.create({
      data: {
        ledgerId: ledger.id,
        actedByMemberId: session.memberId,
        action: approvalAction,
        comment: body.comment,
      },
    });

    return tx.ledger.update({
      where: { id: ledger.id },
      data: { status },
      include: {
        approvals: {
          orderBy: { createdAt: "desc" },
          include: { actedBy: true },
        },
        createdBy: true,
      },
    });
  });

  revalidatePath("/accounting");

  return NextResponse.json({ success: true, ledger: updatedLedger });
}
