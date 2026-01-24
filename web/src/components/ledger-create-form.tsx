"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AccountOption = {
  id: number;
  name: string;
  type: string;
};

type Props = {
  accounts: AccountOption[];
};

export function LedgerCreateForm({ accounts }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [amount, setAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFileName, setReceiptFileName] = useState("");
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const hasAccounts = accounts.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    if (!hasAccounts || !accountId) {
      setError("勘定科目を選択してください。");
      setIsSubmitting(false);
      return;
    }
    if (!transactionDate) {
      setError("日付を入力してください。");
      setIsSubmitting(false);
      return;
    }
    try {
      const response = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amount: Number(amount),
          receiptUrl,
          notes,
          accountId: Number(accountId),
          transactionDate,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "登録に失敗しました。");
        return;
      }
      setTitle("");
      setAmount("");
      setTransactionDate(new Date().toISOString().slice(0, 10));
      setReceiptUrl("");
      setReceiptFileName("");
      setNotes("");
      setAccountId("");
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
      className="rounded-2xl border border-zinc-200 p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
          勘定科目
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={!hasAccounts}
            required
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
        <label className="text-sm text-zinc-600">
          内容
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="例: 備品購入"
            required
          />
        </label>
        <label className="text-sm text-zinc-600">
          金額（円）
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="12000"
            required
            min={1}
          />
        </label>
      </div>
      <label className="mt-4 block text-sm text-zinc-600">
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
        <p className="mt-1 text-xs text-red-500">{receiptUploadError}</p>
      ) : null}
      <label className="mt-4 block text-sm text-zinc-600">
        メモ
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          rows={3}
        />
      </label>
      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {!hasAccounts ? (
        <p className="mt-4 text-sm text-amber-600">
          勘定科目が登録されていません。管理者に科目の追加を依頼してください。
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting || !hasAccounts}
        className="mt-4 w-full rounded-lg bg-sky-600 py-2 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
      >
        {isSubmitting ? "登録中..." : "登録する"}
      </button>
    </form>
  );
}
