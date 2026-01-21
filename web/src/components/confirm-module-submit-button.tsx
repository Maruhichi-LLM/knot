"use client";

type ConfirmModuleSubmitButtonProps = {
  originalModules: Record<string, boolean>;
  criticalKeys?: string[];
  label?: string;
};

export function ConfirmModuleSubmitButton({
  originalModules,
  criticalKeys = [],
  label = "保存",
}: ConfirmModuleSubmitButtonProps) {
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form || criticalKeys.length === 0) {
      return;
    }
    const data = new FormData(form);
    const selected = new Set(
      (data.getAll("enabledModules") as string[] | undefined) ?? []
    );
    const changed = criticalKeys.some((key) => {
      const wasEnabled = originalModules[key] ?? false;
      const nowEnabled = selected.has(key);
      return wasEnabled !== nowEnabled;
    });
    if (changed) {
      const ok = window.confirm(
        "Knot Accounting または Knot Management の設定が変更されます。続行しますか？"
      );
      if (!ok) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }

  return (
    <button
      type="submit"
      onClick={handleClick}
      className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
    >
      {label}
    </button>
  );
}
