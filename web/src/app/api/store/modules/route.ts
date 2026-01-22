import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { ROLE_ADMIN } from "@/lib/roles";
import {
  MODULE_LINKS,
  ModuleKey,
  resolveModules,
} from "@/lib/modules";

const TOGGLEABLE_KEYS: ModuleKey[] = MODULE_LINKS.map(
  (mod) => mod.key
).filter((key): key is ModuleKey => key !== "store");

function isModuleKey(value: string): value is ModuleKey {
  return MODULE_LINKS.some((module) => module.key === value);
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { moduleKey?: string; enable?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!body.moduleKey || !isModuleKey(body.moduleKey)) {
    return NextResponse.json({ error: "Unknown module" }, { status: 400 });
  }

  if (!TOGGLEABLE_KEYS.includes(body.moduleKey)) {
    return NextResponse.json(
      { error: "このモジュールは切り替えできません" },
      { status: 400 }
    );
  }

  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
    select: {
      role: true,
      group: { select: { id: true, enabledModules: true } },
    },
  });

  if (!member || !member.group) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (member.role !== ROLE_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const modules = new Set(resolveModules(member.group.enabledModules));
  if (body.enable) {
    modules.add(body.moduleKey);
  } else {
    modules.delete(body.moduleKey);
  }

  const updated = Array.from(modules);
  await prisma.group.update({
    where: { id: member.group.id },
    data: { enabledModules: updated },
  });

  return NextResponse.json({ ok: true, enabledModules: updated });
}
