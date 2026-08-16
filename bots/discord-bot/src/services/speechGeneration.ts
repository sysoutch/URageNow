import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";
import { getComfyRuntimeSettings } from "@urage/server/services/comfyRuntimeSettings";

export interface GeneratedSpeechAudioPublicRecord {
  fileName: string;
  mimeType: string;
  audioDataUrl: string;
  speaker: string;
  speed: number;
  transcript: string;
}

export interface GeneratedSpeechTranscriptRecord {
  transcript: string;
}

interface GenerateTextToSpeechInput {
  text: string;
  mode?: "standard" | "voice-clone" | "custom-voice" | "design-voice";
  speaker?: string;
  speed?: number;
  workflowPath: string;
  referenceAudioDataUrl?: string;
  referenceAudioFileName?: string;
  referenceText?: string;
  instruct?: string;
  language?: string;
}

interface GenerateSpeechToSpeechInput {
  audioDataUrl: string;
  fileName?: string;
  speaker?: string;
  speed?: number;
  workflowPath: string;
}

interface TranscribeSpeechToTextInput {
  audioDataUrl: string;
  fileName?: string;
  workflowPath: string;
  language?: string;
}

interface ComfyMediaAsset {
  filename: string;
  subfolder: string;
  type: string;
}

const comfyInputSpeechDirectory = path.resolve(appConfig.dataDirectory, "comfy-speech-inputs");

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createRandomFileName(stem: string, extension: string): string {
  return `${stem}-${Date.now()}-${randomBytes(4).toString("hex")}${extension}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeAudioFileName(input: string, fallbackExtension: string): string {
  const normalized = path.basename(String(input || "").trim()) || `speech-input${fallbackExtension}`;
  const cleaned = normalized.replace(/[^\w.\-]+/g, "_").replace(/^_+/, "").slice(0, 120);
  const fileName = cleaned || `speech-input${fallbackExtension}`;
  return path.extname(fileName) ? fileName : `${fileName}${fallbackExtension}`;
}

function extensionFromMimeType(mimeType: string): string {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("mpeg") || normalized.endsWith("/mp3")) return ".mp3";
  if (normalized.includes("wav")) return ".wav";
  if (normalized.includes("ogg")) return ".ogg";
  if (normalized.includes("flac")) return ".flac";
  if (normalized.includes("mp4")) return ".m4a";
  return ".wav";
}

function contentTypeFromExtension(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".flac") return "audio/flac";
  if (extension === ".m4a") return "audio/mp4";
  return "application/octet-stream";
}

function parseAudioDataUrl(dataUrl: string): { mimeType: string; data: Buffer } {
  const match = String(dataUrl || "").trim().match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("A valid audio data URL is required.");
  }
  return {
    mimeType: match[1] || "audio/wav",
    data: Buffer.from(match[2] || "", "base64")
  };
}

async function ensureComfySpeechInputFile(dataUrl: string, requestedFileName: string): Promise<string> {
  const parsed = parseAudioDataUrl(dataUrl);
  const extension = extensionFromMimeType(parsed.mimeType);
  const safeFileName = sanitizeAudioFileName(requestedFileName, extension);
  await mkdir(comfyInputSpeechDirectory, { recursive: true });
  const inputFileName = createRandomFileName(path.basename(safeFileName, path.extname(safeFileName)) || "speech-input", path.extname(safeFileName) || extension);
  await writeFile(path.join(comfyInputSpeechDirectory, inputFileName), parsed.data);
  const comfyInputDir = getComfyRuntimeSettings().comfyUiInputDir;
  if (comfyInputDir) {
    await mkdir(comfyInputDir, { recursive: true });
    await writeFile(path.join(comfyInputDir, inputFileName), parsed.data);
  }
  return inputFileName;
}

async function loadWorkflowDocument(workflowPath: string): Promise<Record<string, unknown>> {
  const raw = await readFile(workflowPath, "utf8");
  const parsed = JSON.parse(raw);
  const record = asRecord(parsed);
  if (!record) {
    throw new Error(`Workflow at ${workflowPath} is not a valid JSON object.`);
  }
  return record;
}

function cloneWorkflowPrompt(record: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
}

function getNodeInputs(root: Record<string, unknown>, nodeId: string): Record<string, unknown> {
  const node = asRecord(root[nodeId]);
  if (!node) {
    throw new Error(`Workflow node ${nodeId} is missing.`);
  }
  const inputs = asRecord(node.inputs);
  if (!inputs) {
    throw new Error(`Workflow node ${nodeId} has no inputs.`);
  }
  return inputs;
}

function setNodeString(root: Record<string, unknown>, nodeId: string, inputKey: string, value: string): void {
  getNodeInputs(root, nodeId)[inputKey] = value;
}

function setNodeNumber(root: Record<string, unknown>, nodeId: string, inputKey: string, value: number): void {
  getNodeInputs(root, nodeId)[inputKey] = value;
}
function findNodeIdByClassType(root: Record<string, unknown>, classTypes: string[]): string | null {
  for (const [nodeId, value] of Object.entries(root)) {
    const classType = asString(asRecord(value)?.class_type);
    if (classType && classTypes.includes(classType)) {
      return nodeId;
    }
  }
  return null;
}

function buildSpeechPromptRootFromWorkflowDocument(workflowDocument: Record<string, unknown>): Record<string, unknown> {
  if (Object.values(workflowDocument).some(entry => asRecord(entry)?.class_type)) {
    return cloneWorkflowPrompt(workflowDocument);
  }
  const nodes = asArray(workflowDocument.nodes);
  if (nodes.length === 0) {
    throw new Error("Workflow document does not contain any nodes.");
  }
  const loadAudioNode = nodes.find(node => asRecord(node)?.type === "LoadAudio" || asRecord(node)?.type === "VHS_LoadAudioUpload");
  const whisperNode = nodes.find(node => asRecord(node)?.type === "Apply Whisper");
  const previewTextNode = nodes.find(node => {
    const record = asRecord(node);
    if (record?.type !== "PreviewAny") return false;
    const title = asString(record.title).toLowerCase();
    const inputs = asArray(record.inputs);
    return title.includes("text") || inputs.some(input => asRecord(input)?.type === "STRING");
  });
  if (!loadAudioNode || !whisperNode) {
    throw new Error("No prompt node was found in the speech workflow.");
  }
  const loadAudio = asRecord(loadAudioNode) || {};
  const whisper = asRecord(whisperNode) || {};
  const previewText = asRecord(previewTextNode) || {};
  const loadAudioId = String(loadAudio.id || "106");
  const whisperId = String(whisper.id || "98");
  const previewTextId = String(previewText.id || "99");
  const whisperWidgets = asArray(whisper.widgets_values);
  const whisperModel = asString(whisperWidgets[0]) || "large-v3-turbo";
  const whisperLanguage = asString(whisperWidgets[1]) || "auto";
  const whisperPrompt = asString(whisperWidgets[2]);
  return {
    [loadAudioId]: {
      inputs: {
        audio: ""
      },
      class_type: asString(loadAudio.type) || "LoadAudio"
    },
    [whisperId]: {
      inputs: {
        audio: [loadAudioId, 0],
        model: whisperModel,
        language: whisperLanguage,
        prompt: whisperPrompt
      },
      class_type: "Apply Whisper"
    },
    [previewTextId]: {
      inputs: {
        source: [whisperId, 0]
      },
      class_type: asString(previewText.type) || "PreviewAny"
    }
  };
}

async function comfyFetchJson(endpoint: string, init: RequestInit | undefined, mode: string): Promise<unknown> {
  const baseUrl = getComfyRuntimeSettings().comfyUiAudioBaseUrl || appConfig.comfyUiAudioBaseUrl;
  const targetUrl = new URL(endpoint, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
  const response = await fetch(targetUrl, init);
  if (!response.ok) {
    throw new Error(`ComfyUI ${mode} request failed with ${response.status}.`);
  }
  return response.json();
}

async function comfyDownloadAsset(asset: ComfyMediaAsset, mode: string): Promise<Buffer> {
  const params = new URLSearchParams({ filename: asset.filename });
  if (asset.subfolder) params.set("subfolder", asset.subfolder);
  if (asset.type) params.set("type", asset.type);
  const baseUrl = getComfyRuntimeSettings().comfyUiAudioBaseUrl || appConfig.comfyUiAudioBaseUrl;
  const targetUrl = new URL(`/view?${params.toString()}`, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`ComfyUI ${mode} asset download failed with ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function extractHistoryOutputs(historyPayload: unknown, promptId: string): Record<string, unknown> | null {
  const root = asRecord(historyPayload);
  const promptRecord = root ? asRecord(root[promptId]) : null;
  return promptRecord ? asRecord(promptRecord.outputs) : null;
}

function extractFirstAudioAsset(outputs: Record<string, unknown>, preferredNodeId: string): ComfyMediaAsset | null {
  const candidateNodeIds = [preferredNodeId, ...Object.keys(outputs)];
  for (const nodeId of candidateNodeIds) {
    const nodeOutput = asRecord(outputs[nodeId]);
    if (!nodeOutput) {
      continue;
    }
    for (const key of ["audio", "result"]) {
      const entries = asArray(nodeOutput[key]).map(item => asRecord(item)).filter(Boolean) as Record<string, unknown>[];
      const first = entries[0];
      if (first && asString(first.filename)) {
        return {
          filename: asString(first.filename),
          subfolder: asString(first.subfolder),
          type: asString(first.type)
        };
      }
    }
  }
  return null;
}

function extractFirstTranscript(outputs: Record<string, unknown>, preferredNodeId: string): string {
  const candidateNodeIds = [preferredNodeId, ...Object.keys(outputs)];
  for (const nodeId of candidateNodeIds) {
    const nodeOutput = asRecord(outputs[nodeId]);
    if (!nodeOutput) {
      continue;
    }
    for (const key of ["text", "result", "source", "ui"]) {
      const raw = key === "ui" ? asRecord(nodeOutput.ui)?.text : nodeOutput[key];
      const textEntries = asArray(raw);
      for (const entry of textEntries) {
        const transcript = asString(entry);
        if (transcript) {
          return transcript.trim();
        }
        const nested = asRecord(entry);
        const nestedTranscript = asString(nested?.text) || asString(nested?.value);
        if (nestedTranscript) {
          return nestedTranscript.trim();
        }
      }
    }
  }
  return "";
}

async function waitForComfyOutputs(promptId: string, mode: string): Promise<Record<string, unknown>> {
  const timeoutAt = Date.now() + 120_000;
  while (Date.now() < timeoutAt) {
    const historyPayload = await comfyFetchJson(`/history/${encodeURIComponent(promptId)}`, undefined, mode);
    const outputs = extractHistoryOutputs(historyPayload, promptId);
    if (outputs && Object.keys(outputs).length > 0) {
      return outputs;
    }
    await new Promise(resolve => setTimeout(resolve, 1_250));
  }
  throw new Error(`ComfyUI ${mode} workflow did not finish in time.`);
}

async function queueSpeechWorkflow(promptRoot: Record<string, unknown>, mode: string): Promise<Record<string, unknown>> {
  const payload = asRecord(await comfyFetchJson("/prompt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: promptRoot,
      client_id: createId()
    })
  }, mode));
  const promptId = asString(payload?.prompt_id);
  if (!promptId) {
    throw new Error(`ComfyUI ${mode} workflow did not return a prompt id.`);
  }
  return waitForComfyOutputs(promptId, mode);
}

function buildAudioPublicRecord(buffer: Buffer, fileName: string, speaker: string, speed: number, transcript: string): GeneratedSpeechAudioPublicRecord {
  const mimeType = contentTypeFromExtension(fileName);
  return {
    fileName,
    mimeType,
    audioDataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    speaker,
    speed,
    transcript
  };
}

export async function generateTextToSpeech(input: GenerateTextToSpeechInput): Promise<GeneratedSpeechAudioPublicRecord> {
  const text = String(input.text || "").trim();
  if (!text) {
    throw new Error("Text is required for text to speech.");
  }
  const workflowRoot = buildSpeechPromptRootFromWorkflowDocument(await loadWorkflowDocument(input.workflowPath));
  const mode = input.mode === "voice-clone" || input.mode === "custom-voice" || input.mode === "design-voice" ? input.mode : "standard";
  const speed = typeof input.speed === "number" && Number.isFinite(input.speed) ? Math.max(0.5, Math.min(2, input.speed)) : 1;
  let speaker = String(input.speaker || "").trim();
  if (mode === "standard") {
    const generatorNodeId = findNodeIdByClassType(workflowRoot, ["KokoroGenerator"]);
    const speakerNodeId = findNodeIdByClassType(workflowRoot, ["KokoroSpeaker"]);
    const speedNodeId = findNodeIdByClassType(workflowRoot, ["PrimitiveFloat"]);
    if (!generatorNodeId || !speakerNodeId || !speedNodeId) {
      throw new Error("Standard TTS workflow is missing Kokoro nodes.");
    }
    speaker = speaker || "af_bella";
    setNodeString(workflowRoot, speakerNodeId, "speaker_name", speaker);
    setNodeNumber(workflowRoot, speedNodeId, "value", speed);
    setNodeString(workflowRoot, generatorNodeId, "text", text);
    if (input.language?.trim()) {
      setNodeString(workflowRoot, generatorNodeId, "lang", input.language.trim());
    }
  } else if (mode === "voice-clone") {
    const cloneNodeId = findNodeIdByClassType(workflowRoot, ["FB_Qwen3TTSVoiceClone"]);
    const loadAudioNodeId = findNodeIdByClassType(workflowRoot, ["LoadAudio", "VHS_LoadAudioUpload"]);
    if (!cloneNodeId || !loadAudioNodeId) {
      throw new Error("Voice clone TTS workflow is missing required nodes.");
    }
    if (!input.referenceAudioDataUrl?.trim()) {
      throw new Error("Reference audio is required for voice clone mode.");
    }
    const stagedAudioFile = await ensureComfySpeechInputFile(input.referenceAudioDataUrl, input.referenceAudioFileName || "tts-reference.wav");
    speaker = speaker || "Qwen Voice Clone";
    setNodeString(workflowRoot, loadAudioNodeId, "audio", stagedAudioFile);
    setNodeString(workflowRoot, cloneNodeId, "target_text", text);
    if (input.referenceText?.trim()) {
      setNodeString(workflowRoot, cloneNodeId, "ref_text", input.referenceText.trim());
    }
    if (input.language?.trim()) {
      setNodeString(workflowRoot, cloneNodeId, "language", input.language.trim());
    }
  } else if (mode === "custom-voice") {
    const customNodeId = findNodeIdByClassType(workflowRoot, ["FB_Qwen3TTSCustomVoice"]);
    if (!customNodeId) {
      throw new Error("Custom voice TTS workflow is missing the Qwen custom voice node.");
    }
    if (!input.instruct?.trim()) {
      throw new Error("Voice instructions are required for custom voice mode.");
    }
    speaker = speaker || "Custom Voice";
    setNodeString(workflowRoot, customNodeId, "text", text);
    setNodeString(workflowRoot, customNodeId, "instruct", input.instruct.trim());
    if (input.speaker?.trim()) {
      setNodeString(workflowRoot, customNodeId, "speaker", input.speaker.trim());
    }
    if (input.language?.trim()) {
      setNodeString(workflowRoot, customNodeId, "language", input.language.trim());
    }
  } else {
    const designNodeId = findNodeIdByClassType(workflowRoot, ["FB_Qwen3TTSVoiceDesign"]);
    if (!designNodeId) {
      throw new Error("Design voice TTS workflow is missing the Qwen voice design node.");
    }
    if (!input.instruct?.trim()) {
      throw new Error("Voice instructions are required for design voice mode.");
    }
    speaker = speaker || "Designed Voice";
    setNodeString(workflowRoot, designNodeId, "text", text);
    setNodeString(workflowRoot, designNodeId, "instruct", input.instruct.trim());
    if (input.language?.trim()) {
      setNodeString(workflowRoot, designNodeId, "language", input.language.trim());
    }
  }
  const outputs = await queueSpeechWorkflow(workflowRoot, "tts");
  const asset = extractFirstAudioAsset(outputs, "");
  if (!asset) {
    throw new Error("ComfyUI did not return a TTS audio file.");
  }
  return buildAudioPublicRecord(await comfyDownloadAsset(asset, "tts"), asset.filename, speaker, speed, text);
}

export async function transcribeSpeechToText(input: TranscribeSpeechToTextInput): Promise<GeneratedSpeechTranscriptRecord> {
  const inputFileName = await ensureComfySpeechInputFile(input.audioDataUrl, input.fileName || "speech-input.wav");
  const workflowRoot = buildSpeechPromptRootFromWorkflowDocument(await loadWorkflowDocument(input.workflowPath));
  const loadNodeId = Object.keys(workflowRoot).find(nodeId => asString(asRecord(workflowRoot[nodeId])?.class_type) === "LoadAudio" || asString(asRecord(workflowRoot[nodeId])?.class_type) === "VHS_LoadAudioUpload") || "106";
  setNodeString(workflowRoot, loadNodeId, "audio", inputFileName);
  const whisperNodeId = Object.keys(workflowRoot).find(nodeId => asString(asRecord(workflowRoot[nodeId])?.class_type) === "Apply Whisper");
  if (whisperNodeId && input.language?.trim()) {
    setNodeString(workflowRoot, whisperNodeId, "language", input.language.trim());
  }
  const outputs = await queueSpeechWorkflow(workflowRoot, "stt");
  const transcript = extractFirstTranscript(outputs, "99") || extractFirstTranscript(outputs, "98");
  if (!transcript) {
    throw new Error("ComfyUI did not return a speech transcript.");
  }
  return { transcript };
}

export async function generateSpeechToSpeech(input: GenerateSpeechToSpeechInput): Promise<GeneratedSpeechAudioPublicRecord> {
  const inputFileName = await ensureComfySpeechInputFile(input.audioDataUrl, input.fileName || "speech-input.wav");
  const workflowRoot = buildSpeechPromptRootFromWorkflowDocument(await loadWorkflowDocument(input.workflowPath));
  const speaker = String(input.speaker || "am_puck").trim() || "am_puck";
  const speed = typeof input.speed === "number" && Number.isFinite(input.speed) ? Math.max(0.5, Math.min(2, input.speed)) : 0.9;
  setNodeString(workflowRoot, "11", "audio", inputFileName);
  setNodeString(workflowRoot, "3", "speaker_name", speaker);
  setNodeNumber(workflowRoot, "2", "value", speed);
  const outputs = await queueSpeechWorkflow(workflowRoot, "sts");
  const transcript = extractFirstTranscript(outputs, "7");
  const asset = extractFirstAudioAsset(outputs, "5");
  if (!asset) {
    throw new Error("ComfyUI did not return a speech-to-speech audio file.");
  }
  return buildAudioPublicRecord(await comfyDownloadAsset(asset, "sts"), asset.filename, speaker, speed, transcript);
}
