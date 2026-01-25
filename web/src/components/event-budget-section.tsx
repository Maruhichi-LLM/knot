"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type EventBudgetData = {
  id: number;
  eventId: number;
  plannedRevenue: number;
  plannedExpense: number;
  actualRevenue: number;
  actualExpense: number;
  status: "PLANNING" | "IN_PROGRESS" | "CONFIRMED" | "IMPORTED";
  confirmedAt: string | null;
  confirmedBy: { id: number; displayName: string } | null;
  importedToLedgerAt: string | null;
  transactions: {
    id: number;
    type: "REVENUE" | "EXPENSE";
    accountId: number | null;
    account: { id: number; name: string; type: string } | null;
    amount: number;
    description: string;
    transactionDate: string;
    createdBy: { id: number; displayName: string };
    createdAt: string;
  }[];
  imports: {
    id: number;
    importedBy: { id: number; displayName: string };
    importedAt: string;
    ledgerEntryCount: number;
    notes: string | null;
  }[];
};

type Props = {
  eventId: number;
  eventTitle: string;
  eventBudget: EventBudgetData | null;
  groupId: number;
  canEdit: boolean;
};

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
});

const statusLabels = {
  PLANNING: "計画中",
  IN_PROGRESS: "進行中",
  CONFIRMED: "確定済み",
  IMPORTED: "取込済み",
};

const statusColors = {
  PLANNING: "bg-zinc-100 text-zinc-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  IMPORTED: "bg-purple-100 text-purple-700",
};

export function EventBudgetSection({
  eventId,
  eventTitle,
  eventBudget,
  groupId,
  canEdit,
}: Props) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 収支管理未作成時の作成フォーム
  if (!eventBudget) {
    return (
      <section className="rounded-2xl border border-dashed border-sky-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          イベント収支管理
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          このイベントの収入・支出を管理できます。
        </p>

        {!canEdit ? (
          <p className="mt-4 text-sm text-zinc-500">
            収支管理の作成は管理者のみが利用できます。
          </p>
        ) : !showCreateForm ? (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            収支管理を開始する
          </button>
        ) : (
          <CreateBudgetForm
            eventId={eventId}
            isCreating={isCreating}
            setIsCreating={setIsCreating}
            onCancel={() => setShowCreateForm(false)}
            onSuccess={() => router.refresh()}
          />
        )}
      </section>
    );
  }

  const balance = eventBudget.actualRevenue - eventBudget.actualExpense;
  const isReadOnly = eventBudget.status === "IMPORTED";

  return (
    <section className="space-y-4">
      {/* 収支サマリー */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              イベント収支管理
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {eventTitle}の収入・支出を記録します。
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              statusColors[eventBudget.status]
            }`}
          >
            {statusLabels[eventBudget.status]}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold text-emerald-700">収入</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {currencyFormatter.format(eventBudget.actualRevenue)}
            </p>
            <p className="mt-1 text-xs text-emerald-600">
              予算: {currencyFormatter.format(eventBudget.plannedRevenue)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-semibold text-rose-700">支出</p>
            <p className="mt-1 text-2xl font-bold text-rose-900">
              {currencyFormatter.format(eventBudget.actualExpense)}
            </p>
            <p className="mt-1 text-xs text-rose-600">
              予算: {currencyFormatter.format(eventBudget.plannedExpense)}
            </p>
          </div>
          <div
            className={`rounded-xl border p-4 ${
              balance >= 0
                ? "border-sky-200 bg-sky-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p
              className={`text-xs font-semibold ${
                balance >= 0 ? "text-sky-700" : "text-amber-700"
              }`}
            >
              収支
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                balance >= 0 ? "text-sky-900" : "text-amber-900"
              }`}
            >
              {currencyFormatter.format(balance)}
            </p>
            <p
              className={`mt-1 text-xs ${
                balance >= 0 ? "text-sky-600" : "text-amber-600"
              }`}
            >
              {balance >= 0 ? "黒字" : "赤字"}
            </p>
          </div>
        </div>

        {/* 確定・取込アクション */}
        {canEdit && !isReadOnly && (
          <BudgetActions
            eventId={eventId}
            eventBudget={eventBudget}
            onSuccess={() => router.refresh()}
          />
        )}

        {/* 取込履歴 */}
        {eventBudget.imports.length > 0 && (
          <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-semibold text-purple-900">取込履歴</p>
            {eventBudget.imports.map((imp) => (
              <div key={imp.id} className="mt-2 text-sm text-purple-700">
                <p>
                  {formatter.format(new Date(imp.importedAt))} -{" "}
                  {imp.importedBy.displayName}が{imp.ledgerEntryCount}
                  件を本会計に取り込みました
                </p>
                {imp.notes && (
                  <p className="mt-1 text-xs text-purple-600">{imp.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 収支記録 */}
      {!isReadOnly && canEdit && (
        <TransactionForm
          eventId={eventId}
          groupId={groupId}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* 取引一覧 */}
      <TransactionList
        transactions={eventBudget.transactions}
        canDelete={canEdit && !isReadOnly}
        eventId={eventId}
        onSuccess={() => router.refresh()}
      />
    </section>
  );
}

// 収支管理作成フォーム
function CreateBudgetForm({
  eventId,
  isCreating,
  setIsCreating,
  onCancel,
  onSuccess,
}: {
  eventId: number;
  isCreating: boolean;
  setIsCreating: (value: boolean) => void;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [plannedRevenue, setPlannedRevenue] = useState("");
  const [plannedExpense, setPlannedExpense] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch(`/api/events/${eventId}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedRevenue: plannedRevenue ? Number(plannedRevenue) : 0,
          plannedExpense: plannedExpense ? Number(plannedExpense) : 0,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "作成に失敗しました。");
        setIsCreating(false);
        return;
      }

      onSuccess();
    } catch {
      setError("通信エラーが発生しました。");
      setIsCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold text-zinc-700">予定収入（円）</span>
          <input
            type="number"
            min="0"
            step="1"
            value={plannedRevenue}
            onChange={(e) => setPlannedRevenue(e.target.value)}
            placeholder="100000"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-zinc-700">予定支出（円）</span>
          <input
            type="number"
            min="0"
            step="1"
            value={plannedExpense}
            onChange={(e) => setPlannedExpense(e.target.value)}
            placeholder="80000"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isCreating}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          {isCreating ? "作成中..." : "作成する"}
        </button>
      </div>
    </form>
  );
}

// 確定・取込アクションボタン
function BudgetActions({
  eventId,
  eventBudget,
  onSuccess,
}: {
  eventId: number;
  eventBudget: EventBudgetData;
  onSuccess: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!confirm("収支を確定しますか？確定後は編集できません。")) return;

    setError(null);
    setIsConfirming(true);

    try {
      const response = await fetch(`/api/events/${eventId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED" }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "確定に失敗しました。");
        setIsConfirming(false);
        return;
      }

      onSuccess();
    } catch {
      setError("通信エラーが発生しました。");
      setIsConfirming(false);
    }
  }

  async function handleImport() {
    setError(null);
    setIsImporting(true);

    try {
      const response = await fetch(`/api/events/${eventId}/budget/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "取り込みに失敗しました。");
        setIsImporting(false);
        return;
      }

      setShowImportDialog(false);
      onSuccess();
    } catch {
      setError("通信エラーが発生しました。");
      setIsImporting(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {eventBudget.status === "PLANNING" && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {isConfirming ? "確定中..." : "収支を確定する"}
          </button>
        )}
        {eventBudget.status === "CONFIRMED" && (
          <button
            type="button"
            onClick={() => setShowImportDialog(true)}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            本会計に取り込む
          </button>
        )}
      </div>

      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-900">
              本会計への取り込み
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              {eventBudget.transactions.length}
              件の取引を本会計（Ledger）に取り込みます。取り込み後は編集できません。
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowImportDialog(false)}
                disabled={isImporting}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
              >
                {isImporting ? "取り込み中..." : "取り込む"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 収支記録フォーム
function TransactionForm({
  eventId,
  groupId,
  onSuccess,
}: {
  eventId: number;
  groupId: number;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<"REVENUE" | "EXPENSE">("EXPENSE");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<
    { id: number; name: string; type: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // 勘定科目一覧取得
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const response = await fetch(`/api/accounts`);
        if (response.ok) {
          const data = (await response.json()) as {
            id: number;
            name: string;
            type: string;
          }[];
          setAccounts(data);
        }
      } catch {
        // エラーは無視
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/events/${eventId}/budget/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            accountId: Number(accountId),
            amount: Number(amount),
            description: description.trim(),
            transactionDate,
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "記録に失敗しました。");
        setIsSubmitting(false);
        return;
      }

      // フォームリセット
      setAccountId("");
      setAmount("");
      setDescription("");
      setTransactionDate(new Date().toISOString().slice(0, 10));
      onSuccess();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredAccounts = accounts.filter((acc) =>
    type === "REVENUE" ? acc.type === "INCOME" : acc.type === "EXPENSE"
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-900">収支を記録する</h3>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-zinc-700">種別</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as "REVENUE" | "EXPENSE");
                setAccountId(""); // 種別変更時にリセット
              }}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="EXPENSE">支出</option>
              <option value="REVENUE">収入</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-zinc-700">勘定科目</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">選択してください</option>
              {filteredAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-zinc-700">金額（円）</span>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="5000"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-zinc-700">取引日</span>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-zinc-700">摘要</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder={
              type === "REVENUE"
                ? "例: 夏祭り 参加費（田中太郎）"
                : "例: 夏祭り 会場費"
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          {isSubmitting ? "記録中..." : "記録する"}
        </button>
      </form>
    </div>
  );
}

// 取引一覧
function TransactionList({
  transactions,
  canDelete,
  eventId,
  onSuccess,
}: {
  transactions: EventBudgetData["transactions"];
  canDelete: boolean;
  eventId: number;
  onSuccess: () => void;
}) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(transactionId: number) {
    if (!confirm("この取引を削除しますか？")) return;

    setDeletingId(transactionId);

    try {
      const response = await fetch(
        `/api/events/${eventId}/budget/transactions/${transactionId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        alert("削除に失敗しました。");
        setDeletingId(null);
        return;
      }

      onSuccess();
    } catch {
      alert("通信エラーが発生しました。");
      setDeletingId(null);
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-zinc-500">まだ取引が記録されていません。</p>
      </div>
    );
  }

  const revenues = transactions.filter((t) => t.type === "REVENUE");
  const expenses = transactions.filter((t) => t.type === "EXPENSE");

  return (
    <div className="space-y-4">
      {/* 収入一覧 */}
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-emerald-900">
          収入 ({revenues.length}件)
        </h3>
        {revenues.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">収入の記録はありません。</p>
        ) : (
          <div className="mt-4 space-y-2">
            {revenues.map((tx) => (
              <div
                key={tx.id}
                className="flex items-start justify-between rounded-lg border border-emerald-100 bg-emerald-50 p-3"
              >
                <div className="flex-1">
                  <p className="font-medium text-emerald-900">
                    {tx.description}
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    {tx.account?.name ?? "科目未設定"} •{" "}
                    {formatter.format(new Date(tx.transactionDate))}
                  </p>
                  <p className="mt-1 text-xs text-emerald-600">
                    記録者: {tx.createdBy.displayName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-emerald-900">
                    +{currencyFormatter.format(tx.amount)}
                  </p>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                      className="rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 支出一覧 */}
      <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-rose-900">
          支出 ({expenses.length}件)
        </h3>
        {expenses.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">支出の記録はありません。</p>
        ) : (
          <div className="mt-4 space-y-2">
            {expenses.map((tx) => (
              <div
                key={tx.id}
                className="flex items-start justify-between rounded-lg border border-rose-100 bg-rose-50 p-3"
              >
                <div className="flex-1">
                  <p className="font-medium text-rose-900">{tx.description}</p>
                  <p className="mt-1 text-sm text-rose-700">
                    {tx.account?.name ?? "科目未設定"} •{" "}
                    {formatter.format(new Date(tx.transactionDate))}
                  </p>
                  <p className="mt-1 text-xs text-rose-600">
                    記録者: {tx.createdBy.displayName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-rose-900">
                    -{currencyFormatter.format(tx.amount)}
                  </p>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                      className="rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
