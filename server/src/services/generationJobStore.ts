import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appConfig } from "../config/appConfig.js";
import { redactLogText } from "../security/logRedaction.js";

const defaultMaxRecords = 250;

export type GenerationJobKind = "image" | "model3d" | "audio" | "music" | "video";
export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "interrupted";

export interface GenerationJobRecord {
  id: string;
  kind: GenerationJobKind;
  executionTarget: "local" | "remote";
  status: GenerationJobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestId: string | null;
  artifactId: string | null;
  error: string | null;
}

export interface GenerationJobStore {
  create: (input: {kind: GenerationJobKind; executionTarget?: "local" | "remote"; requestId?: string}) => Promise<GenerationJobRecord>;
  update: (id: string, input: {status: GenerationJobStatus; artifactId?: string | null; error?: string | null}) => Promise<GenerationJobRecord | null>;
  list: (limit?: number) => Promise<GenerationJobRecord[]>;
}

function cloneJob(record: GenerationJobRecord): GenerationJobRecord {
  return {...record};
}

function normalizeStoredJobs(value: unknown): GenerationJobRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is GenerationJobRecord => Boolean(entry) && typeof entry === "object"
    && typeof (entry as GenerationJobRecord).id === "string"
    && typeof (entry as GenerationJobRecord).kind === "string"
    && typeof (entry as GenerationJobRecord).status === "string"
    && typeof (entry as GenerationJobRecord).createdAt === "string");
}

function recoverInterruptedJobs(records: GenerationJobRecord[]): boolean {
  let changed = false;
  for (const record of records) {
    if (record.status !== "queued" && record.status !== "running") {
      continue;
    }
    record.status = "interrupted";
    record.finishedAt = new Date().toISOString();
    record.error = "Interrupted by runtime restart.";
    changed = true;
  }
  return changed;
}

export function createGenerationJobStore(input: {directory: string; maxRecords?: number}): GenerationJobStore {
  const directory = path.resolve(input.directory);
  const filePath = path.join(directory, "generation-jobs.json");
  const maxRecords = Math.max(25, input.maxRecords || defaultMaxRecords);
  let records: GenerationJobRecord[] | null = null;
  let pending = Promise.resolve();

  async function persist(): Promise<void> {
    if (!records) {
      return;
    }
    await mkdir(directory, {recursive: true});
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(records, null, 2), "utf8");
    await rename(temporaryPath, filePath);
  }

  async function load(): Promise<GenerationJobRecord[]> {
    if (records) {
      return records;
    }
    records = normalizeStoredJobs(await readFile(filePath, "utf8").then(JSON.parse).catch(() => []));
    if (recoverInterruptedJobs(records)) {
      await persist();
    }
    return records;
  }

  function queue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation, operation);
    pending = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    create: inputRecord => queue(async () => {
      const now = new Date().toISOString();
      const next = await load();
      const record: GenerationJobRecord = {
        id: randomUUID(),
        kind: inputRecord.kind,
        executionTarget: inputRecord.executionTarget === "remote" ? "remote" : "local",
        status: "queued",
        createdAt: now,
        startedAt: null,
        finishedAt: null,
        requestId: inputRecord.requestId?.trim().slice(0, 120) || null,
        artifactId: null,
        error: null
      };
      next.unshift(record);
      next.splice(maxRecords);
      await persist();
      return cloneJob(record);
    }),
    update: (id, update) => queue(async () => {
      const next = await load();
      const record = next.find(entry => entry.id === id);
      if (!record) {
        return null;
      }
      const now = new Date().toISOString();
      record.status = update.status;
      if (update.status === "running" && !record.startedAt) {
        record.startedAt = now;
      }
      if (update.status !== "queued" && update.status !== "running") {
        record.finishedAt = now;
      }
      if (update.artifactId !== undefined) {
        record.artifactId = update.artifactId?.trim().slice(0, 160) || null;
      }
      if (update.error !== undefined) {
        record.error = update.error ? redactLogText(update.error).slice(0, 500) : null;
      }
      await persist();
      return cloneJob(record);
    }),
    list: limit => queue(async () => {
      const next = await load();
      const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(maxRecords, Math.round(limit as number))) : maxRecords;
      return next.slice(0, normalizedLimit).map(cloneJob);
    })
  };
}

const generationJobStore = createGenerationJobStore({directory: appConfig.dataDirectory});

export function createGenerationJob(input: {kind: GenerationJobKind; executionTarget?: "local" | "remote"; requestId?: string}): Promise<GenerationJobRecord> {
  return generationJobStore.create(input);
}

export function updateGenerationJob(id: string, input: {status: GenerationJobStatus; artifactId?: string | null; error?: string | null}): Promise<GenerationJobRecord | null> {
  return generationJobStore.update(id, input);
}

export function listGenerationJobs(limit?: number): Promise<GenerationJobRecord[]> {
  return generationJobStore.list(limit);
}
