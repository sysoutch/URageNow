import assert from "node:assert/strict";
import { hasValidRemoteWorkerSecret, requireRemoteWorkerSecret } from "@urage/server/security/remoteWorkerAuth";

assert.throws(() => requireRemoteWorkerSecret(""), /requires REMOTE_WORKER_SHARED_SECRET/);
assert.throws(() => requireRemoteWorkerSecret("  \t "), /requires REMOTE_WORKER_SHARED_SECRET/);
assert.equal(requireRemoteWorkerSecret("  worker-secret  "), "worker-secret");
assert.equal(hasValidRemoteWorkerSecret("worker-secret", undefined), false);
assert.equal(hasValidRemoteWorkerSecret("worker-secret", ""), false);
assert.equal(hasValidRemoteWorkerSecret("worker-secret", "wrong"), false);
assert.equal(hasValidRemoteWorkerSecret("worker-secret", "worker-secret"), true);
assert.equal(hasValidRemoteWorkerSecret("worker-secret", ["wrong", " worker-secret "]), true);

console.log("Remote worker authentication checks passed.");
