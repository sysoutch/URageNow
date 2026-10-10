import type { IncomingMessage, ServerResponse } from "node:http";

export class RequestBodyTooLargeError extends Error {
  readonly statusCode = 413;

  constructor(readonly maxBytes: number) {
    super(`Request body exceeds the ${maxBytes}-byte limit.`);
    this.name = "RequestBodyTooLargeError";
  }
}

export interface JsonBodyOptions {
  maxBytes?: number;
}

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

export async function parseJsonBody(request: IncomingMessage, options: JsonBodyOptions = {}): Promise<Record<string, unknown>> {
  const maxBytes = Math.max(1, Math.floor(options.maxBytes ?? 16 * 1024 * 1024));
  const contentLength = Number(request.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    request.resume();
    throw new RequestBodyTooLargeError(maxBytes);
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      request.resume();
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "").trim();
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}
