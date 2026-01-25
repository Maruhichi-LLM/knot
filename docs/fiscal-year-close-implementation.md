# Knot Accounting - 年度締めと収支計算書 実装手順書

## 目次
1. [概要](#概要)
2. [任意団体の会計締め処理について](#任意団体の会計締め処理について)
3. [収支計算書のフォーマット](#収支計算書のフォーマット)
4. [実装フロー](#実装フロー)
5. [Phase 1: データベース設計](#phase-1-データベース設計)
6. [Phase 2: API実装](#phase-2-api実装)
7. [Phase 3: UIコンポーネント](#phase-3-uiコンポーネント)
8. [Phase 4: 動作確認](#phase-4-動作確認)

---

## 概要

会計年度の締め処理と収支計算書作成機能を実装します。任意団体の実務運用に合わせて、以下の特徴を持ちます：

- **下書き作成**：年度末前後に何度でも収支を集計・確認できる
- **確定処理**：総会承認後に実行し、次年度への繰越金を確定する
- **確定後は編集不可**：監査・承認済みデータの保護

---

## 任意団体の会計締め処理について

### 年度末 ≠ すぐに締める

多くの組織では以下のようなスケジュールで進みます：

```
3月31日（年度末）
  ↓
4月1日〜5月末
  └─ 会計担当が収支を集計・確認
  └─ 下書きの収支計算書を作成
  └─ 監査を受ける
  └─ 必要に応じて修正・再集計

6月上旬
  └─ 理事会で承認

6月中旬〜下旬
  └─ 総会で報告・承認
  └─ この時点で「確定」処理を実行
  └─ 次年度の繰越金が正式決定
```

### システムで対応すべき実務要件

1. **年度末を過ぎても編集可能**
   - 4月以降も前年度の経費を追加・修正できる必要がある
   - 例：3月分の請求書が4月に届いた場合

2. **何度でも再計算可能**
   - 集計ミスや漏れを発見したら、下書きを作り直す
   - 監査で指摘があれば修正して再作成

3. **確定は慎重に**
   - 総会承認後に実行するため、確認ダイアログを表示
   - 確定後は編集不可にして、データの整合性を保つ

4. **次年度への影響**
   - 確定時に次年度の「前期繰越金」を自動設定
   - これにより次年度の収支計算が正確になる

---

## 収支計算書のフォーマット

### 一般的な任意団体（NPO、自治会、サークル等）の収支計算書

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
　　　　　　　　2024年度　収支計算書
　　　　　　（2024年4月1日〜2025年3月31日）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【収入の部】
　前期繰越金                      500,000円

　会費収入                        800,000円
　事業収入                        300,000円
　補助金等収入                    200,000円
　寄附金収入                       50,000円
　雑収入                           10,000円
　受取利息                            500円
　─────────────────────────────
　収入合計                      1,860,500円

【支出の部】
　事業費                          600,000円
　　└ イベント開催費              400,000円
　　└ 広報費                      200,000円

　人件費                          400,000円

　事務費                          250,000円
　　└ 会場費                      100,000円
　　└ 通信費                       50,000円
　　└ 消耗品費                     50,000円
　　└ その他                       50,000円
　─────────────────────────────
　支出合計                      1,250,000円

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
　当期収支差額                     610,500円
　　（収入合計 - 支出合計）

　次期繰越金                     1,110,500円
　　（前期繰越 + 当期収支差額）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Knotでの実装方針

1. **前期繰越金**
   - `AccountingSetting.carryoverAmount` から取得
   - 前年度の確定時に自動設定される

2. **勘定科目ごとの集計**
   - 承認済み（APPROVED）のLedgerのみを対象
   - 年度内（fiscalYearStart 〜 fiscalYearEnd）の取引を集計

3. **収支差額の計算**
   - 当期収支差額 = 総収入 - 総支出
   - 次期繰越金 = 前期繰越金 + 当期収支差額

4. **JSON形式で保存**
   - 勘定科目ごとの詳細をJSON形式で `FiscalYearClose.statement` に保存
   - 後から詳細表示や印刷に利用

---

## 実装フロー

```
┌─────────────────────────────────────┐
│  1. 年度末を迎える                  │
│     （例：2025年3月31日）           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. 管理者が「収支計算書を作成」    │
│     ボタンをクリック                │
│     → 下書きステータスで作成        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. システムが自動集計              │
│     - 承認済み経費を抽出            │
│     - 勘定科目ごとに合計            │
│     - 収支差額を計算                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. 収支計算書を確認                │
│     - 総収入・総支出を確認          │
│     - 科目別の詳細を確認            │
│     - 問題があれば経費を修正        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. 必要に応じて再計算              │
│     「再計算」ボタンで最新データ    │
│     を反映した下書きを再作成        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  6. 監査・理事会・総会で承認        │
│     （システム外のプロセス）        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  7. 総会承認後に「年度を確定」      │
│     ボタンをクリック                │
│     → 確定ステータスに変更          │
│     → 次年度の繰越金を自動設定      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  8. 確定済み（編集不可）            │
│     次年度の会計処理を開始          │
└─────────────────────────────────────┘
```

---

## Phase 1: データベース設計

### 1.1 FiscalYearCloseテーブルの追加

**ファイル**: `prisma/schema.prisma`

```prisma
model FiscalYearClose {
  id                Int      @id @default(autoincrement())
  groupId           Int
  group             Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  fiscalYear        Int      // 年度（例: 2024）
  closedAt          DateTime @default(now())
  closedByMemberId  Int
  closedBy          Member   @relation("FiscalYearCloseClosedBy", fields: [closedByMemberId], references: [id])

  // 収支サマリー
  totalRevenue      Int      // 総収入
  totalExpense      Int      // 総支出
  balance           Int      // 収支差額（収入 - 支出）
  previousCarryover Int      // 前期繰越金
  nextCarryover     Int      // 次期繰越金（前期繰越 + 収支差額）

  // 収支計算書データ（JSON形式で科目別詳細を保存）
  statement         Json?

  status            FiscalYearCloseStatus @default(DRAFT)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([groupId, fiscalYear])
  @@index([groupId])
}

enum FiscalYearCloseStatus {
  DRAFT      // 下書き（何度でも再作成可能）
  CONFIRMED  // 確定済み（編集不可）
}
```

**Groupモデルへのリレーション追加**:

```prisma
model Group {
  // ... 既存のフィールド
  fiscalYearCloses  FiscalYearClose[]
}
```

**Memberモデルへのリレーション追加**:

```prisma
model Member {
  // ... 既存のフィールド
  fiscalYearCloses  FiscalYearClose[] @relation("FiscalYearCloseClosedBy")
}
```

### 1.2 マイグレーション実行

```bash
cd /home/llm/chat_ai_app/knot/web
npx prisma migrate dev --name add-fiscal-year-close
npx prisma generate
```

---

## Phase 2: API実装

### 2.1 年度締めAPI

**ファイル**: `web/src/app/api/accounting/fiscal-year-close/route.ts`

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ROLE_ADMIN } from "@/lib/roles";
import { revalidatePath } from "next/cache";

type RequestBody = {
  fiscalYear?: number;
  status?: "DRAFT" | "CONFIRMED";
};

// 年度締め処理（POST）
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 管理者権限チェック
  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
  });
  if (!member || member.role !== ROLE_ADMIN) {
    return NextResponse.json(
      { error: "管理者権限が必要です。" },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;

  if (!body.fiscalYear || !Number.isInteger(body.fiscalYear)) {
    return NextResponse.json(
      { error: "年度を指定してください。" },
      { status: 400 }
    );
  }

  const fiscalYear = body.fiscalYear;
  const status = body.status ?? "DRAFT";

  // 既存の締め処理をチェック
  const existingClose = await prisma.fiscalYearClose.findUnique({
    where: {
      groupId_fiscalYear: {
        groupId: session.groupId,
        fiscalYear,
      },
    },
  });

  // 確定済みの年度は再作成不可
  if (existingClose && existingClose.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "この年度は既に確定済みです。修正する場合は、確定を取り消してください。" },
      { status: 400 }
    );
  }

  // 会計設定を取得
  const accountingSetting = await prisma.accountingSetting.findUnique({
    where: { groupId: session.groupId },
  });

  // 前期繰越金を取得
  const previousCarryover = accountingSetting?.carryoverAmount ?? 0;

  // 年度の期間を計算
  const startMonth = accountingSetting?.fiscalYearStartMonth ?? 4;
  const endMonth = accountingSetting?.fiscalYearEndMonth ?? 3;

  // 期首日（例：2024年4月1日 00:00:00）
  const fiscalYearStart = new Date(fiscalYear, startMonth - 1, 1, 0, 0, 0);

  // 期末日（例：2025年3月31日 23:59:59）
  const fiscalYearEnd = new Date(
    endMonth < startMonth ? fiscalYear + 1 : fiscalYear,
    endMonth,
    0, // 前月の最終日
    23,
    59,
    59
  );

  // 年度内の承認済み経費を取得
  const ledgers = await prisma.ledger.findMany({
    where: {
      groupId: session.groupId,
      transactionDate: {
        gte: fiscalYearStart,
        lte: fiscalYearEnd,
      },
      status: "APPROVED", // 承認済みのみ
    },
    include: {
      account: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  // 全勘定科目を取得
  const accounts = await prisma.account.findMany({
    where: { groupId: session.groupId, isArchived: false },
    orderBy: { order: "asc" },
  });

  // 勘定科目ごとの集計用マップ
  type AccountSummaryItem = {
    accountId: number;
    name: string;
    type: string;
    amount: number;
  };

  const accountSummary = new Map<number, AccountSummaryItem>();

  // 初期化
  for (const account of accounts) {
    accountSummary.set(account.id, {
      accountId: account.id,
      name: account.name,
      type: account.type,
      amount: 0,
    });
  }

  let totalRevenue = 0;
  let totalExpense = 0;

  // 経費を集計
  for (const ledger of ledgers) {
    const account = ledger.account;
    if (!account) continue;

    const amount = Math.abs(ledger.amount);
    const summary = accountSummary.get(account.id);
    if (!summary) continue;

    if (account.type === "INCOME") {
      totalRevenue += amount;
      summary.amount += amount;
    } else if (account.type === "EXPENSE") {
      totalExpense += amount;
      summary.amount += amount;
    }
  }

  // 収支差額と次期繰越金を計算
  const balance = totalRevenue - totalExpense;
  const nextCarryover = previousCarryover + balance;

  // 収支計算書データ（JSON）
  const statement = {
    revenue: Array.from(accountSummary.values())
      .filter((a) => a.type === "INCOME" && a.amount > 0)
      .sort((a, b) => b.amount - a.amount), // 金額の大きい順
    expense: Array.from(accountSummary.values())
      .filter((a) => a.type === "EXPENSE" && a.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    totalRevenue,
    totalExpense,
    balance,
    previousCarryover,
    nextCarryover,
    periodStart: fiscalYearStart.toISOString(),
    periodEnd: fiscalYearEnd.toISOString(),
    ledgerCount: ledgers.length,
  };

  // 締め処理を保存（既存があれば更新）
  const closeRecord = await prisma.fiscalYearClose.upsert({
    where: {
      groupId_fiscalYear: {
        groupId: session.groupId,
        fiscalYear,
      },
    },
    update: {
      totalRevenue,
      totalExpense,
      balance,
      previousCarryover,
      nextCarryover,
      statement,
      status,
      updatedAt: new Date(),
    },
    create: {
      groupId: session.groupId,
      fiscalYear,
      closedByMemberId: session.memberId,
      totalRevenue,
      totalExpense,
      balance,
      previousCarryover,
      nextCarryover,
      statement,
      status,
    },
    include: {
      closedBy: {
        select: { id: true, displayName: true },
      },
    },
  });

  // 確定時は次年度の繰越金額を更新
  if (status === "CONFIRMED") {
    await prisma.accountingSetting.upsert({
      where: { groupId: session.groupId },
      update: { carryoverAmount: nextCarryover },
      create: {
        groupId: session.groupId,
        fiscalYearStartMonth: startMonth,
        fiscalYearEndMonth: endMonth,
        carryoverAmount: nextCarryover,
        approvalFlow: null,
      },
    });
  }

  revalidatePath("/accounting");

  return NextResponse.json({
    success: true,
    closeRecord: {
      ...closeRecord,
      closedAt: closeRecord.closedAt.toISOString(),
      createdAt: closeRecord.createdAt.toISOString(),
      updatedAt: closeRecord.updatedAt.toISOString(),
    },
  });
}

// 年度締め情報を取得（GET）
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fiscalYearParam = url.searchParams.get("fiscalYear");

  if (!fiscalYearParam) {
    return NextResponse.json(
      { error: "年度を指定してください。" },
      { status: 400 }
    );
  }

  const fiscalYear = Number(fiscalYearParam);
  if (!Number.isInteger(fiscalYear)) {
    return NextResponse.json(
      { error: "年度は整数で指定してください。" },
      { status: 400 }
    );
  }

  const closeRecord = await prisma.fiscalYearClose.findUnique({
    where: {
      groupId_fiscalYear: {
        groupId: session.groupId,
        fiscalYear,
      },
    },
    include: {
      closedBy: {
        select: { id: true, displayName: true },
      },
    },
  });

  if (!closeRecord) {
    return NextResponse.json(
      { error: "年度締め情報が見つかりません。" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...closeRecord,
    closedAt: closeRecord.closedAt.toISOString(),
    createdAt: closeRecord.createdAt.toISOString(),
    updatedAt: closeRecord.updatedAt.toISOString(),
  });
}
```

---

## Phase 3: UIコンポーネント

### 3.1 FiscalYearCloseSectionコンポーネント

**ファイル**: `web/src/components/fiscal-year-close-section.tsx`

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Account = {
  id: number;
  name: string;
  type: string;
};

type Props = {
  groupId: number;
  fiscalYear: number;
  accounts: Account[];
};

type StatementItem = {
  accountId: number;
  name: string;
  type: string;
  amount: number;
};

type Statement = {
  revenue: StatementItem[];
  expense: StatementItem[];
  totalRevenue: number;
  totalExpense: number;
  balance: number;
  previousCarryover: number;
  nextCarryover: number;
  periodStart: string;
  periodEnd: string;
  ledgerCount: number;
};

type CloseRecord = {
  id: number;
  fiscalYear: number;
  totalRevenue: number;
  totalExpense: number;
  balance: number;
  previousCarryover: number;
  nextCarryover: number;
  statement: Statement;
  status: "DRAFT" | "CONFIRMED";
  closedAt: string;
  closedBy: { id: number; displayName: string };
};

export function FiscalYearCloseSection({
  groupId,
  fiscalYear,
  accounts,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeRecord, setCloseRecord] = useState<CloseRecord | null>(null);
  const [showStatement, setShowStatement] = useState(false);

  const numberFormatter = new Intl.NumberFormat("ja-JP");
  const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 初回ロード時にデータを取得
  useEffect(() => {
    async function loadCloseRecord() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/accounting/fiscal-year-close?fiscalYear=${fiscalYear}`
        );

        if (response.ok) {
          const data = (await response.json()) as CloseRecord;
          setCloseRecord(data);
        }
      } catch {
        // エラーは無視（未締めの場合）
      } finally {
        setLoading(false);
      }
    }
    loadCloseRecord();
  }, [fiscalYear]);

  async function handleGenerateDraft() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/accounting/fiscal-year-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYear, status: "DRAFT" }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "収支計算書の作成に失敗しました。");
      }

      const result = (await response.json()) as { closeRecord: CloseRecord };
      setCloseRecord(result.closeRecord);
      setShowStatement(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (
      !confirm(
        "年度を確定しますか？\n\n確定すると：\n・この年度の収支計算書が確定されます\n・次年度の繰越金額が自動設定されます\n・確定後は編集できません"
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/accounting/fiscal-year-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYear, status: "CONFIRMED" }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "年度確定に失敗しました。");
      }

      const result = (await response.json()) as { closeRecord: CloseRecord };
      setCloseRecord(result.closeRecord);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 未作成の場合 */}
      {!closeRecord && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-600">
            {fiscalYear}年度の収支計算書はまだ作成されていません。
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            年度内の承認済み経費を集計して、収支計算書を作成します。
            <br />
            下書きは何度でも作り直すことができます。
          </p>
          <button
            onClick={handleGenerateDraft}
            disabled={loading}
            className="mt-4 rounded-lg bg-sky-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:bg-sky-300"
          >
            {loading ? "作成中..." : "収支計算書を作成"}
          </button>
        </div>
      )}

      {/* 作成済みの場合 */}
      {closeRecord && (
        <div className="space-y-4">
          {/* ステータス表示 */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-700">
                  {fiscalYear}年度の締め処理
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  作成者: {closeRecord.closedBy.displayName} •{" "}
                  {new Date(closeRecord.closedAt).toLocaleString("ja-JP")}
                </p>
                {closeRecord.statement && (
                  <p className="mt-1 text-xs text-zinc-500">
                    対象期間:{" "}
                    {dateFormatter.format(
                      new Date(closeRecord.statement.periodStart)
                    )}{" "}
                    〜{" "}
                    {dateFormatter.format(
                      new Date(closeRecord.statement.periodEnd)
                    )}{" "}
                    • 経費件数: {closeRecord.statement.ledgerCount}件
                  </p>
                )}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  closeRecord.status === "CONFIRMED"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {closeRecord.status === "CONFIRMED" ? "確定済み" : "下書き"}
              </span>
            </div>
          </div>

          {/* サマリー */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-600">
                総収入
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">
                {numberFormatter.format(closeRecord.totalRevenue)}円
              </p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-xs uppercase tracking-wide text-rose-600">
                総支出
              </p>
              <p className="mt-2 text-2xl font-bold text-rose-900">
                {numberFormatter.format(closeRecord.totalExpense)}円
              </p>
            </div>
            <div
              className={`rounded-xl border p-4 ${
                closeRecord.balance >= 0
                  ? "border-sky-100 bg-sky-50"
                  : "border-amber-100 bg-amber-50"
              }`}
            >
              <p
                className={`text-xs uppercase tracking-wide ${
                  closeRecord.balance >= 0 ? "text-sky-600" : "text-amber-600"
                }`}
              >
                当期収支差額
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  closeRecord.balance >= 0 ? "text-sky-900" : "text-amber-900"
                }`}
              >
                {closeRecord.balance >= 0 ? "+" : ""}
                {numberFormatter.format(closeRecord.balance)}円
              </p>
            </div>
          </div>

          {/* 繰越金額 */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-zinc-600">
                  前期繰越金
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {numberFormatter.format(closeRecord.previousCarryover)}円
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-600">
                  次期繰越金
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {numberFormatter.format(closeRecord.nextCarryover)}円
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  = 前期繰越{" "}
                  {closeRecord.balance >= 0 ? "+" : "-"}{" "}
                  当期収支差額
                </p>
              </div>
            </div>
          </div>

          {/* 詳細表示トグル */}
          <button
            onClick={() => setShowStatement(!showStatement)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            {showStatement ? "詳細を閉じる" : "詳細な収支計算書を表示"}
          </button>

          {/* 収支計算書 */}
          {showStatement && closeRecord.statement && (
            <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
              <div className="border-b border-zinc-200 pb-4">
                <h3 className="text-center text-lg font-bold text-zinc-900">
                  {fiscalYear}年度 収支計算書
                </h3>
                <p className="mt-1 text-center text-xs text-zinc-500">
                  （
                  {dateFormatter.format(
                    new Date(closeRecord.statement.periodStart)
                  )}{" "}
                  〜{" "}
                  {dateFormatter.format(
                    new Date(closeRecord.statement.periodEnd)
                  )}
                  ）
                </p>
              </div>

              {/* 前期繰越金 */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-zinc-700">
                    前期繰越金
                  </span>
                  <span className="font-bold text-zinc-900">
                    {numberFormatter.format(closeRecord.previousCarryover)}円
                  </span>
                </div>
              </div>

              {/* 収入の部 */}
              <div>
                <h4 className="mb-3 text-sm font-bold text-emerald-700">
                  【収入の部】
                </h4>
                <div className="space-y-2">
                  {closeRecord.statement.revenue.length > 0 ? (
                    <>
                      {closeRecord.statement.revenue.map((item) => (
                        <div
                          key={item.accountId}
                          className="flex justify-between border-b border-emerald-50 py-2 pl-4 text-sm"
                        >
                          <span className="text-zinc-700">{item.name}</span>
                          <span className="font-semibold text-emerald-900">
                            {numberFormatter.format(item.amount)}円
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t-2 border-emerald-200 pt-3 font-bold">
                        <span className="text-emerald-800">収入合計</span>
                        <span className="text-emerald-900">
                          {numberFormatter.format(
                            closeRecord.totalRevenue
                          )}
                          円
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="py-2 text-sm text-zinc-500">
                      収入はありませんでした
                    </p>
                  )}
                </div>
              </div>

              {/* 支出の部 */}
              <div>
                <h4 className="mb-3 text-sm font-bold text-rose-700">
                  【支出の部】
                </h4>
                <div className="space-y-2">
                  {closeRecord.statement.expense.length > 0 ? (
                    <>
                      {closeRecord.statement.expense.map((item) => (
                        <div
                          key={item.accountId}
                          className="flex justify-between border-b border-rose-50 py-2 pl-4 text-sm"
                        >
                          <span className="text-zinc-700">{item.name}</span>
                          <span className="font-semibold text-rose-900">
                            {numberFormatter.format(item.amount)}円
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t-2 border-rose-200 pt-3 font-bold">
                        <span className="text-rose-800">支出合計</span>
                        <span className="text-rose-900">
                          {numberFormatter.format(
                            closeRecord.totalExpense
                          )}
                          円
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="py-2 text-sm text-zinc-500">
                      支出はありませんでした
                    </p>
                  )}
                </div>
              </div>

              {/* 当期収支差額 */}
              <div className="rounded-lg border-2 border-sky-200 bg-sky-50 p-4">
                <div className="flex justify-between">
                  <span className="font-bold text-sky-800">
                    当期収支差額
                  </span>
                  <span className="text-xl font-bold text-sky-900">
                    {closeRecord.balance >= 0 ? "+" : ""}
                    {numberFormatter.format(closeRecord.balance)}円
                  </span>
                </div>
                <p className="mt-2 text-xs text-sky-700">
                  収入合計 - 支出合計
                </p>
              </div>

              {/* 次期繰越金 */}
              <div className="rounded-lg border-2 border-zinc-300 bg-zinc-100 p-4">
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-800">次期繰越金</span>
                  <span className="text-xl font-bold text-zinc-900">
                    {numberFormatter.format(closeRecord.nextCarryover)}円
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  前期繰越金 {closeRecord.balance >= 0 ? "+" : "-"}{" "}
                  当期収支差額
                </p>
              </div>
            </div>
          )}

          {/* アクション */}
          {closeRecord.status === "DRAFT" && (
            <div className="flex gap-3">
              <button
                onClick={handleGenerateDraft}
                disabled={loading}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:bg-zinc-100"
              >
                {loading ? "更新中..." : "再計算"}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:bg-sky-300"
              >
                {loading ? "確定中..." : "年度を確定"}
              </button>
            </div>
          )}

          {closeRecord.status === "CONFIRMED" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-700">
              この年度は確定済みです。次年度の繰越金額が自動設定されています。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 3.2 accounting/page.tsxへの統合

**ファイル**: `web/src/app/accounting/page.tsx`

既存のsections配列に以下を追加：

```typescript
import { FiscalYearCloseSection } from "@/components/fiscal-year-close-section";

// セクション追加（管理者のみ）
if (canManage) {
  sections.push({
    id: "fiscal-year-close",
    content: (
      <section
        key="fiscal-year-close-section"
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-zinc-900">
          年度締めと収支計算書
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          会計年度を締めて収支計算書を作成します。下書きは何度でも作り直せます。総会承認後に確定してください。
        </p>

        <FiscalYearCloseSection
          groupId={session.groupId}
          fiscalYear={targetFiscalYear}
          accounts={allAccounts}
        />
      </section>
    ),
  });
}

// navigationItemsにも追加
if (canManage) {
  navigationItems.push({
    id: "fiscal-year-close",
    label: "年度締めと収支計算書",
    description: "年度を確定して次年度に繰越",
  });
}
```

---

## Phase 4: 動作確認

### 4.1 マイグレーション実行

```bash
cd /home/llm/chat_ai_app/knot/web
npx prisma migrate dev --name add-fiscal-year-close
npx prisma generate
```

### 4.2 開発サーバー再起動

既存のサーバーを停止して再起動:

```bash
# Ctrl+C で停止
npm run dev
```

### 4.3 テストシナリオ

1. **下書き作成**
   - 管理者でログイン
   - Accounting ページ → 「年度締めと収支計算書」
   - 「収支計算書を作成」をクリック
   - 収支サマリーが表示されることを確認

2. **詳細確認**
   - 「詳細な収支計算書を表示」をクリック
   - 科目別の詳細が表示されることを確認
   - 前期繰越金、次期繰越金が正しく計算されていることを確認

3. **再計算**
   - 新しい経費を追加
   - 「再計算」ボタンをクリック
   - 最新の集計結果が反映されることを確認

4. **確定処理**
   - 「年度を確定」をクリック
   - 確認ダイアログが表示されることを確認
   - OKをクリック
   - ステータスが「確定済み」に変わることを確認
   - 「会計年度と承認フロー」セクションで繰越金額が更新されていることを確認

5. **確定後の制限**
   - 確定済み年度で「収支計算書を作成」を試みる
   - エラーメッセージが表示されることを確認

---

## まとめ

この実装により、以下の実務要件を満たす年度締め機能が完成します：

✅ **年度末を過ぎても柔軟に対応**
- 年度末後も前年度の経費を追加・修正可能
- 下書きは何度でも作り直せる

✅ **段階的な締め処理**
- 下書き作成 → 監査・承認 → 確定という現実的なフロー
- 確定前は何度でも再計算可能

✅ **正確な繰越金管理**
- 確定時に次年度の繰越金を自動設定
- 収支差額の計算が正確

✅ **見やすい収支計算書**
- 任意団体の標準的なフォーマット
- 科目別の詳細表示
- 印刷・保存に対応可能なレイアウト

実装を開始する準備が整いました！
