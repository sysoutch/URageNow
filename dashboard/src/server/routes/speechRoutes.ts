import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { comfyWorkflowPaths } from "../../shared/comfyWorkflowPaths.js";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { parseJsonBody, sendJson } from "../http.js";
import { getRoute, postRoute } from "../router.js";
import { resolveWorkspaceRelativePath } from "../messagingAndModel/helpers.js";
import { persistGeneratedAudioArtifact, toGeneratedAudioPublicRecord } from "@urage/server/services/generatedMediaLibrary";
import { getComfyRuntimeSettings } from "@urage/server/services/comfyRuntimeSettings";

function resolveTtsWorkflowRelativePath(mode: string): string {
  if (mode === "voice-clone") return comfyWorkflowPaths.speech.tts.voiceClone;
  if (mode === "custom-voice") return comfyWorkflowPaths.speech.tts.customVoice;
  if (mode === "design-voice") return comfyWorkflowPaths.speech.tts.designVoice;
  return comfyWorkflowPaths.speech.tts.standard;
}

function inferSpeechSourceMimeType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".ogg" || extension === ".oga") return "audio/ogg";
  if (extension === ".flac") return "audio/flac";
  if (extension === ".m4a" || extension === ".aac") return "audio/mp4";
  if (extension === ".webm") return "audio/webm";
  if (extension === ".mp4" || extension === ".m4v") return "video/mp4";
  if (extension === ".mov") return "video/quicktime";
  return "audio/webm";
}

function sanitizeSpeechSourceFileName(fileName: string, fallback: string): string {
  const extension = path.extname(fileName || fallback) || ".webm";
  const base = path.basename(fileName || fallback, path.extname(fileName || fallback));
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/^_+/, "").slice(0, 100);
  return (cleaned || "speech-source") + extension;
}

function normalizeSpeechSourceDataUrl(dataUrl: string, fileName: string): { dataUrl: string; data: Buffer; mimeType: string } | null {
  const match = dataUrl.trim().match(/^data:([^,]*),(.*)$/i);
  if (!match) {
    return null;
  }
  const headerParts = (match[1] || "").split(";").map(part => part.trim()).filter(Boolean);
  const mimeType = headerParts.find(part => !part.includes("=") && part.toLowerCase() !== "base64") || inferSpeechSourceMimeType(fileName);
  const encodedData = (match[2] || "").trim();
  if (!encodedData) {
    return null;
  }
  const isBase64 = headerParts.some(part => part.toLowerCase() === "base64");
  const data = isBase64
    ? Buffer.from(encodedData, "base64")
    : Buffer.from(decodeURIComponent(encodedData), "utf8");
  return {
    dataUrl: `data:${mimeType};base64,${data.toString("base64")}`,
    data,
    mimeType
  };
}

function createSpeechSourceSeed(): number {
  return Number.parseInt(randomBytes(6).toString("hex"), 16);
}

async function persistSpeechSourceAudio(input: {
  audioDataUrl: string;
  fileName: string;
  prompt?: string;
}) {
  const normalizedSource = normalizeSpeechSourceDataUrl(input.audioDataUrl, input.fileName);
  if (!normalizedSource || normalizedSource.data.length === 0) {
    throw new Error("A valid audio or video data URL is required.");
  }
  const sourceAudio = await persistGeneratedAudioArtifact({
    record: {
      createdAt: new Date().toISOString(),
      mode: "audio",
      prompt: input.prompt?.trim() || "Imported speech source audio",
      tags: "",
      lyrics: "",
      seconds: null,
      comfyPromptId: "speech-source-import",
      seed: createSpeechSourceSeed(),
      steps: null,
      cfg: null,
      model: "Speech Source Import"
    },
    audioData: normalizedSource.data,
    desiredFileName: sanitizeSpeechSourceFileName(input.fileName, "speech-source.webm")
  });
  return {
    normalizedSource,
    sourceAudio: toGeneratedAudioPublicRecord(sourceAudio)
  };
}

export async function generateTextToSpeechForClient(body: Record<string, unknown>, dependencies: DashboardDependencies, requestedBy: string) {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mode = body.mode === "voice-clone" || body.mode === "custom-voice" || body.mode === "design-voice" ? body.mode : "standard";
  const speaker = typeof body.speaker === "string" ? body.speaker.trim() : "";
  const speed = typeof body.speed === "number" && Number.isFinite(body.speed) ? body.speed : undefined;
  const referenceAudioDataUrl = typeof body.referenceAudioDataUrl === "string" ? body.referenceAudioDataUrl.trim() : "";
  const referenceAudioFileName = typeof body.referenceAudioFileName === "string" ? body.referenceAudioFileName.trim() : "";
  const referenceText = typeof body.referenceText === "string" ? body.referenceText.trim() : "";
  const instruct = typeof body.instruct === "string" ? body.instruct.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "";
  if (!text) {
    throw new Error("text is required.");
  }
  if (mode === "voice-clone" && !referenceAudioDataUrl) {
    throw new Error("referenceAudioDataUrl is required for voice clone mode.");
  }
  if ((mode === "custom-voice" || mode === "design-voice") && !instruct) {
    throw new Error("instruct is required for custom voice and design voice modes.");
  }
  const workflowRelativePath = resolveTtsWorkflowRelativePath(mode);
  const workflowPath = await resolveWorkspaceRelativePath(workflowRelativePath);
  if (!workflowPath) {
    throw new Error(`TTS workflow is missing at ${workflowRelativePath}.`);
  }
  const generated = await dependencies.generateTextToSpeech({
    text,
    mode,
    speaker: speaker || undefined,
    speed,
    workflowPath,
    referenceAudioDataUrl: referenceAudioDataUrl || undefined,
    referenceAudioFileName: referenceAudioFileName || undefined,
    referenceText: referenceText || undefined,
    instruct: instruct || undefined,
    language: language || undefined,
    requestedBy
  });
  dependencies.runtimeState.recordAction(`${requestedBy}:speech-tts`, `Generated ${mode} TTS audio ${generated.fileName}.`);
  return generated;
}

async function handlePostApiSpeechTts(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  try {
    const generated = await generateTextToSpeechForClient(await parseJsonBody(request), dependencies, "dashboard");
    sendJson(response, 200, generated);
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Text to speech failed." });
  }
}

function readComfyChoiceValues(value: unknown): string[] {
  if (!Array.isArray(value) || !Array.isArray(value[0])) return [];
  return value[0].filter(entry => typeof entry === "string").map(entry => entry.trim()).filter(Boolean);
}

async function handleGetApiSpeechTtsVoices(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  const settings = getComfyRuntimeSettings();
  const baseUrl = settings.comfyUiAudioBaseUrl.trim() || settings.comfyUiBaseUrl.trim();
  if (!baseUrl) {
    sendJson(response, 503, { error: "ComfyUI audio URL is not configured." });
    return;
  }
  try {
    const objectInfoResponse = await fetch(new URL("/object_info", baseUrl), { signal: AbortSignal.timeout(5_000) });
    if (!objectInfoResponse.ok) throw new Error(`ComfyUI returned ${objectInfoResponse.status}.`);
    const objectInfo = await objectInfoResponse.json() as Record<string, unknown>;
    const speakerNode = objectInfo.KokoroSpeaker as { input?: { required?: Record<string, unknown>; optional?: Record<string, unknown> } } | undefined;
    const requiredVoices = readComfyChoiceValues(speakerNode?.input?.required?.speaker_name);
    const voices = requiredVoices.length > 0
      ? requiredVoices
      : readComfyChoiceValues(speakerNode?.input?.optional?.speaker_name);
    if (!voices.length) throw new Error("KokoroSpeaker did not expose any speaker_name choices.");
    sendJson(response, 200, { voices: [...new Set(voices)].sort((left, right) => left.localeCompare(right)) });
  } catch (error) {
    sendJson(response, 503, { error: error instanceof Error ? error.message : "Could not read TTS voices from ComfyUI." });
  }
}

export async function transcribeSpeechForClient(
  body: Record<string, unknown>,
  dependencies: DashboardDependencies,
  requestedBy = "dashboard"
) {
  const audioDataUrl = typeof body.audioDataUrl === "string" ? body.audioDataUrl.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "auto";
  const normalizedSource = normalizeSpeechSourceDataUrl(audioDataUrl, fileName);
  if (!normalizedSource || normalizedSource.data.length === 0) {
    throw new Error("A valid audio or video data URL is required.");
  }
  const workflowPath = await resolveWorkspaceRelativePath(comfyWorkflowPaths.speech.stt);
  if (!workflowPath) {
    throw new Error(`STT workflow is missing at ${comfyWorkflowPaths.speech.stt}.`);
  }
  const transcript = await dependencies.transcribeSpeechToText({
    audioDataUrl: normalizedSource.dataUrl,
    fileName: fileName || undefined,
    workflowPath,
    language: language || "auto",
    requestedBy
  });
  const sourceAudio = body.saveSource === false
    ? null
    : (await persistSpeechSourceAudio({
      audioDataUrl: normalizedSource.dataUrl,
      fileName,
      prompt: transcript.transcript ? `STT transcript: ${transcript.transcript}` : "STT source audio"
    })).sourceAudio;
  dependencies.runtimeState.recordAction(`${requestedBy}:speech-stt`, "Transcribed speech to text.");
  return { ...transcript, sourceAudio };
}

async function handlePostApiSpeechStt(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  try {
    sendJson(response, 200, await transcribeSpeechForClient(body, dependencies));
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Speech transcription failed." });
  }
}

async function handlePostApiAudioImportSource(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const audioDataUrl = typeof body.audioDataUrl === "string" ? body.audioDataUrl.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  try {
    const persisted = await persistSpeechSourceAudio({ audioDataUrl, fileName, prompt });
    dependencies.runtimeState.recordAction("dashboard:audio-import-source", `Imported audio source ${persisted.sourceAudio.audioFileName}.`);
    sendJson(response, 200, persisted.sourceAudio);
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "A valid audio or video data URL is required." });
  }
}

async function handlePostApiSpeechSts(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const audioDataUrl = typeof body.audioDataUrl === "string" ? body.audioDataUrl.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const speaker = typeof body.speaker === "string" ? body.speaker.trim() : "";
  const speed = typeof body.speed === "number" && Number.isFinite(body.speed) ? body.speed : undefined;
  if (!audioDataUrl) {
    sendJson(response, 400, { error: "audioDataUrl is required." });
    return;
  }
  const workflowPath = await resolveWorkspaceRelativePath(comfyWorkflowPaths.speech.sts);
  if (!workflowPath) {
    sendJson(response, 500, { error: `STS workflow is missing at ${comfyWorkflowPaths.speech.sts}.` });
    return;
  }
  const generated = await dependencies.generateSpeechToSpeech({
    audioDataUrl,
    fileName: fileName || undefined,
    speaker: speaker || undefined,
    speed,
    workflowPath,
    requestedBy: "dashboard"
  });
  dependencies.runtimeState.recordAction("dashboard:speech-sts", `Generated STS audio ${generated.fileName}.`);
  sendJson(response, 200, generated);
}

export const speechRouteDefinitions = [
  getRoute("/api/speech-tts-voices", handleGetApiSpeechTtsVoices),
  postRoute("/api/speech-tts", handlePostApiSpeechTts),
  postRoute("/api/audio-import-source", handlePostApiAudioImportSource),
  postRoute("/api/speech-stt", handlePostApiSpeechStt),
  postRoute("/api/stt-transcribe", handlePostApiSpeechStt),
  postRoute("/api/speech-sts", handlePostApiSpeechSts)
];
