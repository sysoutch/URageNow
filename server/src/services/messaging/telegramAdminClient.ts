export function normalizeTelegramAdminBaseUrl(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/+$/, "");
}

async function requestTelegramAdminJson(
  baseUrl: string,
  pathname: string,
  init?: RequestInit,
  sharedSecret = ""
): Promise<Record<string, unknown>> {
  const normalizedBaseUrl = normalizeTelegramAdminBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error("TELEGRAM_ADMIN_BASE_URL is not configured.");
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
      : `Telegram admin request failed (${response.status}).`;
    throw new Error(detail);
  }
  return payload;
}

export async function fetchTelegramAdminChats(baseUrl: string, sharedSecret = ""): Promise<unknown[]> {
  const payload = await requestTelegramAdminJson(baseUrl, "/chats", undefined, sharedSecret);
  return Array.isArray(payload.chats) ? payload.chats : [];
}

export async function sendTelegramAdminMessage(baseUrl: string, input: {
  chatId: string;
  text: string;
}, sharedSecret = ""): Promise<Record<string, unknown>> {
  return requestTelegramAdminJson(baseUrl, "/send-message", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chatId: input.chatId,
      text: input.text
    })
  }, sharedSecret);
}

export async function sendTelegramAdminPhoto(baseUrl: string, input: {
  chatId: string;
  imageUrl: string;
  caption?: string;
}, sharedSecret = ""): Promise<Record<string, unknown>> {
  return requestTelegramAdminJson(baseUrl, "/send-photo", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chatId: input.chatId,
      imageUrl: input.imageUrl,
      caption: input.caption ?? ""
    })
  }, sharedSecret);
}
