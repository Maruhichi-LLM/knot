import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";
import { ensureOrgChatThread } from "@/lib/chat";
import { ChatInput } from "@/components/chat-input";
import { ChatMessageActions } from "@/components/chat-message-actions";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "short",
  timeStyle: "short",
});

type ChatPageProps = {
  searchParams?: Promise<{
    message?: string;
  }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  await ensureModuleEnabled(session.groupId, "chat");

  const thread = await ensureOrgChatThread(session.groupId);
  const messages = await prisma.chatMessage.findMany({
    where: { threadId: thread.id },
    include: {
      author: {
        select: { id: true, displayName: true },
      },
      todoItems: { select: { id: true } },
      ledgerEntries: { select: { id: true } },
      documents: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const resolvedParams = (await searchParams) ?? {};
  const focusedMessageId = Number(resolvedParams.message ?? "");

  return (
    <div className="min-h-screen py-10">
      <div className="page-shell flex flex-col gap-6">
        <header className="rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-sky-600">
            Knot Chat
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            意思決定の起点となる会話
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            チャットの発言そのものが ToDo や会計下書きに変換される想定です。次に
            取るべき行動をここで決めましょう。
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            まもなくこの発言から{" "}
            <Link href="/todo" className="font-semibold text-sky-600">
              Knot ToDo
            </Link>{" "}
            や{" "}
            <Link href="/ledger" className="font-semibold text-sky-600">
              Knot Accounting
            </Link>{" "}
            へ直接変換できるようになります。
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  まだメッセージがありません。最初の意思決定を記録しましょう。
                </p>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    id={`message-${message.id}`}
                    className={`rounded-xl border px-4 py-3 shadow-sm ${
                      focusedMessageId === message.id
                        ? "border-sky-200 bg-sky-50"
                        : "border-zinc-100 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-700">
                        {message.author.displayName}
                      </span>
                      <time dateTime={message.createdAt.toISOString()}>
                        {formatter.format(message.createdAt)}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-zinc-800">
                      {message.body}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <ChatMessageActions
                        messageId={message.id}
                        convertedTargets={{
                          todo: message.todoItems.length > 0,
                          accounting: message.ledgerEntries.length > 0,
                          document: message.documents.length > 0,
                        }}
                      />
                    </div>
                  </article>
                ))
              )}
            </div>
            <ChatInput />
          </div>
        </section>
      </div>
    </div>
  );
}
