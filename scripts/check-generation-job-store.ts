import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createGenerationJobStore } from "@urage/server/services/generationJobStore";

const directory = await mkdtemp(path.join(os.tmpdir(), "urage-generation-jobs-"));

try {
  const store = createGenerationJobStore({directory, maxRecords: 25});
  const queued = await store.create({kind: "image", executionTarget: "remote", requestId: "request-1"});
  assert.equal(queued.status, "queued");
  assert.equal(queued.executionTarget, "remote");

  const running = await store.update(queued.id, {status: "running"});
  assert.equal(running?.startedAt !== null, true);

  const succeeded = await store.update(queued.id, {status: "succeeded", artifactId: "image-1"});
  assert.equal(succeeded?.status, "succeeded");
  assert.equal(succeeded?.artifactId, "image-1");
  assert.equal(succeeded?.finishedAt !== null, true);

  const active = await store.create({kind: "model3d"});
  await store.update(active.id, {status: "running"});
  const recoveredStore = createGenerationJobStore({directory});
  const recovered = await recoveredStore.list();
  assert.equal(recovered.find(record => record.id === active.id)?.status, "interrupted");
  assert.equal(recovered.find(record => record.id === active.id)?.error, "Interrupted by runtime restart.");
} finally {
  await rm(directory, {recursive: true, force: true});
}

console.log("Generation job store validation passed.");
