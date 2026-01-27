"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApprovalFormSchema,
  ApprovalFieldDefinition,
  ApprovalFormValues,
  buildInitialValues,
} from "@/lib/approval-schema";

export type TemplateOption = {
  id: number;
  name: string;
  description: string | null;
  schema: ApprovalFormSchema;
};

type Props = {
  templates: TemplateOption[];
};

export function ApplicationCreateForm({ templates }: Props) {
  const router = useRouter();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(
    templates[0]?.id ?? 0
  );
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<ApprovalFormValues>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  useEffect(() => {
    if (selectedTemplate) {
      setValues(buildInitialValues(selectedTemplate.schema));
      setTitle(`${selectedTemplate.name} ${new Date().toLocaleDateString("ja-JP")}`);
    }
  }, [selectedTemplate]);

  const updateValue = (fieldId: string, value: string | number | boolean | string[] | null) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTemplate) {
      setError("テンプレートを選択してください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/approval/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          title: title.trim(),
          data: values,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "申請の作成に失敗しました。");
      }
      setValues(buildInitialValues(selectedTemplate.schema));
      setTitle(`${selectedTemplate.name} ${new Date().toLocaleDateString("ja-JP")}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "申請の作成に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  if (templates.length === 0) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        利用可能なテンプレートがありません。管理者にテンプレートの作成を依頼してください。
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-zinc-600">
          申請テンプレート
          <select
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-600">
          申請タイトル
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="備品購入（4月部会向け）"
          />
        </label>
      </div>

      {selectedTemplate?.schema.instructions ? (
        <p className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-800">
          {selectedTemplate.schema.instructions}
        </p>
      ) : null}

      <div className="space-y-4">
        {selectedTemplate?.schema.items.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(value) => updateValue(field.id, value)}
          />
        ))}
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          {submitting ? "送信中..." : "申請を登録"}
        </button>
      </div>
    </form>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: ApprovalFieldDefinition;
  value: string | number | boolean | string[] | null;
  onChange: (value: string | number | boolean | string[] | null) => void;
}) {
  const requiredMark = field.required ? (
    <span className="ml-1 text-rose-500">*</span>
  ) : null;
  const helper = field.helpText ? (
    <p className="mt-1 text-xs text-zinc-500">{field.helpText}</p>
  ) : null;

  switch (field.type) {
    case "textarea":
      return (
        <label className="block text-sm text-zinc-600">
          {field.label}
          {requiredMark}
          <textarea
            value={(value as string | null) ?? ""}
            onChange={(event) => onChange(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder={field.placeholder}
          />
          {helper}
        </label>
      );
    case "number":
      return (
        <label className="block text-sm text-zinc-600">
          {field.label}
          {requiredMark}
          <input
            type="number"
            value={(value as string | number | null) ?? ""}
            onChange={(event) => onChange(event.target.value)}
            min={field.min}
            max={field.max}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder={field.placeholder}
          />
          {helper}
        </label>
      );
    case "date":
      return (
        <label className="block text-sm text-zinc-600">
          {field.label}
          {requiredMark}
          <input
            type="date"
            value={(value as string | null) ?? ""}
            onChange={(event) => onChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          {helper}
        </label>
      );
    case "select":
      return (
        <label className="block text-sm text-zinc-600">
          {field.label}
          {requiredMark}
          <select
            value={(value as string | null) ?? ""}
            onChange={(event) => onChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">選択してください</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {helper}
        </label>
      );
    case "multiSelect":
      return (
        <label className="block text-sm text-zinc-600">
          {field.label}
          {requiredMark}
          <select
            multiple
            value={(value as string[] | undefined) ?? []}
            onChange={(event) =>
              onChange(
                Array.from(event.target.selectedOptions).map((option) => option.value)
              )
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {helper}
        </label>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
          />
          {field.label}
          {requiredMark}
          {helper}
        </label>
      );
    default:
      return (
        <label className="block text-sm text-zinc-600">
          {field.label}
          {requiredMark}
          <input
            type="text"
            value={(value as string | null) ?? ""}
            onChange={(event) => onChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder={field.placeholder}
          />
          {helper}
        </label>
      );
  }
}
