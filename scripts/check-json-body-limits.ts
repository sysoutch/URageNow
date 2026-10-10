import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { parseJsonBody, RequestBodyTooLargeError } from "@urage/server/http/http";

function makeRequest(chunks: string[], contentLength?: string): IncomingMessage {
  const request = Readable.from(chunks.map(chunk => Buffer.from(chunk))) as IncomingMessage;
  request.headers = contentLength ? {"content-length": contentLength} : {};
  return request;
}

assert.deepEqual(await parseJsonBody(makeRequest(['{"ok":true}']), {maxBytes: 20}), {ok: true});
await assert.rejects(
  parseJsonBody(makeRequest(['{"ok":true}'], "100"), {maxBytes: 20}),
  error => error instanceof RequestBodyTooLargeError && error.statusCode === 413
);
await assert.rejects(
  parseJsonBody(makeRequest(["123", "456"]), {maxBytes: 5}),
  error => error instanceof RequestBodyTooLargeError && error.statusCode === 413
);
await assert.rejects(parseJsonBody(makeRequest(["not json"]), {maxBytes: 20}), SyntaxError);

console.log("JSON request body limit checks passed.");
