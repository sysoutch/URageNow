import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  discordTokenSecretName,
  getNativeSecret,
  matrixAccessTokenSecretName,
  setNativeSecret,
  telegramBotTokenSecretName,
  whatsappAccessTokenSecretName
} from "../security/nativeSecretStore.js";
import type {
  DashboardMessengerCredentialSource,
  DashboardMessengerRuntimeKey,
  DashboardMessengerRuntimeLaunchConfig
} from "@urage/shared/dashboard/types";

type ResolvedMessengerLaunch = {
  credentialSource: DashboardMessengerCredentialSource;
  env: Record<string, string>;
  discordToken: string | null;
};

function normalizeValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseSimpleEnvText(raw: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }
    let value = trimmed.slice(separatorIndex + 1);
    if (value.length >= 2 && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    env[key] = value.trim();
  }
  return env;
}

async function loadSafeEnvFile(filePath: string): Promise<Record<string, string>> {
  const normalizedPath = normalizeValue(filePath);
  if (!normalizedPath) {
    throw new Error("Safe secrets path is required.");
  }
  const absolutePath = path.resolve(normalizedPath);
  const raw = await readFile(absolutePath, "utf8");
  return parseSimpleEnvText(raw);
}

function requiredValue(value: string, label: string): string {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function resolveDefaultSecret(processEnv: NodeJS.ProcessEnv, environmentName: string, secretName: string): string {
  return normalizeValue(processEnv[environmentName]) || getNativeSecret(secretName) || "";
}

function rememberManualSecret(secretName: string, value: string, label: string): string {
  const secret = requiredValue(value, label);
  try {
    setNativeSecret(secretName, secret);
  } catch {
    // The entered value still starts this runtime if the OS credential store is unavailable.
  }
  return secret;
}

function pickSafeFilePath(launchConfig: DashboardMessengerRuntimeLaunchConfig | undefined, globalSafePath: string): string {
  const launchPath = normalizeValue(launchConfig?.safeSecretsPath);
  if (launchPath) {
    return launchPath;
  }
  const configuredPath = normalizeValue(globalSafePath);
  if (configuredPath) {
    return configuredPath;
  }
  throw new Error("Safe secrets path is not configured.");
}

function resolveDiscordDefault(processEnv: NodeJS.ProcessEnv): ResolvedMessengerLaunch {
  const discordToken = normalizeValue(processEnv.DISCORD_TOKEN_RUNTIME || processEnv.DISCORD_TOKEN_SECURE_STORE)
    || getNativeSecret(discordTokenSecretName);
  if (!discordToken) {
    throw new Error("No Discord token is available to this dashboard user. Enter a token manually or choose a safe env file.");
  }
  return {
    credentialSource: "default",
    env: {},
    discordToken,
  };
}

function resolveDiscordManual(launchConfig: DashboardMessengerRuntimeLaunchConfig | undefined): ResolvedMessengerLaunch {
  return {
    credentialSource: "manual",
    env: {},
    discordToken: rememberManualSecret(discordTokenSecretName, normalizeValue(launchConfig?.discordToken), "Discord bot token")
  };
}

function resolveDiscordSafeFile(envFile: Record<string, string>): ResolvedMessengerLaunch {
  const discordToken = normalizeValue(envFile.DISCORD_TOKEN_RUNTIME || envFile.DISCORD_TOKEN_SECURE_STORE);
  return {
    credentialSource: "safe-file",
    env: {},
    discordToken: requiredValue(discordToken, "DISCORD_TOKEN_RUNTIME in safe env file")
  };
}

function resolveTelegramDefault(processEnv: NodeJS.ProcessEnv): ResolvedMessengerLaunch {
  const telegramBotToken = requiredValue(resolveDefaultSecret(processEnv, "TELEGRAM_BOT_TOKEN", telegramBotTokenSecretName), "TELEGRAM_BOT_TOKEN");
  return {
    credentialSource: "default",
    env: { TELEGRAM_BOT_TOKEN: telegramBotToken },
    discordToken: null
  };
}

function resolveTelegramManual(launchConfig: DashboardMessengerRuntimeLaunchConfig | undefined): ResolvedMessengerLaunch {
  return {
    credentialSource: "manual",
    env: {
      TELEGRAM_BOT_TOKEN: rememberManualSecret(telegramBotTokenSecretName, normalizeValue(launchConfig?.telegramBotToken), "Telegram bot token")
    },
    discordToken: null
  };
}

function resolveTelegramSafeFile(envFile: Record<string, string>): ResolvedMessengerLaunch {
  return {
    credentialSource: "safe-file",
    env: {
      TELEGRAM_BOT_TOKEN: requiredValue(normalizeValue(envFile.TELEGRAM_BOT_TOKEN), "TELEGRAM_BOT_TOKEN in safe env file")
    },
    discordToken: null
  };
}

function resolveMatrixDefault(processEnv: NodeJS.ProcessEnv): ResolvedMessengerLaunch {
  const matrixAccessToken = requiredValue(resolveDefaultSecret(processEnv, "MATRIX_ACCESS_TOKEN", matrixAccessTokenSecretName), "MATRIX_ACCESS_TOKEN");
  const matrixHomeserverUrl = normalizeValue(processEnv.MATRIX_HOMESERVER_URL);
  return {
    credentialSource: "default",
    // The Matrix runtime loads its non-secret homeserver and identity settings
    // from its own .env. The dashboard only owns the launch-time secret. Requiring
    // the homeserver in both places made a valid bot configuration impossible to start.
    env: {
      MATRIX_ACCESS_TOKEN: matrixAccessToken,
      ...(matrixHomeserverUrl ? { MATRIX_HOMESERVER_URL: matrixHomeserverUrl } : {})
    },
    discordToken: null
  };
}

function resolveMatrixManual(launchConfig: DashboardMessengerRuntimeLaunchConfig | undefined): ResolvedMessengerLaunch {
  const env: Record<string, string> = {
    MATRIX_HOMESERVER_URL: requiredValue(normalizeValue(launchConfig?.matrixHomeserverUrl), "Matrix homeserver URL"),
    MATRIX_ACCESS_TOKEN: rememberManualSecret(matrixAccessTokenSecretName, normalizeValue(launchConfig?.matrixAccessToken), "Matrix access token")
  };
  const botUserId = normalizeValue(launchConfig?.matrixBotUserId);
  if (botUserId) {
    env.MATRIX_BOT_USER_ID = botUserId;
  }
  return {
    credentialSource: "manual",
    env,
    discordToken: null
  };
}

function resolveMatrixSafeFile(envFile: Record<string, string>): ResolvedMessengerLaunch {
  const env: Record<string, string> = {
    MATRIX_HOMESERVER_URL: requiredValue(normalizeValue(envFile.MATRIX_HOMESERVER_URL), "MATRIX_HOMESERVER_URL in safe env file"),
    MATRIX_ACCESS_TOKEN: requiredValue(normalizeValue(envFile.MATRIX_ACCESS_TOKEN), "MATRIX_ACCESS_TOKEN in safe env file")
  };
  const botUserId = normalizeValue(envFile.MATRIX_BOT_USER_ID);
  if (botUserId) {
    env.MATRIX_BOT_USER_ID = botUserId;
  }
  return {
    credentialSource: "safe-file",
    env,
    discordToken: null
  };
}

function resolveWhatsAppDefault(processEnv: NodeJS.ProcessEnv): ResolvedMessengerLaunch {
  const whatsappAccessToken = requiredValue(resolveDefaultSecret(processEnv, "WHATSAPP_ACCESS_TOKEN", whatsappAccessTokenSecretName), "WHATSAPP_ACCESS_TOKEN");
  requiredValue(normalizeValue(processEnv.WHATSAPP_PHONE_NUMBER_ID), "WHATSAPP_PHONE_NUMBER_ID");
  return {
    credentialSource: "default",
    env: { WHATSAPP_ACCESS_TOKEN: whatsappAccessToken },
    discordToken: null
  };
}

function resolveWhatsAppManual(launchConfig: DashboardMessengerRuntimeLaunchConfig | undefined): ResolvedMessengerLaunch {
  const env: Record<string, string> = {
    WHATSAPP_ACCESS_TOKEN: rememberManualSecret(whatsappAccessTokenSecretName, normalizeValue(launchConfig?.whatsappAccessToken), "WhatsApp access token"),
    WHATSAPP_PHONE_NUMBER_ID: requiredValue(normalizeValue(launchConfig?.whatsappPhoneNumberId), "WhatsApp phone number ID")
  };
  const apiVersion = normalizeValue(launchConfig?.whatsappApiVersion);
  if (apiVersion) {
    env.WHATSAPP_API_VERSION = apiVersion;
  }
  return {
    credentialSource: "manual",
    env,
    discordToken: null
  };
}

function resolveWhatsAppSafeFile(envFile: Record<string, string>): ResolvedMessengerLaunch {
  const env: Record<string, string> = {
    WHATSAPP_ACCESS_TOKEN: requiredValue(normalizeValue(envFile.WHATSAPP_ACCESS_TOKEN), "WHATSAPP_ACCESS_TOKEN in safe env file"),
    WHATSAPP_PHONE_NUMBER_ID: requiredValue(normalizeValue(envFile.WHATSAPP_PHONE_NUMBER_ID), "WHATSAPP_PHONE_NUMBER_ID in safe env file")
  };
  const apiVersion = normalizeValue(envFile.WHATSAPP_API_VERSION);
  if (apiVersion) {
    env.WHATSAPP_API_VERSION = apiVersion;
  }
  return {
    credentialSource: "safe-file",
    env,
    discordToken: null
  };
}

export async function resolveMessengerRuntimeLaunch(input: {
  messenger: DashboardMessengerRuntimeKey;
  launchConfig?: DashboardMessengerRuntimeLaunchConfig;
  globalSafeSecretsPath?: string;
  processEnv?: NodeJS.ProcessEnv;
}): Promise<ResolvedMessengerLaunch> {
  const processEnv = input.processEnv ?? process.env;
  const credentialSource = input.launchConfig?.credentialSource === "manual" || input.launchConfig?.credentialSource === "safe-file"
    ? input.launchConfig.credentialSource
    : "default";
  const envFile = credentialSource === "safe-file"
    ? await loadSafeEnvFile(pickSafeFilePath(input.launchConfig, input.globalSafeSecretsPath || ""))
    : null;
  if (input.messenger === "discord") {
    if (credentialSource === "manual") {
      return resolveDiscordManual(input.launchConfig);
    }
    if (credentialSource === "safe-file" && envFile) {
      return resolveDiscordSafeFile(envFile);
    }
    return resolveDiscordDefault(processEnv);
  }
  if (input.messenger === "telegram") {
    if (credentialSource === "manual") {
      return resolveTelegramManual(input.launchConfig);
    }
    if (credentialSource === "safe-file" && envFile) {
      return resolveTelegramSafeFile(envFile);
    }
    return resolveTelegramDefault(processEnv);
  }
  if (input.messenger === "matrix") {
    if (credentialSource === "manual") {
      return resolveMatrixManual(input.launchConfig);
    }
    if (credentialSource === "safe-file" && envFile) {
      return resolveMatrixSafeFile(envFile);
    }
    return resolveMatrixDefault(processEnv);
  }
  if (credentialSource === "manual") {
    return resolveWhatsAppManual(input.launchConfig);
  }
  if (credentialSource === "safe-file" && envFile) {
    return resolveWhatsAppSafeFile(envFile);
  }
  return resolveWhatsAppDefault(processEnv);
}
