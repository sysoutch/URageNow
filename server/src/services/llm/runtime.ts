import { appConfig } from "../../config/appConfig.js";

export type LlmProvider = "ollama" | "lmstudio" | "llamacpp";
export interface ProviderModelSelection {
  provider: LlmProvider;
  model: string;
}

export interface LlmEjectResult {
  attempted: Array<{ provider: LlmProvider; model: string }>;
  unloaded: Array<{ provider: LlmProvider; model: string }>;
  failed: Array<{ provider: LlmProvider; model: string; error: string }>;
}
export interface LlmLoadResult {
  attempted: Array<{ provider: LlmProvider; model: string }>;
  loaded: Array<{ provider: LlmProvider; model: string }>;
  failed: Array<{ provider: LlmProvider; model: string; error: string }>;
}
export interface LlmModelProviderCatalog {
  provider: LlmProvider;
  label: string;
  models: string[];
}
export interface LlmModelCatalog {
  available: string[];
  providers: LlmModelProviderCatalog[];
  active: ActiveOllamaModels;
}
export interface LlavaImageAnalysis {
  isSpam: boolean;
  isNsfw: boolean;
  isCryptoSpam: boolean;
  showsCryptoImage: boolean;
  reason: string;
  rawResponse: string;
}
export interface AskOllamaOptions {
  think?: boolean;
  systemPrompt?: string | null;
  statefulChatSessionId?: string | null;
  useStatefulChat?: boolean;
  resetStatefulChat?: boolean;
}
export interface AskOllamaDetailedResult {
  response: string;
  reasoning: string;
  provider: LlmProvider;
  model: string;
}
export interface AskOllamaStreamCallbacks {
  onReasoningDelta?: (delta: string) => void;
  onResponseDelta?: (delta: string) => void;
  signal?: AbortSignal;
}
export type AskOllamaLegacyInput = boolean | string | AskOllamaOptions | null | undefined;
export type LmStudioStatefulSession = {
  responseId: string;
  systemPrompt: string;
};
export interface LlmConnectionSettings {
  llmProvider?: LlmProvider;
  ollamaUrl?: string;
  lmStudioBaseUrl?: string;
  lmStudioApiKey?: string;
  lmStudioContextLength?: number;
  lmStudioTextModelReasoningEnabled?: boolean;
  textModel?: string;
  visionModel?: string;
}
export interface ResolvedLlmConnectionSettings {
  ollamaUrl: string;
  lmStudioBaseUrl: string;
  lmStudioApiKey: string;
  lmStudioContextLength: number;
  lmStudioTextModelReasoningEnabled: boolean;
}

let defaultProvider: LlmProvider = appConfig.llmProvider;
let runtimeOllamaUrl = appConfig.ollamaUrl;
let runtimeLmStudioBaseUrl = appConfig.lmStudioBaseUrl;
let runtimeLmStudioApiKey = appConfig.lmStudioApiKey;
let runtimeLmStudioContextLength = 0;
let runtimeLmStudioTextModelReasoningEnabled = true;
let activeTextSelection = parseModelSelectionValue(
  appConfig.llmProvider !== "ollama"
    ? (appConfig.lmStudioModel || appConfig.lmStudioVisionModel || appConfig.ollamaModel)
    : appConfig.ollamaModel,
  defaultProvider
);
let activeVisionSelection = parseModelSelectionValue(
  appConfig.llmProvider !== "ollama"
    ? (appConfig.lmStudioVisionModel || appConfig.lmStudioModel || appConfig.ollamaVisionModel)
    : appConfig.ollamaVisionModel,
  defaultProvider
);

export const lmStudioStatefulSessions = new Map<string, LmStudioStatefulSession>();
export const lmStudioStatefulSessionLimit = 512;
export const providerModelListTimeoutMs = 2_500;

export function getProviderLabel(provider: LlmProvider): string {
  return provider === "lmstudio" ? "LM Studio" : provider === "llamacpp" ? "llama.cpp" : "Ollama";
}

export function fetchActiveTextSelection(): { provider: LlmProvider; model: string } {
  return { ...activeTextSelection };
}
export function fetchActiveVisionSelection(): { provider: LlmProvider; model: string } {
  return { ...activeVisionSelection };
}
export function setActiveTextSelection(selection: ProviderModelSelection): void {
  activeTextSelection = {
    provider: selection.provider,
    model: selection.model.trim()
  };
}
export function setActiveVisionSelection(selection: ProviderModelSelection): void {
  activeVisionSelection = {
    provider: selection.provider,
    model: selection.model.trim()
  };
}

export function normalizeHttpUrl(input: string, label: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must start with http:// or https://`);
  }
  return parsed.toString();
}

export function setLlmConnectionSettings(input: LlmConnectionSettings): void {
  if (input.llmProvider === "ollama" || input.llmProvider === "lmstudio" || input.llmProvider === "llamacpp") {
    defaultProvider = input.llmProvider;
  }
  if (typeof input.ollamaUrl === "string") {
    runtimeOllamaUrl = normalizeHttpUrl(input.ollamaUrl, "Ollama URL");
  }
  if (typeof input.lmStudioBaseUrl === "string") {
    runtimeLmStudioBaseUrl = normalizeHttpUrl(input.lmStudioBaseUrl, "LM Studio Base URL");
  }
  if (typeof input.lmStudioApiKey === "string") {
    runtimeLmStudioApiKey = input.lmStudioApiKey.trim();
  }
  if (typeof input.lmStudioContextLength === "number" && Number.isFinite(input.lmStudioContextLength)) {
    runtimeLmStudioContextLength = Math.max(0, Math.round(input.lmStudioContextLength));
  }
  if (typeof input.lmStudioTextModelReasoningEnabled === "boolean") {
    runtimeLmStudioTextModelReasoningEnabled = input.lmStudioTextModelReasoningEnabled;
  }
}

export function encodeModelSelectionValue(provider: LlmProvider, model: string): string {
  const normalizedModel = model.trim();
  if (!normalizedModel) {
    return "";
  }
  return `${provider}::${normalizedModel}`;
}

export function parseModelSelectionValue(value: string | undefined | null, fallbackProvider: LlmProvider): ProviderModelSelection {
  const raw = (value ?? "").trim();
  if (!raw) {
    return { provider: fallbackProvider, model: "" };
  }
  const matched = raw.match(/^(ollama|lmstudio|llamacpp)::(.+)$/i);
  if (matched) {
    const normalizedProvider = matched[1]?.toLowerCase();
    const providerToken: LlmProvider = normalizedProvider === "lmstudio" || normalizedProvider === "llamacpp" ? normalizedProvider : "ollama";
    const modelName = matched[2]?.trim() ?? "";
    if (modelName) {
      return { provider: providerToken, model: modelName };
    }
  }
  return { provider: fallbackProvider, model: raw };
}

export function resolveTextSelectionForRequest(connectionSettings?: LlmConnectionSettings): ProviderModelSelection {
  const fallbackProvider = connectionSettings?.llmProvider === "lmstudio" || connectionSettings?.llmProvider === "llamacpp" || connectionSettings?.llmProvider === "ollama"
    ? connectionSettings.llmProvider
    : activeTextSelection.provider;
  const requested = parseModelSelectionValue(connectionSettings?.textModel, fallbackProvider);
  if (requested.model) {
    return requested;
  }
  return activeTextSelection;
}

export function resolveVisionSelectionForRequest(connectionSettings?: LlmConnectionSettings): ProviderModelSelection {
  const fallbackProvider = connectionSettings?.llmProvider === "lmstudio" || connectionSettings?.llmProvider === "llamacpp" || connectionSettings?.llmProvider === "ollama"
    ? connectionSettings.llmProvider
    : activeVisionSelection.provider;
  const requestedVision = parseModelSelectionValue(connectionSettings?.visionModel, fallbackProvider);
  if (requestedVision.model) {
    return requestedVision;
  }
  const requestedText = parseModelSelectionValue(connectionSettings?.textModel, fallbackProvider);
  if (requestedText.model) {
    return requestedText;
  }
  return activeVisionSelection;
}

function buildUrlWithPathPrefix(baseUrl: URL, pathPrefix: string, pathname: string): string {
  const normalizedPrefix = pathPrefix.replace(/\/+$/, "");
  const normalizedSuffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const joinedPath = `${normalizedPrefix}/${normalizedSuffix.replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
  baseUrl.pathname = joinedPath.startsWith("/") ? joinedPath : `/${joinedPath}`;
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl.toString();
}

export function resolveLlmConnectionSettings(input?: LlmConnectionSettings): ResolvedLlmConnectionSettings {
  const resolved: ResolvedLlmConnectionSettings = {
    ollamaUrl: runtimeOllamaUrl,
    lmStudioBaseUrl: runtimeLmStudioBaseUrl,
    lmStudioApiKey: runtimeLmStudioApiKey,
    lmStudioContextLength: runtimeLmStudioContextLength,
    lmStudioTextModelReasoningEnabled: runtimeLmStudioTextModelReasoningEnabled
  };
  if (typeof input?.ollamaUrl === "string" && input.ollamaUrl.trim().length > 0) {
    resolved.ollamaUrl = normalizeHttpUrl(input.ollamaUrl, "Ollama URL");
  }
  if (typeof input?.lmStudioBaseUrl === "string" && input.lmStudioBaseUrl.trim().length > 0) {
    resolved.lmStudioBaseUrl = normalizeHttpUrl(input.lmStudioBaseUrl, "LM Studio Base URL");
  }
  if (typeof input?.lmStudioApiKey === "string") {
    resolved.lmStudioApiKey = input.lmStudioApiKey.trim();
  }
  if (typeof input?.lmStudioContextLength === "number" && Number.isFinite(input.lmStudioContextLength)) {
    resolved.lmStudioContextLength = Math.max(0, Math.round(input.lmStudioContextLength));
  }
  if (typeof input?.lmStudioTextModelReasoningEnabled === "boolean") {
    resolved.lmStudioTextModelReasoningEnabled = input.lmStudioTextModelReasoningEnabled;
  }
  return resolved;
}

export function buildOllamaUrl(pathname: string, connectionSettings?: ResolvedLlmConnectionSettings): string {
  const baseUrl = new URL(connectionSettings?.ollamaUrl ?? runtimeOllamaUrl);
  const normalizedPath = baseUrl.pathname.replace(/\/+$/, "");
  const pathPrefix = /\/api\/generate$/i.test(normalizedPath)
    ? normalizedPath.slice(0, -"/api/generate".length)
    : /\/api$/i.test(normalizedPath)
      ? normalizedPath.slice(0, -"/api".length)
      : normalizedPath;
  return buildUrlWithPathPrefix(baseUrl, pathPrefix, pathname);
}

export function buildLmStudioUrl(pathname: string, connectionSettings?: ResolvedLlmConnectionSettings): string {
  const baseUrl = connectionSettings?.lmStudioBaseUrl ?? runtimeLmStudioBaseUrl;
  const normalizedPath = new URL(baseUrl).pathname.replace(/\/+$/, "");
  const pathPrefix = /\/v1$/i.test(normalizedPath) ? normalizedPath : `${normalizedPath}/v1`;
  return buildUrlWithPathPrefix(new URL(baseUrl), pathPrefix, pathname);
}

export function buildLmStudioAbsoluteUrl(pathname: string, connectionSettings?: ResolvedLlmConnectionSettings): string {
  const baseUrl = connectionSettings?.lmStudioBaseUrl ?? runtimeLmStudioBaseUrl;
  const normalizedPath = new URL(baseUrl).pathname.replace(/\/+$/, "");
  const pathPrefix = /\/v1$/i.test(normalizedPath) ? normalizedPath.slice(0, -3) : normalizedPath;
  return buildUrlWithPathPrefix(new URL(baseUrl), pathPrefix, pathname);
}

export function buildLmStudioApiV1Url(pathname: string, connectionSettings?: ResolvedLlmConnectionSettings): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return buildLmStudioAbsoluteUrl(`/api/v1${normalizedPath}`, connectionSettings);
}

export function normalizeAskOllamaOptions(input: AskOllamaLegacyInput): AskOllamaOptions {
  if (typeof input === "boolean") {
    return { think: input };
  }
  if (typeof input === "string") {
    return { systemPrompt: input };
  }
  return input ?? {};
}

export function getLmStudioApiKey(connectionSettings?: ResolvedLlmConnectionSettings): string {
  return connectionSettings?.lmStudioApiKey ?? runtimeLmStudioApiKey;
}

export function getLmStudioContextLength(connectionSettings?: ResolvedLlmConnectionSettings): number {
  return connectionSettings?.lmStudioContextLength ?? runtimeLmStudioContextLength;
}

export function getLmStudioReasoningEnabled(connectionSettings?: ResolvedLlmConnectionSettings): boolean {
  return connectionSettings?.lmStudioTextModelReasoningEnabled ?? runtimeLmStudioTextModelReasoningEnabled;
}

export function getScopedActiveModelSelections(scope: "text" | "vision" | "both"): Array<{ provider: LlmProvider; model: string }> {
  const seen = new Set<string>();
  const entries: Array<{ provider: LlmProvider; model: string }> = [];
  const candidates = scope === "text"
    ? [activeTextSelection]
    : scope === "vision"
      ? [activeVisionSelection]
      : [activeTextSelection, activeVisionSelection];
  for (const candidate of candidates) {
    const model = candidate.model.trim();
    if (!model) {
      continue;
    }
    const key = `${candidate.provider}::${model}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push({ provider: candidate.provider, model });
  }
  return entries;
}

export function getUniqueActiveModelSelections(): Array<{ provider: LlmProvider; model: string }> {
  return getScopedActiveModelSelections("both");
}

export function getProviderPriority(primary: LlmProvider): LlmProvider[] {
  if (primary === "lmstudio") return ["lmstudio", "ollama", "llamacpp"];
  if (primary === "llamacpp") return ["llamacpp", "ollama", "lmstudio"];
  return ["ollama", "lmstudio", "llamacpp"];
}

export function getActiveLlmProvider(): LlmProvider {
  return activeTextSelection.provider;
}

export function getActiveOllamaModels(): ActiveOllamaModels {
  return {
    textModel: encodeModelSelectionValue(activeTextSelection.provider, activeTextSelection.model),
    visionModel: encodeModelSelectionValue(activeVisionSelection.provider, activeVisionSelection.model)
  };
}

export interface ActiveOllamaModels {
  textModel: string;
  visionModel: string;
}

export function setActiveOllamaModels(input: { textModel?: string; visionModel?: string }): ActiveOllamaModels {
  if (typeof input.textModel === "string" && input.textModel.trim().length > 0) {
    activeTextSelection = parseModelSelectionValue(input.textModel, activeTextSelection.provider);
  }
  if (typeof input.visionModel === "string" && input.visionModel.trim().length > 0) {
    activeVisionSelection = parseModelSelectionValue(input.visionModel, activeVisionSelection.provider);
  }
  return getActiveOllamaModels();
}

export function trimLmStudioSessionCache(): void {
  while (lmStudioStatefulSessions.size > lmStudioStatefulSessionLimit) {
    const oldestKey = lmStudioStatefulSessions.keys().next().value;
    if (!oldestKey) {
      return;
    }
    lmStudioStatefulSessions.delete(oldestKey);
  }
}

export function getDefaultProvider(): LlmProvider {
  return defaultProvider;
}
