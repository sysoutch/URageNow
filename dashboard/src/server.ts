import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { extname, resolve } from "node:path";
import { repositoryRootCandidates } from "@urage/server/config/repositoryPaths";
import { createRequestId, redactLogText } from "@urage/server/security/logRedaction";
import { resolveContainedStaticFilePath } from "@urage/server/security/staticFilePath";
import { recordRuntimeFailure } from "@urage/server/services/failureLogStore";
import type { GlobalDashboardSettings } from "@urage/shared/dashboard/runtimeContracts";
import { appConfig, applyDashboardNetworkRuntimeConfig, type DashboardDependencies } from "./server/runtime/botBridge.js";
import { RequestBodyTooLargeError, parseJsonBody, sendJson } from "./server/http.js";
import { isBotsDashboardPath, isDiscordOnlyDashboardPath } from "./server/discordOnlyScope.js";
import { renderDiscordOnlyDashboardHtml } from "./discordOnlyDashboardPage.js";
import { renderBotsDashboardHtml } from "./botsDashboardPage.js";
import { handleDashboardReadRoutes } from "./server/routes/readRoutes.js";
import { handleDashboardSettingsAndGuildRoutes } from "./features/discord/server/routes/settingsAndGuildRoutes.js";
import { handleDashboardMessagingAndModelRoutes } from "./server/routes/messagingAndModelRoutes.js";
import { handleDashboardAutomationRoutes } from "./server/routes/automationRoutes.js";
import { handleDashboardMediaConverterRoutes } from "./server/routes/mediaConverterRoutes.js";
import { handleDashboardResourceHubRoutes } from "./server/routes/resourceHubRoutes.js";
import { handleDashboardGameRoutes } from "./server/routes/gameRoutes.js";
import {
  describeCompanionPairing,
  handleAuthenticatedCompanionRequest,
  handleCompanionAdminRequest,
  handlePublicCompanionRequest,
  isCompanionPath,
  isPublicCompanionPath
} from "./server/companion/companionRoutes.js";
import { startLanDiscoveryService, type LanDiscoveryHandle } from "./server/companion/lanDiscoveryService.js";
import {androidCompanionGithubReleasesUrl, readLatestAndroidCompanionRelease} from "./server/companion/androidReleaseDistribution.js";
import {renderRemoteBrowserLoginPage} from "./server/remoteBrowserLoginPage.js";
import {startComfyUiRuntimeWhenConfigured} from "./server/comfyUi/comfyUiRuntimeManager.js";

function getStaticMimeType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js" || extension === ".mjs") return "application/javascript; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".map") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".ico") return "image/x-icon";
  if (extension === ".woff") return "font/woff";
  if (extension === ".woff2") return "font/woff2";
  if (extension === ".txt") return "text/plain; charset=utf-8";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  return "application/octet-stream";
}

function isLocalAddress(address: string | undefined): boolean {
  if (!address) {
    return true;
  }
  const normalized = address.replace(/^::ffff:/i, "").toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1";
}

function normalizeClientAddress(address: string | undefined): string {
  return String(address || "").trim().replace(/^::ffff:/i, "").toLowerCase();
}

function toIpv4Integer(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return null;
  }
  if (parts.some(part => !/^\d{1,3}$/.test(part))) {
    return null;
  }
  const octets = parts.map(part => Number.parseInt(part, 10));
  if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }
  const [first = 0, second = 0, third = 0, fourth = 0] = octets;
  return (((first << 24) >>> 0) | (second << 16) | (third << 8) | fourth) >>> 0;
}

export function matchesDashboardClientAddress(address: string | undefined, allowedClients: readonly string[]): boolean {
  if (allowedClients.length === 0) {
    return true;
  }
  const clientAddress = normalizeClientAddress(address);
  return allowedClients.some(rawEntry => {
    const entry = normalizeClientAddress(rawEntry);
    if (entry === "*") {
      return true;
    }
    if (!entry.includes("/")) {
      return clientAddress === entry;
    }
    const [networkAddress, prefixText] = entry.split("/", 2);
    const clientIpv4 = toIpv4Integer(clientAddress);
    const networkIpv4 = toIpv4Integer(networkAddress || "");
    const prefix = Number.parseInt(prefixText || "", 10);
    if (clientIpv4 === null || networkIpv4 === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }
    const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
    return (clientIpv4 & mask) === (networkIpv4 & mask);
  });
}

function isAllowedDashboardClient(request: IncomingMessage): boolean {
  return matchesDashboardClientAddress(request.socket.remoteAddress, appConfig.dashboardAllowedClients);
}

function getRequestHeader(request: IncomingMessage, name: string): string {
  const value = request.headers[name];
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function normalizeRequestAuthority(authority: string, protocol = "http:"): string | null {
  try {
    const parsed = new URL(`${protocol}//${authority}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    const defaultPort = parsed.protocol === "https:" ? "443" : "80";
    return `${parsed.hostname.toLowerCase()}:${parsed.port || defaultPort}`;
  } catch {
    return null;
  }
}

function isAllowedDashboardHost(request: IncomingMessage, port: number, runtimeHost: string): boolean {
  const requestAuthority = normalizeRequestAuthority(getRequestHeader(request, "host"));
  if (!requestAuthority) return false;
  const allowed = new Set<string>();
  const addHost = (host: string, hostPort = port) => {
    const trimmed = host.trim().toLowerCase();
    if (!trimmed || trimmed === "0.0.0.0" || trimmed === "::") return;
    const authority = trimmed.startsWith("[") ? `${trimmed}:${hostPort}`
      : trimmed.includes(":") ? `[${trimmed}]:${hostPort}` : `${trimmed}:${hostPort}`;
    const normalized = normalizeRequestAuthority(authority);
    if (normalized) allowed.add(normalized);
  };
  addHost("localhost");
  addHost("127.0.0.1");
  addHost("::1");
  addHost(runtimeHost);
  addHost(appConfig.dashboardBindHost);
  try {
    const configured = new URL(appConfig.dashboardPublicBaseUrl);
    const host = configured.hostname.includes(":")
      ? `[${configured.hostname.replace(/^\[|\]$/g, "")}]`
      : configured.hostname;
    const authorities = configured.port
      ? [configured.host]
      : [`${host}:${port}`, `${host}:${configured.protocol === "https:" ? 443 : 80}`, `${host}:80`];
    for (const authority of authorities) {
      const normalized = normalizeRequestAuthority(authority);
      if (normalized) allowed.add(normalized);
    }
  } catch {
    // An invalid configured public URL does not expand the accepted Host set.
  }
  return allowed.has(requestAuthority);
}

function hasSafeBrowserMutationContext(request: IncomingMessage, pathname: string): boolean {
  const method = String(request.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const originHeader = getRequestHeader(request, "origin");
  if (originHeader) {
    try {
      const origin = new URL(originHeader);
      const authority = normalizeRequestAuthority(getRequestHeader(request, "host"), origin.protocol);
      const originAuthority = normalizeRequestAuthority(origin.host, origin.protocol);
      if (!authority || !originAuthority || authority !== originAuthority
        || (origin.protocol !== "http:" && origin.protocol !== "https:")
        || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return false;
    } catch {
      return false;
    }
  }
  const fetchSite = getRequestHeader(request, "sec-fetch-site").toLowerCase();
  if (fetchSite === "cross-site" || fetchSite === "none") return false;
  const isBrowserRequest = Boolean(originHeader || fetchSite || getRequestHeader(request, "sec-fetch-mode"));
  if (isBrowserRequest && pathname.startsWith("/api/")) {
    const contentType = (getRequestHeader(request, "content-type").split(";", 1)[0] || "").trim().toLowerCase();
    if (contentType !== "application/json" && !/^application\/[a-z0-9.+-]+\+json$/.test(contentType)
      && contentType !== "multipart/form-data") return false;
  }
  return true;
}

function getDashboardAccessTokens(): string[] {
  return appConfig.dashboardAccessToken.trim() ? [appConfig.dashboardAccessToken.trim()] : [];
}

const DASHBOARD_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const dashboardSessions = new Map<string, number>();

function hashDashboardSession(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

function issueDashboardSession(): string {
  const now = Date.now();
  for (const [key, expiresAt] of dashboardSessions) if (expiresAt <= now) dashboardSessions.delete(key);
  if (dashboardSessions.size >= 4096) {
    const oldestSessionKey = dashboardSessions.keys().next().value as string | undefined;
    if (oldestSessionKey) dashboardSessions.delete(oldestSessionKey);
  }
  const sessionId = randomBytes(32).toString("base64url");
  dashboardSessions.set(hashDashboardSession(sessionId), now + DASHBOARD_SESSION_TTL_MS);
  return sessionId;
}

function isSecureDashboardContext(request: IncomingMessage): boolean {
  if ("encrypted" in request.socket && Boolean((request.socket as {encrypted?: boolean}).encrypted)) return true;
  try { return new URL(appConfig.dashboardPublicBaseUrl).protocol === "https:"; } catch { return false; }
}

function dashboardSessionCookie(request: IncomingMessage, sessionId: string): string {
  return `urage_dashboard_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DASHBOARD_SESSION_TTL_MS / 1000}${isSecureDashboardContext(request) ? "; Secure" : ""}`;
}

function readDashboardSessionCookie(request: IncomingMessage): string {
  const match = getRequestHeader(request, "cookie").match(/(?:^|;\s*)urage_dashboard_session=([^;]+)/);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function hasMatchingDashboardAccessToken(request: IncomingMessage): boolean {
  const token = getRequestHeader(request, "x-dashboard-access-token");
  if (token && getDashboardAccessTokens().includes(token)) return true;
  const match = getRequestHeader(request, "cookie").match(/(?:^|;\s*)urage_dashboard_session=([^;]+)/);
  let sessionId = "";
  try { sessionId = decodeURIComponent(match?.[1] || ""); } catch { return false; }
  const key = sessionId ? hashDashboardSession(sessionId) : "";
  const expiresAt = key ? dashboardSessions.get(key) : undefined;
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) { dashboardSessions.delete(key); return false; }
  return true;
}

async function sendDashboardBrowserLogin(response: ServerResponse, invalidToken: boolean, discordOnly = false): Promise<void> {
  if (discordOnly) {
    response.writeHead(invalidToken ? 401 : 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Discord Bot Dashboard · Sign in</title><style>body{font:16px system-ui;background:#101418;color:#f4f2ed;min-height:100vh;display:grid;place-items:center;margin:0}main{background:#1b242b;border:1px solid #52616a;border-radius:14px;padding:28px;width:min(400px,90vw)}label{display:grid;gap:9px}input,button{font:inherit;padding:10px;width:100%;box-sizing:border-box;margin-top:10px}button{background:#e88b52;border:0;border-radius:7px;cursor:pointer}.error{color:#ffb4a2}</style></head><body><main><h1>Discord Bot Dashboard</h1>${invalidToken ? '<p class="error">Access token was not accepted.</p>' : ""}<form action="/dashboard-login" method="post"><label>Dashboard access token<input type="password" name="accessToken" autocomplete="current-password" required autofocus></label><button>Sign in</button></form></main></body></html>`);
    return;
  }
  const release = await readLatestAndroidCompanionRelease();
  const releaseLabel = release ? `Version ${release.versionName} (${release.versionCode})` : "No local APK; GitHub fallback will be used";
  const html = renderRemoteBrowserLoginPage({
    invalidToken,
    releaseLabel,
    androidCompanionGithubReleasesUrl
  });
  response.writeHead(invalidToken ? 401 : 200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

async function handleDashboardBrowserLogin(request: IncomingMessage, response: ServerResponse, discordOnly = false): Promise<void> {
  if (!appConfig.dashboardExposeApi || !isAllowedDashboardClient(request)) {
    sendJson(response, 403, {error: "Dashboard remote access is not available for this client."});
    return;
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > 4096) {
      sendJson(response, 413, {error: "Dashboard login request is too large."});
      return;
    }
    chunks.push(buffer);
  }
  const token = new URLSearchParams(Buffer.concat(chunks).toString("utf8")).get("accessToken")?.trim() || "";
  if (!token || !getDashboardAccessTokens().includes(token)) {
    await sendDashboardBrowserLogin(response, true, discordOnly);
    return;
  }
  const sessionId = issueDashboardSession();
  response.writeHead(303, {
    location: "/",
    "cache-control": "no-store",
    "set-cookie": dashboardSessionCookie(request, sessionId)
  });
  response.end();
}

function canServeDashboardRequest(request: IncomingMessage): boolean {
  if (isLocalAddress(request.socket.remoteAddress)) {
    return true;
  }
  if (!appConfig.dashboardExposeApi) {
    return false;
  }
  if (!isAllowedDashboardClient(request)) {
    return false;
  }
  return hasMatchingDashboardAccessToken(request);
}

type DependencyReadiness = "ready" | "not-configured" | "unavailable";
type RemoteWorkerCapacity = {
  cpuLogicalCores: number;
  memory: {totalMiB: number; freeMiB: number};
  gpu: {source: "nvidia-smi" | "unavailable"; devices: Array<{name: string; totalMemoryMiB: number; freeMemoryMiB: number}>};
};

type JsonReadiness = { status: DependencyReadiness; payload: unknown | null };

async function getJsonReadiness(url: string, headers?: Record<string, string>): Promise<JsonReadiness> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      return {status: "unavailable", payload: null};
    }
    return {status: "ready", payload: await response.json().catch(() => null)};
  } catch {
    return {status: "unavailable", payload: null};
  } finally {
    clearTimeout(timeout);
  }
}

async function getHttpReadiness(url: string, headers?: Record<string, string>): Promise<DependencyReadiness> {
  return (await getJsonReadiness(url, headers)).status;
}

function parseRemoteWorkerCapacity(value: unknown): RemoteWorkerCapacity | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const capacity = value as Partial<RemoteWorkerCapacity>;
  if (typeof capacity.cpuLogicalCores !== "number" || !capacity.memory || !capacity.gpu
    || typeof capacity.memory.totalMiB !== "number" || typeof capacity.memory.freeMiB !== "number"
    || !Array.isArray(capacity.gpu.devices) || (capacity.gpu.source !== "nvidia-smi" && capacity.gpu.source !== "unavailable")) {
    return null;
  }
  const devices = capacity.gpu.devices.filter((device): device is {name: string; totalMemoryMiB: number; freeMemoryMiB: number} => Boolean(device)
    && typeof device.name === "string" && typeof device.totalMemoryMiB === "number" && typeof device.freeMemoryMiB === "number");
  if (devices.length !== capacity.gpu.devices.length) {
    return null;
  }
  return {cpuLogicalCores: capacity.cpuLogicalCores, memory: capacity.memory, gpu: {source: capacity.gpu.source, devices}};
}

async function getRemoteWorkerReadiness(): Promise<{status: DependencyReadiness; capacity: RemoteWorkerCapacity | null}> {
  const baseUrl = appConfig.remoteWorkerBaseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return {status: "not-configured", capacity: null};
  }
  const result = await getJsonReadiness(
    `${baseUrl}/capabilities`,
    appConfig.remoteWorkerSharedSecret ? {"x-remote-worker-secret": appConfig.remoteWorkerSharedSecret} : undefined
  );
  if (result.status !== "ready") {
    return {status: result.status, capacity: null};
  }
  const payload = result.payload && typeof result.payload === "object" ? result.payload as {protocolVersion?: unknown; capacity?: unknown} : null;
  return payload?.protocolVersion === 1
    ? {status: "ready", capacity: parseRemoteWorkerCapacity(payload.capacity)}
    : {status: "unavailable", capacity: null};
}

function getConfiguredTextModel(settings: GlobalDashboardSettings): string {
  const selectedModel = settings.ollamaTextModel.trim();
  if (selectedModel && selectedModel !== "unset") {
    return selectedModel;
  }
  return settings.llmProvider === "ollama" ? appConfig.ollamaModel.trim() : appConfig.lmStudioModel.trim();
}

function hasConfiguredModel(modelNames: string[], configuredModel: string): boolean {
  const normalized = configuredModel.toLowerCase();
  return modelNames.some(modelName => {
    const candidate = modelName.toLowerCase();
    return candidate === normalized || candidate.startsWith(`${normalized}:`) || normalized.startsWith(`${candidate}:`);
  });
}

async function getActiveLlmReadiness(settings: GlobalDashboardSettings): Promise<{server: DependencyReadiness; model: DependencyReadiness}> {
  const configuredModel = getConfiguredTextModel(settings);
  if (settings.llmProvider === "ollama") {
    const baseUrl = settings.ollamaUrl.trim().replace(/\/api\/generate\/?$/, "").replace(/\/+$/, "");
    const result = await getJsonReadiness(`${baseUrl}/api/tags`);
    const models = result.payload && typeof result.payload === "object" && Array.isArray((result.payload as {models?: unknown[]}).models)
      ? (result.payload as {models: unknown[]}).models
        .map(entry => entry && typeof entry === "object" ? String((entry as {name?: unknown; model?: unknown}).name || (entry as {model?: unknown}).model || "").trim() : "")
        .filter(Boolean)
      : [];
    return {
      server: result.status,
      model: result.status !== "ready" ? "unavailable" : configuredModel ? hasConfiguredModel(models, configuredModel) ? "ready" : "unavailable" : "not-configured"
    };
  }
  const baseUrl = settings.lmStudioBaseUrl.trim().replace(/\/+$/, "");
  const headers = settings.lmStudioApiKey ? {authorization: `Bearer ${settings.lmStudioApiKey}`} : undefined;
  const result = await getJsonReadiness(`${baseUrl}/models`, headers);
  const models = result.payload && typeof result.payload === "object" && Array.isArray((result.payload as {data?: unknown[]}).data)
    ? (result.payload as {data: unknown[]}).data
      .map(entry => entry && typeof entry === "object" ? String((entry as {id?: unknown}).id || "").trim() : "")
      .filter(Boolean)
    : [];
  return {
    server: result.status,
    model: result.status !== "ready" ? "unavailable" : configuredModel ? hasConfiguredModel(models, configuredModel) ? "ready" : "unavailable" : "not-configured"
  };
}

function getComfyUiReadiness(): Promise<DependencyReadiness> {
  const baseUrl = appConfig.comfyUiBaseUrl.trim().replace(/\/+$/, "");
  return baseUrl ? getHttpReadiness(`${baseUrl}/system_stats`) : Promise.resolve("not-configured");
}

function serveStaticFile(url: URL, response: any): boolean {
  const pathname = String(url.pathname || "");
  const servesToolFile = pathname.startsWith("/tools/");
  const servesMessengerAsset = pathname.startsWith("/assets/messengers/");
  const servesGameEngineAsset = pathname.startsWith("/assets/game-engines/");
  const servesDashboardVendorAsset = pathname.startsWith("/assets/vendor/");
  const servesThreeModule = pathname.startsWith("/vendor/three/");
  const servesBootstrapIcons = pathname.startsWith("/vendor/bootstrap-icons/");
  if (!servesToolFile && !servesMessengerAsset && !servesGameEngineAsset && !servesDashboardVendorAsset && !servesThreeModule && !servesBootstrapIcons) {
    return false;
  }
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (decodedPathname.includes("\0")) {
    return false;
  }
  for (const workspaceRoot of repositoryRootCandidates) {
    const staticRoot = servesToolFile
      ? resolve(workspaceRoot, "tools")
      : servesMessengerAsset || servesGameEngineAsset || servesDashboardVendorAsset
      ? resolve(workspaceRoot, "dashboard", "assets")
      : servesThreeModule
        ? resolve(workspaceRoot, "node_modules", "three")
        : servesBootstrapIcons
          ? resolve(workspaceRoot, "node_modules", "bootstrap-icons")
        : workspaceRoot;
    const staticPath = servesToolFile
      ? decodedPathname.slice("/tools".length)
      : servesMessengerAsset || servesGameEngineAsset || servesDashboardVendorAsset
      ? decodedPathname.slice("/assets".length)
      : servesThreeModule
        ? decodedPathname.slice("/vendor/three".length)
        : servesBootstrapIcons
          ? decodedPathname.slice("/vendor/bootstrap-icons".length)
        : decodedPathname;
    const resolvedPath = resolveContainedStaticFilePath(staticRoot, staticPath);
    if (!resolvedPath) {
      continue;
    }
    const candidatePaths = decodedPathname.endsWith("/")
      ? [resolve(resolvedPath, "index.html"), resolvedPath]
      : [resolvedPath];
    for (const candidatePath of candidatePaths) {
      try {
        const containedCandidatePath = resolveContainedStaticFilePath(staticRoot, candidatePath.slice(staticRoot.length));
        if (!containedCandidatePath) continue;
        const content = readFileSync(containedCandidatePath);
        response.writeHead(200, { "Content-Type": getStaticMimeType(containedCandidatePath) });
        response.end(content);
        return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}

export interface DashboardServerHandle {
  ready: Promise<void>;
  close: () => Promise<void>;
  restart: (requestedBy?: string) => Promise<void>;
  address: () => AddressInfo | null;
}

export function startDashboardServer(dependencies: DashboardDependencies, options: { scope?: "full" | "discord" | "bots" } = {}): DashboardServerHandle {
  if (dependencies.enabled === false) {
    console.log("Dashboard server disabled (DASHBOARD_ENABLED=false).");
    return {
      ready: Promise.resolve(),
      close: async () => {},
      restart: async () => {},
      address: () => null
    };
  }
  const discordOnly = options.scope === "discord";
  const botsOnly = options.scope === "bots";
  const scopedBotDashboard = discordOnly || botsOnly;
  const routeGroups = [
    handleDashboardReadRoutes,
    handleDashboardSettingsAndGuildRoutes,
    handleDashboardMessagingAndModelRoutes,
    handleDashboardAutomationRoutes,
    handleDashboardResourceHubRoutes,
    handleDashboardMediaConverterRoutes,
    handleDashboardGameRoutes
  ] as const;
  const processDashboardRequest = async (request: IncomingMessage, response: ServerResponse, runtimeDependencies: DashboardDependencies) => {
    const requestId = createRequestId();
    try {
      if (!request.url) {
        sendJson(response, 404, { error: "Not found" });
        return;
      }
      const requestPort = runtimeDependencies.port === 0 ? (request.socket.localPort || 0) : runtimeDependencies.port;
      const url = new URL(request.url, `http://${runtimeDependencies.host}:${requestPort}`);
      if (!isAllowedDashboardHost(request, requestPort, runtimeDependencies.host)) {
        sendJson(response, 421, {error: "Unrecognized dashboard Host header."});
        return;
      }
      if (url.searchParams.has("accessToken")) {
        url.search = "";
        response.writeHead(303, {location: url.pathname, "cache-control": "no-store"});
        response.end();
        return;
      }
      if (!hasSafeBrowserMutationContext(request, url.pathname)) {
        sendJson(response, 403, {error: "Cross-origin or unsafe browser mutation rejected."});
        return;
      }
      if (scopedBotDashboard && !(botsOnly ? isBotsDashboardPath(request.method, url.pathname) : isDiscordOnlyDashboardPath(request.method, url.pathname))) {
        sendJson(response, 404, { error: "Not available in the bot dashboard." });
        return;
      }
      const apiOnlyHost = !scopedBotDashboard && !appConfig.dashboardUiEnabled;
      if (apiOnlyHost && url.pathname !== "/health" && url.pathname !== "/ready" && !url.pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "Not found" });
        return;
      }
      if (url.pathname === "/health") {
        sendJson(response, 200, { ok: true, service: apiOnlyHost ? "api" : "dashboard" });
        return;
      }
      const companionClientAllowed = appConfig.dashboardExposeApi && isAllowedDashboardClient(request);
      const isAndroidDistributionPath = url.pathname === "/android-companion"
        || url.pathname === "/android-companion/qr.svg"
        || url.pathname === "/api/companion/android-release"
        || url.pathname === "/downloads/android-companion";
      if (isAndroidDistributionPath && (isLocalAddress(request.socket.remoteAddress) || companionClientAllowed)) {
        if (await handleDashboardReadRoutes(request, response, url, runtimeDependencies)) {
          return;
        }
      }
      if (url.pathname === "/dashboard-login" && request.method === "POST") {
        await handleDashboardBrowserLogin(request, response, scopedBotDashboard);
        return;
      }
      if (url.pathname === "/dashboard-logout" && request.method === "POST") {
        const sessionId = readDashboardSessionCookie(request);
        if (sessionId) dashboardSessions.delete(hashDashboardSession(sessionId));
        response.writeHead(303, {
          location: "/",
          "cache-control": "no-store",
          "set-cookie": `urage_dashboard_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isSecureDashboardContext(request) ? "; Secure" : ""}`
        });
        response.end();
        return;
      }
      if (companionClientAllowed && isPublicCompanionPath(url.pathname)) {
        await handlePublicCompanionRequest(request, response, url, runtimeDependencies.port);
        return;
      }
      if (url.pathname === "/api/companion/pairing-code" && canServeDashboardRequest(request)) {
        sendJson(response, 200, describeCompanionPairing());
        return;
      }
      if (canServeDashboardRequest(request) && await handleCompanionAdminRequest(request, response, url)) {
        return;
      }
      if (companionClientAllowed && isCompanionPath(url.pathname)) {
        await handleAuthenticatedCompanionRequest(request, response, url, runtimeDependencies);
        return;
      }
      if (!canServeDashboardRequest(request)) {
        const isRemoteDashboardPage = request.method === "GET"
          && url.pathname === "/"
          && appConfig.dashboardExposeApi
          && isAllowedDashboardClient(request)
          && getDashboardAccessTokens().length > 0;
        if (isRemoteDashboardPage) {
          await sendDashboardBrowserLogin(response, url.searchParams.has("accessToken"), scopedBotDashboard);
          return;
        }
        if (!appConfig.dashboardExposeApi) {
          sendJson(response, 403, {error: "Dashboard remote access is disabled. Enable LAN mode in Settings > Network on the dashboard PC."});
          return;
        }
        if (!isAllowedDashboardClient(request)) {
          sendJson(response, 403, {error: "This client address is not included in DASHBOARD_ALLOWED_CLIENTS."});
          return;
        }
        sendJson(response, 401, {error: "A valid dashboard access token is required."});
        return;
      }
      if (url.pathname === "/ready") {
        if (scopedBotDashboard) {
          sendJson(response, 200, { ok: true, service: botsOnly ? "bots-dashboard" : "discord-dashboard", discord: runtimeDependencies.getBotSnapshot().id ? "ready" : "stopped", ...(botsOnly ? { runtimes: runtimeDependencies.getMessengerRuntimeSnapshot().runtimes } : {}) });
          return;
        }
        const llmSettings = runtimeDependencies.runtimeState.getGlobalDashboardSettings();
        const [remoteWorkerReadiness, llmReadiness, comfyUi] = await Promise.all([
          getRemoteWorkerReadiness(),
          getActiveLlmReadiness(llmSettings),
          getComfyUiReadiness()
        ]);
        const llm = llmReadiness.server;
        const llmModel = llmReadiness.model;
        const discord = runtimeDependencies.getBotSnapshot().id
          ? "ready"
          : appConfig.discordToken ? "unavailable" : "not-configured";
        const remoteWorker = remoteWorkerReadiness.status;
        const checks = { discord, remoteWorker, llm, llmModel, comfyUi };
        const unavailableCapabilities = Object.entries(checks)
          .filter(([, status]) => status === "unavailable")
          .map(([capability]) => capability);
        // Messenger, LLM, ComfyUI, and remote-worker integrations are optional
        // capabilities. The standalone dashboard is ready when its HTTP runtime
        // can answer; capability outages remain visible without making /ready lie.
        sendJson(response, 200, {
          ok: true,
          service: apiOnlyHost ? "api" : "dashboard",
          degraded: unavailableCapabilities.length > 0,
          unavailableCapabilities,
          checks,
          remoteWorkerCapacity: remoteWorkerReadiness.capacity
        });
        return;
      }
      if (url.pathname === "/bots-dashboard" && request.method === "GET") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderBotsDashboardHtml());
        return;
      }
      if (scopedBotDashboard && url.pathname === "/" && request.method === "GET") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(botsOnly ? renderBotsDashboardHtml() : renderDiscordOnlyDashboardHtml());
        return;
      }
      if (scopedBotDashboard && url.pathname === "/api/discord/status" && request.method === "GET") {
        const snapshot = runtimeDependencies.getMessengerRuntimeSnapshot();
        sendJson(response, 200, { bot: runtimeDependencies.getBotSnapshot(), runtime: snapshot.runtimes.find(runtime => runtime.messenger === "discord"), events: snapshot.events.filter(event => event.messenger === "discord") });
        return;
      }
      if (scopedBotDashboard && url.pathname === "/api/discord/runtime" && request.method === "POST") {
        const body = await parseJsonBody(request);
        const action = body.action;
        if (action !== "start" && action !== "stop" && action !== "restart") {
          sendJson(response, 400, { error: "Use start, stop, or restart." });
          return;
        }
        const runtime = await runtimeDependencies.controlMessengerRuntime({ messenger: "discord", action });
        sendJson(response, 200, { runtime });
        return;
      }
      if (scopedBotDashboard && url.pathname === "/api/discord/moderation" && request.method === "POST") {
        const body = await parseJsonBody(request);
        const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
        if (!guildId) {
          sendJson(response, 400, { error: "Choose a server first." });
          return;
        }
        const settings = runtimeDependencies.runtimeState.updateGuildDashboardSettings(guildId, {
          antiSpamEnabled: body.antiSpamEnabled === true,
          antiSpamApplyTimeouts: body.antiSpamApplyTimeouts === true,
          antiSpamTextRulePatterns: Array.isArray(body.antiSpamTextRulePatterns)
            ? body.antiSpamTextRulePatterns.filter((entry): entry is string => typeof entry === "string") : []
        });
        await runtimeDependencies.saveDashboardSettings(runtimeDependencies.runtimeState.getStoredDashboardSettings());
        sendJson(response, 200, settings);
        return;
      }
      if (scopedBotDashboard && url.pathname === "/api/discord/automations") {
        const body = request.method === "POST" ? await parseJsonBody(request) : undefined;
        const guildId = String(body?.guildId || url.searchParams.get("guildId") || "").trim();
        if (!guildId) {
          sendJson(response, 400, { error: "Choose a server first." });
          return;
        }
        if (request.method === "GET") {
          const [scheduled, joins] = await Promise.all([
            runtimeDependencies.listScheduledAutomations(guildId), runtimeDependencies.listJoinAutomations(guildId)
          ]);
          sendJson(response, 200, { scheduled: scheduled.filter(entry => entry.targetMessenger === "discord"), joins });
          return;
        }
        if (body?.action === "delete") {
          const id = String(body.id || "").trim();
          const scheduled = (await runtimeDependencies.listScheduledAutomations(guildId)).find(entry => entry.id === id && entry.targetMessenger === "discord");
          const join = (await runtimeDependencies.listJoinAutomations(guildId)).find(entry => entry.id === id);
          const deleted = scheduled ? await runtimeDependencies.deleteScheduledAutomation(id)
            : join ? await runtimeDependencies.deleteJoinAutomation(id) : false;
          sendJson(response, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Discord automation not found." });
          return;
        }
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const channelId = typeof body?.channelId === "string" ? body.channelId.trim() : "";
        const template = typeof body?.template === "string" ? body.template.trim() : "";
        if (!name || !channelId || !template || !(await runtimeDependencies.listChannels(guildId)).some(channel => channel.id === channelId)) {
          sendJson(response, 400, { error: "Name, text, and a channel in the selected server are required." });
          return;
        }
        const action = { source: "template" as const, template, prompt: "", jokesFile: "" };
        if (body?.scope === "member-join") {
          const saved = await runtimeDependencies.saveJoinAutomation({ guildId, channelId, name, enabled: true,
            delaySeconds: 0, action });
          sendJson(response, 200, saved);
          return;
        }
        const intervalValue = Number(body?.intervalValue);
        if (!Number.isInteger(intervalValue) || intervalValue < 1 || intervalValue > 10_000) {
          sendJson(response, 400, { error: "Interval must be from 1 to 10000." });
          return;
        }
        const intervalUnit = body?.intervalUnit === "minutes" || body?.intervalUnit === "hours" || body?.intervalUnit === "days"
          ? body.intervalUnit : "hours";
        const saved = await runtimeDependencies.saveScheduledAutomation({ guildId, channelId, name, enabled: true,
          targetMessenger: "discord", triggerMode: "interval", cron: "", intervalValue, intervalUnit,
          repeatCount: 1, repeatDelaySeconds: 0, action });
        sendJson(response, 200, saved);
        return;
      }
      if (serveStaticFile(url, response)) {
        return;
      }
      for (const handleRouteGroup of routeGroups) {
        if (await handleRouteGroup(request, response, url, runtimeDependencies)) {
          return;
        }
      }
      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      const path = redactLogText(request.url || "/");
      const message = `request=${requestId} ${request.method || "GET"} ${path} failed`;
      const redactedDetail = redactLogText(detail);
      runtimeDependencies.runtimeState.recordSystemConsoleEvent({
        source: "dashboard:http",
        level: "error",
        message,
        detail: redactedDetail
      });
      recordRuntimeFailure({
        source: "dashboard:http",
        requestId,
        method: request.method || "GET",
        path,
        detail: redactedDetail
      });
      console.error(JSON.stringify({event: "dashboard.request.failed", requestId, method: request.method || "GET", path, detail: redactedDetail}));
      if (error instanceof RequestBodyTooLargeError) {
        sendJson(response, error.statusCode, {error: "Request body is too large.", maxBytes: error.maxBytes, requestId});
        return;
      }
      sendJson(response, 500, { error: "Dashboard request failed.", requestId });
    }
  };
  let server: Server | null = null;
  let discoveryService: LanDiscoveryHandle | null = null;
  let restartInFlight = false;
  let activeHost = dependencies.host;
  let activeDependencies: DashboardDependencies;
  const listenServer = (nextServer: Server): Promise<void> =>
    new Promise((resolve, reject) => {
      const handleError = (error: Error) => {
        nextServer.off("listening", handleListening);
        reject(error);
      };
      const handleListening = () => {
        nextServer.off("error", handleError);
        resolve();
      };
      nextServer.once("error", handleError);
      nextServer.once("listening", handleListening);
      nextServer.listen(dependencies.port, activeHost);
    });
  const closeServer = (nextServer: Server): Promise<void> =>
    new Promise((resolve, reject) => {
      if (typeof nextServer.closeIdleConnections === "function") {
        nextServer.closeIdleConnections();
      }
      if (typeof nextServer.closeAllConnections === "function") {
        nextServer.closeAllConnections();
      }
      nextServer.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  const getServerUrl = (nextServer: Server): string => {
    const address = nextServer.address();
    const host = address && typeof address !== "string" ? address.address : activeHost;
    const port = address && typeof address !== "string" ? address.port : dependencies.port;
    return `http://${host}:${port}`;
  };
  const restartDashboardServer = async (requestedBy?: string): Promise<void> => {
    if (restartInFlight) {
      return;
    }
    if (!server) {
      return;
    }
    restartInFlight = true;
    const origin = String(requestedBy || "unknown").trim() || "unknown";
    const previousServer = server;
    try {
      await closeServer(previousServer);
      const nextServer = createServer(async (request, response) => {
        await processDashboardRequest(request, response, activeDependencies);
      });
      await listenServer(nextServer);
      server = nextServer;
      console.log(`Dashboard restart complete (${origin}) on ${getServerUrl(nextServer)}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      console.error(`Dashboard restart failed (${origin}): ${detail}`);
    } finally {
      restartInFlight = false;
    }
  };
  const stopLanDiscovery = async (): Promise<void> => {
    const activeDiscoveryService = discoveryService;
    discoveryService = null;
    await activeDiscoveryService?.close();
  };
  const startLanDiscovery = async (): Promise<void> => {
    if (!appConfig.dashboardExposeApi || discoveryService) {
      return;
    }
    const pairing = describeCompanionPairing();
    console.log(`Android companion pairing code: ${pairing.code} (expires ${pairing.expiresAt})`);
    try {
      discoveryService = await startLanDiscoveryService(dependencies.port, {
        baseUrl: appConfig.dashboardPublicBaseUrl,
        certificateSha256: appConfig.companionTlsCertificateSha256
      });
    } catch (error) {
      console.warn(`Android companion LAN discovery unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const applyDashboardNetworkConfig: NonNullable<DashboardDependencies["applyDashboardNetworkConfig"]> =
    async config => {
      activeHost = config.bindHost;
      applyDashboardNetworkRuntimeConfig(config);
      activeDependencies.host = config.bindHost;
      await stopLanDiscovery();
      await restartDashboardServer("network-settings");
      await startLanDiscovery();
    };
  activeDependencies = {
    ...dependencies,
    dashboardScope: botsOnly ? "bots" : discordOnly ? "discord" : "full",
    restartDashboardServer,
    applyDashboardNetworkConfig
  };
  const initialServer = createServer(async (request, response) => {
    await processDashboardRequest(request, response, activeDependencies);
  });
  const ready = listenServer(initialServer).then(() => {
    server = initialServer;
    console.log(`${botsOnly ? "Bots dashboard" : discordOnly ? "Discord bot dashboard" : appConfig.dashboardUiEnabled ? "Dashboard" : "API"} listening on ${getServerUrl(initialServer)}`);
    if (!scopedBotDashboard) {
      void startLanDiscovery();
      void startComfyUiRuntimeWhenConfigured().catch(error => {
        console.error(`Configured ComfyUI startup failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  });
  void ready.catch(error => {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to start dashboard server: ${detail}`);
  });
  return {
    ready,
    close: async () => {
      await ready.catch(() => {});
      if (!server) {
        return;
      }
      const activeServer = server;
      server = null;
      await closeServer(activeServer);
      await stopLanDiscovery();
    },
    restart: restartDashboardServer,
    address: () => {
      const address = server?.address();
      return address && typeof address !== "string" ? address : null;
    }
  };
}
