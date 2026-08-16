const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { getNativeSecret } = require("../shared/nativeSecretStore.cjs");

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw.replace(/\/+$/, "");
}

function shortPreview(value, maxLength = 180) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function loadSimpleEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }
    let value = trimmed.slice(separatorIndex + 1);
    if (value.length >= 2 && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function envString(name, fallback = "") {
  const value = process.env[name];
  if (!value || !value.trim()) {
    return fallback;
  }
  return value.trim();
}

function normalizePhoneNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const cleaned = raw.replace(/[^\d+]+/g, "");
  if (!cleaned) {
    return "";
  }
  if (cleaned.startsWith("+")) {
    return `+${cleaned.slice(1).replace(/[^\d]+/g, "")}`;
  }
  return `+${cleaned.replace(/[^\d]+/g, "")}`;
}

function parseContacts(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry, index) => {
          const label = typeof entry === "string"
            ? entry
            : (entry && typeof entry === "object" && typeof entry.label === "string" ? entry.label : `Contact ${index + 1}`);
          const to = typeof entry === "string"
            ? entry
            : (entry && typeof entry === "object" && typeof entry.to === "string" ? entry.to : "");
          const normalizedTo = normalizePhoneNumber(to);
          if (!normalizedTo) {
            return null;
          }
          return {
            id: createId(),
            label: String(label || normalizedTo).trim() || normalizedTo,
            to: normalizedTo
          };
        })
        .filter(Boolean);
    }
  } catch {}
  return raw
    .split(/[,\n;]+/)
    .map(entry => normalizePhoneNumber(entry))
    .filter(Boolean)
    .map((to, index) => ({
      id: createId(),
      label: `Contact ${index + 1}`,
      to
    }));
}

loadSimpleEnvFile(path.join(__dirname, ".env"));
loadSimpleEnvFile(path.join(__dirname, ".env.local"));

const whatsappAccessToken = envString("WHATSAPP_ACCESS_TOKEN", getNativeSecret("whatsapp.default.access-token"));
const whatsappPhoneNumberId = envString("WHATSAPP_PHONE_NUMBER_ID", "");
const whatsappApiVersion = envString("WHATSAPP_API_VERSION", "v22.0");
const whatsappAdminPort = parsePositiveInteger(envString("WHATSAPP_ADMIN_PORT", process.env.WHATSAPP_ADMIN_PORT), 4793);
const whatsappAdminHost = envString("WHATSAPP_ADMIN_HOST", process.env.WHATSAPP_ADMIN_HOST || "127.0.0.1");
const messengerAdminSharedSecret = envString("MESSENGER_ADMIN_SHARED_SECRET", "");
const configuredContacts = parseContacts(envString("WHATSAPP_CONTACTS", ""));

const runtimeState = {
  startedAt: new Date().toISOString(),
  events: [],
  sentMessages: []
};

function pushEvent(level, message) {
  runtimeState.events.unshift({
    id: createId(),
    createdAt: new Date().toISOString(),
    level,
    message: String(message || "").slice(0, 1200)
  });
  runtimeState.events.splice(100);
}

function canUseWhatsAppCloudApi() {
  return Boolean(whatsappAccessToken && whatsappPhoneNumberId);
}

async function readRequestJson(request) {
  const buffers = [];
  for await (const chunk of request) {
    buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(buffers).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function whatsappCloudRequest(pathname, body) {
  if (!canUseWhatsAppCloudApi()) {
    throw new Error("WhatsApp runtime is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
  }
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const response = await fetch(`https://graph.facebook.com/${whatsappApiVersion}${normalizedPath}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${whatsappAccessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let payload = {};
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.trim() };
    }
  }
  if (!response.ok) {
    const detail = payload && typeof payload.error === "object" && payload.error && typeof payload.error.message === "string"
      ? payload.error.message
      : (payload && typeof payload.error === "string" ? payload.error : `WhatsApp Cloud API failed (${response.status}).`);
    throw new Error(detail);
  }
  return payload;
}

function rememberSentMessage(to, text) {
  runtimeState.sentMessages.unshift({
    id: createId(),
    createdAt: new Date().toISOString(),
    to,
    textPreview: shortPreview(text)
  });
  runtimeState.sentMessages.splice(100);
}

function getContactsSnapshot() {
  const contacts = [...configuredContacts];
  for (const sent of runtimeState.sentMessages) {
    if (!sent || !sent.to) {
      continue;
    }
    const normalizedTo = normalizePhoneNumber(sent.to);
    if (!normalizedTo) {
      continue;
    }
    if (contacts.some(entry => entry.to === normalizedTo)) {
      continue;
    }
    contacts.push({
      id: createId(),
      label: normalizedTo,
      to: normalizedTo
    });
  }
  return contacts;
}

async function sendWhatsAppText(to, text) {
  const normalizedTo = normalizePhoneNumber(to);
  const trimmedText = String(text || "").trim();
  if (!normalizedTo || normalizedTo.length < 8) {
    throw new Error("Recipient number is invalid. Use E.164 format, for example +15551234567.");
  }
  if (!trimmedText) {
    throw new Error("Message text is required.");
  }
  const toForCloud = normalizedTo.replace(/^\+/, "");
  const chunks = [];
  for (let cursor = 0; cursor < trimmedText.length; cursor += 3500) {
    chunks.push(trimmedText.slice(cursor, cursor + 3500));
  }
  const payloads = [];
  for (const chunk of chunks) {
    const payload = await whatsappCloudRequest(`/${encodeURIComponent(whatsappPhoneNumberId)}/messages`, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toForCloud,
      type: "text",
      text: {
        body: chunk,
        preview_url: false
      }
    });
    payloads.push(payload);
  }
  rememberSentMessage(normalizedTo, trimmedText);
  pushEvent("info", `send-message -> ${normalizedTo}: ${shortPreview(trimmedText, 120)}`);
  return payloads;
}

const server = http.createServer(async (request, response) => {
  const method = String(request.method || "GET").toUpperCase();
  const url = new URL(request.url || "/", "http://127.0.0.1");
  try {
    if (messengerAdminSharedSecret && request.headers["x-messenger-admin-secret"] !== messengerAdminSharedSecret) {
      sendJson(response, 401, { error: "Messenger admin secret mismatch." });
      return;
    }
    if (method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        configured: canUseWhatsAppCloudApi(),
        startedAt: runtimeState.startedAt,
        apiVersion: whatsappApiVersion,
        phoneNumberId: whatsappPhoneNumberId || null
      });
      return;
    }
    if (method === "GET" && url.pathname === "/contacts") {
      sendJson(response, 200, {
        contacts: getContactsSnapshot()
      });
      return;
    }
    if (method === "GET" && url.pathname === "/events") {
      sendJson(response, 200, {
        events: runtimeState.events
      });
      return;
    }
    if (method === "POST" && url.pathname === "/send-message") {
      const body = await readRequestJson(request);
      const to = body && typeof body.to !== "undefined" ? String(body.to).trim() : "";
      const text = body && typeof body.text === "string" ? body.text.trim() : "";
      if (!to || !text) {
        sendJson(response, 400, { error: "to and text are required." });
        return;
      }
      const payload = await sendWhatsAppText(to, text);
      sendJson(response, 200, {
        ok: true,
        payload
      });
      return;
    }
    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const detail = error && typeof error.message === "string" ? error.message : String(error);
    pushEvent("error", detail || "Unknown WhatsApp admin error.");
    sendJson(response, 500, { error: detail || "Request failed." });
  }
});

function initialize() {
  if (canUseWhatsAppCloudApi()) {
    pushEvent("info", "WhatsApp runtime configured for Cloud API text messaging.");
  } else {
    pushEvent("error", "WhatsApp runtime is not fully configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
  }
  server.listen(whatsappAdminPort, whatsappAdminHost, () => {
    const message = `WhatsApp admin API listening on http://${whatsappAdminHost}:${whatsappAdminPort}`;
    console.log(message);
    pushEvent("info", message);
  });
}

initialize();
