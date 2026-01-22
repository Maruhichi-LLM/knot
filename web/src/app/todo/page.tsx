import Link from "next/link";
import { redirect } from "next/navigation";
import { TodoStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ensureModuleEnabled } from "@/lib/modules";
import { revalidatePath } from "next/cache";

const STATUS_LABELS: Record<TodoStatus, string> = {
  TODO: "未着手",
  IN_PROGRESS: "進行中",
  DONE: "完了",
};

type TodoPageProps = {
  searchParams?: {
    focus?: string;
  };
};

async function updateTodoStatusAction(formData: FormData) {
  "use server";
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  const todoId = Number(formData.get("todoId"));
  const statusValue = formData.get("status");
  if (!Number.isInteger(todoId) || typeof statusValue !== "string") {
    throw new Error("不正な入力です。");
  }
  const newStatus = statusValue as TodoStatus;
  if (!Object.prototype.hasOwnProperty.call(STATUS_LABELS, newStatus)) {
    throw new Error("不正なステータスです。");
  }
  const todo = await prisma.todoItem.findFirst({
    where: { id: todoId, groupId: session.groupId },
  });
  if (!todo) {
    throw new Error("対象のToDoが見つかりません。");
  }
  await prisma.todoItem.update({
    where: { id: todo.id },
    data: { status: newStatus },
  });
  revalidatePath("/todo");
}

export default async function TodoPage({ searchParams }: TodoPageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/join");
  }
  await ensureModuleEnabled(session.groupId, "todo");

  const todos = await prisma.todoItem.findMany({
    where: { groupId: session.groupId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, displayName: true } },
      assignedTo: { select: { id: true, displayName: true } },
    },
  });
  const focusId = Number(searchParams?.focus ?? "");

  return (
    <div className="min-h-screen py-10">
      <div className="page-shell space-y-8">
        <header className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Knot ToDo
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            会話から生まれた「やること」を一元管理
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Knot Chatから変換されたタスクが並びます。担当や期限が固まり次第、
            状態を更新してください。タスクからチャットに戻り、コンテキストをすぐ確認できます。
          </p>
        </header>

        <section className="space-y-4">
          {todos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              まだToDoはありません。Knot Chatから変換するとここに表示されます。
            </p>
          ) : (
            todos.map((todo) => {
              const isFocused = Number.isInteger(focusId) && focusId === todo.id;
              return (
                <article
                  key={todo.id}
                  id={`todo-${todo.id}`}
                  className={`rounded-2xl border bg-white/90 p-6 shadow-sm ${
                    isFocused ? "ring-2 ring-sky-300" : "border-zinc-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-400">
                        {new Intl.DateTimeFormat("ja-JP", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(todo.createdAt)}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-zinc-900">
                        {todo.title}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-600">
                        登録者: {todo.createdBy.displayName}
                      </p>
                      {todo.assignedTo ? (
                        <p className="text-sm text-zinc-600">
                          担当: {todo.assignedTo.displayName}
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-500">担当: 未設定</p>
                      )}
                      {todo.body ? (
                        <p className="mt-3 whitespace-pre-line text-sm text-zinc-800">
                          {todo.body}
                        </p>
                      ) : null}
                    </div>
                    <form
                      action={updateTodoStatusAction}
                      className="flex flex-col items-end gap-2 text-sm"
                    >
                      <input type="hidden" name="todoId" value={todo.id} />
                      <label className="text-xs font-semibold text-zinc-500">
                        状態
                        <select
                          name="status"
                          defaultValue={todo.status}
                          className="mt-1 rounded-full border border-zinc-200 px-3 py-1.5 text-zinc-800"
                        >
                          {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="rounded-full bg-zinc-900 px-4 py-1 text-xs font-semibold text-white hover:bg-zinc-800"
                      >
                        更新
                      </button>
                    </form>
                  </div>
                  {todo.sourceChatMessageId ? (
                    <div className="mt-4 text-sm">
                      <Link
                        href={`/chat?message=${todo.sourceChatMessageId}`}
                        className="inline-flex items-center gap-1 text-sky-600 underline"
                      >
                        元のチャットを開く
                      </Link>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
