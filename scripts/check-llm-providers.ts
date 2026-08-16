import assert from "node:assert/strict";
import {
  getProviderLabel,
  getProviderPriority,
  parseModelSelectionValue
} from "@urage/server/services/llm/runtime";
import { optionalAliasedString } from "@urage/server/config/appConfig";

assert.deepEqual(parseModelSelectionValue("llamacpp::local-model", "ollama"), {
  provider: "llamacpp",
  model: "local-model"
});
assert.equal(getProviderLabel("llamacpp"), "llama.cpp");
assert.deepEqual(getProviderPriority("llamacpp"), ["llamacpp", "ollama", "lmstudio"]);

const primaryName = "URAGE_TEST_OPENAI_COMPATIBLE_VALUE";
const legacyName = "URAGE_TEST_LMSTUDIO_VALUE";
const originalPrimary = process.env[primaryName];
const originalLegacy = process.env[legacyName];
try {
  process.env[legacyName] = "legacy";
  delete process.env[primaryName];
  assert.equal(optionalAliasedString(primaryName, legacyName, "fallback"), "legacy");
  process.env[primaryName] = "preferred";
  assert.equal(optionalAliasedString(primaryName, legacyName, "fallback"), "preferred");
} finally {
  if (originalPrimary === undefined) delete process.env[primaryName];
  else process.env[primaryName] = originalPrimary;
  if (originalLegacy === undefined) delete process.env[legacyName];
  else process.env[legacyName] = originalLegacy;
}

console.log("LLM provider validation passed.");
