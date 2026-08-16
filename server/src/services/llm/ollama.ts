import { appConfig } from "../../config/appConfig.js";
import {
  lmStudioApplyNoReasoningDirective,
  lmStudioBuildAbsoluteUrl,
  lmStudioBuildApiV1Url,
  lmStudioBuildLoadCandidates,
  lmStudioBuildReasoningControlFields,
  lmStudioBuildUnloadCandidates,
  lmStudioBuildUrl,
  lmStudioCreateHeaders,
  lmStudioExtractChatCompletionOutput,
  lmStudioExtractStatefulOutput,
  lmStudioExtractTextValue,
  lmStudioIsModelAlreadyLoadedError,
  lmStudioIsModelAlreadyUnloadedError,
  lmStudioIsStatefulChatMissingPreviousResponse,
  lmStudioShouldRetryWithoutReasoningControls,
  lmStudioShouldRetryWithoutThinkingHintFields,
  lmStudioStripReasoningControlFields,
  lmStudioStripThinkingHintFields,
  type LmStudioChatCompletionChunk,
  type LmStudioChatCompletionResponse,
  type LmStudioModelListResponse,
  type LmStudioNativeModelListResponse,
  type LmStudioStatefulChatResponse,
  type LmStudioStatefulChatStreamEvent
} from "./lmstudio.js";
import {
  type ActiveOllamaModels,
  type AskOllamaDetailedResult,
  type AskOllamaLegacyInput,
  type AskOllamaOptions,
  type AskOllamaStreamCallbacks,
  type LlavaImageAnalysis,
  type LlmConnectionSettings,
  type LlmEjectResult,
  type LlmLoadResult,
  type LlmModelCatalog,
  type LlmModelProviderCatalog,
  type LlmProvider,
  type ProviderModelSelection,
  type ResolvedLlmConnectionSettings,
  buildLmStudioAbsoluteUrl,
  buildLmStudioApiV1Url,
  buildLmStudioUrl,
  buildOllamaUrl,
  encodeModelSelectionValue,
  getActiveLlmProvider,
  getActiveOllamaModels,
  getLmStudioApiKey,
  getLmStudioContextLength,
  getLmStudioReasoningEnabled,
  getProviderLabel,
  getProviderPriority,
  getScopedActiveModelSelections,
  getUniqueActiveModelSelections,
  lmStudioStatefulSessions,
  normalizeAskOllamaOptions,
  parseModelSelectionValue,
  providerModelListTimeoutMs,
  resolveLlmConnectionSettings,
  resolveTextSelectionForRequest,
  resolveVisionSelectionForRequest,
  setActiveOllamaModels,
  setActiveTextSelection,
  setActiveVisionSelection,
  setLlmConnectionSettings,
  trimLmStudioSessionCache
} from "./runtime.js";
import { resolveImageInputForProvider } from "./imageInputs.js";
import { recordDashboardLlmConsoleEvent } from "../dashboardConsoleLogger.js";

export { getActiveOllamaModels, setActiveOllamaModels, setLlmConnectionSettings } from "./runtime.js";
export type {
  AskOllamaDetailedResult,
  AskOllamaLegacyInput,
  AskOllamaOptions,
  AskOllamaStreamCallbacks,
  LlavaImageAnalysis,
  LlmConnectionSettings,
  LlmEjectResult,
  LlmLoadResult,
  LlmModelCatalog,
  LlmModelProviderCatalog,
  LlmProvider
} from "./runtime.js";

interface OllamaGenerateResponse {
  response?: string;
}
interface OllamaGenerateStreamChunk {
  response?: string;
  done?: boolean;
}

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
}

async function fetchWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...(init ?? {}),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
function normalizeResponseText(input: string): string {
  return input
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$2")
    .trim();
}
function extractLmStudioTextValue(
  value: unknown,
  options?: {
    trim?: boolean;
    joinWith?: string;
  }
): string {
  return lmStudioExtractTextValue(value, options);
}
function extractLmStudioChatCompletionOutput(payload: LmStudioChatCompletionResponse): { responseText: string; reasoningText: string } {
  return lmStudioExtractChatCompletionOutput(payload);
}
function extractLmStudioStatefulOutput(payload: LmStudioStatefulChatResponse): { responseText: string; reasoningText: string } {
  return lmStudioExtractStatefulOutput(payload);
}
function extractOllamaThinkSections(input: string): { responseText: string; reasoningText: string } {
  const raw = String(input || "");
  const thinkSections = [...raw.matchAll(/<think>([\s\S]*?)<\/think>/gi)]
    .map(match => (match[1] || "").trim())
    .filter(Boolean);
  const reasoningText = thinkSections.join("\n\n").trim();
  const responseText = normalizeResponseText(raw);
  return {
    responseText,
    reasoningText
  };
}
function createThinkTagStreamSplitter(input: {
  onReasoningDelta: (delta: string) => void;
  onResponseDelta: (delta: string) => void;
}): {
  push: (delta: string) => void;
  flush: () => void;
} {
  const openTag = "<think>";
  const closeTag = "</think>";
  let insideThink = false;
  let buffer = "";
  const emitBufferedSafeChunk = (token: string, emitter: (delta: string) => void): boolean => {
    const safeLength = Math.max(0, buffer.length - (token.length - 1));
    if (safeLength <= 0) {
      return false;
    }
    const delta = buffer.slice(0, safeLength);
    buffer = buffer.slice(safeLength);
    if (delta) {
      emitter(delta);
    }
    return true;
  };
  return {
    push: delta => {
      if (!delta) {
        return;
      }
      buffer += delta;
      while (buffer.length > 0) {
        if (!insideThink) {
          const index = buffer.indexOf(openTag);
          if (index === -1) {
            if (!emitBufferedSafeChunk(openTag, input.onResponseDelta)) {
              break;
            }
            continue;
          }
          if (index > 0) {
            input.onResponseDelta(buffer.slice(0, index));
          }
          buffer = buffer.slice(index + openTag.length);
          insideThink = true;
          continue;
        }
        const index = buffer.indexOf(closeTag);
        if (index === -1) {
          if (!emitBufferedSafeChunk(closeTag, input.onReasoningDelta)) {
            break;
          }
          continue;
        }
        if (index > 0) {
          input.onReasoningDelta(buffer.slice(0, index));
        }
        buffer = buffer.slice(index + closeTag.length);
        insideThink = false;
      }
    },
    flush: () => {
      if (!buffer) {
        return;
      }
      if (insideThink) {
        input.onReasoningDelta(buffer);
      } else {
        input.onResponseDelta(buffer);
      }
      buffer = "";
    }
  };
}
async function readUtf8LinesFromStream(response: Response, onLine: (line: string) => void): Promise<void> {
  if (!response.body) {
    throw new Error("Streaming response body is not available.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    buffer += decoder.decode(chunk.value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      onLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  const tail = buffer.replace(/\r$/, "");
  if (tail) {
    onLine(tail);
  }
}
async function readSseDataEvents(response: Response, onData: (data: string) => void): Promise<void> {
  const lines: string[] = [];
  await readUtf8LinesFromStream(response, line => {
    if (!line.trim()) {
      if (lines.length > 0) {
        onData(lines.join("\n"));
        lines.length = 0;
      }
      return;
    }
    if (line.startsWith("data:")) {
      lines.push(line.slice(5).trimStart());
    }
  });
  if (lines.length > 0) {
    onData(lines.join("\n"));
  }
}
function isLmStudioStatefulChatMissingPreviousResponse(status: number, detail: string): boolean {
  return lmStudioIsStatefulChatMissingPreviousResponse(status, detail);
}
function buildLmStudioReasoningControlFields(input: {
  hasImages: boolean;
  endpoint: "openai-chat-completions" | "native-chat";
  connectionSettings?: ResolvedLlmConnectionSettings;
}): Record<string, unknown> {
  const reasoningEnabled = getLmStudioReasoningEnabled(input.connectionSettings);
  return lmStudioBuildReasoningControlFields({
    hasImages: input.hasImages,
    endpoint: input.endpoint,
    reasoningEnabled
  });
}
function stripLmStudioThinkingHintFields(body: Record<string, unknown>): Record<string, unknown> {
  return lmStudioStripThinkingHintFields(body);
}
function stripLmStudioReasoningControlFields(body: Record<string, unknown>): Record<string, unknown> {
  return lmStudioStripReasoningControlFields(body);
}
function shouldRetryLmStudioWithoutThinkingHintFields(status: number, detail: string): boolean {
  return lmStudioShouldRetryWithoutThinkingHintFields(status, detail);
}
function shouldRetryLmStudioWithoutReasoningControls(status: number, detail: string): boolean {
  return lmStudioShouldRetryWithoutReasoningControls(status, detail);
}
function applyLmStudioNoReasoningDirective(systemPrompt: string, reasoningControlsEnabled: boolean): string {
  return lmStudioApplyNoReasoningDirective(systemPrompt, reasoningControlsEnabled);
}

async function runOllamaGenerateRequestDetailed(
  model: string,
  prompt: string,
  options?: {
    think?: boolean;
    images?: string[];
    systemPrompt?: string | null;
  },
  connectionSettings?: ResolvedLlmConnectionSettings
): Promise<{ responseText: string; reasoningText: string }> {
  const systemPrompt = options?.systemPrompt?.trim() || undefined;
  const response = await fetch(buildOllamaUrl("/api/generate", connectionSettings), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      think: options?.think ?? false,
      images: options?.images,
      system: systemPrompt,
      stream: false
    })
  });

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      detail.length > 0
        ? `Ollama request for model "${model}" failed with status ${response.status}: ${detail}`
        : `Ollama request for model "${model}" failed with status ${response.status}`
    );
  }

  const payload = (await response.json()) as OllamaGenerateResponse;
  if (!payload.response) {
    throw new Error("Ollama returned an empty response.");
  }
  return extractOllamaThinkSections(payload.response);
}
async function runOllamaGenerateRequestStreamDetailed(
  model: string,
  prompt: string,
  callbacks: AskOllamaStreamCallbacks,
  options?: {
    think?: boolean;
    images?: string[];
    systemPrompt?: string | null;
  },
  connectionSettings?: ResolvedLlmConnectionSettings
): Promise<{ responseText: string; reasoningText: string }> {
  const systemPrompt = options?.systemPrompt?.trim() || undefined;
  const response = await fetch(buildOllamaUrl("/api/generate", connectionSettings), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      think: options?.think ?? false,
      images: options?.images,
      system: systemPrompt,
      stream: true
    }),
    signal: callbacks.signal
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      detail.length > 0
        ? `Ollama request for model "${model}" failed with status ${response.status}: ${detail}`
        : `Ollama request for model "${model}" failed with status ${response.status}`
    );
  }
  const reasoningSegments: string[] = [];
  const responseSegments: string[] = [];
  const splitter = createThinkTagStreamSplitter({
    onReasoningDelta: delta => {
      if (!delta) {
        return;
      }
      reasoningSegments.push(delta);
      callbacks.onReasoningDelta?.(delta);
    },
    onResponseDelta: delta => {
      if (!delta) {
        return;
      }
      responseSegments.push(delta);
      callbacks.onResponseDelta?.(delta);
    }
  });
  await readUtf8LinesFromStream(response, line => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    try {
      const chunk = JSON.parse(trimmed) as OllamaGenerateStreamChunk;
      const delta = typeof chunk.response === "string" ? chunk.response : "";
      if (delta) {
        splitter.push(delta);
      }
    } catch {
      // Ignore malformed stream lines and continue collecting valid chunks.
    }
  });
  splitter.flush();
  const responseText = normalizeResponseText(responseSegments.join(""));
  const reasoningText = normalizeResponseText(reasoningSegments.join(""));
  if (!responseText && !reasoningText) {
    throw new Error("Ollama returned an empty response.");
  }
  return {
    responseText,
    reasoningText
  };
}

async function runLmStudioGenerateRequestDetailed(
  model: string,
  prompt: string,
  options?: {
    images?: string[];
    systemPrompt?: string | null;
    statefulChatSessionId?: string | null;
    useStatefulChat?: boolean;
    resetStatefulChat?: boolean;
  },
  connectionSettings?: ResolvedLlmConnectionSettings
): Promise<{ responseText: string; reasoningText: string }> {
  const shouldUseStatefulChat = options?.useStatefulChat === true || typeof options?.statefulChatSessionId === "string" || options?.resetStatefulChat === true;
  const reasoningEnabled = getLmStudioReasoningEnabled(connectionSettings);
  const shouldUseNativeChat = shouldUseStatefulChat || !reasoningEnabled;
  if (shouldUseNativeChat) {
    const detailed = await runLmStudioStatefulChatRequestDetailed(model, prompt, options, connectionSettings);
    return {
      responseText: detailed.responseText,
      reasoningText: reasoningEnabled ? detailed.reasoningText : ""
    };
  }
  const reasoningControlFields = buildLmStudioReasoningControlFields({
    hasImages: Array.isArray(options?.images) && options.images.length > 0,
    endpoint: "openai-chat-completions",
    connectionSettings
  });
  const hadReasoningControls = Object.keys(reasoningControlFields).length > 0;
  const content = options?.images && options.images.length > 0
    ? [
      { type: "text", text: prompt },
      ...options.images.map(image => ({
        type: "image_url",
        image_url: {
          url: image
        }
      }))
    ]
    : prompt;
  const systemPrompt = applyLmStudioNoReasoningDirective(options?.systemPrompt?.trim() || "", hadReasoningControls);
  const messages: Array<{ role: "system" | "user"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];
  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt
    });
  }
  messages.push({
    role: "user",
    content
  });
  let requestBody: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    ...reasoningControlFields
  };
  const runChatCompletionRequest = async (body: Record<string, unknown>): Promise<{ ok: true; payload: LmStudioChatCompletionResponse } | { ok: false; status: number; detail: string }> => {
    const response = await fetch(buildLmStudioUrl("/chat/completions", connectionSettings), {
      method: "POST",
      headers: getLmStudioHeaders(connectionSettings),
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: (await response.text()).trim()
      };
    }
    return {
      ok: true,
      payload: (await response.json()) as LmStudioChatCompletionResponse
    };
  };

  let response = await runChatCompletionRequest(requestBody);
  if (!response.ok && hadReasoningControls && shouldRetryLmStudioWithoutThinkingHintFields(response.status, response.detail)) {
    requestBody = stripLmStudioThinkingHintFields(requestBody);
    response = await runChatCompletionRequest(requestBody);
  }
  if (!response.ok && hadReasoningControls && shouldRetryLmStudioWithoutReasoningControls(response.status, response.detail)) {
    requestBody = stripLmStudioReasoningControlFields(requestBody);
    response = await runChatCompletionRequest(requestBody);
  }
  if (!response.ok) {
    throw new Error(
      response.detail.length > 0
        ? `LM Studio request for model "${model}" failed with status ${response.status}: ${response.detail}`
        : `LM Studio request for model "${model}" failed with status ${response.status}`
    );
  }
  const output = extractLmStudioChatCompletionOutput(response.payload);
  if (output.responseText.length > 0) {
    return {
      responseText: normalizeResponseText(output.responseText),
      reasoningText: reasoningEnabled ? normalizeResponseText(output.reasoningText) : ""
    };
  }
  throw new Error("LM Studio returned an empty response.");
}
async function runLmStudioGenerateRequestStreamDetailed(
  model: string,
  prompt: string,
  callbacks: AskOllamaStreamCallbacks,
  options?: {
    images?: string[];
    systemPrompt?: string | null;
    statefulChatSessionId?: string | null;
    useStatefulChat?: boolean;
    resetStatefulChat?: boolean;
  },
  connectionSettings?: ResolvedLlmConnectionSettings
): Promise<{ responseText: string; reasoningText: string }> {
  const shouldUseStatefulChat = options?.useStatefulChat === true || typeof options?.statefulChatSessionId === "string" || options?.resetStatefulChat === true;
  const reasoningEnabled = getLmStudioReasoningEnabled(connectionSettings);
  const shouldUseNativeChatStream = shouldUseStatefulChat || !reasoningEnabled;
  if (shouldUseNativeChatStream) {
    return runLmStudioStatefulChatRequestStreamDetailed(model, prompt, callbacks, options, connectionSettings);
  }
  const reasoningControlFields = buildLmStudioReasoningControlFields({
    hasImages: Array.isArray(options?.images) && options.images.length > 0,
    endpoint: "openai-chat-completions",
    connectionSettings
  });
  const hadReasoningControls = Object.keys(reasoningControlFields).length > 0;
  const content = options?.images && options.images.length > 0
    ? [
      { type: "text", text: prompt },
      ...options.images.map(image => ({
        type: "image_url",
        image_url: {
          url: image
        }
      }))
    ]
    : prompt;
  const systemPrompt = applyLmStudioNoReasoningDirective(options?.systemPrompt?.trim() || "", hadReasoningControls);
  const messages: Array<{ role: "system" | "user"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];
  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt
    });
  }
  messages.push({
    role: "user",
    content
  });
  let requestBody: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    ...reasoningControlFields
  };
  const runStreamRequest = async (body: Record<string, unknown>): Promise<{ ok: true; response: Response } | { ok: false; status: number; detail: string }> => {
    const response = await fetch(buildLmStudioUrl("/chat/completions", connectionSettings), {
      method: "POST",
      headers: getLmStudioHeaders(connectionSettings),
      body: JSON.stringify(body),
      signal: callbacks.signal
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: (await response.text()).trim()
      };
    }
    return {
      ok: true,
      response
    };
  };
  let streamResponse = await runStreamRequest(requestBody);
  if (!streamResponse.ok && hadReasoningControls && shouldRetryLmStudioWithoutThinkingHintFields(streamResponse.status, streamResponse.detail)) {
    requestBody = stripLmStudioThinkingHintFields(requestBody);
    streamResponse = await runStreamRequest(requestBody);
  }
  if (!streamResponse.ok && hadReasoningControls && shouldRetryLmStudioWithoutReasoningControls(streamResponse.status, streamResponse.detail)) {
    requestBody = stripLmStudioReasoningControlFields(requestBody);
    streamResponse = await runStreamRequest(requestBody);
  }
  if (!streamResponse.ok) {
    throw new Error(
      streamResponse.detail.length > 0
        ? `LM Studio request for model "${model}" failed with status ${streamResponse.status}: ${streamResponse.detail}`
        : `LM Studio request for model "${model}" failed with status ${streamResponse.status}`
    );
  }
  const reasoningSegments: string[] = [];
  const responseSegments: string[] = [];
  await readSseDataEvents(streamResponse.response, data => {
    if (!data || data === "[DONE]") {
      return;
    }
    try {
      const chunk = JSON.parse(data) as LmStudioChatCompletionChunk;
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) {
        return;
      }
      const reasoningDelta = extractLmStudioTextValue(delta.reasoning_content ?? delta.reasoning, {
        trim: false,
        joinWith: ""
      });
      if (reasoningEnabled && reasoningDelta) {
        reasoningSegments.push(reasoningDelta);
        callbacks.onReasoningDelta?.(reasoningDelta);
      }
      const responseDelta = extractLmStudioTextValue(delta.content, {
        trim: false,
        joinWith: ""
      });
      if (responseDelta) {
        responseSegments.push(responseDelta);
        callbacks.onResponseDelta?.(responseDelta);
      }
    } catch {
      // Ignore malformed SSE chunks and continue.
    }
  });
  const responseText = normalizeResponseText(responseSegments.join(""));
  const rawReasoningText = normalizeResponseText(reasoningSegments.join(""));
  const reasoningText = reasoningEnabled ? rawReasoningText : "";
  if (!responseText && !reasoningText) {
    throw new Error("LM Studio returned an empty response.");
  }
  return {
    responseText,
    reasoningText
  };
}
async function runLmStudioStatefulChatRequestDetailed(
  model: string,
  prompt: string,
  options?: {
    images?: string[];
    systemPrompt?: string | null;
    statefulChatSessionId?: string | null;
    useStatefulChat?: boolean;
    resetStatefulChat?: boolean;
  },
  connectionSettings?: ResolvedLlmConnectionSettings
): Promise<{ responseText: string; reasoningText: string }> {
  const sessionId = options?.statefulChatSessionId?.trim() || "";
  const reasoningControlFields = buildLmStudioReasoningControlFields({
    hasImages: Array.isArray(options?.images) && options.images.length > 0,
    endpoint: "native-chat",
    connectionSettings
  });
  const hadReasoningControls = Object.keys(reasoningControlFields).length > 0;
  const systemPrompt = applyLmStudioNoReasoningDirective(options?.systemPrompt?.trim() || "", hadReasoningControls);
  let currentSession = sessionId ? lmStudioStatefulSessions.get(sessionId) ?? null : null;
  if (sessionId && options?.resetStatefulChat) {
    lmStudioStatefulSessions.delete(sessionId);
    currentSession = null;
  }
  if (sessionId && currentSession && systemPrompt && currentSession.systemPrompt && currentSession.systemPrompt !== systemPrompt) {
    lmStudioStatefulSessions.delete(sessionId);
    currentSession = null;
  }
  const input = options?.images && options.images.length > 0
    ? [
      { type: "text", content: prompt },
      ...options.images.map(image => ({ type: "image", data_url: image }))
    ]
    : prompt;
  const requestBody: Record<string, unknown> = {
    model,
    input
  };
  Object.assign(requestBody, reasoningControlFields);
  if (systemPrompt && (!currentSession || currentSession.systemPrompt !== systemPrompt)) {
    requestBody.system_prompt = systemPrompt;
  }
  if (currentSession?.responseId) {
    requestBody.previous_response_id = currentSession.responseId;
  }
  if (!sessionId) {
    requestBody.store = false;
  }
  const headers = getLmStudioHeaders(connectionSettings);
  const request = async (body: Record<string, unknown>): Promise<{ ok: true; payload: LmStudioStatefulChatResponse } | { ok: false; detail: string; status: number }> => {
    const response = await fetch(buildLmStudioApiV1Url("/chat", connectionSettings), {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      return {
        ok: false,
        detail: (await response.text()).trim(),
        status: response.status
      };
    }
    return {
      ok: true,
      payload: (await response.json()) as LmStudioStatefulChatResponse
    };
  };
  let effectiveRequestBody = requestBody;
  let statefulResponse = await request(effectiveRequestBody);
  if (!statefulResponse.ok && hadReasoningControls && shouldRetryLmStudioWithoutReasoningControls(statefulResponse.status, statefulResponse.detail)) {
    effectiveRequestBody = stripLmStudioReasoningControlFields(effectiveRequestBody);
    statefulResponse = await request(effectiveRequestBody);
  }
  const attemptedWithPreviousResponse = typeof effectiveRequestBody.previous_response_id === "string" && effectiveRequestBody.previous_response_id.trim().length > 0;
  if (!statefulResponse.ok && attemptedWithPreviousResponse && isLmStudioStatefulChatMissingPreviousResponse(statefulResponse.status, statefulResponse.detail)) {
    if (sessionId) {
      lmStudioStatefulSessions.delete(sessionId);
    }
    const retryBody = {
      ...effectiveRequestBody
    };
    delete retryBody.previous_response_id;
    if (systemPrompt) {
      retryBody.system_prompt = systemPrompt;
    }
    statefulResponse = await request(retryBody);
  }
  if (!statefulResponse.ok) {
    throw new Error(
      statefulResponse.detail.length > 0
        ? `LM Studio request for model "${model}" failed with status ${statefulResponse.status}: ${statefulResponse.detail}`
        : `LM Studio request for model "${model}" failed with status ${statefulResponse.status}`
    );
  }
  const output = extractLmStudioStatefulOutput(statefulResponse.payload);
  if (!output.responseText) {
    throw new Error("LM Studio returned an empty response.");
  }
  if (sessionId) {
    const responseId = typeof statefulResponse.payload.response_id === "string" ? statefulResponse.payload.response_id.trim() : "";
    if (responseId) {
      lmStudioStatefulSessions.set(sessionId, {
        responseId,
        systemPrompt: systemPrompt || currentSession?.systemPrompt || ""
      });
      trimLmStudioSessionCache();
    } else {
      lmStudioStatefulSessions.delete(sessionId);
    }
  }
  return {
    responseText: normalizeResponseText(output.responseText),
    reasoningText: normalizeResponseText(output.reasoningText)
  };
}
async function runLmStudioStatefulChatRequestStreamDetailed(
  model: string,
  prompt: string,
  callbacks: AskOllamaStreamCallbacks,
  options?: {
    images?: string[];
    systemPrompt?: string | null;
    statefulChatSessionId?: string | null;
    useStatefulChat?: boolean;
    resetStatefulChat?: boolean;
  },
  connectionSettings?: ResolvedLlmConnectionSettings
): Promise<{ responseText: string; reasoningText: string }> {
  const sessionId = options?.statefulChatSessionId?.trim() || "";
  const reasoningEnabled = getLmStudioReasoningEnabled(connectionSettings);
  const reasoningControlFields = buildLmStudioReasoningControlFields({
    hasImages: Array.isArray(options?.images) && options.images.length > 0,
    endpoint: "native-chat",
    connectionSettings
  });
  const hadReasoningControls = Object.keys(reasoningControlFields).length > 0;
  const systemPrompt = applyLmStudioNoReasoningDirective(options?.systemPrompt?.trim() || "", hadReasoningControls);
  let currentSession = sessionId ? lmStudioStatefulSessions.get(sessionId) ?? null : null;
  if (sessionId && options?.resetStatefulChat) {
    lmStudioStatefulSessions.delete(sessionId);
    currentSession = null;
  }
  if (sessionId && currentSession && systemPrompt && currentSession.systemPrompt && currentSession.systemPrompt !== systemPrompt) {
    lmStudioStatefulSessions.delete(sessionId);
    currentSession = null;
  }
  const input = options?.images && options.images.length > 0
    ? [
      { type: "text", content: prompt },
      ...options.images.map(image => ({ type: "image", data_url: image }))
    ]
    : prompt;
  const requestBody: Record<string, unknown> = {
    model,
    input,
    stream: true
  };
  Object.assign(requestBody, reasoningControlFields);
  if (systemPrompt && (!currentSession || currentSession.systemPrompt !== systemPrompt)) {
    requestBody.system_prompt = systemPrompt;
  }
  if (currentSession?.responseId) {
    requestBody.previous_response_id = currentSession.responseId;
  }
  if (!sessionId) {
    requestBody.store = false;
  }
  const headers = getLmStudioHeaders(connectionSettings);
  const request = async (body: Record<string, unknown>): Promise<{ ok: true; response: Response } | { ok: false; detail: string; status: number }> => {
    const response = await fetch(buildLmStudioApiV1Url("/chat", connectionSettings), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: callbacks.signal
    });
    if (!response.ok) {
      return {
        ok: false,
        detail: (await response.text()).trim(),
        status: response.status
      };
    }
    return {
      ok: true,
      response
    };
  };
  let effectiveRequestBody = requestBody;
  let statefulResponse = await request(effectiveRequestBody);
  if (!statefulResponse.ok && hadReasoningControls && shouldRetryLmStudioWithoutReasoningControls(statefulResponse.status, statefulResponse.detail)) {
    effectiveRequestBody = stripLmStudioReasoningControlFields(effectiveRequestBody);
    statefulResponse = await request(effectiveRequestBody);
  }
  const attemptedWithPreviousResponse = typeof effectiveRequestBody.previous_response_id === "string" && effectiveRequestBody.previous_response_id.trim().length > 0;
  if (!statefulResponse.ok && attemptedWithPreviousResponse && isLmStudioStatefulChatMissingPreviousResponse(statefulResponse.status, statefulResponse.detail)) {
    if (sessionId) {
      lmStudioStatefulSessions.delete(sessionId);
    }
    const retryBody = {
      ...effectiveRequestBody
    };
    delete retryBody.previous_response_id;
    if (systemPrompt) {
      retryBody.system_prompt = systemPrompt;
    }
    statefulResponse = await request(retryBody);
  }
  if (!statefulResponse.ok) {
    throw new Error(
      statefulResponse.detail.length > 0
        ? `LM Studio request for model "${model}" failed with status ${statefulResponse.status}: ${statefulResponse.detail}`
        : `LM Studio request for model "${model}" failed with status ${statefulResponse.status}`
    );
  }
  const responseSegments: string[] = [];
  const reasoningSegments: string[] = [];
  let endResult: LmStudioStatefulChatResponse | null = null;
  await readSseDataEvents(statefulResponse.response, data => {
    if (!data || data === "[DONE]") {
      return;
    }
    const event = JSON.parse(data) as LmStudioStatefulChatStreamEvent;
    const type = typeof event.type === "string" ? event.type : "";
    if (type === "reasoning.delta") {
      const delta = typeof event.content === "string" ? event.content : "";
      if (reasoningEnabled && delta) {
        reasoningSegments.push(delta);
        callbacks.onReasoningDelta?.(delta);
      }
      return;
    }
    if (type === "message.delta") {
      const delta = typeof event.content === "string" ? event.content : "";
      if (delta) {
        responseSegments.push(delta);
        callbacks.onResponseDelta?.(delta);
      }
      return;
    }
    if (type === "chat.end" && event.result && typeof event.result === "object") {
      endResult = event.result;
      return;
    }
    if (type === "error") {
      const detail = typeof event.message === "string" && event.message.trim()
        ? event.message.trim()
        : typeof event.reason === "string" && event.reason.trim()
          ? event.reason.trim()
          : "LM Studio streaming request failed.";
      throw new Error(detail);
    }
  });
  let responseText = normalizeResponseText(responseSegments.join(""));
  let reasoningText = normalizeResponseText(reasoningSegments.join(""));
  const streamEndResult = endResult as LmStudioStatefulChatResponse | null;
  if ((!responseText || !reasoningText) && streamEndResult) {
    const output = extractLmStudioStatefulOutput(streamEndResult);
    if (!responseText) {
      responseText = normalizeResponseText(output.responseText);
    }
    if (!reasoningText) {
      reasoningText = normalizeResponseText(output.reasoningText);
    }
  }
  if (sessionId) {
    const responseId = streamEndResult && typeof streamEndResult.response_id === "string"
      ? streamEndResult.response_id.trim()
      : "";
    if (responseId) {
      lmStudioStatefulSessions.set(sessionId, {
        responseId,
        systemPrompt: systemPrompt || currentSession?.systemPrompt || ""
      });
      trimLmStudioSessionCache();
    } else {
      lmStudioStatefulSessions.delete(sessionId);
    }
  }
  if (!responseText && !(reasoningEnabled && reasoningText)) {
    throw new Error("LM Studio returned an empty response.");
  }
  return {
    responseText,
    reasoningText: reasoningEnabled ? reasoningText : ""
  };
}

async function runGenerateRequestDetailed(
  provider: LlmProvider,
  model: string,
  prompt: string,
  options?: {
    think?: boolean;
    images?: string[];
    systemPrompt?: string | null;
    statefulChatSessionId?: string | null;
    useStatefulChat?: boolean;
    resetStatefulChat?: boolean;
  },
  connectionSettings?: LlmConnectionSettings
): Promise<{ responseText: string; reasoningText: string }> {
  const startedAt = Date.now();
  const resolvedConnectionSettings = resolveLlmConnectionSettings(connectionSettings);
  try {
    let output: { responseText: string; reasoningText: string };
    if (provider !== "ollama") {
      const statefulOptions = provider === "lmstudio" ? {
        statefulChatSessionId: options?.statefulChatSessionId,
        useStatefulChat: options?.useStatefulChat,
        resetStatefulChat: options?.resetStatefulChat
      } : {};
      output = await runLmStudioGenerateRequestDetailed(model, prompt, {
        images: options?.images,
        systemPrompt: options?.systemPrompt,
        ...statefulOptions
      }, resolvedConnectionSettings);
    } else {
      output = await runOllamaGenerateRequestDetailed(model, prompt, {
        think: options?.think,
        images: options?.images,
        systemPrompt: options?.systemPrompt
      }, resolvedConnectionSettings);
    }
    recordLlmRequestToDashboardConsole({
      source: options?.images && options.images.length > 0 ? "vision" : "text",
      provider,
      model,
      prompt,
      output,
      imageCount: options?.images?.length ?? 0,
      startedAt
    });
    return output;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    recordLlmRequestToDashboardConsole({
      source: options?.images && options.images.length > 0 ? "vision" : "text",
      provider,
      model,
      prompt,
      imageCount: options?.images?.length ?? 0,
      startedAt,
      error: detail
    });
    throw new Error(`${getProviderLabel(provider)} request failed: ${detail}`);
  }
}
async function runGenerateRequestStreamDetailed(
  provider: LlmProvider,
  model: string,
  prompt: string,
  callbacks: AskOllamaStreamCallbacks,
  options?: {
    think?: boolean;
    images?: string[];
    systemPrompt?: string | null;
    statefulChatSessionId?: string | null;
    useStatefulChat?: boolean;
    resetStatefulChat?: boolean;
  },
  connectionSettings?: LlmConnectionSettings
): Promise<{ responseText: string; reasoningText: string }> {
  const startedAt = Date.now();
  const resolvedConnectionSettings = resolveLlmConnectionSettings(connectionSettings);
  try {
    let output: { responseText: string; reasoningText: string };
    if (provider !== "ollama") {
      const statefulOptions = provider === "lmstudio" ? {
        statefulChatSessionId: options?.statefulChatSessionId,
        useStatefulChat: options?.useStatefulChat,
        resetStatefulChat: options?.resetStatefulChat
      } : {};
      output = await runLmStudioGenerateRequestStreamDetailed(model, prompt, callbacks, {
        images: options?.images,
        systemPrompt: options?.systemPrompt,
        ...statefulOptions
      }, resolvedConnectionSettings);
    } else {
      output = await runOllamaGenerateRequestStreamDetailed(model, prompt, callbacks, {
        think: options?.think,
        images: options?.images,
        systemPrompt: options?.systemPrompt
      }, resolvedConnectionSettings);
    }
    recordLlmRequestToDashboardConsole({
      source: options?.images && options.images.length > 0 ? "vision-stream" : "text-stream",
      provider,
      model,
      prompt,
      output,
      imageCount: options?.images?.length ?? 0,
      startedAt
    });
    return output;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    recordLlmRequestToDashboardConsole({
      source: options?.images && options.images.length > 0 ? "vision-stream" : "text-stream",
      provider,
      model,
      prompt,
      imageCount: options?.images?.length ?? 0,
      startedAt,
      error: detail
    });
    throw new Error(`${getProviderLabel(provider)} request failed: ${detail}`);
  }
}
async function runGenerateRequest(
  provider: LlmProvider,
  model: string,
  prompt: string,
  options?: {
    think?: boolean;
    images?: string[];
    systemPrompt?: string | null;
    statefulChatSessionId?: string | null;
    useStatefulChat?: boolean;
    resetStatefulChat?: boolean;
  },
  connectionSettings?: LlmConnectionSettings
): Promise<string> {
  const output = await runGenerateRequestDetailed(provider, model, prompt, options, connectionSettings);
  return output.responseText;
}

function extractJsonObject(content: string): string {
  const direct = content.trim();
  if (direct.startsWith("{") && direct.endsWith("}")) {
    return direct;
  }

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Could not find a JSON object in the Llava response.");
  }

  return content.slice(start, end + 1);
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeReason(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function recordLlmRequestToDashboardConsole(input: {
  source: string;
  provider: LlmProvider;
  model: string;
  prompt: string;
  output?: { responseText: string; reasoningText: string };
  imageCount?: number;
  startedAt: number;
  error?: string;
}): void {
  recordDashboardLlmConsoleEvent({
    source: input.source,
    provider: input.provider,
    model: input.model,
    prompt: input.prompt,
    response: input.output?.responseText ?? "",
    reasoning: input.output?.reasoningText ?? "",
    imageCount: input.imageCount ?? 0,
    durationMs: Date.now() - input.startedAt,
    error: input.error
  });
}

export async function askOllama(
  prompt: string,
  optionsOrThink: AskOllamaLegacyInput = false,
  connectionSettings?: LlmConnectionSettings
): Promise<string> {
  const selection = resolveTextSelectionForRequest(connectionSettings);
  if (!selection.model) {
    throw new Error("No active text model is configured.");
  }
  const options = normalizeAskOllamaOptions(optionsOrThink);
  return runGenerateRequest(selection.provider, selection.model, prompt, {
    think: options.think,
    systemPrompt: options.systemPrompt,
    statefulChatSessionId: options.statefulChatSessionId,
    useStatefulChat: options.useStatefulChat,
    resetStatefulChat: options.resetStatefulChat
  }, connectionSettings);
}
export async function askOllamaDetailed(
  prompt: string,
  optionsOrThink: AskOllamaLegacyInput = false,
  connectionSettings?: LlmConnectionSettings
): Promise<AskOllamaDetailedResult> {
  const selection = resolveTextSelectionForRequest(connectionSettings);
  if (!selection.model) {
    throw new Error("No active text model is configured.");
  }
  const options = normalizeAskOllamaOptions(optionsOrThink);
  const output = await runGenerateRequestDetailed(selection.provider, selection.model, prompt, {
    think: options.think,
    systemPrompt: options.systemPrompt,
    statefulChatSessionId: options.statefulChatSessionId,
    useStatefulChat: options.useStatefulChat,
    resetStatefulChat: options.resetStatefulChat
  }, connectionSettings);
  return {
    response: output.responseText,
    reasoning: output.reasoningText,
    provider: selection.provider,
    model: selection.model
  };
}
export async function askOllamaDetailedStream(
  prompt: string,
  callbacks: AskOllamaStreamCallbacks,
  optionsOrThink: AskOllamaLegacyInput = false,
  connectionSettings?: LlmConnectionSettings
): Promise<AskOllamaDetailedResult> {
  const selection = resolveTextSelectionForRequest(connectionSettings);
  if (!selection.model) {
    throw new Error("No active text model is configured.");
  }
  const options = normalizeAskOllamaOptions(optionsOrThink);
  const output = await runGenerateRequestStreamDetailed(selection.provider, selection.model, prompt, callbacks, {
    think: options.think,
    systemPrompt: options.systemPrompt,
    statefulChatSessionId: options.statefulChatSessionId,
    useStatefulChat: options.useStatefulChat,
    resetStatefulChat: options.resetStatefulChat
  }, connectionSettings);
  return {
    response: output.responseText,
    reasoning: output.reasoningText,
    provider: selection.provider,
    model: selection.model
  };
}

export async function askVisionOllama(
  prompt: string,
  imageInputs: string[],
  connectionSettings?: LlmConnectionSettings
): Promise<string> {
  if (imageInputs.length === 0) {
    throw new Error("At least one image is required for the vision model.");
  }
  const selection = resolveVisionSelectionForRequest(connectionSettings);
  if (!selection.model) {
    throw new Error("No active vision model is configured.");
  }
  const images = await Promise.all(imageInputs.map(input => resolveImageInputForProvider(input, selection.provider)));
  return runGenerateRequest(selection.provider, selection.model, prompt, { images }, connectionSettings);
}

export async function analyzeImageInputsWithLlava(imageInputs: string[]): Promise<LlavaImageAnalysis> {
  if (imageInputs.length === 0) {
    throw new Error("At least one image URL is required for Llava analysis.");
  }
  const selection = resolveVisionSelectionForRequest();
  if (!selection.model) {
    throw new Error("No active vision model is configured.");
  }
  const images = await Promise.all(imageInputs.map(input => resolveImageInputForProvider(input, selection.provider)));
  const rawResponse = await runGenerateRequest(
    selection.provider,
    selection.model,
    [
      "You are a Discord moderation classifier.",
      "Analyze the attached images and respond with JSON only.",
      "Return exactly these keys:",
      "{\"isSpam\":false,\"isNsfw\":false,\"isCryptoSpam\":false,\"showsCryptoImage\":false,\"reason\":\"short explanation\"}",
      "Set showsCryptoImage to true when the image visibly shows cryptocurrency branding, coins, wallets, token logos, trading charts, or giveaway graphics.",
      "Set isCryptoSpam to true when the image looks like crypto promotion, fake support, giveaway, investment bait, scam, wallet drain, token sale, or pump messaging.",
      "Also set isCryptoSpam to true for fake withdrawal-success screenshots, fake earnings dashboards, fake exchange or wallet interfaces, promo bonus cards, referral-code bait, USDT or token payout screenshots, green success checkmarks tied to withdrawals, or text such as 'Withdrawal Success', 'withdrawal completed', 'bonus activated', 'activate code', or similar scam-style confirmations.",
      "A green checkmark next to a withdrawal or payout confirmation is a strong scam indicator when combined with crypto balances, wallet UIs, promo codes, or exchange-like dashboards.",
      "Important: do not mark it as crypto spam just because the image is a screenshot of someone else posting scam content inside Discord or another social/chat app.",
      "If the image clearly shows Discord message UI, chat bubbles, usernames, timestamps, server/channel layout, or a social-media post frame and appears to be documenting/reporting the scam rather than promoting it directly, prefer isCryptoSpam=false and explain that it is a screenshot of a post.",
      "Distinguish between an original scam graphic and a screenshot showing that graphic inside a discussion, moderation report, warning, or explanatory post.",
      "Set isSpam to true for generic ad spam, scam bait, mass-posted junk, or malicious promotional content.",
      "Set isNsfw to true only when the image is sexually explicit or clearly pornographic.",
      "Treat visible UI text in the image as evidence. Use OCR-style reading when possible.",
      "If uncertain, prefer false and explain why in reason."
    ].join("\n"),
    { images }
  );

  const parsed = JSON.parse(extractJsonObject(rawResponse)) as Record<string, unknown>;
  return {
    isSpam: normalizeBoolean(parsed.isSpam),
    isNsfw: normalizeBoolean(parsed.isNsfw),
    isCryptoSpam: normalizeBoolean(parsed.isCryptoSpam),
    showsCryptoImage: normalizeBoolean(parsed.showsCryptoImage),
    reason: normalizeReason(parsed.reason, "Llava flagged the duplicate images."),
    rawResponse
  };
}

export async function analyzeImagesWithLlava(imageUrls: string[]): Promise<LlavaImageAnalysis> {
  return analyzeImageInputsWithLlava(imageUrls);
}

async function listProviderModels(provider: LlmProvider): Promise<string[]> {
  if (provider !== "ollama") {
    const headers: Record<string, string> = {};
    const apiKey = getLmStudioApiKey().trim();
    if (apiKey.length > 0) {
      headers.authorization = `Bearer ${apiKey}`;
    }

    const response = await fetchWithTimeout(buildLmStudioUrl("/models"), {
      headers
    }, providerModelListTimeoutMs);
    if (!response.ok) {
      throw new Error(`${getProviderLabel(provider)} models request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as LmStudioModelListResponse;
    const names = (payload.data ?? [])
      .map(model => model.id ?? "")
      .map(name => name.trim())
      .filter(name => name.length > 0);
    return [...new Set(names)].sort((left, right) => left.localeCompare(right));
  }

  const response = await fetchWithTimeout(buildOllamaUrl("/api/tags"), undefined, providerModelListTimeoutMs);
  if (!response.ok) {
    throw new Error(`Ollama tags request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as OllamaTagsResponse;
  const names = (payload.models ?? [])
    .map(model => model.name ?? model.model ?? "")
    .map(name => name.trim())
    .filter(name => name.length > 0);
  return [...new Set(names)].sort((left, right) => left.localeCompare(right));
}

async function listProviderModelsSafely(provider: LlmProvider): Promise<string[]> {
  try {
    return await listProviderModels(provider);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[${getProviderLabel(provider)}] model listing unavailable: ${detail}`);
    return [];
  }
}

function getLmStudioHeaders(connectionSettings?: ResolvedLlmConnectionSettings): Record<string, string> {
  return lmStudioCreateHeaders(getLmStudioApiKey(connectionSettings));
}

async function unloadOllamaModel(model: string): Promise<void> {
  const response = await fetch(buildOllamaUrl("/api/generate"), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt: "",
      stream: false,
      keep_alive: 0
    })
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      detail.length > 0
        ? `Ollama eject failed for "${model}" (${response.status}): ${detail}`
        : `Ollama eject failed for "${model}" (${response.status}).`
    );
  }
}
async function loadOllamaModel(model: string): Promise<void> {
  const response = await fetch(buildOllamaUrl("/api/generate"), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt: "",
      stream: false,
      keep_alive: "30m",
      options: {
        num_predict: 0
      }
    })
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      detail.length > 0
        ? `Ollama load failed for "${model}" (${response.status}): ${detail}`
        : `Ollama load failed for "${model}" (${response.status}).`
    );
  }
}

async function unloadLmStudioModel(model: string): Promise<void> {
  const headers = getLmStudioHeaders();
  const instanceIds = await resolveLmStudioUnloadInstanceIds(model, headers);
  const candidates = buildLmStudioUnloadCandidates(instanceIds);
  let lastError = "Unknown LM Studio eject error.";
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, {
        method: "POST",
        headers,
        body: JSON.stringify(candidate.body)
      });
      if (response.ok) {
        return;
      }
      const detail = (await response.text()).trim();
      if (isLmStudioModelAlreadyUnloadedError(response.status, detail)) {
        return;
      }
      lastError = detail.length > 0
        ? `status ${response.status}: ${detail}`
        : `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`LM Studio eject failed for "${model}": ${lastError}`);
}
async function resolveLmStudioUnloadInstanceIds(model: string, headers: Record<string, string>): Promise<string[]> {
  const normalizedModel = model.trim();
  if (!normalizedModel) {
    return [];
  }
  const fallbackIds = [normalizedModel];
  try {
    const response = await fetch(buildLmStudioApiV1Url("/models"), { headers });
    if (!response.ok) {
      return fallbackIds;
    }
    const payload = (await response.json()) as LmStudioNativeModelListResponse;
    const models = payload.models ?? [];
    const ids = new Set<string>();
    const allLoadedIds = new Set<string>();
    for (const entry of models) {
      const key = entry.key?.trim() ?? "";
      const loadedInstances = entry.loaded_instances ?? [];
      if (key === normalizedModel) {
        for (const loaded of loadedInstances) {
          const id = loaded.id?.trim() ?? "";
          if (id) {
            ids.add(id);
          }
        }
      }
      for (const loaded of loadedInstances) {
        const id = loaded.id?.trim() ?? "";
        if (id) {
          allLoadedIds.add(id);
        }
        if (id === normalizedModel) {
          ids.add(id);
        }
      }
    }
    if (ids.size === 0) {
      if (allLoadedIds.size > 0) {
        return [...allLoadedIds];
      }
      ids.add(normalizedModel);
    }
    return [...ids];
  } catch {
    return fallbackIds;
  }
}
function buildLmStudioUnloadCandidates(instanceIds: string[]): Array<{ url: string; body: Record<string, string> }> {
  return lmStudioBuildUnloadCandidates(buildLmStudioAbsoluteUrl("/"), instanceIds);
}
function isLmStudioModelAlreadyUnloadedError(status: number, detail: string): boolean {
  return lmStudioIsModelAlreadyUnloadedError(status, detail);
}
async function loadLmStudioModel(model: string, connectionSettings?: ResolvedLlmConnectionSettings): Promise<void> {
  const headers = getLmStudioHeaders(connectionSettings);
  const resolvedModelKey = await resolveLmStudioLoadModelKey(model, headers);
  const candidates = buildLmStudioLoadCandidates(resolvedModelKey, getLmStudioContextLength(connectionSettings));
  const requestedContextLength = getLmStudioContextLength(connectionSettings);
  const tryLoadCandidates = async (): Promise<{ loaded: boolean; alreadyLoaded: boolean; lastError: string }> => {
    let lastError = "Unknown LM Studio load error.";
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate.url, {
          method: "POST",
          headers,
          body: JSON.stringify(candidate.body)
        });
        if (response.ok) {
          return { loaded: true, alreadyLoaded: false, lastError };
        }
        const detail = (await response.text()).trim();
        if (isLmStudioModelAlreadyLoadedError(response.status, detail)) {
          return { loaded: false, alreadyLoaded: true, lastError: detail || `status ${response.status}` };
        }
        lastError = detail.length > 0
          ? `status ${response.status}: ${detail}`
          : `status ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    return { loaded: false, alreadyLoaded: false, lastError };
  };
  const firstAttempt = await tryLoadCandidates();
  if (firstAttempt.loaded) {
    return;
  }
  if (!firstAttempt.alreadyLoaded) {
    throw new Error(`LM Studio load failed for "${model}": ${firstAttempt.lastError}`);
  }
  // When a context length is requested, force a reload so LM Studio can apply the new context window.
  if (requestedContextLength <= 0) {
    return;
  }
  try {
    await unloadLmStudioModel(model);
  } catch {}
  const secondAttempt = await tryLoadCandidates();
  if (secondAttempt.loaded || secondAttempt.alreadyLoaded) {
    return;
  }
  throw new Error(`LM Studio load failed for "${model}": ${secondAttempt.lastError}`);
}
async function resolveLmStudioLoadModelKey(model: string, headers: Record<string, string>): Promise<string> {
  const normalizedModel = model.trim();
  if (!normalizedModel) {
    return "";
  }
  try {
    const response = await fetch(buildLmStudioApiV1Url("/models"), { headers });
    if (!response.ok) {
      return normalizedModel;
    }
    const payload = (await response.json()) as LmStudioNativeModelListResponse;
    for (const entry of payload.models ?? []) {
      const key = entry.key?.trim() ?? "";
      if (!key) {
        continue;
      }
      if (key === normalizedModel) {
        return key;
      }
      for (const loadedInstance of entry.loaded_instances ?? []) {
        const instanceId = loadedInstance.id?.trim() ?? "";
        if (instanceId === normalizedModel) {
          return key;
        }
      }
    }
    return normalizedModel;
  } catch {
    return normalizedModel;
  }
}
function buildLmStudioLoadCandidates(modelKey: string, contextLength = 0): Array<{ url: string; body: Record<string, string | number> }> {
  return lmStudioBuildLoadCandidates(buildLmStudioAbsoluteUrl("/"), modelKey, contextLength);
}
function isLmStudioModelAlreadyLoadedError(status: number, detail: string): boolean {
  return lmStudioIsModelAlreadyLoadedError(status, detail);
}
export async function ejectActiveOllamaModels(): Promise<LlmEjectResult> {
  const targets = getUniqueActiveModelSelections();
  const result: LlmEjectResult = {
    attempted: [...targets],
    unloaded: [],
    failed: []
  };
  for (const target of targets) {
    try {
      if (target.provider === "lmstudio") {
        await unloadLmStudioModel(target.model);
      } else if (target.provider === "llamacpp") {
        throw new Error("llama.cpp model lifecycle is controlled by the llama.cpp server process.");
      } else {
        await unloadOllamaModel(target.model);
      }
      result.unloaded.push(target);
    } catch (error) {
      result.failed.push({
        ...target,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return result;
}
export async function loadActiveOllamaModels(
  scope: "text" | "vision" | "both" = "both",
  connectionSettings?: LlmConnectionSettings
): Promise<LlmLoadResult> {
  const targets = getScopedActiveModelSelections(scope);
  const result: LlmLoadResult = {
    attempted: [...targets],
    loaded: [],
    failed: []
  };
  const resolvedConnectionSettings = resolveLlmConnectionSettings(connectionSettings);
  for (const target of targets) {
    try {
      if (target.provider === "lmstudio") {
        await loadLmStudioModel(target.model, resolvedConnectionSettings);
      } else if (target.provider === "llamacpp") {
        // llama.cpp loads its model when the server starts.
      } else {
        await loadOllamaModel(target.model);
      }
      result.loaded.push(target);
    } catch (error) {
      result.failed.push({
        ...target,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return result;
}

function resolvePreferredSelection(
  candidates: ProviderModelSelection[],
  modelsByProvider: Record<LlmProvider, string[]>,
  fallbackMatch: (name: string) => boolean,
  preferredProvider: LlmProvider
): ProviderModelSelection | null {
  for (const candidate of candidates) {
    if (!candidate.model) {
      continue;
    }
    const providerModels = modelsByProvider[candidate.provider];
    if (providerModels.includes(candidate.model)) {
      return candidate;
    }
  }
  const providerOrder = getProviderPriority(preferredProvider);
  for (const provider of providerOrder) {
    const matched = modelsByProvider[provider].find(fallbackMatch);
    if (matched) {
      return { provider, model: matched };
    }
  }
  for (const provider of providerOrder) {
    const first = modelsByProvider[provider][0];
    if (first) {
      return { provider, model: first };
    }
  }
  return null;
}

function toCatalog(providers: Record<LlmProvider, string[]>): LlmModelCatalog {
  const providerEntries: LlmModelProviderCatalog[] = [
    {
      provider: "ollama",
      label: getProviderLabel("ollama"),
      models: providers.ollama
    },
    {
      provider: "lmstudio",
      label: getProviderLabel("lmstudio"),
      models: providers.lmstudio
    },
    {
      provider: "llamacpp",
      label: getProviderLabel("llamacpp"),
      models: providers.llamacpp
    }
  ];
  return {
    available: providerEntries.flatMap(entry => entry.models.map(model => encodeModelSelectionValue(entry.provider, model))),
    providers: providerEntries,
    active: getActiveOllamaModels()
  };
}

export async function listOllamaModels(): Promise<LlmModelCatalog> {
  const openAiProvider: LlmProvider = getActiveLlmProvider() === "llamacpp" ? "llamacpp" : "lmstudio";
  const [ollamaModels, openAiModels] = await Promise.all([
    listProviderModelsSafely("ollama"),
    listProviderModelsSafely(openAiProvider)
  ]);
  const providers: Record<LlmProvider, string[]> = {
    ollama: ollamaModels,
    lmstudio: openAiProvider === "lmstudio" ? openAiModels : [],
    llamacpp: openAiProvider === "llamacpp" ? openAiModels : []
  };
  return toCatalog(providers);
}

export async function ensureAvailableOllamaModels(): Promise<ActiveOllamaModels> {
  const openAiProvider: LlmProvider = getActiveLlmProvider() === "llamacpp" ? "llamacpp" : "lmstudio";
  const [ollamaModels, openAiModels] = await Promise.all([
    listProviderModelsSafely("ollama"),
    listProviderModelsSafely(openAiProvider)
  ]);
  const providers: Record<LlmProvider, string[]> = {
    ollama: ollamaModels,
    lmstudio: openAiProvider === "lmstudio" ? openAiModels : [],
    llamacpp: openAiProvider === "llamacpp" ? openAiModels : []
  };
  if (providers.ollama.length === 0 && providers.lmstudio.length === 0 && providers.llamacpp.length === 0) {
    return getActiveOllamaModels();
  }
  const activeTextSelection = resolveTextSelectionForRequest();
  const activeVisionSelection = resolveVisionSelectionForRequest();
  const textFallbackCandidates: ProviderModelSelection[] = [
    activeTextSelection,
    parseModelSelectionValue(appConfig.ollamaModel, "ollama"),
    parseModelSelectionValue(appConfig.lmStudioModel, "lmstudio"),
    parseModelSelectionValue(appConfig.lmStudioVisionModel, "lmstudio"),
    parseModelSelectionValue("qwen3-coder:30b", "ollama"),
    parseModelSelectionValue("qwen3-coder:7b", "ollama"),
    parseModelSelectionValue("qwen2.5-coder:7b", "ollama"),
    parseModelSelectionValue("mistral:latest", "ollama"),
    parseModelSelectionValue("llama3.1:8b", "ollama")
  ];
  const visionFallbackCandidates: ProviderModelSelection[] = [
    activeVisionSelection,
    parseModelSelectionValue(appConfig.ollamaVisionModel, "ollama"),
    parseModelSelectionValue(appConfig.lmStudioVisionModel, "lmstudio"),
    parseModelSelectionValue(appConfig.lmStudioModel, "lmstudio"),
    parseModelSelectionValue("llava:13b", "ollama"),
    parseModelSelectionValue("llava:7b", "ollama"),
    parseModelSelectionValue("llava:34b", "ollama")
  ];
  const resolvedTextSelection = resolvePreferredSelection(
    textFallbackCandidates,
    providers,
    name => !/embed|vision|vl|llava/i.test(name),
    activeTextSelection.provider
  );
  const resolvedVisionSelection = resolvePreferredSelection(
    visionFallbackCandidates,
    providers,
    name => /vision|vl|llava|pixtral|qwen2-vl/i.test(name),
    activeVisionSelection.provider
  );
  if (resolvedTextSelection) {
    setActiveTextSelection(resolvedTextSelection);
  }
  if (resolvedVisionSelection) {
    setActiveVisionSelection(resolvedVisionSelection);
  }
  const finalTextSelection = resolveTextSelectionForRequest();
  const finalVisionSelection = resolveVisionSelectionForRequest();
  if (!finalVisionSelection.model && finalTextSelection.model) {
    setActiveVisionSelection(finalTextSelection);
  }
  return getActiveOllamaModels();
}
