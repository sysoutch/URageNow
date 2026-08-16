import { randomUUID } from "node:crypto";

const sensitiveQueryPattern = /([?&](?:access[_-]?token|api[_-]?key|authorization|secret|password)=)[^&#\s]+/gi;
const sensitiveAssignmentPattern = /((?:access[_-]?token|api[_-]?key|authorization|secret|password)\s*(?:=|:)\s*)([^\s,;&]+)/gi;
const bearerTokenPattern = /\bBearer\s+[^\s,]+/gi;

export function createRequestId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export function redactLogText(value: unknown): string {
  return String(value || "")
    .replace(sensitiveQueryPattern, "$1[REDACTED]")
    .replace(bearerTokenPattern, "Bearer [REDACTED]")
    .replace(sensitiveAssignmentPattern, "$1[REDACTED]");
}
