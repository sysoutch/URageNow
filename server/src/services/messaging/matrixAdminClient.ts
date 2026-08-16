export function normalizeMatrixAdminBaseUrl(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/+$/, "");
}

async function requestMatrixAdminJson(
  baseUrl: string,
  pathname: string,
  init?: RequestInit,
  sharedSecret = ""
): Promise<Record<string, unknown>> {
  const normalizedBaseUrl = normalizeMatrixAdminBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error("MATRIX_ADMIN_BASE_URL is not configured.");
  }
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const headers = new Headers(init?.headers);
  if (sharedSecret.trim()) {
    headers.set("x-messenger-admin-secret", sharedSecret.trim());
  }
  const response = await fetch(`${normalizedBaseUrl}${normalizedPath}`, { ...init, headers });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = { error: text.trim() };
    }
  }
  if (!response.ok) {
    const detail = typeof payload.error === "string" && payload.error.trim().length > 0
      ? payload.error.trim()
      : `Matrix admin request failed (${response.status}).`;
    throw new Error(detail);
  }
  return payload;
}

export async function fetchMatrixAdminRooms(baseUrl: string, sharedSecret = ""): Promise<unknown[]> {
  const payload = await requestMatrixAdminJson(baseUrl, "/rooms", undefined, sharedSecret);
  return Array.isArray(payload.rooms) ? payload.rooms : [];
}

export async function refreshMatrixAdminRooms(baseUrl: string, sharedSecret = ""): Promise<unknown[]> {
  const payload = await requestMatrixAdminJson(baseUrl, "/refresh-rooms", { method: "POST" }, sharedSecret);
  return Array.isArray(payload.rooms) ? payload.rooms : [];
}

export async function fetchMatrixAdminHealth(baseUrl: string, sharedSecret = ""): Promise<Record<string, unknown>> {
  return requestMatrixAdminJson(baseUrl, "/health", undefined, sharedSecret);
}

export async function fetchMatrixAdminEvents(baseUrl: string, sharedSecret = ""): Promise<unknown[]> {
  const payload = await requestMatrixAdminJson(baseUrl, "/events", undefined, sharedSecret);
  return Array.isArray(payload.events) ? payload.events : [];
}

export async function sendMatrixAdminMessage(baseUrl: string, input: {
  roomId: string;
  text: string;
}, sharedSecret = ""): Promise<Record<string, unknown>> {
  return requestMatrixAdminJson(baseUrl, "/send-message", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      roomId: input.roomId,
      text: input.text
    })
  }, sharedSecret);
}
