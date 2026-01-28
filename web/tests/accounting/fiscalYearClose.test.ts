import { beforeEach, describe, expect, it } from "vitest";
import {
  AccountType,
  FiscalYearCloseStatus,
  LedgerStatus,
} from "@prisma/client";
import {
  assertFiscalYearCloseEditable,
  computeFiscalYearPeriod,
  summarizeLedgersForStatement,
} from "@/lib/accounting/fiscalYearClose";
import { prisma } from "@/lib/prisma";
import {
  createAccount,
  createGroup,
  createLedger,
  createMember,
  resetDatabase,
} from "../helpers/factories";

describe("fiscal year close statement", () => {
  const period = computeFiscalYearPeriod({
    fiscalYear: 2024,
    startDate: new Date("2024-04-01T00:00:00Z"),
    endDate: new Date("2025-03-31T23:59:59Z"),
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("Case A: APPROVEDのみ集計される", async () => {
    const group = await createGroup();
    const member = await createMember({ groupId: group.id });
    const incomeAccount = await createAccount({
      groupId: group.id,
      type: AccountType.INCOME,
      name: "会費収入",
    });
    const expenseAccount = await createAccount({
      groupId: group.id,
      type: AccountType.EXPENSE,
      name: "事務費",
    });

    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: incomeAccount.id,
      amount: 1000,
      status: LedgerStatus.APPROVED,
      transactionDate: new Date("2024-05-10T00:00:00Z"),
    });
    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: expenseAccount.id,
      amount: 400,
      status: LedgerStatus.APPROVED,
      transactionDate: new Date("2024-06-01T00:00:00Z"),
    });
    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: expenseAccount.id,
      amount: 999,
      status: LedgerStatus.PENDING,
      transactionDate: new Date("2024-06-15T00:00:00Z"),
    });

    const ledgers = await prisma.ledger.findMany({
      where: { groupId: group.id },
      include: { account: true },
    });

    const statement = summarizeLedgersForStatement({
      ledgers,
      previousCarryover: 500,
      period,
    });

    expect(statement.totalRevenue).toBe(1000);
    expect(statement.totalExpense).toBe(400);
    expect(statement.balance).toBe(600);
    expect(statement.nextCarryover).toBe(1100);
    expect(statement.revenue).toEqual([
      {
        accountId: incomeAccount.id,
        accountName: incomeAccount.name,
        amount: 1000,
      },
    ]);
    expect(statement.expense).toEqual([
      {
        accountId: expenseAccount.id,
        accountName: expenseAccount.name,
        amount: 400,
      },
    ]);
  });

  it("Case B: APPROVEDが0件でも繰越金のみ反映される", async () => {
    const group = await createGroup();
    const member = await createMember({ groupId: group.id });
    const expenseAccount = await createAccount({
      groupId: group.id,
      type: AccountType.EXPENSE,
    });

    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: expenseAccount.id,
      amount: 900,
      status: LedgerStatus.REJECTED,
      transactionDate: new Date("2024-05-10T00:00:00Z"),
    });

    const ledgers = await prisma.ledger.findMany({
      where: { groupId: group.id },
      include: { account: true },
    });

    const statement = summarizeLedgersForStatement({
      ledgers,
      previousCarryover: 500,
      period,
    });

    expect(statement.totalRevenue).toBe(0);
    expect(statement.totalExpense).toBe(0);
    expect(statement.balance).toBe(0);
    expect(statement.nextCarryover).toBe(500);
    expect(statement.revenue).toEqual([]);
    expect(statement.expense).toEqual([]);
  });

  it("Case C: 赤伝票はabsで支出計上される", async () => {
    const group = await createGroup();
    const member = await createMember({ groupId: group.id });
    const expenseAccount = await createAccount({
      groupId: group.id,
      type: AccountType.EXPENSE,
    });

    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: expenseAccount.id,
      amount: -300,
      status: LedgerStatus.APPROVED,
      transactionDate: new Date("2024-07-01T00:00:00Z"),
    });

    const ledgers = await prisma.ledger.findMany({
      where: { groupId: group.id },
      include: { account: true },
    });

    const statement = summarizeLedgersForStatement({
      ledgers,
      previousCarryover: 0,
      period,
    });

    expect(statement.totalExpense).toBe(300);
    expect(statement.expense).toEqual([
      {
        accountId: expenseAccount.id,
        accountName: expenseAccount.name,
        amount: 300,
      },
    ]);
    expect(statement.balance).toBe(-300);
  });

  it("Case D: 確定済みは再計算できない", () => {
    const result = assertFiscalYearCloseEditable(
      { status: FiscalYearCloseStatus.CONFIRMED },
      "recalculate"
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("確定済みの年度は再計算できません。");
  });

  it("Case E: 承認ステータスの混在でも集計はAPPROVEDのみ", async () => {
    const group = await createGroup();
    const member = await createMember({ groupId: group.id });
    const incomeAccount = await createAccount({
      groupId: group.id,
      type: AccountType.INCOME,
    });

    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: incomeAccount.id,
      amount: 1000,
      status: LedgerStatus.APPROVED,
      transactionDate: new Date("2024-05-10T00:00:00Z"),
    });
    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: incomeAccount.id,
      amount: 200,
      status: LedgerStatus.PENDING,
      transactionDate: new Date("2024-05-11T00:00:00Z"),
    });
    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: incomeAccount.id,
      amount: 300,
      status: LedgerStatus.REJECTED,
      transactionDate: new Date("2024-05-12T00:00:00Z"),
    });

    const ledgers = await prisma.ledger.findMany({
      where: { groupId: group.id },
      include: { account: true },
    });

    const statement = summarizeLedgersForStatement({
      ledgers,
      previousCarryover: 0,
      period,
    });

    expect(statement.totalRevenue).toBe(1000);
    expect(statement.totalExpense).toBe(0);
  });

  it("Case F: 期間外のLedgerは集計されない", async () => {
    const group = await createGroup();
    const member = await createMember({ groupId: group.id });
    const incomeAccount = await createAccount({
      groupId: group.id,
      type: AccountType.INCOME,
    });

    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: incomeAccount.id,
      amount: 700,
      status: LedgerStatus.APPROVED,
      transactionDate: new Date("2024-05-10T00:00:00Z"),
    });
    await createLedger({
      groupId: group.id,
      createdByMemberId: member.id,
      accountId: incomeAccount.id,
      amount: 800,
      status: LedgerStatus.APPROVED,
      transactionDate: new Date("2026-01-01T00:00:00Z"),
    });

    const ledgers = await prisma.ledger.findMany({
      where: { groupId: group.id },
      include: { account: true },
    });

    const statement = summarizeLedgersForStatement({
      ledgers,
      previousCarryover: 0,
      period,
    });

    expect(statement.totalRevenue).toBe(700);
    expect(statement.revenue).toEqual([
      {
        accountId: incomeAccount.id,
        accountName: incomeAccount.name,
        amount: 700,
      },
    ]);
  });
});
