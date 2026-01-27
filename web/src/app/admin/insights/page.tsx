import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/admin";
import {
  MODULE_LINKS,
  EXTENSION_MODULES,
  resolveModules,
} from "@/lib/modules";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理者",
  ACCOUNTANT: "会計担当",
  AUDITOR: "監査役",
  MEMBER: "メンバー",
};

type GroupSummary = {
  id: number;
  name: string;
  createdAt: Date;
  enabledModules: string[];
  _count: { members: number };
};

export default async function AdminInsightsPage() {
  await requirePlatformAdmin();

  const [groups, memberRoleCounts] = await Promise.all([
    prisma.group.findMany({
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<GroupSummary[]>,
    prisma.member.groupBy({
      by: ["role"],
      _count: { role: true },
    }),
  ]);

  const totalGroups = groups.length;
  const totalMembers = memberRoleCounts.reduce(
    (sum, entry) => sum + entry._count.role,
    0
  );
  const averageMembers =
    totalGroups > 0 ? Math.round(totalMembers / totalGroups) : 0;

  const moduleKeys = MODULE_LINKS.map((module) => module.key);
  const moduleUsage = new Map<string, number>();
  [...moduleKeys, ...EXTENSION_MODULES].forEach((key) =>
    moduleUsage.set(key, 0)
  );

  let totalEnabledModuleCount = 0;

  groups.forEach((group) => {
    const resolved = resolveModules(group.enabledModules);
    totalEnabledModuleCount += resolved.length;
    resolved.forEach((module) => {
      moduleUsage.set(module, (moduleUsage.get(module) ?? 0) + 1);
    });
    EXTENSION_MODULES.forEach((ext) => {
      if ((group.enabledModules ?? []).includes(ext)) {
        moduleUsage.set(ext, (moduleUsage.get(ext) ?? 0) + 1);
      }
    });
  });

  const averageModules =
    totalGroups > 0
      ? (totalEnabledModuleCount / totalGroups).toFixed(1)
      : "0.0";

  const roleDistribution = memberRoleCounts
    .map((entry) => ({
      role: entry.role,
      count: entry._count.role,
      label: ROLE_LABELS[entry.role] ?? entry.role,
    }))
    .sort((a, b) => b.count - a.count);

  const moduleCards = Array.from(moduleUsage.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const recentGroups = groups.slice(0, 5);

  return (
    <div className="min-h-screen bg-transparent py-10">
      <div className="page-shell space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Knot Admin
            </p>
            <h1 className="text-3xl font-semibold text-zinc-900">
              インサイトダッシュボード
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              モジュールの利用状況や団体の増減を俯瞰できます。
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Admin Home
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            {
              label: "登録団体数",
              value: totalGroups,
              subtitle: "全アクティブ団体",
            },
            {
              label: "メンバー総数",
              value: totalMembers,
              subtitle: `平均 ${averageMembers} 名/団体`,
            },
            {
              label: "モジュール稼働率",
              value: `${averageModules}`,
              subtitle: "平均有効モジュール",
            },
            {
              label: "監査役の数",
              value:
                roleDistribution.find((role) => role.role === "AUDITOR")
                  ?.count ?? 0,
              subtitle: "プラットフォーム全体",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs text-zinc-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{card.subtitle}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">
              モジュール利用上位
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              有効化している団体数の多いモジュール
            </p>
            <div className="mt-4 space-y-3">
              {moduleCards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                  データがまだありません。
                </p>
              ) : (
                moduleCards.map(([key, count]) => {
                  const moduleMeta =
                    MODULE_LINKS.find((module) => module.key === key) ??
                    undefined;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {moduleMeta?.label ?? key}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {key} モジュール
                        </p>
                      </div>
                      <span className="text-2xl font-semibold text-sky-700">
                        {count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">
              役割別メンバー構成
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              登録メンバーの役割比率
            </p>
            <div className="mt-4 space-y-3">
              {roleDistribution.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                  データがまだありません。
                </p>
              ) : (
                roleDistribution.map((role) => {
                  const percentage =
                    totalMembers > 0
                      ? Math.round((role.count / totalMembers) * 100)
                      : 0;
                  return (
                    <div key={role.role}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-zinc-800">
                          {role.label}
                        </span>
                        <span className="text-zinc-500">
                          {role.count}名 ({percentage}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-sky-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                最近追加された団体
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                直近5団体のステータス
              </p>
            </div>
            <Link
              href="/admin/groups"
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-sky-500 hover:text-sky-600"
            >
              一覧を見る
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left">団体名</th>
                  <th className="px-4 py-2 text-left">Modules</th>
                  <th className="px-4 py-2 text-right">Members</th>
                  <th className="px-4 py-2 text-left">作成日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentGroups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-sm text-zinc-500"
                    >
                      まだ団体がありません。
                    </td>
                  </tr>
                ) : (
                  recentGroups.slice(0, 5).map((group) => {
                    const enabled = resolveModules(group.enabledModules);
                    return (
                      <tr key={group.id} className="text-zinc-800">
                        <td className="px-4 py-3 font-semibold">
                          {group.name}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {enabled.join(", ")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {group._count.members}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-500">
                          {group.createdAt.toLocaleDateString("ja-JP", {
                            dateStyle: "medium",
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
