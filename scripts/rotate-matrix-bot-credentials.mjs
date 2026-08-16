import {createHash, randomBytes} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const {setNativeSecret} = require("../bots/shared/nativeSecretStore.cjs");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(repoRoot, "bots", "matrix-bot", ".env");
const source = await readFile(envPath, "utf8");

function parseEnv(value) {
  const result = new Map();
  for (const line of value.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]*)=(.*)$/);
    if (match) result.set(match[1].trim(), match[2].trim().replace(/^(['"])(.*)\1$/, "$2"));
  }
  return result;
}

function replaceEnv(value, updates) {
  const remaining = new Map(Object.entries(updates));
  const lines = value.split(/\r?\n/).map(line => {
    const match = line.match(/^(\s*)([^#][^=]*)(=)(.*)$/);
    if (!match) return line;
    const key = match[2].trim();
    if (!remaining.has(key)) return line;
    const replacement = `${match[1]}${key}=${remaining.get(key)}`;
    remaining.delete(key);
    return replacement;
  });
  for (const [key, value] of remaining) lines.push(`${key}=${value}`);
  return lines.join("\n").replace(/\n*$/, "\n");
}

async function request(baseUrl, token, method, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(token ? {authorization: `Bearer ${token}`} : {}),
      ...(body ? {"content-type": "application/json"} : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.error || `${method} ${pathname} failed (${response.status}).`);
  return payload;
}

const values = parseEnv(source);
const baseUrl = String(values.get("MATRIX_HOMESERVER_URL") || "").replace(/\/+$/, "");
const oldToken = String(values.get("MATRIX_ACCESS_TOKEN") || "");
if (!baseUrl.startsWith("https://") || !oldToken) {
  throw new Error("A configured HTTPS homeserver and current Matrix token are required.");
}
const currentIdentity = await request(baseUrl, oldToken, "GET", "/_matrix/client/v3/account/whoami");
const currentUserId = String(currentIdentity.user_id || "");
const serverName = currentUserId.split(":").slice(1).join(":");
if (!currentUserId.startsWith("@") || !serverName) throw new Error("Current Matrix identity is invalid.");
const admin = await request(baseUrl, oldToken, "GET", `/_synapse/admin/v1/users/${encodeURIComponent(currentUserId)}/admin`);
if (!admin.admin) throw new Error("The current Matrix token is not a Synapse server administrator.");

const botLocalpart = "urage-studio-bot";
const botUserId = `@${botLocalpart}:${serverName}`;
const availabilityPayload = await request(
  baseUrl,
  oldToken,
  "GET",
  `/_synapse/admin/v1/username_available?username=${encodeURIComponent(botLocalpart)}`
);
if (availabilityPayload.available !== true) {
  throw new Error(`${botUserId} already exists; refusing to reset or take over an existing account.`);
}

const botPassword = randomBytes(36).toString("base64url");
await request(baseUrl, oldToken, "PUT", `/_synapse/admin/v2/users/${encodeURIComponent(botUserId)}`, {
  password: botPassword,
  displayname: "URage NOW Bot",
  admin: false,
  user_type: "bot",
  logout_devices: false
});
const login = await request(baseUrl, "", "POST", "/_matrix/client/v3/login", {
  type: "m.login.password",
  identifier: {type: "m.id.user", user: botUserId},
  password: botPassword,
  initial_device_display_name: "URage NOW Matrix Bot"
});
const botToken = String(login.access_token || "");
if (!botToken || !login.device_id) throw new Error("Bot login did not return a device-scoped access token.");
const replacementIdentity = await request(baseUrl, botToken, "GET", "/_matrix/client/v3/account/whoami");
if (replacementIdentity.user_id !== botUserId || !replacementIdentity.device_id) {
  throw new Error("Replacement Matrix credentials failed identity validation.");
}

const room = await request(baseUrl, botToken, "POST", "/_matrix/client/v3/createRoom", {
  visibility: "private",
  preset: "private_chat",
  name: "URage Companion",
  topic: "Private E2EE relay for URage NOW Android workflows.",
  invite: [currentUserId],
  initial_state: [{
    type: "m.room.encryption",
    state_key: "",
    content: {algorithm: "m.megolm.v1.aes-sha2"}
  }]
});
const roomId = String(room.room_id || "");
if (!roomId.startsWith("!")) throw new Error("Encrypted Matrix room creation failed.");
await request(baseUrl, oldToken, "POST", `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {});
await request(baseUrl, botToken, "GET", `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.encryption/`);

setNativeSecret("matrix.default.access-token", botToken);
setNativeSecret("matrix.bot.password", botPassword);
const stateIdentity = createHash("sha256").update(botUserId).digest("hex").slice(0, 16);
const updatedSource = replaceEnv(source, {
  MATRIX_ACCESS_TOKEN: "",
  MATRIX_BOT_USER_ID: botUserId,
  MATRIX_ALLOWED_USER_IDS: currentUserId,
  MATRIX_ALLOWED_ROOM_IDS: roomId,
  MATRIX_WORKFLOW_REQUIRE_ALLOWLIST: "true",
  MATRIX_STATE_DIRECTORY: path.join(repoRoot, "data", "matrix-bot", stateIdentity)
});
await writeFile(envPath, updatedSource, "utf8");

let oldTokenRevoked = false;
try {
  await request(baseUrl, oldToken, "POST", "/_matrix/client/v3/logout", {});
  oldTokenRevoked = true;
} catch {
  // Replacement is already active and safely persisted; report manual revocation below.
}

console.log(JSON.stringify({
  botUserId,
  roomId,
  allowedUserId: currentUserId,
  replacementDeviceId: String(login.device_id),
  oldTokenRevoked
}, null, 2));
