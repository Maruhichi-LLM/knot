import { prisma } from "@/lib/prisma";

export type SearchEntityType =
  | "CHAT_MESSAGE"
  | "CHAT_THREAD"
  | "TODO"
  | "EVENT"
  | "LEDGER"
  | "DOCUMENT";

export type UpsertSearchIndexInput = {
  groupId: number;
  entityType: SearchEntityType;
  entityId: number;
  title?: string | null;
  content?: string | null;
  urlPath: string;
  threadId?: number | null;
  eventId?: number | null;
  fiscalYear?: number | null;
  occurredAt?: Date | null;
};

const MAX_TEXT_LENGTH = 5000;

export function normalizeText(value?: string | null) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > MAX_TEXT_LENGTH
    ? normalized.slice(0, MAX_TEXT_LENGTH)
    : normalized;
}

export function extractSearchTerms(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [] as string[];
  return trimmed
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

export function buildSnippet(text: string, query: string, maxLength = 160) {
  const normalized = normalizeText(text) ?? "";
  if (!normalized) return "";

  const terms = extractSearchTerms(query).map((term) => term.toLowerCase());
  if (terms.length === 0) {
    return normalized.slice(0, maxLength);
  }

  const haystack = normalized.toLowerCase();
  let firstIndex = -1;
  for (const term of terms) {
    const idx = haystack.indexOf(term);
    if (idx >= 0 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }

  if (firstIndex === -1) {
    return normalized.slice(0, maxLength);
  }

  const context = Math.max(30, Math.floor(maxLength * 0.4));
  const start = Math.max(0, firstIndex - context);
  const end = Math.min(normalized.length, start + maxLength);
  let snippet = normalized.slice(start, end);
  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < normalized.length) {
    snippet = `${snippet}...`;
  }
  return snippet;
}

export async function upsertSearchIndex(input: UpsertSearchIndexInput) {
  const title = normalizeText(input.title);
  const content = normalizeText(input.content);

  return prisma.searchIndex.upsert({
    where: {
      entityType_entityId_groupId: {
        entityType: input.entityType,
        entityId: input.entityId,
        groupId: input.groupId,
      },
    },
    update: {
      title,
      content,
      urlPath: input.urlPath,
      threadId: input.threadId ?? null,
      eventId: input.eventId ?? null,
      fiscalYear: input.fiscalYear ?? null,
      occurredAt: input.occurredAt ?? null,
    },
    create: {
      groupId: input.groupId,
      entityType: input.entityType,
      entityId: input.entityId,
      title,
      content,
      urlPath: input.urlPath,
      threadId: input.threadId ?? null,
      eventId: input.eventId ?? null,
      fiscalYear: input.fiscalYear ?? null,
      occurredAt: input.occurredAt ?? null,
    },
  });
}

export async function deleteSearchIndex({
  groupId,
  entityType,
  entityId,
}: {
  groupId: number;
  entityType: SearchEntityType;
  entityId: number;
}) {
  return prisma.searchIndex.deleteMany({
    where: {
      groupId,
      entityType,
      entityId,
    },
  });
}
