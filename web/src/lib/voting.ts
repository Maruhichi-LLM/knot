import { createHash } from "crypto";

export type VotingOption = {
  id: string;
  label: string;
};

export const DEFAULT_VOTING_OPTIONS: VotingOption[] = [
  { id: "yes", label: "賛成" },
  { id: "no", label: "反対" },
  { id: "hold", label: "保留" },
];

export const VOTING_LIMITS = {
  titleMax: 80,
  descriptionMax: 500,
  optionLabelMax: 40,
  optionMin: 2,
  optionMax: 10,
  commentMax: 500,
} as const;

const OPTION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,20}$/;

export function buildVoteHash(votingId: number, memberId: number) {
  const pepper = process.env.VOTING_PEPPER;
  if (!pepper) {
    throw new Error("VOTING_PEPPER is not configured");
  }
  return createHash("sha256")
    .update(`${votingId}:${memberId}:${pepper}`)
    .digest("hex");
}

function normalizeLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function slugifyLabel(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

export function normalizeVotingOptions(input?: unknown) {
  if (!Array.isArray(input) || input.length === 0) {
    return { options: DEFAULT_VOTING_OPTIONS };
  }

  const normalized: VotingOption[] = [];
  const usedIds = new Set<string>();

  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index] as { id?: unknown; label?: unknown } | string;
    const label =
      typeof raw === "string" ? normalizeLabel(raw) : normalizeLabel(raw?.label);
    if (!label) {
      return { error: "選択肢のラベルを入力してください。" };
    }
    if (label.length > VOTING_LIMITS.optionLabelMax) {
      return {
        error: `選択肢のラベルは${VOTING_LIMITS.optionLabelMax}文字以内で入力してください。`,
      };
    }

    let id =
      typeof raw === "string"
        ? null
        : normalizeLabel(raw?.id ?? "");
    if (id && !OPTION_ID_PATTERN.test(id)) {
      return { error: "選択肢IDは英数字と記号(-, _)のみで設定してください。" };
    }
    if (!id) {
      id = slugifyLabel(label) ?? `option-${index + 1}`;
    }
    let uniqueId = id;
    let suffix = 1;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(uniqueId);
    normalized.push({ id: uniqueId, label });
  }

  if (
    normalized.length < VOTING_LIMITS.optionMin ||
    normalized.length > VOTING_LIMITS.optionMax
  ) {
    return {
      error: `選択肢は${VOTING_LIMITS.optionMin}〜${VOTING_LIMITS.optionMax}件で設定してください。`,
    };
  }

  return { options: normalized };
}

export function buildResultsFromCounts(
  options: VotingOption[],
  counts: Record<string, number>
) {
  const results: Record<string, number> = {};
  let total = 0;
  options.forEach((option) => {
    const value = counts[option.id] ?? 0;
    results[option.id] = value;
    total += value;
  });
  return { results, total };
}
