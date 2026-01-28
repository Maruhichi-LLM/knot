import pkg from "@prisma/client";

const { PrismaClient, ThreadSourceType } = pkg;
const prisma = new PrismaClient();

function getFiscalYear(date, startMonth = 4) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= startMonth ? year : year - 1;
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function main() {
  const groups = await prisma.group.findMany({
    select: {
      id: true,
      fiscalYearStartMonth: true,
      accountingSetting: { select: { fiscalYearStartMonth: true } },
    },
  });
  const fiscalYearByGroup = new Map(
    groups.map((group) => [
      group.id,
      group.accountingSetting?.fiscalYearStartMonth ??
        group.fiscalYearStartMonth ??
        4,
    ])
  );

  await prisma.searchIndex.deleteMany();

  const [
    ledgers,
    events,
    todos,
    documents,
    threads,
    messages,
  ] = await Promise.all([
    prisma.ledger.findMany({
      select: {
        id: true,
        groupId: true,
        title: true,
        notes: true,
        transactionDate: true,
        sourceThreadId: true,
        createdAt: true,
      },
    }),
    prisma.event.findMany({
      select: {
        id: true,
        groupId: true,
        title: true,
        description: true,
        location: true,
        startsAt: true,
      },
    }),
    prisma.todoItem.findMany({
      select: {
        id: true,
        groupId: true,
        title: true,
        body: true,
        dueDate: true,
        createdAt: true,
        sourceThreadId: true,
      },
    }),
    prisma.document.findMany({
      select: {
        id: true,
        groupId: true,
        title: true,
        eventId: true,
        fiscalYear: true,
        sourceThreadId: true,
        createdAt: true,
      },
    }),
    prisma.chatThread.findMany({
      select: {
        id: true,
        groupId: true,
        title: true,
        createdAt: true,
        sourceType: true,
        sourceId: true,
      },
    }),
    prisma.chatMessage.findMany({
      select: {
        id: true,
        groupId: true,
        body: true,
        createdAt: true,
        threadId: true,
      },
    }),
  ]);

  const threadMap = new Map(threads.map((thread) => [thread.id, thread]));

  const entries = [];

  for (const ledger of ledgers) {
    const startMonth = fiscalYearByGroup.get(ledger.groupId) ?? 4;
    entries.push({
      groupId: ledger.groupId,
      entityType: "LEDGER",
      entityId: ledger.id,
      title: ledger.title,
      content: ledger.notes,
      urlPath: `/accounting?focus=${ledger.id}`,
      threadId: ledger.sourceThreadId,
      fiscalYear: getFiscalYear(ledger.transactionDate, startMonth),
      occurredAt: ledger.transactionDate,
    });
  }

  for (const eventItem of events) {
    entries.push({
      groupId: eventItem.groupId,
      entityType: "EVENT",
      entityId: eventItem.id,
      title: eventItem.title,
      content: [eventItem.description, eventItem.location]
        .filter(Boolean)
        .join(" "),
      urlPath: `/events/${eventItem.id}`,
      eventId: eventItem.id,
      occurredAt: eventItem.startsAt,
    });
  }

  for (const todo of todos) {
    entries.push({
      groupId: todo.groupId,
      entityType: "TODO",
      entityId: todo.id,
      title: todo.title,
      content: todo.body,
      urlPath: `/todo?focus=${todo.id}`,
      threadId: todo.sourceThreadId,
      occurredAt: todo.dueDate ?? todo.createdAt,
    });
  }

  for (const document of documents) {
    entries.push({
      groupId: document.groupId,
      entityType: "DOCUMENT",
      entityId: document.id,
      title: document.title,
      content: null,
      urlPath: `/documents/${document.id}`,
      threadId: document.sourceThreadId,
      eventId: document.eventId,
      fiscalYear: document.fiscalYear,
      occurredAt: document.createdAt,
    });
  }

  for (const thread of threads) {
    entries.push({
      groupId: thread.groupId,
      entityType: "CHAT_THREAD",
      entityId: thread.id,
      title: thread.title,
      urlPath: `/threads/${thread.id}`,
      threadId: thread.id,
      eventId:
        thread.sourceType === ThreadSourceType.EVENT
          ? thread.sourceId ?? null
          : null,
      occurredAt: thread.createdAt,
    });
  }

  for (const message of messages) {
    const thread = threadMap.get(message.threadId);
    entries.push({
      groupId: message.groupId,
      entityType: "CHAT_MESSAGE",
      entityId: message.id,
      title: thread?.title ?? "Chat",
      content: message.body,
      urlPath: `/threads/${message.threadId}`,
      threadId: message.threadId,
      eventId:
        thread?.sourceType === ThreadSourceType.EVENT
          ? thread?.sourceId ?? null
          : null,
      occurredAt: message.createdAt,
    });
  }

  const batches = chunk(entries, 500);
  for (const batch of batches) {
    await prisma.searchIndex.createMany({ data: batch });
  }

  console.log(`SearchIndex backfilled: ${entries.length} records`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
