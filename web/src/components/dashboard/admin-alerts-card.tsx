import Link from "next/link";
import { DashboardCard } from "./dashboard-card";

export type AdminAlertItem = {
  id: string;
  title: string;
  description?: string;
  href: string;
};

export function AdminAlertsCard({ alerts }: { alerts: AdminAlertItem[] }) {
  if (alerts.length === 0) return null;

  return (
    <DashboardCard title="管理者向け" actionHref="/management">
      <div className="space-y-2">
        {alerts.map((alert) => (
          <Link
            key={alert.id}
            href={alert.href}
            className="block rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition hover:border-amber-200"
          >
            <p className="font-semibold">{alert.title}</p>
            {alert.description ? (
              <p className="mt-1 text-xs text-amber-800">
                {alert.description}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
