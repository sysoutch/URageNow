const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const express = require("express");
require("dotenv").config();
const { getNativeSecret } = require("../shared/nativeSecretStore.cjs");

function normalizeBaseUrl(value, fallback) {
  const raw = String(value || fallback || "").trim();
  if (!raw) {
    return "";
  }
  return raw.replace(/\/+$/, "");
}

function toErrorMessage(error, fallback) {
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function shortPreview(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) {
    return "";
  }
  if (text.length <= 160) {
    return text;
  }
  return `${text.slice(0, 157)}...`;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function resolveDashboardUrl(baseUrl, route) {
  const normalizedBase = normalizeBaseUrl(baseUrl, "");
  const normalizedRoute = String(route || "").startsWith("/") ? String(route) : `/${String(route || "")}`;
  return `${normalizedBase}${normalizedRoute}`;
}

function resolveMediaUrl(baseUrl, maybeUrl) {
  const raw = String(maybeUrl || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return resolveDashboardUrl(baseUrl, raw);
}

function splitMessage(text, maxLength = 3800) {
  const source = String(text || "");
  if (!source.trim()) {
    return [""];
  }
  const chunks = [];
  let cursor = 0;
  while (cursor < source.length) {
    let end = Math.min(source.length, cursor + maxLength);
    if (end < source.length) {
      const nearestBreak = source.lastIndexOf("\n", end);
      if (nearestBreak > cursor + 120) {
        end = nearestBreak;
      }
    }
    chunks.push(source.slice(cursor, end));
    cursor = end;
  }
  return chunks;
}

async function sendLongMessage(chatId, text, bot) {
  const chunks = splitMessage(text, 3800);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index] || "";
    const prefix = chunks.length > 1 ? `Part ${index + 1}/${chunks.length}\n\n` : "";
    await bot.sendMessage(chatId, `${prefix}${chunk}`);
  }
}

const token = String(process.env.TELEGRAM_BOT_TOKEN || getNativeSecret("telegram.default.bot-token") || "").trim();
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required.");
  process.exit(1);
}

const dashboardBaseUrl = normalizeBaseUrl(
  process.env.NODE_BOT_DASHBOARD_URL || process.env.DASHBOARD_BASE_URL,
  `http://127.0.0.1:${parsePositiveInteger(process.env.DASHBOARD_PORT, 4782)}`
);
const dashboardAccessToken = String(process.env.DASHBOARD_ACCESS_TOKEN || "").trim();
const dashboardRequestConfig = dashboardAccessToken ? { headers: { "x-dashboard-access-token": dashboardAccessToken } } : {};
const telegramAdminPort = parsePositiveInteger(process.env.TELEGRAM_ADMIN_PORT, 4791);
const telegramAdminHost = String(process.env.TELEGRAM_ADMIN_HOST || "127.0.0.1").trim() || "127.0.0.1";
const messengerAdminSharedSecret = String(process.env.MESSENGER_ADMIN_SHARED_SECRET || "").trim();

const bot = new TelegramBot(token, {
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 }
  }
});

const adminApp = express();
adminApp.use(express.json({ limit: "1mb" }));
adminApp.use((request, response, next) => {
  if (!messengerAdminSharedSecret || request.get("x-messenger-admin-secret") === messengerAdminSharedSecret) {
    next();
    return;
  }
  response.status(401).json({ error: "Messenger admin secret mismatch." });
});

const runtimeState = {
  startedAt: new Date().toISOString(),
  me: null,
  chatsById: new Map(),
  events: []
};

function pushEvent(level, message) {
  runtimeState.events.unshift({
    id: createId(),
    createdAt: new Date().toISOString(),
    level,
    message: String(message || "").slice(0, 1000)
  });
  runtimeState.events.splice(0, 80);
}

function rememberChatFromMessage(message) {
  const chat = message && message.chat ? message.chat : null;
  if (!chat || typeof chat.id === "undefined") {
    return;
  }
  const chatId = String(chat.id);
  const title = shortPreview(chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || `Chat ${chatId}`);
  const entry = runtimeState.chatsById.get(chatId) || {
    chatId,
    title: title || `Chat ${chatId}`,
    type: String(chat.type || "unknown"),
    username: chat.username ? String(chat.username) : "",
    lastMessageText: "",
    lastMessageAt: null
  };
  entry.title = title || entry.title;
  entry.type = String(chat.type || entry.type || "unknown");
  entry.username = chat.username ? String(chat.username) : entry.username;
  entry.lastMessageText = shortPreview(message.text || message.caption || "[non-text message]");
  entry.lastMessageAt = new Date().toISOString();
  runtimeState.chatsById.set(chatId, entry);
}

async function askDashboard(prompt) {
  const url = resolveDashboardUrl(dashboardBaseUrl, "/api/ask");
  const response = await axios.post(url, { prompt }, { timeout: 120000, ...dashboardRequestConfig });
  const payload = response.data || {};
  return String(payload.response || "").trim();
}

async function generateDashboardImage(prompt) {
  const url = resolveDashboardUrl(dashboardBaseUrl, "/api/image-generate");
  const response = await axios.post(url, {
    prompt,
    autoPrompt: false
  }, { timeout: 180000, ...dashboardRequestConfig });
  return response.data || {};
}

async function sendDashboardImage(chatId, generated) {
  const imageUrl = resolveMediaUrl(dashboardBaseUrl, generated.imageUrl || "");
  if (!imageUrl) {
    throw new Error("Image generation finished but no imageUrl was returned.");
  }
  const imageResponse = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 120000,
    ...dashboardRequestConfig
  });
  const imageBuffer = Buffer.from(imageResponse.data);
  const fileName = String(generated.imageFileName || "generated.png");
  await bot.sendPhoto(chatId, imageBuffer, {
    filename: fileName,
    caption: generated.prompt ? `Prompt: ${shortPreview(generated.prompt)}` : undefined
  });
}

const helpMessage = [
  "Commands:",
  "/start - Show intro",
  "/help - Show help",
  "/test - Check if bot is alive",
  "/chat <prompt> - Ask shared LazyDev model",
  "/image <prompt> - Generate image via shared dashboard pipeline",
  "/3d <image> - Generate 3d model via shared dashboard pipeline",
  "",
  "Plain text messages are treated as /chat."
].join("\n");

bot.on("polling_error", error => {
  const detail = `${error.code || "polling_error"}: ${toErrorMessage(error, "Unknown polling error")}`;
  console.error(detail);
  pushEvent("error", detail);
});
bot.on("error", error => {
  const detail = toErrorMessage(error, "Unknown bot error");
  console.error(detail);
  pushEvent("error", detail);
});
bot.on("message", message => {
  rememberChatFromMessage(message);
});

bot.onText(/\/start/, async message => {
  const chatId = message.chat.id;
  const name = message.from?.first_name || "there";
  const intro = `Hi ${name}. I am connected to your shared dashboard runtime.\n\n${helpMessage}`;
  await bot.sendMessage(chatId, intro);
});
bot.onText(/\/help/, async message => {
  await bot.sendMessage(message.chat.id, helpMessage);
});
bot.onText(/\/test/, async message => {
  await bot.sendMessage(message.chat.id, "Telegram runtime is online.");
});
bot.onText(/\/chat(?:\s+([\s\S]+))?/, async (message, match) => {
  const chatId = message.chat.id;
  const prompt = String(match && match[1] ? match[1] : "").trim();
  if (!prompt) {
    await bot.sendMessage(chatId, "Send: /chat <your prompt>");
    return;
  }
  await bot.sendChatAction(chatId, "typing");
  try {
    const responseText = await askDashboard(prompt);
    if (!responseText) {
      await bot.sendMessage(chatId, "No response received from dashboard.");
      return;
    }
    await sendLongMessage(chatId, responseText, bot);
    pushEvent("info", `chat response sent for chatId=${chatId}`);
  } catch (error) {
    const detail = toErrorMessage(error, "Failed to ask dashboard.");
    await bot.sendMessage(chatId, `Request failed: ${detail}`);
    pushEvent("error", `chat failed for chatId=${chatId}: ${detail}`);
  }
});
bot.onText(/\/image(?:\s+([\s\S]+))?/, async (message, match) => {
  const chatId = message.chat.id;
  const prompt = String(match && match[1] ? match[1] : "").trim();
  if (!prompt) {
    await bot.sendMessage(chatId, "Send: /image <your prompt>");
    return;
  }
  await bot.sendChatAction(chatId, "upload_photo");
  try {
    const generated = await generateDashboardImage(prompt);
    await sendDashboardImage(chatId, generated);
    pushEvent("info", `image sent for chatId=${chatId}`);
  } catch (error) {
    const detail = toErrorMessage(error, "Failed to generate image.");
    await bot.sendMessage(chatId, `Image generation failed: ${detail}`);
    pushEvent("error", `image failed for chatId=${chatId}: ${detail}`);
  }
});

bot.on("message", async message => {
  if (!message || !message.text) {
    return;
  }
  const text = String(message.text || "").trim();
  if (!text || text.startsWith("/")) {
    return;
  }
  const chatId = message.chat.id;
  await bot.sendChatAction(chatId, "typing");
  try {
    const responseText = await askDashboard(text);
    if (!responseText) {
      await bot.sendMessage(chatId, "No response received from dashboard.");
      return;
    }
    await sendLongMessage(chatId, responseText, bot);
    pushEvent("info", `plain chat response sent for chatId=${chatId}`);
  } catch (error) {
    const detail = toErrorMessage(error, "Failed to ask dashboard.");
    await bot.sendMessage(chatId, `Request failed: ${detail}`);
    pushEvent("error", `plain chat failed for chatId=${chatId}: ${detail}`);
  }
});

adminApp.get("/health", async (request, response) => {
  response.json({
    ok: true,
    startedAt: runtimeState.startedAt,
    dashboardBaseUrl,
    me: runtimeState.me
  });
});
adminApp.get("/chats", async (request, response) => {
  const chats = [...runtimeState.chatsById.values()]
    .sort((left, right) => String(right.lastMessageAt || "").localeCompare(String(left.lastMessageAt || "")));
  response.json({
    chats
  });
});
adminApp.get("/events", async (request, response) => {
  response.json({
    events: runtimeState.events
  });
});
adminApp.post("/send-message", async (request, response) => {
  const chatIdRaw = request.body && typeof request.body.chatId !== "undefined" ? String(request.body.chatId).trim() : "";
  const text = request.body && typeof request.body.text === "string" ? request.body.text.trim() : "";
  if (!chatIdRaw || !text) {
    response.status(400).json({ error: "chatId and text are required." });
    return;
  }
  const chatId = /^-?\d+$/.test(chatIdRaw) ? Number(chatIdRaw) : chatIdRaw;
  try {
    const sent = await bot.sendMessage(chatId, text);
    const chatIdString = String(chatIdRaw);
    const existing = runtimeState.chatsById.get(chatIdString) || {
      chatId: chatIdString,
      title: `Chat ${chatIdString}`,
      type: "unknown",
      username: "",
      lastMessageText: "",
      lastMessageAt: null
    };
    existing.lastMessageText = shortPreview(text);
    existing.lastMessageAt = new Date().toISOString();
    runtimeState.chatsById.set(chatIdString, existing);
    pushEvent("info", `admin send-message -> ${chatIdRaw}`);
    response.json({
      ok: true,
      messageId: sent.message_id,
      date: sent.date
    });
  } catch (error) {
    const detail = toErrorMessage(error, "Failed to send Telegram message.");
    pushEvent("error", `admin send-message failed -> ${chatIdRaw}: ${detail}`);
    response.status(500).json({ error: detail });
  }
});

adminApp.post("/send-photo", async (request, response) => {
  const chatIdRaw = request.body && typeof request.body.chatId !== "undefined" ? String(request.body.chatId).trim() : "";
  const imageUrlRaw = request.body && typeof request.body.imageUrl === "string"
    ? request.body.imageUrl.trim()
    : (request.body && typeof request.body.url === "string" ? request.body.url.trim() : "");
  const caption = request.body && typeof request.body.caption === "string" ? request.body.caption.trim() : "";
  if (!chatIdRaw || !imageUrlRaw) {
    response.status(400).json({ error: "chatId and imageUrl are required." });
    return;
  }
  const chatId = /^-?\d+$/.test(chatIdRaw) ? Number(chatIdRaw) : chatIdRaw;
  const imageUrl = resolveMediaUrl(dashboardBaseUrl, imageUrlRaw);
  try {
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 120000
    });
    const imageBuffer = Buffer.from(imageResponse.data);
    const fileName = imageUrl.split(/[?#]/)[0].split("/").pop() || "generated.png";
    const sent = await bot.sendPhoto(chatId, imageBuffer, {
      filename: fileName,
      caption: caption || undefined
    });
    const chatIdString = String(chatIdRaw);
    const existing = runtimeState.chatsById.get(chatIdString) || {
      chatId: chatIdString,
      title: `Chat ${chatIdString}`,
      type: "unknown",
      username: "",
      lastMessageText: "",
      lastMessageAt: null
    };
    existing.lastMessageText = shortPreview(caption || "[photo]");
    existing.lastMessageAt = new Date().toISOString();
    runtimeState.chatsById.set(chatIdString, existing);
    pushEvent("info", `admin send-photo -> ${chatIdRaw}`);
    response.json({
      ok: true,
      messageId: sent.message_id,
      date: sent.date
    });
  } catch (error) {
    const detail = toErrorMessage(error, "Failed to send Telegram photo.");
    pushEvent("error", `admin send-photo failed -> ${chatIdRaw}: ${detail}`);
    response.status(500).json({ error: detail });
  }
});

async function initialize() {
  try {
    runtimeState.me = await bot.getMe();
    pushEvent("info", `Bot connected as @${runtimeState.me.username || "unknown"}`);
    console.log(`Telegram bot connected as @${runtimeState.me.username || "unknown"}`);
  } catch (error) {
    const detail = toErrorMessage(error, "Failed to fetch Telegram bot identity.");
    pushEvent("error", detail);
    console.error(detail);
  }
  adminApp.listen(telegramAdminPort, telegramAdminHost, () => {
    const message = `Telegram admin API listening on http://${telegramAdminHost}:${telegramAdminPort}`;
    console.log(message);
    pushEvent("info", message);
  });
}

initialize().catch(error => {
  const detail = toErrorMessage(error, "Telegram runtime initialization failed.");
  console.error(detail);
  pushEvent("error", detail);
});
