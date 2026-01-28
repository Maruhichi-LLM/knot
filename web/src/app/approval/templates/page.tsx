import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";
import { ROLE_ADMIN } from "@/lib/roles";
import { TemplateCreateForm, RouteOption } from "./template-create-form";
import { parseApprovalFormSchema } from "@/lib/approval-schema";

export default async function ApprovalTemplatesPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  await ensureModuleEnabled(session.groupId, "approval");

  const [member, routes, templates] = await Promise.all([
    prisma.member.findUnique({
      where: { id: session.memberId },
      select: { role: true },
    }),
    prisma.approvalRoute.findMany({
      where: { groupId: session.groupId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        steps: {
          orderBy: { stepOrder: "asc" },
          select: {
            id: true,
            stepOrder: true,
            approverRole: true,
            requireAll: true,
          },
        },
        createdAt: true,
      },
    }),
    prisma.approvalTemplate.findMany({
      where: { groupId: session.groupId },
      orderBy: { createdAt: "desc" },
      include: {
        route: {
          select: {
            id: true,
            name: true,
            steps: {
              orderBy: { stepOrder: "asc" },
              select: {
                id: true,
                stepOrder: true,
                approverRole: true,
                requireAll: true,
              },
            },
          },
        },
        _count: {
          select: { applications: true },
        },
      },
    }),
  ]);

  const routeOptions: RouteOption[] = routes.map((route) => ({
    id: route.id,
    name: route.name,
  }));

  const isAdmin = member?.role === ROLE_ADMIN;

  return (
    <div className="min-h-screen bg-transparent py-10">
      <div className="page-shell space-y-8">
        <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Knot Workflow
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            申請テンプレート管理
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            申請フォームの項目と承認ルートをテンプレート化し、備品・休暇・施設利用など様々な申請を統一ルールで扱います。
          </p>
        </header>

        {isAdmin ? (
          <TemplateCreateForm routes={routeOptions} />
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
            テンプレートの作成・更新は管理者のみが実行できます。申請者は下の一覧から利用可能なテンプレートを確認できます。
          </p>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              利用可能なテンプレート
            </h2>
            <p className="text-xs text-zinc-500">
              {templates.length} 件のテンプレート
            </p>
          </div>
          {templates.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500">
              まだテンプレートが登録されていません。承認ルートを用意した上でテンプレートを作成してください。
            </p>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => {
                let schemaSummary: { fieldCount: number; fields: string[] } = {
                  fieldCount: 0,
                  fields: [],
                };
                try {
                  const schema = parseApprovalFormSchema(template.fields);
                  schemaSummary = {
                    fieldCount: schema.items.length,
                    fields: schema.items.slice(0, 4).map((item) => item.label),
                  };
                } catch {
                  // noop, fallback summary remains empty
                }
                return (
                  <article
                    key={template.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs text-zinc-500">
                          作成日:{" "}
                          {template.createdAt.toLocaleString("ja-JP", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold text-zinc-900">
                          {template.name}
                        </h3>
                        {template.description ? (
                          <p className="mt-1 text-sm text-zinc-600">
                            {template.description}
                          </p>
                        ) : null}
                        <p className="mt-3 text-xs uppercase tracking-wide text-zinc-400">
                          使用中の承認ルート
                        </p>
                        <div className="mt-1 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm">
                          <p className="font-semibold text-zinc-800">
                            {template.route?.name ?? "未設定"}
                          </p>
                          <ol className="mt-2 space-y-1 text-xs text-zinc-600">
                            {template.route?.steps.map((step) => (
                              <li key={step.id}>
                                STEP {step.stepOrder}: {step.approverRole}
                                {step.requireAll ? "（全員承認）" : ""}
                              </li>
                            )) ?? (
                              <li>ステップが登録されていません。</li>
                            )}
                          </ol>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                        <p className="text-xs uppercase tracking-wide">
                          フィールド定義
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                          {schemaSummary.fieldCount}
                          <span className="ml-1 text-sm font-normal text-sky-800">
                            項目
                          </span>
                        </p>
                        {schemaSummary.fields.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-xs">
                            {schemaSummary.fields.map((label) => (
                              <li
                                key={label}
                                className="truncate rounded-full bg-white/70 px-2 py-0.5 text-sky-700"
                              >
                                {label}
                              </li>
                            ))}
                            {schemaSummary.fieldCount > schemaSummary.fields.length ? (
                              <li className="text-sky-700">
                                …ほか {schemaSummary.fieldCount - schemaSummary.fields.length} 件
                              </li>
                            ) : null}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs">
                            JSON定義の解析に失敗しました。テンプレートを再保存してください。
                          </p>
                        )}
                        <p className="mt-3 text-xs text-sky-700">
                          累計申請数: {template._count.applications}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
