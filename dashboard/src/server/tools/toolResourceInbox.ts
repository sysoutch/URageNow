import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../runtime/botBridge.js";
import { listToolCapabilities } from "./toolCapabilityRegistry.js";

export type ToolResourceKind = "text" | "image" | "gif" | "model3d" | "video" | "audio" | "music" | "file";

export interface ToolResourceRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceToolId: string;
  targetToolId: string;
  resourceKind: ToolResourceKind;
  title: string;
  fileName: string;
  mimeType: string;
  sourceUrl: string;
  textContent: string;
  metadata: Record<string, string | number | boolean>;
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const inboxDirectory = path.join(dataDirectory, "tool-resource-inbox");
const filesDirectory = path.join(inboxDirectory, "files");
const indexPath = path.join(inboxDirectory, "index.json");
let mutationQueue: Promise<unknown> = Promise.resolve();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function kind(value: unknown): ToolResourceKind | null {
  return value === "text" || value === "image" || value === "gif" || value === "model3d" || value === "video" || value === "audio" || value === "music" || value === "file" ? value : null;
}

function metadata(value: unknown): Record<string, string | number | boolean> {
  const source = asRecord(value);
  if (!source) return {};
  return Object.fromEntries(Object.entries(source).filter(([, item]) => typeof item === "string" || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) as Array<[string, string | number | boolean]>);
}

function fileName(value: unknown, fallback: string): string {
  return path.basename(text(value) || fallback).replace(/[^\w.\-]+/g, "_").slice(0, 120) || fallback;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function parseDataUrl(value: string): { mimeType: string; data: Buffer } | null {
  const match = text(value).match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) return null;
  const data = Buffer.from(match[2] || "", "base64");
  return data.length > 0 ? { mimeType: (match[1] || "application/octet-stream").toLowerCase(), data } : null;
}

async function ensureDirectory(): Promise<void> {
  await mkdir(inboxDirectory, { recursive: true });
}

async function readIndex(): Promise<ToolResourceRecord[]> {
  await ensureDirectory();
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8"));
    return (Array.isArray(parsed) ? parsed : []).map(entry => {
      const source = asRecord(entry);
      const resourceKind = kind(source?.resourceKind);
      if (!source || !resourceKind || !text(source.id) || !text(source.targetToolId)) return null;
      return {
        id: text(source.id), createdAt: text(source.createdAt), updatedAt: text(source.updatedAt),
        sourceToolId: text(source.sourceToolId), targetToolId: text(source.targetToolId), resourceKind,
        title: text(source.title) || "Tool resource", fileName: fileName(source.fileName, "resource.bin"),
        mimeType: text(source.mimeType), sourceUrl: text(source.sourceUrl),
        textContent: typeof source.textContent === "string" ? source.textContent : "", metadata: metadata(source.metadata)
      } satisfies ToolResourceRecord;
    }).filter((entry): entry is ToolResourceRecord => entry !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") return [];
    throw error;
  }
}

async function mutate<T>(action: (entries: ToolResourceRecord[]) => Promise<T>): Promise<T> {
  const run = mutationQueue.then(async () => {
    const entries = await readIndex();
    const result = await action(entries);
    await writeFile(indexPath, JSON.stringify(entries, null, 2), "utf8");
    return result;
  });
  mutationQueue = run.then(() => undefined, () => undefined);
  return run;
}

function fileUrl(baseUrl: string, id: string, name: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/tool-resource-file?resourceId=${encodeURIComponent(id)}&file=${encodeURIComponent(name)}`;
}

export async function createToolResource(input: {
  targetToolId: string; sourceToolId?: string; resourceKind: ToolResourceKind; title?: string; fileName?: string;
  mimeType?: string; sourceUrl?: string; dataUrl?: string; textContent?: string; metadata?: Record<string, string | number | boolean>; publicBaseUrl: string;
}): Promise<ToolResourceRecord> {
  const targetToolId = text(input.targetToolId);
  if (!targetToolId) throw new Error("targetToolId is required.");
  const id = createId();
  let resolvedFileName = fileName(input.fileName, input.resourceKind === "text" ? "resource.txt" : "resource.bin");
  let mimeType = text(input.mimeType);
  let sourceUrl = text(input.sourceUrl);
  const parsed = parseDataUrl(input.dataUrl || "");
  if (!sourceUrl && parsed) {
    await mkdir(path.join(filesDirectory, id), { recursive: true });
    await writeFile(path.join(filesDirectory, id, resolvedFileName), parsed.data);
    mimeType = mimeType || parsed.mimeType;
    sourceUrl = fileUrl(input.publicBaseUrl, id, resolvedFileName);
  }
  const textContent = typeof input.textContent === "string" ? input.textContent : "";
  if (!sourceUrl && !textContent) throw new Error("sourceUrl, dataUrl, or textContent is required.");
  const now = new Date().toISOString();
  const record: ToolResourceRecord = { id, createdAt: now, updatedAt: now, sourceToolId: text(input.sourceToolId), targetToolId, resourceKind: input.resourceKind, title: text(input.title) || resolvedFileName, fileName: resolvedFileName, mimeType, sourceUrl, textContent, metadata: metadata(input.metadata) };
  return await mutate(async entries => { entries.unshift(record); return record; });
}

export async function listToolResources(targetToolId: string, limit = 100): Promise<ToolResourceRecord[]> {
  const target = text(targetToolId);
  if (!target) throw new Error("targetToolId is required.");
  return (await readIndex()).filter(entry => entry.targetToolId === target).slice(0, Math.max(1, Math.min(500, limit)));
}

export async function getToolResource(id: string): Promise<ToolResourceRecord | null> {
  return (await readIndex()).find(entry => entry.id === text(id)) || null;
}

export async function readToolResourceFile(id: string, requestedFileName: string): Promise<{ contentType: string; data: Buffer }> {
  const record = await getToolResource(id);
  if (!record || record.fileName !== fileName(requestedFileName, "")) throw new Error("Tool resource file was not found.");
  return { contentType: record.mimeType || "application/octet-stream", data: await readFile(path.join(filesDirectory, record.id, record.fileName)) };
}

export function buildToolApiSchema(): object {
  return {
    version: "v1",
    authentication: "Use the same dashboard access controls as the Studio UI. Generation endpoints may start compute-intensive jobs.",
    tools: listToolCapabilities(),
    resources: {
      create: { method: "POST", path: "/api/tool-resources" },
      inbox: { method: "GET", path: "/api/tool-resources?targetToolId={toolId}" },
      get: { method: "GET", path: "/api/tool-resources?resourceId={resourceId}" }
    },
    functions: [
      {
        name: "urage_invoke_tool", description: "Invoke a server-capable URage tool by exact toolId. Consult the manifest tools list first. A client-only tool has no server endpoint and must not be replaced with media generation.",
        http: { method: "POST", path: "/api/tools/invoke" },
        parameters: { type: "object", required: ["toolId", "input"], properties: { toolId: { type: "string" }, input: { type: "object" } } }
      },      {
        name: "urage_generate_image", description: "Generate one or more images in URage NOW Studio. This completes an image request; do not invoke model generation unless the user explicitly requests a 3D model.",
        http: { method: "POST", path: "/api/image-generate" },
        parameters: { type: "object", required: ["prompt"], properties: { prompt: { type: "string" }, width: { type: "number" }, height: { type: "number" }, count: { type: "number" } } }
      },
      {
        name: "urage_generate_model3d", description: "Generate a 3D model only when the user explicitly requests one. It requires an image; for an explicit text-to-3D request, first call urage_generate_image and use its imageUrl or data URL as imageInput.",
        http: { method: "POST", path: "/api/model3d-generate" },
        parameters: { type: "object", required: ["imageInput"], properties: { imageInput: { type: "string" }, imageFileNameHint: { type: "string" }, prompt: { type: "string" }, autoPrompt: { type: "boolean" } } }
      },
      {
        name: "urage_generate_audio", description: "Generate a sound effect or other non-musical audio asset.",
        http: { method: "POST", path: "/api/audio-generate" },
        parameters: { type: "object", required: ["prompt"], properties: { prompt: { type: "string" }, seconds: { type: "number" } } }
      },
      {
        name: "urage_generate_music", description: "Generate music from lyrics and optional musical tags.",
        http: { method: "POST", path: "/api/music-generate" },
        parameters: { type: "object", properties: { lyrics: { type: "string" }, tags: { type: "string" }, seconds: { type: "number" } } }
      },
      {
        name: "urage_generate_video", description: "Generate video from a prompt, optionally using an image input.",
        http: { method: "POST", path: "/api/video-generate" },
        parameters: { type: "object", required: ["prompt"], properties: { prompt: { type: "string" }, imageDataUrl: { type: "string" }, imageFileName: { type: "string" }, seconds: { type: "number" }, width: { type: "number" }, height: { type: "number" } } }
      },
      {
        name: "urage_list_generation_jobs", description: "Inspect existing generation jobs by request ID, job ID, or media kind. Generation POST endpoints wait for completion; do not resend a generation request to poll it.",
        http: { method: "GET", path: "/api/generation-jobs?requestId={dashboardRequestId}" },
        parameters: { type: "object", properties: { dashboardRequestId: { type: "string" }, jobId: { type: "string" }, kind: { type: "string", enum: ["image", "model3d", "audio", "music", "video"] }, limit: { type: "number" } } }
      },
      {
        name: "urage_download_generated_image", description: "Download the binary image identified by the id and imageFileName returned from image generation. Do not use a job ID.",
        http: { method: "GET", path: "/api/generated-image-file?imageId={id}&file={imageFileName}" },
        parameters: { type: "object", required: ["id", "imageFileName"], properties: { id: { type: "string" }, imageFileName: { type: "string" } } }
      },
      {
        name: "urage_download_generated_model3d", description: "Download the primary generated 3D model identified by the id and modelFileName returned from model generation. Do not use a job ID.",
        http: { method: "GET", path: "/api/model3d-file?modelId={id}&file={modelFileName}" },
        parameters: { type: "object", required: ["id", "modelFileName"], properties: { id: { type: "string" }, modelFileName: { type: "string" } } }
      },
      {
        name: "urage_download_generated_audio", description: "Download the binary audio or music file identified by the id and audioFileName returned from generation. Do not use a job ID.",
        http: { method: "GET", path: "/api/generated-audio-file?audioId={id}&file={audioFileName}" },
        parameters: { type: "object", required: ["id", "audioFileName"], properties: { id: { type: "string" }, audioFileName: { type: "string" } } }
      },
      {
        name: "urage_download_generated_video", description: "Download the binary video identified by the id and videoFileName returned from video generation. Do not use a job ID.",
        http: { method: "GET", path: "/api/generated-video-file?videoId={id}&file={videoFileName}" },
        parameters: { type: "object", required: ["id", "videoFileName"], properties: { id: { type: "string" }, videoFileName: { type: "string" } } }
      },
      {
        name: "urage_list_tool_resources", description: "List resources waiting for a URage tool.",
        http: { method: "GET", path: "/api/tool-resources?targetToolId={targetToolId}" },
        parameters: { type: "object", required: ["targetToolId"], properties: { targetToolId: { type: "string" } } }
      },
      {
        name: "urage_send_tool_resource", description: "Send a resource to a URage tool inbox.",
        http: { method: "POST", path: "/api/tool-resources" },
        parameters: { type: "object", required: ["targetToolId", "resourceKind"], properties: { targetToolId: { type: "string" }, resourceKind: { type: "string" }, sourceUrl: { type: "string" }, dataUrl: { type: "string" }, textContent: { type: "string" } } }
      }
    ]
  };
}