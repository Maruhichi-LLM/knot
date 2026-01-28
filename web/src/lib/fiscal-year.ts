import { prisma } from "@/lib/prisma";

export function getFiscalYear(date: Date, startMonth = 4): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= startMonth ? year : year - 1;
}

export async function resolveFiscalYearStartMonth(groupId: number) {
  const [setting, group] = await Promise.all([
    prisma.accountingSetting.findUnique({
      where: { groupId },
      select: { fiscalYearStartMonth: true },
    }),
    prisma.group.findUnique({
      where: { id: groupId },
      select: { fiscalYearStartMonth: true },
    }),
  ]);

  return setting?.fiscalYearStartMonth ?? group?.fiscalYearStartMonth ?? 4;
}
