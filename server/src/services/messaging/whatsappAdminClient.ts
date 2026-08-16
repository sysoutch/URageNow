export function normalizeWhatsAppAdminBaseUrl(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/+$/, "");
}

async function requestWhatsAppAdminJson(
  baseUrl: string,
  pathname: string,
  init?: RequestInit,
  sharedSecret = ""
): Promise<Record<string, unknown>> {
  const normalizedBaseUrl = normalizeWhatsAppAdminBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error("WHATSAPP_ADMIN_BASE_URL is not configured.");
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
      : `WhatsApp admin request failed (${response.status}).`;
    throw new Error(detail);
  }
  return payload;
}

export async function fetchWhatsAppAdminContacts(baseUrl: string, sharedSecret = ""): Promise<unknown[]> {
  const payload = await requestWhatsAppAdminJson(baseUrl, "/contacts", undefined, sharedSecret);
  return Array.isArray(payload.contacts) ? payload.contacts : [];
}

export async function sendWhatsAppAdminMessage(baseUrl: string, input: {
  to: string;
  text: string;
}, sharedSecret = ""): Promise<Record<string, unknown>> {
  return requestWhatsAppAdminJson(baseUrl, "/send-message", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      to: input.to,
      text: input.text
    })
  }, sharedSecret);
}
