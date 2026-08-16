import { Entry } from "@napi-rs/keyring";

export const nativeSecretService = "URageStudio";
export const discordTokenSecretName = "discord.default.token";
export const openAiCompatibleApiKeySecretName = "openai-compatible.default.api-key";
export const imageOpenAiCompatibleApiKeySecretName = "openai-compatible.image.api-key";
export const model3dOpenAiCompatibleApiKeySecretName = "openai-compatible.model3d.api-key";
export const dashboardAccessTokenSecretName = "dashboard.default.access-token";
export const remoteWorkerSharedSecretName = "remote-worker.default.shared-secret";
export const messengerAdminSharedSecretName = "messenger-admin.default.shared-secret";
export const telegramBotTokenSecretName = "telegram.default.bot-token";
export const matrixAccessTokenSecretName = "matrix.default.access-token";
export const whatsappAccessTokenSecretName = "whatsapp.default.access-token";

export type NativeSecretStatus = "available" | "missing" | "unavailable";

function createEntry(name: string): Entry {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Secret name is required.");
  }
  return new Entry(nativeSecretService, normalized);
}

export function getNativeSecret(name: string): string | null {
  try {
    const value = createEntry(name).getPassword();
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function setNativeSecret(name: string, value: string): void {
  if (!value) {
    throw new Error("Secret value is required.");
  }
  createEntry(name).setPassword(value);
}

export function deleteNativeSecret(name: string): boolean {
  try {
    createEntry(name).deletePassword();
    return true;
  } catch {
    return false;
  }
}

export function getNativeSecretStatus(name: string): NativeSecretStatus {
  try {
    return createEntry(name).getPassword() ? "available" : "missing";
  } catch (error) {
    const detail = error instanceof Error ? error.message.toLowerCase() : "";
    return detail.includes("not found") || detail.includes("no matching") ? "missing" : "unavailable";
  }
}
