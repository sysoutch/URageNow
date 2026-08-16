import {appendFile, mkdir, readFile, rename, rm, stat} from "node:fs/promises";
import path from "node:path";
import {appConfig} from "@urage/server/config/appConfig";

export type CompanionAccessAuditEntry = {
  timestamp?: string;
  event: string;
  deviceId?: string;
  deviceName?: string;
  permission?: string;
  method?: string;
  path?: string;
  allowed: boolean;
  details?: unknown;
};

const auditPath = path.resolve(appConfig.dataDirectory, "companion-access-audit.jsonl");
const maxAuditBytes = 5 * 1024 * 1024;
let auditQueue: Promise<unknown> = Promise.resolve();

export async function appendCompanionAccessAudit(entry: CompanionAccessAuditEntry): Promise<void> {
  const operation = auditQueue.then(async () => {
    await mkdir(path.dirname(auditPath), {recursive: true});
    try {
      if ((await stat(auditPath)).size >= maxAuditBytes) {
        await rm(`${auditPath}.previous`, {force: true});
        await rename(auditPath, `${auditPath}.previous`);
      }
    } catch {
      // A missing audit file is expected on first use.
    }
    await appendFile(auditPath, JSON.stringify({...entry, timestamp: entry.timestamp || new Date().toISOString()}) + "\n", "utf8");
  });
  auditQueue = operation.then(() => undefined, () => undefined);
  try {
    await operation;
  } catch {
    // Auditing must never turn an otherwise valid media request into a failure.
  }
}

export async function listCompanionAccessAudit(limit = 200): Promise<CompanionAccessAuditEntry[]> {
  await auditQueue;
  try {
    const lines = (await readFile(auditPath, "utf8")).trim().split(/\r?\n/).filter(Boolean);
    return lines.slice(-Math.min(1000, Math.max(1, limit))).reverse().flatMap(line => {
      try {
        return [JSON.parse(line) as CompanionAccessAuditEntry];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
