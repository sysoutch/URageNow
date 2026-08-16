import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { extname, resolve, sep } from "node:path";
import { repositoryRootCandidates } from "@urage/server/config/repositoryPaths";
import { createRequestId, redactLogText } from "@urage/server/security/logRedaction";
import { recordRuntimeFailure } from "@urage/server/services/failureLogStore";
import type { GlobalDashboardSettings } from "@urage/shared/dashboard/runtimeContracts";
import { appConfig, applyDashboardNetworkRuntimeConfig, type DashboardDependencies } from "./server/runtime/botBridge.js";
import { sendJson } from "./server/http.js";
import { handleDashboardReadRoutes } from "./server/routes/readRoutes.js";
import { handleDashboardSettingsAndGuildRoutes } from "./features/discord/server/routes/settingsAndGuildRoutes.js";
import { handleDashboardMessagingAndModelRoutes } from "./server/routes/messagingAndModelRoutes.js";
import { handleDashboardAutomationRoutes } from "./server/routes/automationRoutes.js";
import { handleDashboardMediaConverterRoutes } from "./server/routes/mediaConverterRoutes.js";
import { handleDashboardResourceHubRoutes } from "./server/routes/resourceHubRoutes.js";
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

function resolveSafeStaticPath(baseRoot: string, requestPath: string): string | null {
  const relativePath = requestPath.replace(/^\/+/, "");
  const resolvedPath = resolve(baseRoot, relativePath);
  const normalizedRoot = baseRoot.endsWith(sep) ? baseRoot : `${baseRoot}${sep}`;
  if (resolvedPath === baseRoot || resolvedPath.startsWith(normalizedRoot)) {
    return resolvedPath;
  }
  return null;
}

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

function getDashboardAccessTokens(): string[] {
  return [appConfig.dashboardAccessToken.trim(), appConfig.remoteWorkerSharedSecret.trim()].filter(Boolean);
}

function hasMatchingDashboardAccessToken(request: IncomingMessage): boolean {
  const tokens = getDashboardAccessTokens();
  if (tokens.length === 0) {
    return false;
  }
  const encodedCookieToken = (getRequestHeader(request, "cookie").match(/(?:^|;\s*)urage_dashboard_access=([^;]+)/)?.[1] || "").trim();
  let cookieToken = "";
  try {
    cookieToken = decodeURIComponent(encodedCookieToken);
  } catch {
    cookieToken = "";
  }
  const providedTokens = [
    getRequestHeader(request, "x-dashboard-access-token"),
    getRequestHeader(request, "x-remote-worker-secret"),
    cookieToken
  ];
  return providedTokens.some(value => tokens.includes(value));
}

function authorizeDashboardBrowser(request: IncomingMessage, response: ServerResponse, url: URL): boolean {
  if (isLocalAddress(request.socket.remoteAddress) || hasMatchingDashboardAccessToken(request)) {
    return false;
  }
  if (!isAllowedDashboardClient(request)) {
    return false;
  }
  const requestedToken = url.searchParams.get("accessToken")?.trim() || "";
  if (!requestedToken || !getDashboardAccessTokens().includes(requestedToken)) {
    return false;
  }
  url.searchParams.delete("accessToken");
  response.writeHead(302, {
    location: `${url.pathname}${url.search}`,
    "set-cookie": `urage_dashboard_access=${encodeURIComponent(requestedToken)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`
  });
  response.end();
  return true;
}

async function sendDashboardBrowserLogin(response: ServerResponse, invalidToken: boolean): Promise<void> {
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

async function handleDashboardBrowserLogin(request: IncomingMessage, response: ServerResponse): Promise<void> {
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
    await sendDashboardBrowserLogin(response, true);
    return;
  }
  response.writeHead(303, {
    location: "/",
    "set-cookie": `urage_dashboard_access=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`
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
  const servesDashboardVendorAsset = pathname.startsWith("/assets/vendor/");
  const servesThreeModule = pathname.startsWith("/vendor/three/");
  const servesBootstrapIcons = pathname.startsWith("/vendor/bootstrap-icons/");
  if (!servesToolFile && !servesMessengerAsset && !servesDashboardVendorAsset && !servesThreeModule && !servesBootstrapIcons) {
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
    const staticRoot = servesMessengerAsset || servesDashboardVendorAsset
      ? resolve(workspaceRoot, "dashboard", "assets")
      : servesThreeModule
        ? resolve(workspaceRoot, "node_modules", "three")
        : servesBootstrapIcons
          ? resolve(workspaceRoot, "node_modules", "bootstrap-icons")
        : workspaceRoot;
    const staticPath = servesMessengerAsset || servesDashboardVendorAsset
      ? decodedPathname.slice("/assets".length)
      : servesThreeModule
        ? decodedPathname.slice("/vendor/three".length)
        : servesBootstrapIcons
          ? decodedPathname.slice("/vendor/bootstrap-icons".length)
        : decodedPathname;
    const resolvedPath = resolveSafeStaticPath(staticRoot, staticPath);
    if (!resolvedPath) {
      continue;
    }
    const candidatePaths = decodedPathname.endsWith("/")
      ? [resolve(resolvedPath, "index.html"), resolvedPath]
      : [resolvedPath];
    for (const candidatePath of candidatePaths) {
      try {
        const content = readFileSync(candidatePath);
        response.writeHead(200, { "Content-Type": getStaticMimeType(candidatePath) });
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

export function startDashboardServer(dependencies: DashboardDependencies): DashboardServerHandle {
  if (dependencies.enabled === false) {
    console.log("Dashboard server disabled (DASHBOARD_ENABLED=false).");
    return {
      ready: Promise.resolve(),
      close: async () => {},
      restart: async () => {},
      address: () => null
    };
  }
  const routeGroups = [
    handleDashboardReadRoutes,
    handleDashboardSettingsAndGuildRoutes,
    handleDashboardMessagingAndModelRoutes,
    handleDashboardAutomationRoutes,
    handleDashboardResourceHubRoutes,
    handleDashboardMediaConverterRoutes
  ] as const;
  const processDashboardRequest = async (request: IncomingMessage, response: ServerResponse, runtimeDependencies: DashboardDependencies) => {
    const requestId = createRequestId();
    try {
      if (!request.url) {
        sendJson(response, 404, { error: "Not found" });
        return;
      }
      const url = new URL(request.url, `http://${runtimeDependencies.host}:${runtimeDependencies.port}`);
      if (url.pathname === "/health") {
        sendJson(response, 200, { ok: true, service: "dashboard" });
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
        await handleDashboardBrowserLogin(request, response);
        return;
      }
      if (authorizeDashboardBrowser(request, response, url)) {
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
          await sendDashboardBrowserLogin(response, url.searchParams.has("accessToken"));
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
          service: "dashboard",
          degraded: unavailableCapabilities.length > 0,
          unavailableCapabilities,
          checks,
          remoteWorkerCapacity: remoteWorkerReadiness.capacity
        });
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
    restartDashboardServer,
    applyDashboardNetworkConfig
  };
  const initialServer = createServer(async (request, response) => {
    await processDashboardRequest(request, response, activeDependencies);
  });
  const ready = listenServer(initialServer).then(() => {
    server = initialServer;
    console.log(`Dashboard listening on ${getServerUrl(initialServer)}`);
    void startLanDiscovery();
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
