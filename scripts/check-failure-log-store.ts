import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFailureLogStore } from "@urage/server/services/failureLogStore";

const directory = await mkdtemp(path.join(os.tmpdir(), "urage-failure-log-"));
const store = createFailureLogStore({directory, maxBytes: 4_096});

try {
  store.record({
    source: "test",
    requestId: "request-1",
    method: "GET",
    path: "/api?accessToken=secret-value",
    detail: "authorization: Bearer token-value"
  });
  await store.flush();
  const log = await readFile(path.join(directory, "runtime-failures.jsonl"), "utf8");
  assert.equal(log.includes("secret-value"), false);
  assert.equal(log.includes("token-value"), false);
  assert.match(log, /\[REDACTED\]/);
} finally {
  await rm(directory, {recursive: true, force: true});
}

console.log("Failure log store validation passed.");
