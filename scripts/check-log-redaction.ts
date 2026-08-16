import assert from "node:assert/strict";
import { createRequestId, redactLogText } from "@urage/server/security/logRedaction";

const redacted = redactLogText("https://example.test?accessToken=secret-value authorization: Bearer token-value api_key=another-secret");
assert.equal(redacted.includes("secret-value"), false);
assert.equal(redacted.includes("token-value"), false);
assert.equal(redacted.includes("another-secret"), false);
assert.match(redacted, /accessToken=\[REDACTED\]/i);
assert.match(redacted, /authorization: \[REDACTED\]/i);
assert.match(createRequestId(), /^[a-f0-9]{12}$/);

console.log("Log redaction validation passed.");
