import path from "node:path";
import fs from "node:fs/promises";

export const DOCUMENT_MAX_FILE_SIZE = 20 * 1024 * 1024;

export function getDocumentStorageBaseDir() {
  return (
    process.env.DOCUMENT_STORAGE_DIR ??
    path.join(process.cwd(), ".data", "documents")
  );
}

export async function saveDocumentBytes(
  groupId: number,
  documentId: number,
  versionId: number,
  buffer: Buffer
) {
  const relativePath = path.join(
    String(groupId),
    String(documentId),
    String(versionId)
  );
  const absolutePath = path.join(getDocumentStorageBaseDir(), relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return relativePath;
}

export async function saveUploadedDocumentFile(
  groupId: number,
  documentId: number,
  versionId: number,
  file: File
) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > DOCUMENT_MAX_FILE_SIZE) {
    throw new Error("ファイルサイズは20MB以下にしてください。");
  }
  return saveDocumentBytes(groupId, documentId, versionId, buffer);
}
