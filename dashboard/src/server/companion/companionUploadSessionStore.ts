import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";
import type { CompanionMediaKind } from "./companionMediaStore.js";

const sessionsRoot = path.resolve(appConfig.dataDirectory, "companion-upload-sessions");
const maxUploadBytes = 100 * 1024 * 1024;
const sessionQueues = new Map<string, Promise<unknown>>();

export type CompanionUploadSession = {
  id: string;
  kind: CompanionMediaKind;
  fileName: string;
  contentType: string;
  totalSize: number;
  offset: number;
  createdAt: string;
  deviceId: string;
  completedAt?: string;
  completionStartedAt?: string;
  result?: Record<string, unknown>;
};

function resolveSessionDirectory(uploadId: string): string {
  if (!/^[a-z0-9-]{12,80}$/i.test(uploadId)) throw new Error("Invalid upload session.");
  const directory = path.resolve(sessionsRoot, uploadId);
  if (!directory.startsWith(sessionsRoot + path.sep)) throw new Error("Invalid upload session path.");
  return directory;
}

function metadataPath(uploadId: string): string {
  return path.join(resolveSessionDirectory(uploadId), "metadata.json");
}

function payloadPath(uploadId: string): string {
  return path.join(resolveSessionDirectory(uploadId), "payload.part");
}

async function queueSessionMutation<T>(uploadId: string, mutation: () => Promise<T>): Promise<T> {
  const previous = sessionQueues.get(uploadId) || Promise.resolve();
  const operation = previous.then(mutation, mutation);
  const tail = operation.then(() => undefined, () => undefined);
  sessionQueues.set(uploadId, tail);
  try {
    return await operation;
  } finally {
    if (sessionQueues.get(uploadId) === tail) sessionQueues.delete(uploadId);
  }
}

export async function createCompanionUploadSession(input: {
  kind: CompanionMediaKind;
  fileName: string;
  contentType: string;
  totalSize: number;
  deviceId: string;
}): Promise<CompanionUploadSession> {
  if (!Number.isSafeInteger(input.totalSize) || input.totalSize <= 0 || input.totalSize > maxUploadBytes) {
    throw new Error("Upload size must be between 1 byte and 100 MiB.");
  }
  const id = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
  const session: CompanionUploadSession = {
    id,
    kind: input.kind,
    fileName: path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "upload.bin",
    contentType: input.contentType || "application/octet-stream",
    totalSize: input.totalSize,
    offset: 0,
    createdAt: new Date().toISOString(),
    deviceId: input.deviceId
  };
  const directory = resolveSessionDirectory(id);
  await mkdir(directory, { recursive: true });
  await writeFile(payloadPath(id), Buffer.alloc(0));
  await writeFile(metadataPath(id), JSON.stringify(session, null, 2) + "\n", "utf8");
  return session;
}

export async function readCompanionUploadSession(uploadId: string, deviceId: string): Promise<CompanionUploadSession> {
  const session = JSON.parse(await readFile(metadataPath(uploadId), "utf8")) as CompanionUploadSession;
  if (session.deviceId !== deviceId) throw new Error("Upload session belongs to another device.");
  if (session.completedAt) return session;
  const payloadStats = await stat(payloadPath(uploadId));
  session.offset = payloadStats.size;
  return session;
}

export async function appendCompanionUploadChunk(uploadId: string, deviceId: string, expectedOffset: number, data: Buffer): Promise<CompanionUploadSession> {
  return queueSessionMutation(uploadId, async () => {
    const session = await readCompanionUploadSession(uploadId, deviceId);
    if (session.offset !== expectedOffset) throw new Error(`Upload offset mismatch. Resume from ${session.offset}.`);
    if (data.length === 0) throw new Error("Upload chunk is empty.");
    if (session.offset + data.length > session.totalSize) throw new Error("Upload chunk exceeds the declared file size.");
    await appendFile(payloadPath(uploadId), data);
    session.offset += data.length;
    await writeFile(metadataPath(uploadId), JSON.stringify(session, null, 2) + "\n", "utf8");
    return session;
  });
}

export async function completeCompanionUploadSession(uploadId: string, deviceId: string): Promise<{ session: CompanionUploadSession; data: Buffer }> {
  return queueSessionMutation(uploadId, async () => {
    const session = await readCompanionUploadSession(uploadId, deviceId);
    if (session.completedAt) return { session, data: Buffer.alloc(0) };
    if (session.offset !== session.totalSize) throw new Error(`Upload is incomplete. Resume from ${session.offset}.`);
    return { session, data: await readFile(payloadPath(uploadId)) };
  });
}

export async function markCompanionUploadSessionCompleted(
  uploadId: string,
  deviceId: string,
  result: Record<string, unknown>
): Promise<CompanionUploadSession> {
  return queueSessionMutation(uploadId, async () => {
    const session = await readCompanionUploadSession(uploadId, deviceId);
    session.completedAt = session.completedAt || new Date().toISOString();
    session.result = session.result || result;
    await writeFile(metadataPath(uploadId), JSON.stringify(session, null, 2) + "\n", "utf8");
    await rm(payloadPath(uploadId), { force: true });
    return session;
  });
}

export async function beginCompanionUploadCompletion(uploadId: string, deviceId: string): Promise<CompanionUploadSession> {
  return queueSessionMutation(uploadId, async () => {
    const session = await readCompanionUploadSession(uploadId, deviceId);
    if (session.result) return session;
    if (session.completionStartedAt) {
      throw new Error("Upload completion was interrupted after it was claimed. Inspect dashboard media before retrying.");
    }
    session.completionStartedAt = new Date().toISOString();
    await writeFile(metadataPath(uploadId), JSON.stringify(session, null, 2) + "\n", "utf8");
    return session;
  });
}
