"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { ThreadSourceType } from "@prisma/client";
import { RelatedThreadButton } from "./related-thread-button";

type ApprovalDisplay = {
  id: number;
  action: "APPROVED" | "REJECTED";
  comment?: string | null;
  createdAt: string;
  actedBy: {
    id: number;
    displayName: string;
  };
};

export type LedgerDisplay = {
  id: number;
  title: string;
  amount: number;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  transactionDate: string;
  receiptUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  sourceChatMessageId?: number | null;
  sourceThreadId?: number | null;
  createdBy: {
    id: number;
    displayName: string;
  };
  approvals: ApprovalDisplay[];
  account?: {
    id: number;
    name: string;
    type: string;
  } | null;
};

type Props = {
  ledgers: LedgerDisplay[];
  canApprove: boolean;
  accounts: { id: number; name: string; type: string }[];
  groupId: number;
};

export function LedgerList({ ledgers, canApprove, accounts, groupId }: Props) {
  if (ledgers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        まだ会計データがありません。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {ledgers.map((ledger) => (
        <article
          key={ledger.id}
          className="rounded-2xl border border-zinc-200 p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">
                {new Intl.DateTimeFormat("ja-JP", {
                  timeZone: "Asia/Tokyo",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(
                  new Date(ledger.transactionDate ?? ledger.createdAt)
                )}
              </p>
              <h3 className="text-xl font-semibold text-zinc-900">
                {ledger.title}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-zinc-900">
                {ledger.amount < 0 ? "-" : ""}¥
                {Math.abs(ledger.amount).toLocaleString()}
              </p>
              <p
                className={`text-sm font-medium ${
                  ledger.status === "APPROVED"
                    ? "text-green-600"
                    : ledger.status === "REJECTED"
                    ? "text-red-600"
                    : ledger.status === "DRAFT"
                    ? "text-zinc-500"
                    : "text-amber-600"
                }`}
              >
                {statusLabel(ledger.status)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            登録者: {ledger.createdBy.displayName}
          </p>
          {ledger.receiptUrl ? (
            <p className="mt-2 text-sm">
              証憑:{" "}
              <a
                href={ledger.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 underline"
              >
                {ledger.receiptUrl}
              </a>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-zinc-600">
            科目:{" "}
            {ledger.account ? (
              <span>{ledger.account.name}</span>
            ) : (
              <span className="text-amber-600">未割当（下書き）</span>
            )}
          </p>
          {ledger.notes ? (
            <p className="mt-2 text-sm text-zinc-600">メモ: {ledger.notes}</p>
          ) : null}
          <RelatedThreadButton
            groupId={groupId}
            sourceType={ThreadSourceType.ACCOUNTING}
            sourceId={ledger.id}
            title={`Accounting: ${ledger.title}`}
            threadId={ledger.sourceThreadId ?? null}
            className="mt-3"
          />

          {ledger.status === "PENDING" && canApprove ? (
            <ApprovalActions ledgerId={ledger.id} />
          ) : null}
          {ledger.status === "DRAFT" ? (
            <DraftFinalizeForm ledger={ledger} accounts={accounts} />
          ) : null}
          {ledger.status === "REJECTED" ? (
            <RejectedActions ledgerId={ledger.id} />
          ) : null}

          {ledger.approvals.length > 0 ? (
            <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
              <p className="font-medium text-zinc-700">承認ログ</p>
              <ul className="mt-2 space-y-2">
                {ledger.approvals.map((approval) => (
                  <li key={approval.id}>
                    {new Intl.DateTimeFormat("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(approval.createdAt))}{" "}
                    -{" "}
                    {approval.actedBy.displayName}{" "}
                    {approval.action === "APPROVED" ? "承認" : "却下"}{" "}
                    {approval.comment ? `(${approval.comment})` : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function statusLabel(status: LedgerDisplay["status"]) {
  switch (status) {
    case "APPROVED":
      return "承認済み";
    case "REJECTED":
      return "却下";
    case "DRAFT":
      return "下書き";
    default:
      return "承認待ち";
  }
}

function ApprovalActions({ ledgerId }: { ledgerId: number }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<"approve" | "reject" | null>(
    null
  );

  async function handleAction(action: "approve" | "reject") {
    setIsSubmitting(action);
    setError(null);
    try {
      const response = await fetch(`/api/ledger/${ledgerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId,
          action,
          comment: comment || undefined,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "処理に失敗しました。");
        return;
      }
      setComment("");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(null);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        placeholder="コメント（任意）"
        rows={2}
      />
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleAction("approve")}
          disabled={isSubmitting !== null}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting === "approve" ? "承認中..." : "承認"}
        </button>
        <button
          type="button"
          onClick={() => handleAction("reject")}
          disabled={isSubmitting !== null}
          className="flex-1 rounded-lg bg-red-600 py-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting === "reject" ? "却下中..." : "却下"}
        </button>
      </div>
    </div>
  );
}

function DraftFinalizeForm({
  ledger,
  accounts,
}: {
  ledger: LedgerDisplay;
  accounts: { id: number; name: string; type: string }[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    ledger.amount !== 0 ? String(ledger.amount) : ""
  );
  const [accountId, setAccountId] = useState(
    ledger.account?.id ? String(ledger.account.id) : ""
  );
  const formatDateInput = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toISOString().slice(0, 10);
  };
  const [transactionDate, setTransactionDate] = useState(
    formatDateInput(ledger.transactionDate ?? ledger.createdAt)
  );
  const [receiptUrl, setReceiptUrl] = useState(ledger.receiptUrl ?? "");
  const [notes, setNotes] = useState(ledger.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFileName, setReceiptFileName] = useState("");
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const hasAccounts = accounts.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountId) {
      setError("勘定科目を選択してください。");
      return;
    }
    if (!transactionDate) {
      setError("日付を入力してください。");
      return;
    }
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber === 0) {
      setError("正しい金額を入力してください（0以外）。");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/ledger/${ledger.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ledger.id,
          amount: amountNumber,
          accountId: Number(accountId),
          transactionDate,
          receiptUrl,
          notes,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "送信に失敗しました。");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReceiptFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setIsUploadingReceipt(true);
    setReceiptUploadError(null);
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const response = await fetch("/api/receipts", {
        method: "POST",
        body: uploadForm,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "アップロードに失敗しました。");
      }
      const data = (await response.json()) as { url: string; fileName: string };
      setReceiptUrl(data.url);
      setReceiptFileName(file.name);
    } catch (err) {
      setReceiptUploadError(
        err instanceof Error ? err.message : "アップロードに失敗しました。"
      );
    } finally {
      event.target.value = "";
      setIsUploadingReceipt(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4"
    >
      <p className="text-sm text-zinc-600">
        下書きを正式な申請にするには、確定した金額と勘定科目を入力してください。
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-zinc-600">
          日付
          <input
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>
        <label className="text-sm text-zinc-600">
          金額（円）
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="正の値または赤伝票（マイナス値）"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>
        <label className="text-sm text-zinc-600">
          勘定科目
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            disabled={!hasAccounts}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-zinc-100"
          >
            <option value="">選択してください</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-sm text-zinc-600">
        証憑URL（任意）
        <input
          value={receiptUrl}
          onChange={(e) => setReceiptUrl(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="https://example.com/receipt"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <input
          ref={receiptFileInputRef}
          type="file"
          className="hidden"
          onChange={handleReceiptFileChange}
        />
        <button
          type="button"
          onClick={() => receiptFileInputRef.current?.click()}
          className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-700 transition hover:border-sky-500 hover:text-sky-600"
          disabled={isUploadingReceipt}
        >
          {isUploadingReceipt ? "アップロード中…" : "ローカルファイルを添付"}
        </button>
        {receiptFileName && !isUploadingReceipt ? (
          <span className="text-xs text-zinc-500">
            {receiptFileName} をアップロードしました
          </span>
        ) : null}
      </div>
      {receiptUploadError ? (
        <p className="text-xs text-red-500">{receiptUploadError}</p>
      ) : null}
      <label className="text-sm text-zinc-600">
        メモ
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          rows={2}
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {!hasAccounts ? (
        <p className="text-sm text-amber-600">
          勘定科目が登録されていません。管理者に科目追加を依頼してください。
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!hasAccounts || isSubmitting}
        className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
      >
        {isSubmitting ? "申請中..." : "申請に進む"}
      </button>
    </form>
  );
}

function RejectedActions({ ledgerId }: { ledgerId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleRevert() {
    setIsReverting(true);
    setError(null);
    try {
      const response = await fetch(`/api/ledger/${ledgerId}/revert`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "処理に失敗しました。");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsReverting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/ledger/${ledgerId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "削除に失敗しました。");
        return;
      }
      setShowDeleteConfirm(false);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRevert}
            disabled={isReverting || isDeleting}
            className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isReverting ? "処理中..." : "修正して再申請"}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isReverting || isDeleting}
            className="flex-1 rounded-lg bg-zinc-600 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            削除
          </button>
        </div>
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">
              経費の削除
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              この経費を削除します。この操作は取り消せません。よろしいですか？
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
