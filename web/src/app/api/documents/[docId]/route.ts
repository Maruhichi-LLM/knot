import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { isPlatformAdminEmail } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import path from "node:path";
import fs from "node:fs/promises";
import {
  getDocumentStorageBaseDir,
  saveUploadedDocumentFile,
} from "@/lib/document-storage";

async function loadDocument(docId: number) {
  return prisma.document.findUnique({
    where: { id: docId },
    include: {
      group: { select: { id: true, name: true } },
      event: { select: { id: true, title: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          createdBy: { select: { id: true, displayName: true } },
        },
      },
      createdBy: { select: { id: true, displayName: true } },
    },
  });
}

async function ensureAccess(documentGroupId: number, sessionGroupId: number, memberEmail: string | null | undefined) {
  if (isPlatformAdminEmail(memberEmail ?? null)) {
    return true;
  }
  return documentGroupId === sessionGroupId;
}

async function loadRequester(memberId: number) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { email: true },
  });
  return member?.email ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { docId: docIdString } = await params;
  const docId = Number(docIdString);
  if (!Number.isInteger(docId)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }
  const document = await loadDocument(docId);
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const email = await loadRequester(session.memberId);
  const allowed = await ensureAccess(document.groupId, session.groupId, email);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const downloadParam = searchParams.get("download");

  if (downloadParam) {
    let version = document.versions[0];
    if (downloadParam !== "latest") {
      const requestedId = Number(downloadParam);
      if (!Number.isInteger(requestedId)) {
        return NextResponse.json(
          { error: "Invalid version id" },
          { status: 400 }
        );
      }
      const foundVersion = document.versions.find((v) => v.id === requestedId);
      if (!foundVersion) {
        return NextResponse.json({ error: "Version not found" }, { status: 404 });
      }
      version = foundVersion;
    }
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const absolutePath = path.join(
      getDocumentStorageBaseDir(),
      version.storedPath
    );
    try {
      const data = await fs.readFile(absolutePath);
      return new NextResponse(data, {
        headers: {
          "Content-Type": version.mimeType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
            version.originalFilename
          )}`,
        },
      });
    } catch {
      return NextResponse.json(
        { error: "ファイルを取得できませんでした。" },
        { status: 404 }
      );
    }
  }

  return NextResponse.json({
    document: {
      id: document.id,
      title: document.title,
      category: document.category,
      fiscalYear: document.fiscalYear,
      event: document.event,
      group: document.group,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      versions: document.versions,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { docId: docIdString } = await params;
  const docId = Number(docIdString);
  if (!Number.isInteger(docId)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }
  const document = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const email = await loadRequester(session.memberId);
  const allowed = await ensureAccess(document.groupId, session.groupId, email);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "ファイルを選択してください。" },
      { status: 400 }
    );
  }

  try {
    const nextVersionNumber =
      (document.versions[0]?.versionNumber ?? 0) + 1;
    const version = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: nextVersionNumber,
        originalFilename: file.name,
        storedPath: "",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        createdByMemberId: session.memberId,
      },
    });
    const storedPath = await saveUploadedDocumentFile(
      document.groupId,
      document.id,
      version.id,
      file
    );
    await prisma.documentVersion.update({
      where: { id: version.id },
      data: { storedPath },
    });
    await prisma.document.update({
      where: { id: document.id },
      data: { updatedAt: new Date() },
    });
    revalidatePath("/documents");
    revalidatePath(`/documents/${document.id}`);
    return NextResponse.json({ success: true, versionId: version.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存に失敗しました。" },
      { status: 400 }
    );
  }
}
