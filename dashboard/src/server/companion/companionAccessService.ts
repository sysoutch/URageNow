import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";
import {appendCompanionAccessAudit} from "./companionAccessAudit.js";

export const companionPermissionKeys = [
  "media.list",
  "media.download",
  "media.upload",
  "media.metadata.update",
  "media.delete",
  "tools.browse",
  "workflow.chat",
  "workflow.image.generate",
  "workflow.audio.generate",
  "workflow.music.generate",
  "workflow.video.generate",
  "workflow.model3d.generate",
  "application.3d-print.launch"
] as const;
export type CompanionPermissionKey = (typeof companionPermissionKeys)[number];
export type CompanionPermissionSet = Record<CompanionPermissionKey, boolean>;
type PairedDevice = {
  id: string;
  name: string;
  tokenHash: string;
  pairedAt: string;
  lastSeenAt: string;
  permissions?: Partial<CompanionPermissionSet>;
};
export type CompanionDeviceSummary = Omit<PairedDevice, "tokenHash">;
const storePath = path.resolve(appConfig.dataDirectory, "companion-devices.json");
const policyPath = path.resolve(appConfig.dataDirectory, "companion-access-policy.json");
const defaultPermissions: CompanionPermissionSet = {
  "media.list": true,
  "media.download": true,
  "media.upload": true,
  "media.metadata.update": false,
  "media.delete": false,
  "tools.browse": false,
  "workflow.chat": false,
  "workflow.image.generate": false,
  "workflow.audio.generate": false,
  "workflow.music.generate": false,
  "workflow.video.generate": false,
  "workflow.model3d.generate": false,
  "application.3d-print.launch": false
};
const pairingLifetimeMs = 10 * 60 * 1000;
const lastSeenWriteIntervalMs = 60 * 1000;
let pairingCode = "";
let pairingToken = "";
let pairingExpiresAt = 0;
let failedPairingAttempts = 0;
let pairingLockedUntil = 0;
let deviceMutationQueue: Promise<unknown> = Promise.resolve();
let cachedDefaultPermissions: CompanionPermissionSet | null = null;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function readDevices(): Promise<PairedDevice[]> {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is PairedDevice =>
      Boolean(entry && typeof entry === "object" && "id" in entry && "tokenHash" in entry)
    ) : [];
  } catch {
    return [];
  }
}

async function persistDevices(devices: PairedDevice[]): Promise<void> {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(devices, null, 2) + "\n", "utf8");
}

function normalizePermissions(value: unknown, fallback: CompanionPermissionSet): CompanionPermissionSet {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(companionPermissionKeys.map(key => [
    key,
    typeof source[key] === "boolean" ? source[key] : fallback[key]
  ])) as CompanionPermissionSet;
}

async function readDefaultPermissions(): Promise<CompanionPermissionSet> {
  if (cachedDefaultPermissions) return {...cachedDefaultPermissions};
  try {
    cachedDefaultPermissions = normalizePermissions(JSON.parse(await readFile(policyPath, "utf8")), defaultPermissions);
  } catch {
    cachedDefaultPermissions = {...defaultPermissions};
  }
  return {...cachedDefaultPermissions};
}

async function persistDefaultPermissions(permissions: CompanionPermissionSet): Promise<void> {
  await mkdir(path.dirname(policyPath), {recursive: true});
  await writeFile(policyPath, JSON.stringify(permissions, null, 2) + "\n", "utf8");
  cachedDefaultPermissions = {...permissions};
}

async function mutateDevices<T>(mutation: (devices: PairedDevice[]) => Promise<{ result: T; changed: boolean }> | { result: T; changed: boolean }): Promise<T> {
  const operation = deviceMutationQueue.then(async () => {
    const devices = await readDevices();
    const { result, changed } = await mutation(devices);
    if (changed) await persistDevices(devices);
    return result;
  });
  deviceMutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function getCompanionPairingCode(): { code: string; expiresAt: string } {
  if (!pairingCode || Date.now() >= pairingExpiresAt) {
    pairingCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
    pairingToken = randomBytes(32).toString("base64url");
    pairingExpiresAt = Date.now() + pairingLifetimeMs;
  }
  return { code: pairingCode, expiresAt: new Date(pairingExpiresAt).toISOString() };
}

export function getCompanionPairingPayload(): {baseUrl: string; token: string; expiresAt: string; certificateSha256: string | null; deepLink: string} {
  const active = getCompanionPairingCode();
  const parameters = new URLSearchParams({
    baseUrl: appConfig.dashboardPublicBaseUrl,
    token: pairingToken,
    expiresAt: active.expiresAt
  });
  if (appConfig.companionTlsCertificateSha256) parameters.set("certificateSha256", appConfig.companionTlsCertificateSha256);
  return {
    baseUrl: appConfig.dashboardPublicBaseUrl,
    token: pairingToken,
    expiresAt: active.expiresAt,
    certificateSha256: appConfig.companionTlsCertificateSha256 || null,
    deepLink: `urage://pair?${parameters.toString()}`
  };
}

function pairingCredentialMatches(candidate: string): boolean {
  const expected = candidate.length === pairingToken.length ? pairingToken : pairingCode;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function pairCompanionDevice(credential: string, name: string): Promise<{ deviceId: string; token: string }> {
  if (Date.now() < pairingLockedUntil) throw new Error("Pairing is temporarily locked after repeated failed attempts.");
  const active = getCompanionPairingCode();
  if (Date.now() >= pairingExpiresAt || !pairingCredentialMatches(credential)) {
    failedPairingAttempts += 1;
    if (failedPairingAttempts >= 5) {
      pairingLockedUntil = Date.now() + 30_000;
      failedPairingAttempts = 0;
    }
    throw new Error("The pairing code is invalid or expired.");
  }
  const deviceId = randomBytes(12).toString("hex");
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  await mutateDevices(devices => {
    devices.push({ id: deviceId, name: name.trim().slice(0, 80) || "Android companion", tokenHash: hashToken(token), pairedAt: now, lastSeenAt: now });
    if (devices.length > 50) devices.splice(0, devices.length - 50);
    return { result: undefined, changed: true };
  });
  pairingCode = "";
  pairingToken = "";
  pairingExpiresAt = 0;
  failedPairingAttempts = 0;
  pairingLockedUntil = 0;
  await appendCompanionAccessAudit({event: "device.paired", deviceId, deviceName: name.trim().slice(0, 80) || "Android companion", allowed: true});
  return { deviceId, token };
}

export async function authorizeCompanionToken(token: string): Promise<PairedDevice | null> {
  if (!token) return null;
  const candidateHash = hashToken(token);
  return mutateDevices(devices => {
    const device = devices.find(entry => {
      if (entry.tokenHash.length !== candidateHash.length) return false;
      return timingSafeEqual(Buffer.from(entry.tokenHash, "hex"), Buffer.from(candidateHash, "hex"));
    }) || null;
    const shouldUpdateLastSeen = device !== null
      && Date.now() - (Date.parse(device.lastSeenAt) || 0) >= lastSeenWriteIntervalMs;
    if (device && shouldUpdateLastSeen) device.lastSeenAt = new Date().toISOString();
    return { result: device, changed: shouldUpdateLastSeen };
  });
}

export async function listCompanionDevices(): Promise<CompanionDeviceSummary[]> {
  await deviceMutationQueue;
  return (await readDevices()).map(({ tokenHash: _tokenHash, ...device }) => device);
}

export async function getCompanionAccessPolicy(): Promise<{
  defaults: CompanionPermissionSet;
  devices: Array<CompanionDeviceSummary & {effectivePermissions: CompanionPermissionSet}>;
}> {
  await deviceMutationQueue;
  const [defaults, devices] = await Promise.all([readDefaultPermissions(), readDevices()]);
  return {
    defaults,
    devices: devices.map(({tokenHash: _tokenHash, ...device}) => ({
      ...device,
      effectivePermissions: normalizePermissions(device.permissions, defaults)
    }))
  };
}

export async function updateCompanionDefaultPermissions(value: unknown): Promise<CompanionPermissionSet> {
  const permissions = normalizePermissions(value, await readDefaultPermissions());
  await persistDefaultPermissions(permissions);
  await appendCompanionAccessAudit({event: "policy.defaults.updated", allowed: true, details: permissions});
  return permissions;
}

export async function updateCompanionDevicePermissions(deviceId: string, value: unknown): Promise<CompanionPermissionSet | null> {
  const defaults = await readDefaultPermissions();
  return mutateDevices(devices => {
    const device = devices.find(entry => entry.id === deviceId);
    if (!device) return {result: null, changed: false};
    if (value === null) {
      delete device.permissions;
      void appendCompanionAccessAudit({event: "policy.device.reset", deviceId, deviceName: device.name, allowed: true});
      return {result: {...defaults}, changed: true};
    }
    device.permissions = normalizePermissions(value, defaults);
    void appendCompanionAccessAudit({event: "policy.device.updated", deviceId, deviceName: device.name, allowed: true, details: device.permissions});
    return {result: normalizePermissions(device.permissions, defaults), changed: true};
  });
}

export async function companionDeviceCan(device: PairedDevice, permission: CompanionPermissionKey): Promise<boolean> {
  const defaults = await readDefaultPermissions();
  return normalizePermissions(device.permissions, defaults)[permission];
}

export async function revokeCompanionDevice(deviceId: string): Promise<boolean> {
  return mutateDevices(devices => {
    const index = devices.findIndex(device => device.id === deviceId);
    if (index < 0) return { result: false, changed: false };
    const removed = devices.splice(index, 1)[0]!;
    void appendCompanionAccessAudit({event: "device.revoked", deviceId, deviceName: removed.name, allowed: true});
    return { result: true, changed: true };
  });
}

export async function exportCompanionAccessPolicy(): Promise<Record<string, unknown>> {
  const policy = await getCompanionAccessPolicy();
  return {
    schema: "urage-companion-access-policy",
    version: 1,
    exportedAt: new Date().toISOString(),
    defaults: policy.defaults,
    devices: policy.devices.map(device => ({deviceId: device.id, permissions: device.permissions || null}))
  };
}

export async function importCompanionAccessPolicy(value: unknown): Promise<{defaults: CompanionPermissionSet; updatedDevices: number}> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (source.schema !== "urage-companion-access-policy" || source.version !== 1) {
    throw new Error("Unsupported companion access-policy document.");
  }
  const defaults = normalizePermissions(source.defaults, await readDefaultPermissions());
  const entries = Array.isArray(source.devices) ? source.devices : [];
  let updatedDevices = 0;
  await persistDefaultPermissions(defaults);
  await mutateDevices(devices => {
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const device = devices.find(candidate => candidate.id === String(record.deviceId || ""));
      if (!device) continue;
      if (record.permissions === null) delete device.permissions;
      else device.permissions = normalizePermissions(record.permissions, defaults);
      updatedDevices += 1;
    }
    return {result: undefined, changed: updatedDevices > 0};
  });
  await appendCompanionAccessAudit({event: "policy.imported", allowed: true, details: {updatedDevices}});
  return {defaults, updatedDevices};
}
