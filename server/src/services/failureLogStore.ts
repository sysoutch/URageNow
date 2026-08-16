import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { redactLogText } from "../security/logRedaction.js";

const defaultMaxBytes = 1_048_576;

export interface RuntimeFailureLogInput {
  source: string;
  requestId: string;
  method: string;
  path: string;
  detail: string;
}

export interface FailureLogStore {
  record: (input: RuntimeFailureLogInput) => void;
  flush: () => Promise<void>;
}

function toLogLine(input: RuntimeFailureLogInput): string {
  return `${JSON.stringify({
    createdAt: new Date().toISOString(),
    source: redactLogText(input.source).slice(0, 120),
    requestId: redactLogText(input.requestId).slice(0, 120),
    method: redactLogText(input.method).slice(0, 12),
    path: redactLogText(input.path).slice(0, 500),
    detail: redactLogText(input.detail).slice(0, 2_000)
  })}\n`;
}

export function createFailureLogStore(input: {directory: string; maxBytes?: number}): FailureLogStore {
  const directory = path.resolve(input.directory);
  const logPath = path.join(directory, "runtime-failures.jsonl");
  const previousLogPath = path.join(directory, "runtime-failures.previous.jsonl");
  const maxBytes = Math.max(4_096, input.maxBytes || defaultMaxBytes);
  let pending = Promise.resolve();

  async function append(line: string): Promise<void> {
    await mkdir(directory, {recursive: true});
    const currentSize = await stat(logPath).then(entry => entry.size).catch(() => 0);
    if (currentSize > 0 && currentSize + Buffer.byteLength(line) > maxBytes) {
      await rm(previousLogPath, {force: true});
      await rename(logPath, previousLogPath);
    }
    await appendFile(logPath, line, "utf8");
  }

  return {
    record: event => {
      const line = toLogLine(event);
      pending = pending.then(() => append(line)).catch(error => {
        console.error("Failed to persist redacted runtime failure log.", error);
      });
    },
    flush: () => pending
  };
}

const runtimeFailureLogStore = createFailureLogStore({directory: appConfig.dataDirectory});

export function recordRuntimeFailure(input: RuntimeFailureLogInput): void {
  runtimeFailureLogStore.record(input);
}
