import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  resolveTypingTextConfig,
  selectTypingRoundTexts
} from "../server/src/services/games/typingSpeedTextConfig.js";

const words = Array.from({ length: 25 }, (_, index) => `word${index + 1}`).join(" ");
assert.deepEqual(resolveTypingTextConfig({ text: words }), { texts: [words], textMode: "sequential" });
assert.throws(() => resolveTypingTextConfig({ texts: ["too short"] }), /Text 1 must contain/);
assert.throws(() => resolveTypingTextConfig({ texts: [words], textMode: "unknown" }), /text mode/);
assert.deepEqual(selectTypingRoundTexts({ texts: ["one", "two"], textMode: "sequential" }, 5), ["one", "two", "one", "two", "one"]);
assert.deepEqual(selectTypingRoundTexts({ texts: ["one", "two"], textMode: "random" }, 3, () => 0.9), ["two", "two", "two"]);
const shuffled = selectTypingRoundTexts({ texts: ["one", "two", "three"], textMode: "shuffle" }, 6, () => 0.2);
assert.deepEqual(new Set(shuffled.slice(0, 3)), new Set(["one", "two", "three"]));
assert.deepEqual(new Set(shuffled.slice(3)), new Set(["one", "two", "three"]));

const scratch = await mkdtemp(path.join(tmpdir(), "urage-token-config-"));
try {
  process.env.DASHBOARD_DATA_DIR = scratch;
  const { getInstalledGamePackage, importGamePackage, setGameRuntimeEnabled, updateGameConfiguration } =
    await import("../server/src/services/games/gamePackageStore.js");
  await importGamePackage("token-typing");
  await setGameRuntimeEnabled("token-typing", "discord", true);
  const initial = await getInstalledGamePackage("token-typing");
  assert.ok(initial);
  assert.equal(resolveTypingTextConfig(initial.configuration).texts.length, 3);
  const updated = { rounds: 4, texts: [words, `${words} extra`], textMode: "shuffle" };
  await updateGameConfiguration("token-typing", updated);
  const saved = await getInstalledGamePackage("token-typing");
  assert.deepEqual(saved?.configuration, updated);
  assert.deepEqual(saved?.packageInfo.enabledRuntimes, ["discord"]);
  await assert.rejects(updateGameConfiguration("token-typing", { texts: ["too short"] }), /Text 1 must contain/);
  assert.deepEqual((await getInstalledGamePackage("token-typing"))?.configuration, updated);
} finally {
  const resolvedScratch = path.resolve(scratch);
  if (!resolvedScratch.startsWith(`${path.resolve(tmpdir())}${path.sep}`)) throw new Error("Unsafe test cleanup path.");
  await rm(resolvedScratch, { recursive: true, force: true });
}

console.log("Token Typing text configuration validation passed.");
