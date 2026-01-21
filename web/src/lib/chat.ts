import { prisma } from "./prisma";

export async function ensureOrgChatThread(groupId: number) {
  let thread = await prisma.chatThread.findFirst({
    where: { groupId, scopeType: "ORG" },
  });
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: {
        groupId,
        scopeType: "ORG",
      },
    });
  }
  return thread;
}
