import { ThreadSourceType, ThreadStatus } from "@prisma/client";
import { prisma } from "./prisma";

const FREE_THREAD_TITLE = "FREEスレッド";

export async function ensureFreeThread(groupId: number) {
  let thread = await prisma.chatThread.findFirst({
    where: { groupId, sourceType: ThreadSourceType.FREE },
  });
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: {
        groupId,
        title: FREE_THREAD_TITLE,
        sourceType: ThreadSourceType.FREE,
        status: ThreadStatus.OPEN,
      },
    });
  }
  return thread;
}

export async function findExistingThreadForSource(
  groupId: number,
  sourceType: ThreadSourceType,
  sourceId: number | null
) {
  if (sourceType === ThreadSourceType.FREE) {
    return ensureFreeThread(groupId);
  }
  if (sourceId === null || Number.isNaN(sourceId)) {
    return null;
  }
  return prisma.chatThread.findFirst({
    where: { groupId, sourceType, sourceId },
  });
}
