import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { getNativeSecret, getNativeSecretStatus, setNativeSecret, urageNetMediaApiPasswordSecretName } from "../security/nativeSecretStore.js";

interface StoredSettings { baseUrl?: string; username?: string; }
export interface UrageNetMediaGallerySettings { baseUrl: string; username: string; passwordConfigured: boolean; }

const settingsPath = path.join(appConfig.dataDirectory, "uragenet-media-gallery-settings.json");

async function readStored(): Promise<StoredSettings> {
  try { return JSON.parse(await readFile(settingsPath, "utf8")) as StoredSettings; } catch { return {}; }
}

export async function getUrageNetMediaGallerySettings(): Promise<UrageNetMediaGallerySettings> {
  const stored = await readStored();
  return {
    baseUrl: String(stored.baseUrl || appConfig.urageNetMediaApiBaseUrl || "").trim(),
    username: String(stored.username || appConfig.urageNetMediaApiUsername || "").trim(),
    passwordConfigured: getNativeSecretStatus(urageNetMediaApiPasswordSecretName) === "available" || Boolean(appConfig.urageNetMediaApiPassword)
  };
}

export async function saveUrageNetMediaGallerySettings(input: { baseUrl?: string; username?: string; password?: string; }): Promise<UrageNetMediaGallerySettings> {
  const current = await getUrageNetMediaGallerySettings();
  const baseUrl = typeof input.baseUrl === "string" ? input.baseUrl.trim().replace(/\/+$/, "") : current.baseUrl;
  const username = typeof input.username === "string" ? input.username.trim() : current.username;
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) throw new Error("Media Library URL must start with http:// or https://.");
  await mkdir(path.dirname(settingsPath), { recursive: true });
  const temporary = `${settingsPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ baseUrl, username }, null, 2)}\n`, "utf8");
  await rename(temporary, settingsPath);
  if (typeof input.password === "string" && input.password.trim()) setNativeSecret(urageNetMediaApiPasswordSecretName, input.password.trim());
  return getUrageNetMediaGallerySettings();
}

export async function resolveUrageNetMediaGalleryCredentials(): Promise<{ baseUrl: string; username: string; password: string; }> {
  const settings = await getUrageNetMediaGallerySettings();
  return { baseUrl: settings.baseUrl, username: settings.username, password: getNativeSecret(urageNetMediaApiPasswordSecretName) || appConfig.urageNetMediaApiPassword };
}
