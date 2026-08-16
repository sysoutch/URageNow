import type { IncomingMessage, ServerResponse } from "node:http";

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

export function sendBinary(response: ServerResponse, statusCode: number, contentType: string, payload: Buffer): void {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "content-length": String(payload.length)
  });
  response.end(payload);
}

export async function parseJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "").trim();
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}
