import {
  AccountType,
  FiscalYearCloseStatus,
  LedgerStatus,
  type Account,
  type FiscalYearClose,
  type Ledger,
} from "@prisma/client";

export type FiscalYearPeriod = {
  fiscalYear: number;
  startDate: Date;
  endDate: Date;
};

export type StatementItem = {
  accountId: number;
  accountName: string;
  amount: number;
};

export type Statement = {
  revenue: StatementItem[];
  expense: StatementItem[];
  totalRevenue: number;
  totalExpense: number;
  balance: number;
  previousCarryover: number;
  nextCarryover: number;
};

type LedgerWithAccount = Pick<
  Ledger,
  "id" | "amount" | "transactionDate" | "status" | "accountId"
> & {
  account?: Account | null;
};

export function computeFiscalYearPeriod(params: {
  fiscalYear: number;
  startDate: Date;
  endDate: Date;
}): FiscalYearPeriod {
  return {
    fiscalYear: params.fiscalYear,
    startDate: params.startDate,
    endDate: params.endDate,
  };
}

export function assertFiscalYearCloseEditable(
  existing: Pick<FiscalYearClose, "status"> | null,
  action: "create" | "recalculate" | "confirm"
): { ok: boolean; error?: string } {
  if (existing?.status === FiscalYearCloseStatus.CONFIRMED && action !== "confirm") {
    return { ok: false, error: "確定済みの年度は再計算できません。" };
  }
  return { ok: true };
}

export function summarizeLedgersForStatement(params: {
  ledgers: LedgerWithAccount[];
  accounts?: Account[];
  previousCarryover: number;
  period: FiscalYearPeriod;
}): Statement {
  const { ledgers, accounts = [], previousCarryover, period } = params;
  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  const revenueMap = new Map<number, { accountName: string; amount: number }>();
  const expenseMap = new Map<number, { accountName: string; amount: number }>();

  for (const ledger of ledgers) {
    if (ledger.status !== LedgerStatus.APPROVED) continue;

    const txDate = ledger.transactionDate;
    if (txDate < period.startDate || txDate > period.endDate) continue;

    const account =
      ledger.account ??
      (ledger.accountId ? accountMap.get(ledger.accountId) ?? null : null);
    if (!account) continue;

    if (account.type === AccountType.INCOME) {
      const current = revenueMap.get(account.id) ?? {
        accountName: account.name,
        amount: 0,
      };
      current.amount += ledger.amount;
      revenueMap.set(account.id, current);
    } else if (account.type === AccountType.EXPENSE) {
      const current = expenseMap.get(account.id) ?? {
        accountName: account.name,
        amount: 0,
      };
      current.amount += Math.abs(ledger.amount);
      expenseMap.set(account.id, current);
    }
  }

  const revenue = Array.from(revenueMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([accountId, { accountName, amount }]) => ({
      accountId,
      accountName,
      amount,
    }));

  const expense = Array.from(expenseMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([accountId, { accountName, amount }]) => ({
      accountId,
      accountName,
      amount,
    }));

  const totalRevenue = revenue.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = expense.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalRevenue - totalExpense;
  const nextCarryover = previousCarryover + balance;

  return {
    revenue,
    expense,
    totalRevenue,
    totalExpense,
    balance,
    previousCarryover,
    nextCarryover,
  };
}
