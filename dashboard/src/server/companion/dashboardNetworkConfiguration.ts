import {randomBytes} from "node:crypto";
import {networkInterfaces} from "node:os";
import {readFile, rename, writeFile} from "node:fs/promises";
import path from "node:path";
import {appConfig} from "@urage/server/config/appConfig";
import {repoRoot} from "@urage/server/config/repositoryPaths";
import {dashboardAccessTokenSecretName, setNativeSecret} from "@urage/server/security/nativeSecretStore";

export type DashboardNetworkRuntimeConfig = {
  bindHost: string;
  publicBaseUrl: string;
  exposeApi: boolean;
  allowedClients: string[];
  certificateSha256: string;
  accessToken: string;
};

type NetworkAddress = {
  interfaceName: string;
  address: string;
  netmask: string;
  recommendedUrl: string;
  recommendedAllowedClients: string;
};

const envPath = path.resolve(repoRoot, ".env.main.local");
const managedKeys = [
  "DASHBOARD_BIND_HOST",
  "DASHBOARD_PUBLIC_BASE_URL",
  "COMPANION_TLS_CERTIFICATE_SHA256",
  "DASHBOARD_EXPOSE_API",
  "DASHBOARD_ALLOWED_CLIENTS"
] as const;

function isPrivateIpv4(address: string): boolean {
  return /^10\./.test(address)
    || /^192\.168\./.test(address)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

function describeIpv4Network(address: string, netmask: string): string {
  const addressBytes = address.split(".").map(Number);
  const maskBytes = netmask.split(".").map(Number);
  if (addressBytes.length !== 4 || maskBytes.length !== 4) return "";
  const maskBits = maskBytes.map(byte => byte.toString(2).padStart(8, "0")).join("");
  if (!/^1*0*$/.test(maskBits)) return "";
  const network = addressBytes.map((byte, index) => byte & (maskBytes[index] ?? 0)).join(".");
  return `${network}/${maskBits.lastIndexOf("1") + 1}`;
}

function isLikelyVirtualInterface(interfaceName: string): boolean {
  return /(virtual|vethernet|wsl|docker|vmware|vbox|hyper-v|tailscale|zerotier|vpn)/i.test(interfaceName);
}

function listLanAddresses(port: number): NetworkAddress[] {
  const addresses: NetworkAddress[] = [];
  for (const [interfaceName, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.internal || entry.family !== "IPv4") continue;
      addresses.push({
        interfaceName,
        address: entry.address,
        netmask: entry.netmask,
        recommendedUrl: `http://${entry.address}:${port}`,
        recommendedAllowedClients: describeIpv4Network(entry.address, entry.netmask)
      });
    }
  }
  return addresses.sort((left, right) => Number(isPrivateIpv4(right.address)) - Number(isPrivateIpv4(left.address))
    || Number(isLikelyVirtualInterface(left.interfaceName)) - Number(isLikelyVirtualInterface(right.interfaceName))
    || left.interfaceName.localeCompare(right.interfaceName));
}

function normalizeAllowedClients(value: unknown): string[] {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return Array.from(new Set(values.map(entry => String(entry || "").trim()).filter(Boolean))).slice(0, 64);
}

function normalizeCertificatePin(value: unknown): string {
  const pin = String(value || "").trim();
  if (!pin) return "";
  if (/^[0-9a-f]{64}$/i.test(pin) || /^sha256\/[a-z0-9+/]{43}=$/i.test(pin)) return pin;
  throw new Error("Certificate pin must be a 64-character hexadecimal fingerprint or sha256/base64 digest.");
}

function normalizePublicUrl(value: unknown, mode: "local" | "lan", fallback: string): string {
  const candidate = String(value || fallback).trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("Dashboard public URL must be a complete http:// or https:// URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Dashboard public URL must use HTTP or HTTPS.");
  if (mode === "lan" && ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(parsed.hostname)) {
    throw new Error("Choose this computer's LAN address, not localhost or 0.0.0.0, for Android access.");
  }
  return candidate;
}

async function readEnvDocument(): Promise<string> {
  try {
    return await readFile(envPath, "utf8");
  } catch {
    return "# Local URage NOW overrides managed by the dashboard.\n";
  }
}

async function writeManagedEnvironment(values: Record<(typeof managedKeys)[number], string>): Promise<void> {
  let document = await readEnvDocument();
  for (const key of managedKeys) {
    const line = `${key}=${values[key]}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    document = pattern.test(document) ? document.replace(pattern, line) : `${document.trimEnd()}\n${line}\n`;
  }
  const temporaryPath = `${envPath}.${randomBytes(5).toString("hex")}.tmp`;
  await writeFile(temporaryPath, document.replace(/\r?\n/g, "\n"), {encoding: "utf8", mode: 0o600});
  await rename(temporaryPath, envPath);
}

export function getDashboardNetworkConfiguration(port: number, runningHost: string): {
  mode: "local" | "lan" | "internet";
  runningHost: string;
  publicBaseUrl: string;
  exposeApi: boolean;
  allowedClients: string[];
  certificateSha256: string;
  accessTokenConfigured: boolean;
  addresses: NetworkAddress[];
  recommendedPublicUrl: string;
  recommendedAllowedClients: string;
  readyForAndroid: boolean;
  checks: Array<{id: string; passed: boolean; message: string}>;
  firewallCommands: string[];
} {
  const addresses = listLanAddresses(port);
  const recommended = addresses[0];
  const bindAllowsLan = runningHost === "0.0.0.0" || runningHost === "::" || (!["127.0.0.1", "::1", "localhost"].includes(runningHost));
  let publicHost = "";
  try {
    publicHost = new URL(appConfig.dashboardPublicBaseUrl).hostname;
  } catch {}
  const publicUrlAllowsLan = Boolean(publicHost) && !["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(publicHost);
  const checks = [
    {id: "listener", passed: bindAllowsLan, message: bindAllowsLan ? "Dashboard listener accepts LAN connections." : "Dashboard is listening on this computer only."},
    {id: "api", passed: appConfig.dashboardExposeApi, message: appConfig.dashboardExposeApi ? "Companion API and UDP discovery are enabled." : "Companion API and discovery are disabled."},
    {id: "token", passed: Boolean(appConfig.dashboardAccessToken), message: appConfig.dashboardAccessToken ? "Remote browser access token is configured." : "No remote browser access token is configured yet."},
    {id: "url", passed: publicUrlAllowsLan, message: publicUrlAllowsLan ? `Android URL: ${appConfig.dashboardPublicBaseUrl}` : "Public URL still points to localhost."},
    {id: "interfaces", passed: addresses.length > 0, message: addresses.length > 0 ? `Detected ${addresses.length} LAN address(es).` : "No non-loopback IPv4 interface was detected."}
  ];
  const isInternetMode = bindAllowsLan && appConfig.dashboardExposeApi && appConfig.dashboardPublicBaseUrl.startsWith("https://");
  return {
    mode: isInternetMode ? "internet" : (bindAllowsLan && appConfig.dashboardExposeApi ? "lan" : "local"),
    runningHost,
    publicBaseUrl: appConfig.dashboardPublicBaseUrl,
    exposeApi: appConfig.dashboardExposeApi,
    allowedClients: appConfig.dashboardAllowedClients,
    certificateSha256: appConfig.companionTlsCertificateSha256,
    accessTokenConfigured: Boolean(appConfig.dashboardAccessToken),
    addresses,
    recommendedPublicUrl: recommended?.recommendedUrl || "",
    recommendedAllowedClients: recommended?.recommendedAllowedClients || "",
    readyForAndroid: checks.every(check => check.passed),
    checks,
    firewallCommands: [
      `netsh advfirewall firewall add rule name="URage NOW Dashboard" dir=in action=allow protocol=TCP localport=${port} profile=private`,
      "netsh advfirewall firewall add rule name=\"URage NOW Discovery\" dir=in action=allow protocol=UDP localport=47820 profile=private"
    ]
  };
}

export async function saveDashboardNetworkConfiguration(input: Record<string, unknown>, port: number): Promise<{
  runtimeConfig: DashboardNetworkRuntimeConfig;
  generatedAccessToken: string | null;
}> {
  const mode = input.mode === "internet" ? "internet" : (input.mode === "lan" ? "lan" : "local");
  const remotelyHosted = mode !== "local";
  const addresses = listLanAddresses(port);
  const recommendedUrl = addresses[0]?.recommendedUrl || "";
  const publicBaseUrl = normalizePublicUrl(
    remotelyHosted ? input.publicBaseUrl : `http://127.0.0.1:${port}`,
    remotelyHosted ? "lan" : "local",
    remotelyHosted ? recommendedUrl : `http://127.0.0.1:${port}`
  );
  const allowedClients = remotelyHosted ? normalizeAllowedClients(input.allowedClients) : [];
  const certificateSha256 = remotelyHosted ? normalizeCertificatePin(input.certificateSha256) : "";
  const suppliedToken = String(input.accessToken || "").trim();
  const shouldGenerateToken = input.generateAccessToken === true || (remotelyHosted && !suppliedToken && !appConfig.dashboardAccessToken);
  const generatedAccessToken = shouldGenerateToken ? randomBytes(32).toString("base64url") : null;
  const accessToken = generatedAccessToken || suppliedToken || appConfig.dashboardAccessToken;
  if (mode === "internet" && !publicBaseUrl.startsWith("https://")) throw new Error("Internet server mode requires an HTTPS Dashboard Public URL.");
  if (mode === "internet" && allowedClients.length === 0) throw new Error("Internet server mode requires at least one allowed machine, IP address, or CIDR range.");
  if (mode === "internet" && !accessToken) throw new Error("Internet server mode requires a dashboard access token.");
  if (suppliedToken && suppliedToken.length < 24) throw new Error("Dashboard access token must contain at least 24 characters.");
  if (accessToken) setNativeSecret(dashboardAccessTokenSecretName, accessToken);

  const runtimeConfig: DashboardNetworkRuntimeConfig = {
    bindHost: remotelyHosted ? "0.0.0.0" : "127.0.0.1",
    publicBaseUrl,
    exposeApi: remotelyHosted,
    allowedClients,
    certificateSha256,
    accessToken
  };
  await writeManagedEnvironment({
    DASHBOARD_BIND_HOST: runtimeConfig.bindHost,
    DASHBOARD_PUBLIC_BASE_URL: runtimeConfig.publicBaseUrl,
    COMPANION_TLS_CERTIFICATE_SHA256: runtimeConfig.certificateSha256,
    DASHBOARD_EXPOSE_API: runtimeConfig.exposeApi ? "true" : "false",
    DASHBOARD_ALLOWED_CLIENTS: runtimeConfig.allowedClients.join(",")
  });
  return {runtimeConfig, generatedAccessToken};
}
