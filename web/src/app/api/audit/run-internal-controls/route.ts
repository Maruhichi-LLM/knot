import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, CSRF_ERROR_MESSAGE } from "@/lib/security";
import { getAuditViewerForApi } from "@/lib/audit/access";
import { runInternalControlChecks } from "@/lib/audit/internal-controls";

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { error: CSRF_ERROR_MESSAGE },
      { status: 403 }
    );
  }

  const context = await getAuditViewerForApi();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runInternalControlChecks(context.session.groupId);

  return NextResponse.json({ results });
}
