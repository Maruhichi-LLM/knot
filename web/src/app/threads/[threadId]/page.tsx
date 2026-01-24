import Link from "next/link";
import { redirect } from "next/navigation";
import { ThreadSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";
import { ChatInput } from "@/components/chat-input";
import { ChatMessageActions } from "@/components/chat-message-actions";

const SOURCE_TYPE_LABELS: Record<ThreadSourceType, string> = {
  TODO: "ToDo",
  EVENT: "Event",
  ACCOUNTING: "Accounting",
  DOCUMENT: "Document",
  FREE: "FREE",
};

const TODO_STATUS_LABELS = {
  TODO: "未着手",
  IN_PROGRESS: "進行中",
  DONE: "完了",
} as const;

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "short",
  timeStyle: "short",
});

type PageProps = {
  params: Promise<{ threadId: string }>;
  searchParams?: Promise<{ message?: string }>;
};

export default async function ThreadDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const threadIdString = resolvedParams.threadId;
  const threadId = Number(threadIdString);
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  await ensureModuleEnabled(session.groupId, "chat");
  if (!Number.isInteger(threadId)) {
    redirect("/chat");
  }

  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, groupId: session.groupId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, displayName: true } },
          todoItems: { select: { id: true } },
          ledgerEntries: { select: { id: true } },
          documents: { select: { id: true } },
        },
      },
    },
  });
  if (!thread) {
    redirect("/chat");
  }

  const [todos] = await Promise.all([
    prisma.todoItem.findMany({
      where: { groupId: session.groupId, sourceThreadId: thread.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const focusedMessageId = Number(resolvedSearchParams?.message ?? "");
  const sourceLink = resolveSourceLink(thread.sourceType, thread.sourceId);

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      {/* ヘッダー */}
      <header className="flex-shrink-0 border-b border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition hover:border-sky-300 hover:text-sky-600"
            >
              ← 一覧
            </Link>
            <div className="h-6 w-px bg-zinc-200" />
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-600">
                  {SOURCE_TYPE_LABELS[thread.sourceType]}
                </span>
                <h1 className="text-lg font-semibold text-zinc-900">
                  {thread.title}
                </h1>
              </div>
              <p className="text-xs text-zinc-500">
                最終更新 {formatter.format(thread.updatedAt)}
              </p>
            </div>
          </div>
          {sourceLink ? (
            <Link
              href={sourceLink}
              className="text-sm text-sky-600 underline hover:text-sky-700"
            >
              元のモジュールを開く
            </Link>
          ) : null}
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* チャットエリア */}
        <div className="flex flex-1 flex-col">
          {/* メッセージエリア */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-4xl px-4 py-6">
              <div className="space-y-6">
                {thread.messages.length === 0 ? (
                  <div className="flex h-64 items-center justify-center">
                    <p className="text-center text-sm text-zinc-400">
                      まだメッセージがありません。<br />最初のアクションを記録しましょう。
                    </p>
                  </div>
                ) : (
                  thread.messages.map((message) => {
                    const isOwn = message.author.id === session.memberId;
                    const isFocused =
                      Number.isInteger(focusedMessageId) &&
                      focusedMessageId === message.id;
                    const bubbleClasses = isOwn
                      ? "bg-sky-600 text-white border-sky-500"
                      : "bg-white text-zinc-800 border-zinc-100";
                    return (
                      <div
                        key={message.id}
                        className={`flex w-full ${
                          isOwn ? "justify-end" : "justify-start"
                        }`}
                      >
                        <article
                          id={`message-${message.id}`}
                          className={`max-w-[750px] rounded-2xl border px-5 py-4 shadow-sm ${
                            isFocused ? "ring-2 ring-sky-300" : ""
                          } ${bubbleClasses}`}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span
                              className={`text-sm font-semibold ${
                                isOwn ? "text-white" : "text-zinc-900"
                              }`}
                            >
                              {message.author.displayName}
                            </span>
                            <time
                              dateTime={message.createdAt.toISOString()}
                              className={`text-xs ${
                                isOwn ? "text-white/70" : "text-zinc-400"
                              }`}
                            >
                              {formatter.format(message.createdAt)}
                            </time>
                          </div>
                          <p
                            className={`mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed ${
                              isOwn ? "text-white" : "text-zinc-800"
                            }`}
                          >
                            {message.body}
                          </p>
                          <div className={`mt-3 flex ${isOwn ? "justify-end" : "justify-start"}`}>
                            <ChatMessageActions
                              menuAlign={isOwn ? "right" : "left"}
                              messageId={message.id}
                              convertedTargets={{
                                todo: message.todoItems.length > 0,
                                accounting: message.ledgerEntries.length > 0,
                                document: message.documents.length > 0,
                              }}
                            />
                          </div>
                        </article>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 入力エリア（画面下部固定） */}
          <div className="flex-shrink-0 border-t border-zinc-200 bg-white px-4 py-4">
            <div className="mx-auto max-w-4xl">
              <ChatInput threadId={threadIdString} />
            </div>
          </div>
        </div>

        {/* サイドバー（ToDoリスト） */}
        <aside className="w-80 flex-shrink-0 border-l border-zinc-200 bg-white overflow-y-auto">
          <div className="p-6">
            <h2 className="text-base font-semibold text-zinc-900">
              このThreadから生まれたToDo
            </h2>
            {todos.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                まだToDoはありません。決まった内容は即座にToDoへ変換しましょう。
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {todos.map((todo) => (
                  <li key={todo.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm">
                    <p className="font-semibold text-zinc-900">{todo.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatter.format(todo.createdAt)} /{" "}
                      {TODO_STATUS_LABELS[todo.status as keyof typeof TODO_STATUS_LABELS] ??
                        todo.status}
                    </p>
                    <Link
                      href={`/todo?focus=${todo.id}`}
                      className="mt-2 inline-flex text-xs text-sky-600 underline hover:text-sky-700"
                    >
                      ToDoを開く
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function resolveSourceLink(sourceType: ThreadSourceType, sourceId: number | null) {
  if (!sourceId) {
    return null;
  }
  switch (sourceType) {
    case ThreadSourceType.TODO:
      return `/todo?focus=${sourceId}`;
    case ThreadSourceType.ACCOUNTING:
      return `/accounting?focus=${sourceId}`;
    case ThreadSourceType.DOCUMENT:
      return `/documents/${sourceId}`;
    case ThreadSourceType.EVENT:
      return `/events`;
    default:
      return null;
  }
}
