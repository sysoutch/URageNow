export interface LmStudioModelListResponse {
  data?: Array<{
    id?: string;
  }>;
}

export interface LmStudioNativeModelListResponse {
  models?: Array<{
    key?: string;
    loaded_instances?: Array<{
      id?: string;
    }>;
  }>;
}

export interface LmStudioChatCompletionResponse {
  choices?: Array<{
    message?: {
      reasoning_content?: string | Array<{
        type?: string;
        text?: string;
      }>;
      content?: string | Array<{
        type?: string;
        text?: string;
      }>;
    };
  }>;
}

export interface LmStudioChatCompletionChunk {
  choices?: Array<{
    delta?: {
      reasoning_content?: string | Array<{
        type?: string;
        text?: string;
      }>;
      reasoning?: string | Array<{
        type?: string;
        text?: string;
      }>;
      content?: string | Array<{
        type?: string;
        text?: string;
      }>;
    };
  }>;
}

export interface LmStudioStatefulChatResponse {
  output?: Array<{
    type?: string;
    content?: string;
    text?: string;
  }>;
  response_id?: string;
}

export interface LmStudioStatefulChatStreamEvent {
  type?: string;
  content?: string;
  message?: string;
  reason?: string;
  result?: LmStudioStatefulChatResponse;
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

export function lmStudioBuildUrl(baseUrlInput: string, pathname: string): string {
  const baseUrl = new URL(baseUrlInput);
  const normalizedPath = baseUrl.pathname.replace(/\/+$/, "");
  const pathPrefix = /\/v1$/i.test(normalizedPath) ? normalizedPath : `${normalizedPath}/v1`;
  return buildUrlWithPathPrefix(baseUrl, pathPrefix, pathname);
}

export function lmStudioBuildAbsoluteUrl(baseUrlInput: string, pathname: string): string {
  const baseUrl = new URL(baseUrlInput);
  const normalizedPath = baseUrl.pathname.replace(/\/+$/, "");
  const pathPrefix = /\/v1$/i.test(normalizedPath) ? normalizedPath.slice(0, -3) : normalizedPath;
  return buildUrlWithPathPrefix(baseUrl, pathPrefix, pathname);
}

export function lmStudioBuildApiV1Url(baseUrlInput: string, pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return lmStudioBuildAbsoluteUrl(baseUrlInput, `/api/v1${normalizedPath}`);
}

export function lmStudioCreateHeaders(apiKeyInput: string | undefined | null): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  const apiKey = String(apiKeyInput || "").trim();
  if (apiKey.length > 0) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

export function lmStudioExtractTextValue(
  value: unknown,
  options?: {
    trim?: boolean;
    joinWith?: string;
  }
): string {
  const trim = options?.trim !== false;
  const joinWith = typeof options?.joinWith === "string" ? options.joinWith : "\n";
  if (typeof value === "string") {
    return trim ? value.trim() : value;
  }
  if (Array.isArray(value)) {
    const chunks = value
      .map(entry => typeof entry?.text === "string" ? entry.text : "")
      .filter(text => text.length > 0);
    const combined = chunks.join(joinWith);
    return trim ? combined.trim() : combined;
  }
  return "";
}

export function lmStudioExtractChatCompletionOutput(payload: LmStudioChatCompletionResponse): { responseText: string; reasoningText: string } {
  const message = payload.choices?.[0]?.message;
  const contentText = lmStudioExtractTextValue(message?.content);
  const reasoningText = lmStudioExtractTextValue(message?.reasoning_content);
  const responseText = contentText || reasoningText;
  return {
    responseText: responseText.trim(),
    reasoningText: reasoningText.trim()
  };
}

export function lmStudioExtractStatefulOutput(payload: LmStudioStatefulChatResponse): { responseText: string; reasoningText: string } {
  const items = Array.isArray(payload.output) ? payload.output : [];
  const extractItems = (allowedTypes: string[]): string => items
    .filter(item => item?.type && allowedTypes.includes(item.type))
    .map(item => {
      const text = typeof item.content === "string" ? item.content : typeof item.text === "string" ? item.text : "";
      return text.trim();
    })
    .filter(text => text.length > 0)
    .join("\n")
    .trim();
  const messageText = extractItems(["message"]);
  const reasoningText = extractItems(["reasoning", "reasoning_content"]);
  return {
    responseText: (messageText || reasoningText).trim(),
    reasoningText: reasoningText.trim()
  };
}

export function lmStudioIsStatefulChatMissingPreviousResponse(status: number, detail: string): boolean {
  if (status === 404 || status === 410) {
    return true;
  }
  const normalized = detail.trim().toLowerCase();
  return normalized.includes("previous_response_id") || normalized.includes("response_id") && normalized.includes("not found");
}

export function lmStudioBuildReasoningControlFields(input: {
  hasImages: boolean;
  endpoint: "openai-chat-completions" | "native-chat";
  reasoningEnabled: boolean;
}): Record<string, unknown> {
  if (input.hasImages || input.reasoningEnabled) {
    return {};
  }
  if (input.endpoint === "native-chat") {
    return {
      reasoning: "off"
    };
  }
  return {
    chat_template_kwargs: {
      enable_thinking: false
    },
    reasoning: {
      enabled: false
    }
  };
}

export function lmStudioStripThinkingHintFields(body: Record<string, unknown>): Record<string, unknown> {
  const nextBody = {
    ...body
  };
  delete nextBody.chat_template_kwargs;
  delete nextBody.enable_thinking;
  delete nextBody.thinking;
  return nextBody;
}

export function lmStudioStripReasoningControlFields(body: Record<string, unknown>): Record<string, unknown> {
  const nextBody = lmStudioStripThinkingHintFields(body);
  delete nextBody.reasoning;
  delete nextBody.reasoning_effort;
  return nextBody;
}

export function lmStudioShouldRetryWithoutThinkingHintFields(status: number, detail: string): boolean {
  if (status < 400 || status >= 500) {
    return false;
  }
  const normalized = detail.trim().toLowerCase();
  const mentionsThinkingField = normalized.includes("chat_template_kwargs")
    || normalized.includes("enable_thinking")
    || normalized.includes("thinking");
  if (!mentionsThinkingField) {
    return false;
  }
  return normalized.includes("unknown")
    || normalized.includes("unexpected")
    || normalized.includes("not supported")
    || normalized.includes("not allowed")
    || normalized.includes("invalid")
    || normalized.includes("additional");
}

export function lmStudioShouldRetryWithoutReasoningControls(status: number, detail: string): boolean {
  if (status < 400 || status >= 500) {
    return false;
  }
  const normalized = detail.trim().toLowerCase();
  if (!normalized.includes("reasoning")) {
    return false;
  }
  return normalized.includes("unknown")
    || normalized.includes("unexpected")
    || normalized.includes("not supported")
    || normalized.includes("not allowed")
    || normalized.includes("invalid")
    || normalized.includes("additional");
}

export function lmStudioApplyNoReasoningDirective(systemPrompt: string, reasoningControlsEnabled: boolean): string {
  if (!reasoningControlsEnabled) {
    return systemPrompt;
  }
  const directive = "Respond with only the final answer. Do not output chain-of-thought or reasoning traces.";
  const normalizedPrompt = systemPrompt.trim();
  if (!normalizedPrompt) {
    return directive;
  }
  if (normalizedPrompt.toLowerCase().includes("chain-of-thought") || normalizedPrompt.toLowerCase().includes("reasoning traces")) {
    return normalizedPrompt;
  }
  return `${normalizedPrompt}\n\n${directive}`;
}

export function lmStudioBuildUnloadCandidates(baseUrlInput: string, instanceIds: string[]): Array<{ url: string; body: Record<string, string> }> {
  const candidates: Array<{ url: string; body: Record<string, string> }> = [];
  for (const instanceId of instanceIds) {
    const normalizedId = instanceId.trim();
    if (!normalizedId) {
      continue;
    }
    candidates.push({
      url: lmStudioBuildApiV1Url(baseUrlInput, "/models/unload"),
      body: { instance_id: normalizedId }
    });
    candidates.push({
      url: lmStudioBuildAbsoluteUrl(baseUrlInput, "/api/v0/model/unload"),
      body: { model: normalizedId }
    });
    candidates.push({
      url: lmStudioBuildAbsoluteUrl(baseUrlInput, "/api/v0/models/unload"),
      body: { model: normalizedId }
    });
    candidates.push({
      url: lmStudioBuildAbsoluteUrl(baseUrlInput, "/v1/models/unload"),
      body: { model: normalizedId }
    });
  }
  return candidates;
}

export function lmStudioIsModelAlreadyUnloadedError(status: number, detail: string): boolean {
  if (status === 404) {
    return true;
  }
  const normalized = detail.trim().toLowerCase();
  return normalized.includes("not loaded") || normalized.includes("already unloaded") || normalized.includes("no loaded model");
}

export function lmStudioBuildLoadCandidates(
  baseUrlInput: string,
  modelKey: string,
  contextLength = 0
): Array<{ url: string; body: Record<string, string | number> }> {
  const normalizedKey = modelKey.trim();
  if (!normalizedKey) {
    return [];
  }
  const normalizedContextLength = Number.isFinite(contextLength) ? Math.max(0, Math.round(contextLength)) : 0;
  const pushBodies = (
    candidates: Array<{ url: string; body: Record<string, string | number> }>,
    url: string,
    key: "model" | "key"
  ): void => {
    const base: Record<string, string | number> = { [key]: normalizedKey };
    if (normalizedContextLength <= 0) {
      candidates.push({ url, body: base });
      return;
    }
    candidates.push({
      url,
      body: {
        ...base,
        context_length: normalizedContextLength,
        contextLength: normalizedContextLength,
        n_ctx: normalizedContextLength
      }
    });
    candidates.push({ url, body: { ...base, context_length: normalizedContextLength } });
    candidates.push({ url, body: { ...base, contextLength: normalizedContextLength } });
    candidates.push({ url, body: { ...base, n_ctx: normalizedContextLength } });
    candidates.push({ url, body: base });
  };
  const candidates: Array<{ url: string; body: Record<string, string | number> }> = [];
  pushBodies(candidates, lmStudioBuildApiV1Url(baseUrlInput, "/models/load"), "model");
  pushBodies(candidates, lmStudioBuildApiV1Url(baseUrlInput, "/models/load"), "key");
  pushBodies(candidates, lmStudioBuildAbsoluteUrl(baseUrlInput, "/api/v0/model/load"), "model");
  pushBodies(candidates, lmStudioBuildAbsoluteUrl(baseUrlInput, "/api/v0/models/load"), "model");
  pushBodies(candidates, lmStudioBuildAbsoluteUrl(baseUrlInput, "/v1/models/load"), "model");
  return candidates;
}

export function lmStudioIsModelAlreadyLoadedError(status: number, detail: string): boolean {
  const normalized = detail.trim().toLowerCase();
  if (status === 409) {
    return true;
  }
  return normalized.includes("already loaded") || normalized.includes("already active") || normalized.includes("already in memory");
}
