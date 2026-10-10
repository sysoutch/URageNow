import { timingSafeEqual } from "node:crypto";

export function requireRemoteWorkerSecret(value: string): string {
  const secret = value.trim();
  if (!secret) {
    throw new Error("Remote worker startup requires REMOTE_WORKER_SHARED_SECRET or the native remote-worker credential.");
  }
  return secret;
}

export function hasValidRemoteWorkerSecret(expectedSecret: string, provided: string | string[] | undefined): boolean {
  const expected = expectedSecret.trim();
  if (!expected || provided === undefined) {
    return false;
  }
  const candidates = Array.isArray(provided) ? provided : [provided];
  const expectedBytes = Buffer.from(expected, "utf8");
  return candidates.some(value => {
    const candidateBytes = Buffer.from(value.trim(), "utf8");
    return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
  });
}
