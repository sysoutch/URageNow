const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const {createHash} = require("node:crypto");
const { getNativeSecret } = require("../shared/nativeSecretStore.cjs");
const {createDashboardWorkflowClient} = require("./dashboardWorkflowClient.js");
const {MatrixSourceAudioRegistry, MatrixSourceImageRegistry} = require("./matrixSourceImageRegistry.js");
const {parseRelayCommand, renderRelayProgress, renderRelayPrompt, renderRelayResult} = require("./relayProtocol.js");
const {MatrixSdkRuntime} = require("./matrixSdkRuntime.cjs");

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

function envBoolean(name, fallback) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

loadSimpleEnvFile(path.join(__dirname, ".env"));
loadSimpleEnvFile(path.join(__dirname, ".env.local"));

const matrixHomeserverUrl = normalizeBaseUrl(envString("MATRIX_HOMESERVER_URL", ""));
const matrixAccessToken = envString("MATRIX_ACCESS_TOKEN", getNativeSecret("matrix.default.access-token"));
const configuredBotUserId = envString("MATRIX_BOT_USER_ID", "");
const matrixAdminPort = parsePositiveInteger(envString("MATRIX_ADMIN_PORT", process.env.MATRIX_ADMIN_PORT), 4792);
const matrixAdminHost = envString("MATRIX_ADMIN_HOST", process.env.MATRIX_ADMIN_HOST || "127.0.0.1");
const messengerAdminSharedSecret = envString("MESSENGER_ADMIN_SHARED_SECRET", "");
const dashboardBaseUrl = normalizeBaseUrl(
  envString("DASHBOARD_BASE_URL", envString("NODE_BOT_DASHBOARD_URL", `http://127.0.0.1:${parsePositiveInteger(process.env.DASHBOARD_PORT, 4782)}`))
);
// Keep the Matrix runtime aligned with the dashboard's credential source. The
// dashboard stores this token in the native keyring, so requiring a duplicate
// plaintext value in bots/matrix-bot/.env made otherwise healthy chat commands
// fail authorization.
const dashboardAccessToken = envString("DASHBOARD_ACCESS_TOKEN", getNativeSecret("dashboard.default.access-token"));
const matrixAllowedUserIds = new Set(envString("MATRIX_ALLOWED_USER_IDS", "").split(",").map(value => value.trim()).filter(Boolean));
const matrixAllowedRoomIds = new Set(envString("MATRIX_ALLOWED_ROOM_IDS", "").split(",").map(value => value.trim()).filter(Boolean));
const matrixWorkflowRequireAllowlist = envBoolean("MATRIX_WORKFLOW_REQUIRE_ALLOWLIST", true);
const matrixWorkflowPermissionsPath = path.resolve(envString(
  "MATRIX_WORKFLOW_PERMISSIONS_FILE",
  path.join(envString("DASHBOARD_DATA_DIR", path.resolve(__dirname, "../../data")), "matrix-workflow-permissions.json")
));
let resolvedDashboardAccessToken = dashboardAccessToken;
let dashboardAccessTokenRequest = null;

function dashboardLoopbackBaseUrl() {
  try {
    const configuredUrl = new URL(dashboardBaseUrl);
    const port = configuredUrl.port || (configuredUrl.protocol === "https:" ? "443" : "80");
    return `${configuredUrl.protocol}//127.0.0.1:${port}`;
  } catch {
    return "http://127.0.0.1:4782";
  }
}

async function resolveDashboardAccessToken() {
  if (resolvedDashboardAccessToken) return resolvedDashboardAccessToken;
  if (!dashboardAccessTokenRequest) {
    // The dashboard explicitly permits this loopback-only endpoint for local
    // host integrations. It avoids persisting a second plaintext copy of the
    // dashboard password in the Matrix bot configuration.
    dashboardAccessTokenRequest = fetch(`${dashboardLoopbackBaseUrl()}/api/settings/network/access-token`, {method: "POST"})
      .then(async response => {
        if (!response.ok) throw new Error(`Dashboard access-token lookup failed (${response.status}).`);
        const payload = await response.json();
        const token = String(payload?.accessToken || "").trim();
        if (!token) throw new Error("Dashboard returned an empty access token.");
        resolvedDashboardAccessToken = token;
        return token;
      })
      .catch(error => {
        dashboardAccessTokenRequest = null;
        throw error;
      });
  }
  return dashboardAccessTokenRequest;
}

const dashboardWorkflows = createDashboardWorkflowClient({
  baseUrl: dashboardBaseUrl,
  accessToken: dashboardAccessToken,
  accessTokenProvider: resolveDashboardAccessToken
});
const matrixStateIdentity = createHash("sha256").update(configuredBotUserId || "unconfigured").digest("hex").slice(0, 16);
const matrixStateDirectory = path.resolve(envString(
  "MATRIX_STATE_DIRECTORY",
  path.join(envString("DASHBOARD_DATA_DIR", path.resolve(__dirname, "../../data")), "matrix-bot", matrixStateIdentity)
));
const matrixRuntime = canUseMatrixApi()
  ? new MatrixSdkRuntime({homeserverUrl: matrixHomeserverUrl, accessToken: matrixAccessToken, stateDirectory: matrixStateDirectory})
  : null;
const matrixSourceImages = new MatrixSourceImageRegistry(content => {
  if (!matrixRuntime) throw new Error("Matrix runtime is not configured.");
  return matrixRuntime.downloadSourceMedia(content);
});
const matrixSourceAudio = new MatrixSourceAudioRegistry(content => {
  if (!matrixRuntime) throw new Error("Matrix runtime is not configured.");
  return matrixRuntime.downloadSourceMedia(content);
});

const runtimeState = {
  startedAt: new Date().toISOString(),
  selfUserId: configuredBotUserId || "",
  connectionStatus: canUseMatrixApi() ? "starting" : "unconfigured",
  connectionError: "",
  roomsById: new Map(),
  events: [],
  processedEventIds: new Set(),
  processedEventIdQueue: []
};

const MAX_PROCESSED_EVENT_IDS = 2000;
const MAX_INLINE_CHAT_REPLY_CHARS = 3_500;

function pushEvent(level, message) {
  runtimeState.events.unshift({
    id: createId(),
    createdAt: new Date().toISOString(),
    level,
    message: String(message || "").slice(0, 1000)
  });
  runtimeState.events.splice(80);
}

function markEventProcessed(eventId) {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) {
    return true;
  }
  if (runtimeState.processedEventIds.has(normalizedEventId)) {
    return false;
  }
  runtimeState.processedEventIds.add(normalizedEventId);
  runtimeState.processedEventIdQueue.push(normalizedEventId);
  while (runtimeState.processedEventIdQueue.length > MAX_PROCESSED_EVENT_IDS) {
    runtimeState.processedEventIds.delete(runtimeState.processedEventIdQueue.shift());
  }
  return true;
}

function canUseMatrixApi() {
  return Boolean(matrixHomeserverUrl && matrixAccessToken);
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

async function sendRoomMessage(roomId, text) {
  const trimmedRoomId = String(roomId || "").trim();
  const trimmedText = String(text || "").trim();
  if (!trimmedRoomId || !trimmedText) {
    throw new Error("roomId and text are required.");
  }
  const chunks = [];
  let cursor = 0;
  while (cursor < trimmedText.length) {
    chunks.push(trimmedText.slice(cursor, cursor + 3500));
    cursor += 3500;
  }
  if (!matrixRuntime) throw new Error("Matrix runtime is not configured.");
  if (runtimeState.connectionStatus !== "ready") {
    const reason = runtimeState.connectionError || "Matrix encryption is still initializing.";
    throw new Error("Matrix runtime is not ready to send messages: " + reason);
  }
  for (const chunk of chunks.length > 0 ? chunks : [""]) await matrixRuntime.sendText(trimmedRoomId, chunk);
}

async function sendRoomMedia(roomId, artifact) {
  if (!matrixRuntime) throw new Error("Matrix runtime is not configured.");
  return matrixRuntime.sendMedia(roomId, artifact);
}

async function sendRelayMedia(roomId, artifact, allowUnencryptedMedia) {
  if (!matrixRuntime) throw new Error("Matrix runtime is not configured.");
  if (!await matrixRuntime.isRoomEncrypted(roomId) && !allowUnencryptedMedia) {
    throw new Error("The configured Matrix room is not encrypted. Confirm the unencrypted-media privacy risk in Android before sending media.");
  }
  return matrixRuntime.sendMedia(roomId, artifact);
}

let matrixWorkflowPermissionsMtime = -1;
let matrixWorkflowPermissions = {};

function loadMatrixWorkflowPermissions() {
  try {
    const stat = fs.statSync(matrixWorkflowPermissionsPath);
    if (stat.mtimeMs === matrixWorkflowPermissionsMtime) return matrixWorkflowPermissions;
    const parsed = JSON.parse(fs.readFileSync(matrixWorkflowPermissionsPath, "utf8"));
    const rooms = parsed && typeof parsed.rooms === "object" && !Array.isArray(parsed.rooms) ? parsed.rooms : {};
    matrixWorkflowPermissions = Object.fromEntries(Object.entries(rooms).map(([roomId, rule]) => [
      roomId,
      {
        allowAllMembers: Boolean(rule && typeof rule === "object" && rule.allowAllMembers === true),
        actions: new Set(rule && typeof rule === "object" && Array.isArray(rule.workflows)
          ? rule.workflows.filter(action => ["chat", "image", "audio", "music", "video", "model3d"].includes(action)) : [])
      }
    ]));
    matrixWorkflowPermissionsMtime = stat.mtimeMs;
  } catch {
    matrixWorkflowPermissions = {};
    matrixWorkflowPermissionsMtime = -1;
  }
  return matrixWorkflowPermissions;
}

function canRunWorkflow(roomId, sender, action) {
  const permissionAction = ["image-interpret", "image-improve"].includes(action) ? "image" : action === "stt" ? "audio" : action;
  const roomPermissions = loadMatrixWorkflowPermissions()[roomId];
  if (roomPermissions) return roomPermissions.allowAllMembers && roomPermissions.actions.has(permissionAction);
  if (matrixWorkflowRequireAllowlist && matrixAllowedUserIds.size === 0 && matrixAllowedRoomIds.size === 0) return false;
  const userAllowed = matrixAllowedUserIds.size === 0 || matrixAllowedUserIds.has(sender);
  const roomAllowed = matrixAllowedRoomIds.size === 0 || matrixAllowedRoomIds.has(roomId);
  return userAllowed && roomAllowed;
}

async function answerChatCommand(roomId, prompt) {
  try {
    const result = await dashboardWorkflows.chat(prompt);
    const reply = result.text || "Chat Studio returned no response.";
    if (reply.length <= MAX_INLINE_CHAT_REPLY_CHARS) {
      await sendRoomMessage(roomId, reply);
      return;
    }
    const fileName = `urage-chat-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    await sendRoomMessage(roomId, `Chat Studio response is long. The complete answer is attached as ${fileName}.\n\n${shortPreview(reply, 480)}`);
    await sendRoomMedia(roomId, {
      kind: "file",
      data: Buffer.from(reply, "utf8"),
      contentType: "text/plain; charset=utf-8",
      fileName
    });
  } catch (error) {
    const detail = error && error.message ? error.message : String(error);
    pushEvent("error", `Chat Studio request failed in ${roomId}: ${detail}`);
    await sendRoomMessage(roomId, `Chat Studio failed: ${detail || "unknown dashboard error"}`);
  }
}

async function runWorkflow(action, payload) {
  const prompt = String(payload.prompt || "").trim();
  if (action === "music") {
    if (!String(payload.tags || "").trim() && !String(payload.lyrics || "").trim()) {
      throw new Error("Music tags or lyrics are required.");
    }
    return dashboardWorkflows.music(payload);
  }
  const hasModelSource = Boolean(
    payload.imageInput
    || (String(payload.imageId || "").trim() && String(payload.imageFileName || "").trim())
  );
  if (!prompt && action !== "image-interpret" && action !== "stt" && !(action === "model3d" && hasModelSource)) {
    throw new Error(action === "model3d"
      ? "Select an image or provide a prompt that can generate the source image."
      : "A prompt is required.");
  }
  if (action === "chat") return dashboardWorkflows.chat(prompt);
  if (action === "image-interpret") return dashboardWorkflows.interpretImage(payload);
  if (action === "image-improve") return dashboardWorkflows.improveImagePrompt(payload);
  if (action === "stt") return dashboardWorkflows.transcribeAudio(payload);
  if (action === "image") return dashboardWorkflows.image({...payload, prompt});
  if (action === "audio") return dashboardWorkflows.audio({...payload, prompt});
  if (action === "video") return dashboardWorkflows.video({...payload, prompt});
  return dashboardWorkflows.model3d({...payload, prompt});
}

async function runRelayWorkflow(roomId, sender, relay, reportProgress) {
  if (relay.action !== "chat") {
    await reportProgress("Starting " + relay.action + " workflow in the dashboard.");
    let payload = relay.payload;
      if (payload.matrixSourceId) {
        if (!["image", "image-interpret", "video", "model3d"].includes(relay.action)) {
          throw new Error("This workflow does not accept a Matrix source image.");
        }
        const source = await matrixSourceImages.consume(payload.matrixSourceId, roomId, sender, payload.allowUnencryptedMedia === true);
      payload = {...payload, ...source};
      delete payload.matrixSourceId;
      delete payload.matrixSourceFileName;
    }
    if (payload.matrixAudioSourceId) {
      if (relay.action !== "stt") throw new Error("This workflow does not accept Matrix source audio.");
      const source = await matrixSourceAudio.consume(payload.matrixAudioSourceId, roomId, sender, payload.allowUnencryptedMedia === true);
      payload = {...payload, ...source};
      delete payload.matrixAudioSourceId;
      delete payload.matrixAudioSourceFileName;
    }
    return runWorkflow(relay.action, payload);
  }
  let bufferedDelta = "";
  let lastFlushAt = Date.now();
  const flush = async force => {
    if (!bufferedDelta || (!force && bufferedDelta.length < 180 && Date.now() - lastFlushAt < 500)) return;
    const delta = bufferedDelta;
    bufferedDelta = "";
    lastFlushAt = Date.now();
    await reportProgress(delta);
  };
  const result = await dashboardWorkflows.chatStream(String(relay.payload.prompt || "").trim(), async delta => {
    bufferedDelta += delta;
    await flush(false);
  });
  await flush(true);
  return result;
}

async function refreshJoinedRooms() {
  if (!canUseMatrixApi()) {
    return [];
  }
  const roomDetails = await matrixRuntime.getJoinedRoomDetails();
  const knownIds = new Set();
  for (const detail of roomDetails) {
    const roomId = String(detail?.roomId || "").trim();
    if (!roomId) {
      continue;
    }
    knownIds.add(roomId);
    const existing = runtimeState.roomsById.get(roomId) || {};
    runtimeState.roomsById.set(roomId, {
      ...existing,
      ...describeMatrixRoom(roomId, detail?.state),
      lastMessageText: existing.lastMessageText || "",
      lastMessageAt: existing.lastMessageAt || null
    });
  }
  for (const existingRoomId of [...runtimeState.roomsById.keys()]) {
    if (!knownIds.has(existingRoomId)) {
      runtimeState.roomsById.delete(existingRoomId);
    }
  }
  return [...runtimeState.roomsById.values()];
}

function describeMatrixRoom(roomId, state) {
  const events = Array.isArray(state) ? state : [];
  const findState = (type, stateKey = "") => events.find(event => event?.type === type && String(event?.state_key || "") === stateKey);
  const roomName = String(findState("m.room.name")?.content?.name || "").trim();
  const canonicalAlias = String(findState("m.room.canonical_alias")?.content?.alias || "").trim();
  const roomType = String(findState("m.room.create")?.content?.type || "").trim();
  const parentSpaceIds = events
    .filter(event => event?.type === "m.space.parent" && event?.content && typeof event.content === "object")
    .map(event => String(event?.state_key || "").trim())
    .filter(Boolean);
  const childRoomIds = events
    .filter(event => event?.type === "m.space.child" && event?.content && typeof event.content === "object")
    .map(event => String(event?.state_key || "").trim())
    .filter(Boolean);
  return {
    roomId,
    title: roomName || canonicalAlias || roomId,
    canonicalAlias,
    isSpace: roomType === "m.space",
    parentSpaceIds,
    childRoomIds
  };
}

function rememberRoomMessage(roomId, messageText, messageTimestamp) {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) {
    return;
  }
  const entry = runtimeState.roomsById.get(normalizedRoomId) || describeMatrixRoom(normalizedRoomId, []);
  entry.lastMessageText = shortPreview(messageText);
  entry.lastMessageAt = messageTimestamp ? new Date(messageTimestamp).toISOString() : new Date().toISOString();
  runtimeState.roomsById.set(normalizedRoomId, entry);
}

async function handleInboundMessage(roomId, sender, text, event = {}) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    return;
  }
  if (runtimeState.selfUserId && sender === runtimeState.selfUserId) {
    return;
  }
  if (cleanText.startsWith("URAGE_SOURCE ")) {
    if (!canRunWorkflow(roomId, sender, "image")
      && !canRunWorkflow(roomId, sender, "video")
      && !canRunWorkflow(roomId, sender, "model3d")) {
      throw new Error("This Matrix user or room is not allowed to upload URage workflow sources.");
    }
    if (matrixSourceImages.remember({roomId, sender, ...event, body: cleanText})) {
        pushEvent("info", `Accepted Matrix workflow source ${event.eventId || "unknown"} from ${sender}.`);
    }
    return;
  }
  if (cleanText.startsWith("URAGE_AUDIO_SOURCE ")) {
    if (!canRunWorkflow(roomId, sender, "stt")) {
      throw new Error("This Matrix user or room is not allowed to upload URage workflow audio.");
    }
    if (matrixSourceAudio.remember({roomId, sender, ...event, body: cleanText})) {
      pushEvent("info", `Accepted Matrix workflow audio ${event.eventId || "unknown"} from ${sender}.`);
    }
    return;
  }
  const relay = parseRelayCommand(cleanText);
  if (relay) {
    if (!canRunWorkflow(roomId, sender, relay.action)) {
      await sendRoomMessage(roomId, renderRelayResult(relay.requestId, "denied", {error: "This Matrix user or room is not allowed to run URage workflows."}));
      return;
    }
    try {
      pushEvent("info", `Running relay ${relay.action} ${relay.requestId} for ${sender}.`);
      let progressSequence = 0;
      const reportProgress = async delta => {
        await sendRoomMessage(roomId, renderRelayProgress(relay.requestId, progressSequence++, {delta}));
      };
      await reportProgress("Matrix bot accepted the request.");
      const result = await runRelayWorkflow(roomId, sender, relay, reportProgress);
        const media = result.data ? await sendRelayMedia(roomId, result, relay.payload.allowUnencryptedMedia === true) : null;
      pushEvent("info", `Completed relay ${relay.action} ${relay.requestId}.`);
      if (["image-interpret", "image-improve", "stt"].includes(relay.action) && result.text) {
        await sendRoomMessage(roomId, renderRelayPrompt(relay.requestId, result.text));
      }
      await sendRoomMessage(roomId, renderRelayResult(relay.requestId, "ok", {
        kind: result.kind || "chat",
        text: result.text || "",
        id: result.id || "",
        fileName: result.fileName || "",
        contentType: result.contentType || "",
        mxcUrl: media ? media.mxcUrl : "",
        encryptedFile: media ? media.encryptedFile : null
      }));
    } catch (error) {
      pushEvent("error", `Relay ${relay.action} ${relay.requestId} failed: ${error && error.message ? error.message : String(error)}`);
      await sendRoomMessage(roomId, renderRelayResult(relay.requestId, "error", {error: error && error.message ? error.message : String(error)}));
    }
    return;
  }
  const directWorkflowAction = cleanText.startsWith("!ask ") || cleanText.startsWith("!chat ") ? "chat"
    : cleanText.startsWith("!image ") ? "image"
      : cleanText.startsWith("!audio ") ? "audio"
        : cleanText.startsWith("!music ") ? "music"
          : cleanText.startsWith("!video ") ? "video"
            : cleanText.startsWith("!3d ") ? "model3d" : "";
  if (directWorkflowAction && !canRunWorkflow(roomId, sender, directWorkflowAction)) {
    await sendRoomMessage(roomId, "This Matrix user or room is not allowed to run URage workflows.");
    return;
  }
  if (cleanText === "!ping") {
    await sendRoomMessage(roomId, "Matrix runtime is online.");
    return;
  }
  if (cleanText === "!help") {
    await sendRoomMessage(roomId, "Commands: !help, !ping, !ask <prompt>, !image <prompt>, !audio <prompt>, !music <tags>, !video <prompt>, !3d <prompt>");
    return;
  }
  if (cleanText.startsWith("!ask ")) {
    const prompt = cleanText.slice("!ask ".length).trim();
    if (!prompt) {
      await sendRoomMessage(roomId, "Usage: !ask <prompt>");
      return;
    }
    await answerChatCommand(roomId, prompt);
    return;
  }
  if (cleanText.startsWith("!chat ")) {
    const prompt = cleanText.slice("!chat ".length).trim();
    if (!prompt) {
      await sendRoomMessage(roomId, "Usage: !chat <prompt>");
      return;
    }
    await answerChatCommand(roomId, prompt);
    return;
  }
  if (cleanText.startsWith("!image ")) {
    const prompt = cleanText.slice("!image ".length).trim();
    if (!prompt) {
      await sendRoomMessage(roomId, "Usage: !image <prompt>");
      return;
    }
    await sendRoomMessage(roomId, "Generating image...");
    const result = await dashboardWorkflows.image({prompt});
    await sendRoomMedia(roomId, result);
    await sendRoomMessage(roomId, `Generated ${result.fileName}`);
    return;
  }
  if (cleanText.startsWith("!audio ")) {
    const prompt = cleanText.slice("!audio ".length).trim();
    if (!prompt) {
      await sendRoomMessage(roomId, "Usage: !audio <prompt>");
      return;
    }
    await sendRoomMessage(roomId, "Generating audio...");
    const result = await dashboardWorkflows.audio({prompt, seconds: 10});
    await sendRoomMedia(roomId, result);
    await sendRoomMessage(roomId, `Generated ${result.fileName}`);
    return;
  }
  if (cleanText.startsWith("!music ")) {
    const tags = cleanText.slice("!music ".length).trim();
    if (!tags) {
      await sendRoomMessage(roomId, "Usage: !music <tags>");
      return;
    }
    await sendRoomMessage(roomId, "Generating music...");
    const result = await dashboardWorkflows.music({tags, seconds: 30});
    await sendRoomMedia(roomId, result);
    await sendRoomMessage(roomId, `Generated ${result.fileName}`);
    return;
  }
  if (cleanText.startsWith("!video ")) {
    const prompt = cleanText.slice("!video ".length).trim();
    if (!prompt) {
      await sendRoomMessage(roomId, "Usage: !video <prompt>");
      return;
    }
    await sendRoomMessage(roomId, "Generating video...");
    const result = await dashboardWorkflows.video({prompt, seconds: 5});
    await sendRoomMedia(roomId, result);
    await sendRoomMessage(roomId, `Generated ${result.fileName}`);
    return;
  }
  if (cleanText.startsWith("!3d ")) {
    const prompt = cleanText.slice("!3d ".length).trim();
    if (!prompt) {
      await sendRoomMessage(roomId, "Usage: !3d <prompt>");
      return;
    }
    await sendRoomMessage(roomId, "Generating source image and 3D model...");
    const result = await dashboardWorkflows.model3d({prompt});
    await sendRoomMedia(roomId, result);
    await sendRoomMessage(roomId, `Generated ${result.fileName}`);
  }
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
        ok: runtimeState.connectionStatus === "ready",
        ready: runtimeState.connectionStatus === "ready",
        connectionStatus: runtimeState.connectionStatus,
        connectionError: runtimeState.connectionError || null,
        configured: canUseMatrixApi(),
        homeserver: matrixHomeserverUrl,
        dashboardBaseUrl,
        startedAt: runtimeState.startedAt,
        botUserId: runtimeState.selfUserId || null
      });
      return;
    }
    if (method === "GET" && url.pathname === "/rooms") {
      sendJson(response, 200, {
        rooms: [...runtimeState.roomsById.values()].sort((left, right) => String(right.lastMessageAt || "").localeCompare(String(left.lastMessageAt || "")))
      });
      return;
    }
    if (method === "GET" && url.pathname === "/events") {
      sendJson(response, 200, { events: runtimeState.events });
      return;
    }
    if (method === "POST" && url.pathname === "/refresh-rooms") {
      const rooms = await refreshJoinedRooms();
      sendJson(response, 200, { ok: true, rooms });
      return;
    }
    if (method === "POST" && url.pathname === "/send-message") {
      const body = await readRequestJson(request);
      const roomId = body && typeof body.roomId !== "undefined" ? String(body.roomId).trim() : "";
      const text = body && typeof body.text === "string" ? body.text.trim() : "";
      if (!roomId || !text) {
        sendJson(response, 400, { error: "roomId and text are required." });
        return;
      }
      await sendRoomMessage(roomId, text);
      rememberRoomMessage(roomId, text, Date.now());
      pushEvent("info", `admin send-message -> ${roomId}`);
      sendJson(response, 200, { ok: true });
      return;
    }
    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const detail = error && typeof error.message === "string" ? error.message : String(error);
    pushEvent("error", detail || "Unknown Matrix admin error.");
    sendJson(response, 500, { error: detail || "Request failed." });
  }
});

async function initialize() {
  if (canUseMatrixApi()) {
    try {
      matrixRuntime.onMessage(event => {
        if (!markEventProcessed(event.eventId)) return;
        rememberRoomMessage(event.roomId, event.body, event.timestamp);
        void handleInboundMessage(event.roomId, event.sender, event.body, event).catch(error => {
          const detail = error && typeof error.message === "string" ? error.message : String(error);
          pushEvent("error", `Failed inbound command for ${event.roomId}: ${detail}`);
        });
      });
      matrixRuntime.onDecryptionFailure(event => {
        pushEvent("error", `Could not decrypt Matrix event ${event.eventId || "unknown"} in ${event.roomId}: ${event.error.message}`);
      });
      matrixRuntime.onFailure(error => {
        const detail = error && error.message ? error.message : String(error);
        runtimeState.connectionStatus = "error";
        runtimeState.connectionError = detail;
        pushEvent("error", `Matrix SDK sync stopped: ${detail}`);
      });
      await matrixRuntime.start();
      runtimeState.selfUserId = await matrixRuntime.getUserId() || configuredBotUserId;
      await refreshJoinedRooms();
      runtimeState.connectionStatus = "ready";
      runtimeState.connectionError = "";
      pushEvent("info", `Matrix bot connected as ${runtimeState.selfUserId || configuredBotUserId || "unknown user"}.`);
      if (matrixWorkflowRequireAllowlist && matrixAllowedUserIds.size === 0 && matrixAllowedRoomIds.size === 0) {
        pushEvent("error", "Matrix workflows are locked. Configure a Matrix room rule in Dashboard or MATRIX_ALLOWED_USER_IDS / MATRIX_ALLOWED_ROOM_IDS.");
      }
    } catch (error) {
      const detail = error && typeof error.message === "string" ? error.message : String(error);
      runtimeState.connectionStatus = "error";
      runtimeState.connectionError = detail;
      pushEvent("error", `Failed Matrix startup checks: ${detail}`);
    }
  } else {
    runtimeState.connectionStatus = "unconfigured";
    runtimeState.connectionError = "Set MATRIX_HOMESERVER_URL and MATRIX_ACCESS_TOKEN.";
    pushEvent("error", "Matrix runtime is not fully configured. Set MATRIX_HOMESERVER_URL and MATRIX_ACCESS_TOKEN.");
  }
  server.listen(matrixAdminPort, matrixAdminHost, () => {
    const message = `Matrix admin API listening on http://${matrixAdminHost}:${matrixAdminPort}`;
    console.log(message);
    pushEvent("info", message);
  });
}

initialize().catch(error => {
  const detail = error && typeof error.message === "string" ? error.message : String(error);
  console.error(detail || "Matrix runtime initialization failed.");
  pushEvent("error", detail || "Matrix runtime initialization failed.");
});
