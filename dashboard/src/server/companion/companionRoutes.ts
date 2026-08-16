import type { IncomingMessage, ServerResponse } from "node:http";
import type { DashboardDependencies } from "@urage/shared/dashboard/types";
import { appConfig } from "@urage/server/config/appConfig";
import {readDashboardThemePreference} from "@urage/server/services/dashboardThemePreference";
import QRCode from "qrcode";
import { parseJsonBody, sendBinary, sendJson } from "../http.js";
import {
  authorizeCompanionToken,
  companionDeviceCan,
  getCompanionPairingCode,
  getCompanionPairingPayload,
  getCompanionAccessPolicy,
  exportCompanionAccessPolicy,
  importCompanionAccessPolicy,
  listCompanionDevices,
  pairCompanionDevice,
  revokeCompanionDevice,
  updateCompanionDefaultPermissions,
  updateCompanionDevicePermissions,
  type CompanionPermissionKey
} from "./companionAccessService.js";
import {appendCompanionAccessAudit, listCompanionAccessAudit} from "./companionAccessAudit.js";
import {
  deleteCompanionUpload,
  listCompanionUploads,
  parseCompanionMediaKind,
  readCompanionUpload,
  saveCompanionUpload,
  updateCompanionUploadMetadata,
  type CompanionMediaKind
} from "./companionMediaStore.js";
import {
  appendCompanionUploadChunk,
  beginCompanionUploadCompletion,
  completeCompanionUploadSession,
  createCompanionUploadSession,
  markCompanionUploadSessionCompleted,
  readCompanionUploadSession,
} from "./companionUploadSessionStore.js";
import {paginateCompanionMedia} from "./companionMediaPagination.js";
import {getCompanionThumbnail} from "./companionThumbnailCache.js";
import {applySoulPromptContext} from "../routes/chatSkillRoutes.js";
import {loadChatSkillsFromDisk, loadLocalToolsFromDisk} from "../chatSkills/catalog.js";
import {buildPromptWithSkillContext} from "../chatSkills/routing.js";
import {generateTextToSpeechForClient, transcribeSpeechForClient} from "../routes/speechRoutes.js";
import {launchModelInPrintApplication} from "../resourceHub/model3dPrintApplicationManager.js";
import {listCompanionTools, readCompanionToolFile} from "./companionToolCatalog.js";

const maxUploadBytes = 100 * 1024 * 1024;

async function buildCompanionChatStudioPrompt(body: Record<string, unknown>): Promise<string> {
  const prompt = String(body.prompt || "").trim();
  const conversation = (Array.isArray(body.history) ? body.history : [])
    .slice(-12)
    .flatMap(entry => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      const role: "assistant" | "user" = record.role === "assistant" ? "assistant" : "user";
      const text = String(record.content || "").trim().slice(0, 4_000);
      return text ? [{role, text}] : [];
    });
  const [availableSkills, availableTools] = await Promise.all([
    loadChatSkillsFromDisk(),
    loadLocalToolsFromDisk()
  ]);
  return applySoulPromptContext(buildPromptWithSkillContext({
    prompt,
    conversation,
    availableSkills,
    availableTools,
    selectedSkill: null,
    autoRunSkills: false
  }));
}

function readHeader(request: IncomingMessage, name: string): string {
  const value = request.headers[name];
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function sendRangeAwareBinary(request: IncomingMessage, response: ServerResponse, contentType: string, data: Buffer): void {
  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Content-Type", contentType);
  const range = readHeader(request, "range").match(/^bytes=(\d+)-(\d*)$/);
  if (!range) {
    response.statusCode = 200;
    response.setHeader("Content-Length", data.length);
    response.end(data);
    return;
  }
  const start = Number(range[1]);
  const requestedEnd = range[2] ? Number(range[2]) : data.length - 1;
  if (!Number.isSafeInteger(start) || start < 0 || start >= data.length) {
    response.statusCode = 416;
    response.setHeader("Content-Range", `bytes */${data.length}`);
    response.end();
    return;
  }
  const end = Math.min(data.length - 1, Number.isSafeInteger(requestedEnd) ? requestedEnd : data.length - 1);
  const chunk = data.subarray(start, end + 1);
  response.statusCode = 206;
  response.setHeader("Content-Range", `bytes ${start}-${end}/${data.length}`);
  response.setHeader("Content-Length", chunk.length);
  response.end(chunk);
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += data.length;
    if (size > maxUploadBytes) throw new Error("Upload exceeds the 100 MiB companion limit.");
    chunks.push(data);
  }
  return Buffer.concat(chunks);
}

function toGeneratedItem(kind: CompanionMediaKind, record: Record<string, unknown>): Record<string, unknown> {
  const fileName = String(kind === "image" ? record.imageFileName : kind === "audio" ? record.audioFileName : kind === "video" ? record.videoFileName : record.modelFileName || "");
  return {
    id: String(record.id || ""), kind, fileName, createdAt: String(record.createdAt || ""),
    title: String(record.prompt || fileName), size: null, source: "generated",
    downloadUrl: `/api/companion/media/file?kind=${kind}&id=${encodeURIComponent(String(record.id || ""))}&file=${encodeURIComponent(fileName)}`,
    thumbnailUrl: kind === "image"
      ? `/api/companion/media/thumbnail?kind=${kind}&id=${encodeURIComponent(String(record.id || ""))}&file=${encodeURIComponent(fileName)}`
      : null
  };
}

async function listGenerated(kind: CompanionMediaKind, dependencies: DashboardDependencies): Promise<Record<string, unknown>[]> {
  const records = kind === "image" ? await dependencies.listGeneratedImages()
    : kind === "audio" ? await dependencies.listGeneratedAudios()
    : kind === "video" ? await dependencies.listGeneratedVideos()
    : await dependencies.listGeneratedModels();
  return records.map(record => toGeneratedItem(kind, record as unknown as Record<string, unknown>));
}

async function readGenerated(kind: CompanionMediaKind, id: string, fileName: string, dependencies: DashboardDependencies) {
  if (kind === "image") return dependencies.readGeneratedImageFile(id, fileName);
  if (kind === "audio") return dependencies.readGeneratedAudioFile(id, fileName);
  if (kind === "video") return dependencies.readGeneratedVideoFile(id, fileName);
  return dependencies.readGeneratedModelFile(id, fileName);
}

async function deleteGenerated(kind: CompanionMediaKind, id: string, dependencies: DashboardDependencies): Promise<boolean> {
  if (kind === "image") return dependencies.deleteGeneratedImage(id);
  if (kind === "audio") return dependencies.deleteGeneratedAudio(id);
  if (kind === "video") return dependencies.deleteGeneratedVideo(id);
  return dependencies.deleteGeneratedModel(id);
}

export function isPublicCompanionPath(pathname: string): boolean {
  return pathname === "/api/companion/info" || pathname === "/api/companion/pair";
}

export function isCompanionPath(pathname: string): boolean {
  return pathname.startsWith("/api/companion/");
}

export async function handleCompanionAdminRequest(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
  if (url.pathname === "/api/companion/devices" && request.method === "GET") {
    sendJson(response, 200, { devices: await listCompanionDevices() });
    return true;
  }
  if (url.pathname === "/api/companion/devices/revoke" && request.method === "POST") {
    const body = await parseJsonBody(request);
    const deviceId = String(body.deviceId || "").trim();
    if (!deviceId) {
      sendJson(response, 400, { error: "deviceId is required." });
      return true;
    }
    const revoked = await revokeCompanionDevice(deviceId);
    sendJson(response, revoked ? 200 : 404, revoked ? { revoked: true } : { error: "Paired device not found." });
    return true;
  }
  if (url.pathname === "/api/companion/access-policy" && request.method === "GET") {
    sendJson(response, 200, await getCompanionAccessPolicy());
    return true;
  }
  if (url.pathname === "/api/companion/access-policy/export" && request.method === "GET") {
    response.setHeader("Content-Disposition", 'attachment; filename="urage-companion-access-policy.json"');
    sendJson(response, 200, await exportCompanionAccessPolicy());
    return true;
  }
  if (url.pathname === "/api/companion/access-policy/import" && request.method === "POST") {
    try {
      const body = await parseJsonBody(request);
      sendJson(response, 200, await importCompanionAccessPolicy(body.policy ?? body));
    } catch (error) {
      sendJson(response, 400, {error: error instanceof Error ? error.message : "Policy import failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/access-audit" && request.method === "GET") {
    sendJson(response, 200, {entries: await listCompanionAccessAudit(Number(url.searchParams.get("limit") || 200))});
    return true;
  }
  if (url.pathname === "/api/companion/pairing-payload" && request.method === "GET") {
    sendJson(response, 200, getCompanionPairingPayload());
    return true;
  }
  if (url.pathname === "/api/companion/pairing-qr.svg" && request.method === "GET") {
    const svg = await QRCode.toString(getCompanionPairingPayload().deepLink, {
      type: "svg", errorCorrectionLevel: "M", margin: 1, width: 320
    });
    response.statusCode = 200;
    response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(svg);
    return true;
  }
  if (url.pathname === "/api/companion/access-policy/defaults" && request.method === "POST") {
    const body = await parseJsonBody(request);
    sendJson(response, 200, {permissions: await updateCompanionDefaultPermissions(body.permissions)});
    return true;
  }
  if (url.pathname === "/api/companion/access-policy/device" && request.method === "POST") {
    const body = await parseJsonBody(request);
    const permissions = await updateCompanionDevicePermissions(String(body.deviceId || ""), body.permissions);
    sendJson(response, permissions ? 200 : 404, permissions ? {permissions} : {error: "Paired device not found."});
    return true;
  }
  return false;
}

export async function handlePublicCompanionRequest(request: IncomingMessage, response: ServerResponse, url: URL, port: number): Promise<boolean> {
  if (url.pathname === "/api/companion/info" && request.method === "GET") {
    sendJson(response, 200, {
      protocol: 5,
      name: "URage NOW",
      port,
      baseUrl: appConfig.dashboardPublicBaseUrl,
      secure: appConfig.dashboardPublicBaseUrl.startsWith("https://"),
      certificateSha256: appConfig.companionTlsCertificateSha256 || null,
      capabilities: [
        "pairing",
        "one-scan-pairing",
        "cursor-pagination",
        "media-download",
        "media-upload",
        "media-metadata-update",
        "media-delete",
        "resumable-upload",
        "resumable-download",
        "thumbnails",
        "device-permissions",
        "tools-catalog",
        "workflow-chat",
        "workflow-image-generation",
        "workflow-model3d-generation",
        "theme-sync"
      ]
    });
    return true;
  }
  if (url.pathname === "/api/companion/pair" && request.method === "POST") {
    const body = await parseJsonBody(request);
    try {
      sendJson(response, 201, await pairCompanionDevice(String(body.token || body.code || "").trim(), String(body.deviceName || "").trim()));
    } catch (error) {
      sendJson(response, 401, { error: error instanceof Error ? error.message : "Pairing failed." });
    }
    return true;
  }
  sendJson(response, 405, { error: "Method not allowed." });
  return true;
}

export async function handleAuthenticatedCompanionRequest(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<boolean> {
  if (!isCompanionPath(url.pathname) || isPublicCompanionPath(url.pathname)) return false;
  const token = readHeader(request, "authorization").replace(/^Bearer\s+/i, "").trim();
  const device = await authorizeCompanionToken(token);
  if (!device) {
    sendJson(response, 401, { error: "A valid paired-device token is required." });
    return true;
  }
  const requirePermission = async (permission: CompanionPermissionKey): Promise<boolean> => {
    const allowed = await companionDeviceCan(device, permission);
    await appendCompanionAccessAudit({
      event: "access.request",
      deviceId: device.id,
      deviceName: device.name,
      permission,
      method: request.method || "",
      path: url.pathname,
      allowed
    });
    if (allowed) return true;
    sendJson(response, 403, {error: `This paired device is not allowed to use ${permission}.`, permission});
    return false;
  };
  if (url.pathname === "/api/companion/theme" && request.method === "GET") {
    sendJson(response, 200, await readDashboardThemePreference());
    return true;
  }
  if (url.pathname === "/api/companion/tools" && request.method === "GET") {
    if (!await requirePermission("tools.browse")) return true;
    sendJson(response, 200, {tools: await listCompanionTools()});
    return true;
  }
  if (url.pathname === "/api/companion/tools/file" && request.method === "GET") {
    if (!await requirePermission("tools.browse")) return true;
    const requestedPath = url.searchParams.get("path") || "";
    const file = await readCompanionToolFile(requestedPath);
    if (!file) {
      sendJson(response, 404, {error: "Tool file not found."});
      return true;
    }
    sendBinary(response, 200, file.contentType, file.data);
    return true;
  }
  if (url.pathname === "/api/companion/workflows/stt" && request.method === "POST") {
    // Voice messages ultimately become Chat Studio messages, so the existing
    // chat permission governs their STT handoff as well.
    if (!await requirePermission("workflow.chat")) return true;
    try {
      const body = await parseJsonBody(request);
      sendJson(response, 200, await transcribeSpeechForClient(body, dependencies, "companion"));
    } catch (error) {
      sendJson(response, 400, {error: error instanceof Error ? error.message : "Speech transcription failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/workflows/tts" && request.method === "POST") {
    // TTS reads Chat Studio replies, so it follows the same capability as chat and STT.
    if (!await requirePermission("workflow.chat")) return true;
    try {
      sendJson(response, 200, await generateTextToSpeechForClient(await parseJsonBody(request), dependencies, "companion"));
    } catch (error) {
      sendJson(response, 400, {error: error instanceof Error ? error.message : "Text to speech failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/workflows/chat-stream" && request.method === "POST") {
    if (!await requirePermission("workflow.chat")) return true;
    const body = await parseJsonBody(request);
    const prompt = String(body.prompt || "").trim();
    if (!prompt || prompt.length > 12_000) {
      sendJson(response, 400, {error: "prompt is required and must not exceed 12,000 characters."});
      return true;
    }
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    const writeEvent = (value: Record<string, unknown>) => response.write(`data: ${JSON.stringify(value)}\n\n`);
    try {
      const preparedPrompt = await buildCompanionChatStudioPrompt(body);
      if (typeof dependencies.askModelDetailedStream === "function") {
        const detailed = await dependencies.askModelDetailedStream(preparedPrompt, {
          onReasoningDelta: () => {},
          onResponseDelta: delta => writeEvent({type: "response-delta", delta})
        });
        writeEvent({type: "done", response: detailed.response});
      } else {
        const answer = await dependencies.askModel(preparedPrompt);
        writeEvent({type: "response-delta", delta: answer});
        writeEvent({type: "done", response: answer});
      }
      dependencies.runtimeState.recordAction("companion:chat", `Android companion ${device.id} streamed a Chat Studio prompt.`);
    } catch (error) {
      writeEvent({type: "error", message: error instanceof Error ? error.message : "Chat generation failed."});
    }
    response.end();
    return true;
  }
  if (url.pathname === "/api/companion/workflows/chat" && request.method === "POST") {
    if (!await requirePermission("workflow.chat")) return true;
    const body = await parseJsonBody(request);
    const prompt = String(body.prompt || "").trim();
    if (!prompt || prompt.length > 12_000) {
      sendJson(response, 400, {error: "prompt is required and must not exceed 12,000 characters."});
      return true;
    }
    try {
      const answer = await dependencies.askModel(await buildCompanionChatStudioPrompt(body));
      dependencies.runtimeState.recordAction("companion:chat", `Android companion ${device.id} completed a Chat Studio prompt.`);
      sendJson(response, 200, {response: answer});
    } catch (error) {
      sendJson(response, 502, {error: error instanceof Error ? error.message : "Chat generation failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/workflows/image/improve-prompt" && request.method === "POST") {
    if (!await requirePermission("workflow.image.generate")) return true;
    const body = await parseJsonBody(request);
    const prompt = String(body.prompt || "").trim();
    if (!prompt || prompt.length > 8_000) {
      sendJson(response, 400, {error: "prompt is required and must not exceed 8,000 characters."});
      return true;
    }
    const negativePrompt = String(body.negativePrompt || "").trim();
    const instructions = String(body.instructions || "").trim();
    const task = [
      "Improve one image-generation prompt.",
      "Return plain prompt text only, without markdown, labels, quotes, or explanations.",
      "Preserve the core subject and intent. Improve composition, lighting, materials, camera, and style only where useful.",
      instructions ? `User direction: ${instructions}` : "",
      `Current prompt: ${prompt}`,
      negativePrompt ? `Negative prompt context that must remain excluded: ${negativePrompt}` : ""
    ].filter(Boolean).join("\n");
    try {
      const improved = (await dependencies.askModel(task)).trim().replace(/^[\"'`]+|[\"'`]+$/g, "");
      if (!improved) throw new Error("The text model returned an empty prompt.");
      dependencies.runtimeState.recordAction("companion:image-prompt", `Android companion ${device.id} improved an Image Studio prompt.`);
      sendJson(response, 200, {prompt: improved});
    } catch (error) {
      sendJson(response, 502, {error: error instanceof Error ? error.message : "Prompt improvement failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/workflows/image/interpret" && request.method === "POST") {
    if (!await requirePermission("workflow.image.generate")) return true;
    if (!await requirePermission("media.download")) return true;
    const body = await parseJsonBody(request);
    const sources = Array.isArray(body.images) ? body.images.slice(0, 8) : [];
    if (sources.length === 0) {
      sendJson(response, 400, {error: "At least one source image is required."});
      return true;
    }
    try {
      const imageInputs: string[] = [];
      for (const source of sources) {
        const record = source && typeof source === "object" ? source as Record<string, unknown> : {};
        const imageId = String(record.id || "").trim();
        const fileName = String(record.fileName || "").trim();
        if (!imageId || !fileName) throw new Error("Every source image requires an id and fileName.");
        const image = await dependencies.readGeneratedImageFile(imageId, fileName);
        imageInputs.push(`data:${String(image.contentType || "image/png")};base64,${image.data.toString("base64")}`);
      }
      const currentPrompt = String(body.prompt || "").trim();
      const parts = body.mode === "parts";
      const instruction = [
        "Write exactly one high-quality image-generation prompt from the attached reference image or images.",
        "Return plain prompt text only, without markdown, labels, quotes, or explanations.",
        parts
          ? "Interpret the distinct useful subjects and visible parts in each image individually, then compose them into one coherent prompt. Preserve which details came from separate references."
          : "Interpret the references as a unified visual direction, preserving the primary subject, composition, materials, lighting, colors, and style.",
        currentPrompt ? `Preserve and integrate this existing user direction: ${currentPrompt}` : ""
      ].filter(Boolean).join("\n");
      const interpreted = (await dependencies.askVisionModel(instruction, imageInputs))
        .trim().replace(/^[\"'`]+|[\"'`]+$/g, "");
      if (!interpreted) throw new Error("The vision model returned an empty prompt.");
      dependencies.runtimeState.recordAction(
        "companion:image-interpret",
        `Android companion ${device.id} interpreted ${imageInputs.length} image source(s) in ${parts ? "parts" : "whole"} mode.`
      );
      sendJson(response, 200, {prompt: interpreted});
    } catch (error) {
      sendJson(response, 502, {error: error instanceof Error ? error.message : "Image interpretation failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/workflows/image" && request.method === "POST") {
    if (!await requirePermission("workflow.image.generate")) return true;
    const body = await parseJsonBody(request);
    const prompt = String(body.prompt || "").trim();
    if (!prompt || prompt.length > 8_000) {
      sendJson(response, 400, {error: "prompt is required and must not exceed 8,000 characters."});
      return true;
    }
    const width = Math.max(256, Math.min(2048, Math.round(Number(body.width) || 1024)));
    const height = Math.max(256, Math.min(2048, Math.round(Number(body.height) || 1024)));
    try {
      const imageId = String(body.imageId || "").trim();
      const imageFileName = String(body.imageFileName || "").trim();
      let imageInput: string | undefined;
      if (imageId && imageFileName) {
        if (!await requirePermission("media.download")) return true;
        const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
        imageInput = `data:${String(source.contentType || "image/png")};base64,${source.data.toString("base64")}`;
      }
      const generated = await dependencies.generateImageFromPrompt({
        prompt,
        negativePrompt: String(body.negativePrompt || "").trim() || undefined,
        width,
        height,
        seed: Number.isFinite(Number(body.seed)) ? Math.round(Number(body.seed)) : undefined,
        steps: Number.isFinite(Number(body.steps)) ? Math.max(1, Math.min(250, Math.round(Number(body.steps)))) : undefined,
        cfg: Number.isFinite(Number(body.cfg)) ? Math.max(0, Math.min(30, Number(body.cfg))) : undefined,
        imageInput,
        imageFileNameHint: imageInput ? imageFileName : undefined,
        autoPrompt: body.autoPrompt !== false,
        autoFileName: true,
        requestedBy: `android-companion:${device.id}`
      });
      dependencies.runtimeState.recordAction("companion:image", `Android companion ${device.id} generated image ${generated.id}.`);
      sendJson(response, 200, {item: toGeneratedItem("image", generated as unknown as Record<string, unknown>)});
    } catch (error) {
      sendJson(response, 502, {error: error instanceof Error ? error.message : "Image generation failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/workflows/audio" && request.method === "POST") {
    if (!await requirePermission("workflow.audio.generate")) return true;
    const body = await parseJsonBody(request);
    const prompt = String(body.prompt || "").trim();
    if (!prompt || prompt.length > 8_000) {
      sendJson(response, 400, {error: "prompt is required and must not exceed 8,000 characters."});
      return true;
    }
    const seconds = Math.max(1, Math.min(120, Math.round(Number(body.seconds) || 10)));
    const steps = Number.isFinite(Number(body.steps)) ? Math.max(1, Math.min(250, Math.round(Number(body.steps)))) : undefined;
    const cfg = Number.isFinite(Number(body.cfg)) ? Math.max(0, Math.min(30, Number(body.cfg))) : undefined;
    try {
      const generated = await dependencies.generateAudioFromPrompt({
        prompt,
        seconds,
        steps,
        cfg,
        requestedBy: `android-companion:${device.id}`
      });
      dependencies.runtimeState.recordAction("companion:audio", `Android companion ${device.id} generated audio ${generated.id}.`);
      sendJson(response, 200, {item: toGeneratedItem("audio", generated as unknown as Record<string, unknown>)});
    } catch (error) {
      sendJson(response, 502, {error: error instanceof Error ? error.message : "Audio generation failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/workflows/music" && request.method === "POST") {
    if (!await requirePermission("workflow.music.generate")) return true;
    const body = await parseJsonBody(request);
    const tags = String(body.tags || "").trim();
    const lyrics = String(body.lyrics || "").trim();
    if (!tags && !lyrics) {
      sendJson(response, 400, {error: "tags or lyrics are required."});
      return true;
    }
    const seconds = Math.max(1, Math.min(120, Math.round(Number(body.seconds) || 30)));
    try {
      const generated = await dependencies.generateMusicFromPrompt({
        seconds,
        tags: tags || undefined,
        lyrics: lyrics || undefined,
        requestedBy: `android-companion:${device.id}`
      });
      dependencies.runtimeState.recordAction("companion:music", `Android companion ${device.id} generated music ${generated.id}.`);
      sendJson(response, 200, {item: toGeneratedItem("audio", generated as unknown as Record<string, unknown>)});
    } catch (error) {
      sendJson(response, 502, {error: error instanceof Error ? error.message : "Music generation failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/workflows/video" && request.method === "POST") {
    if (!await requirePermission("workflow.video.generate")) return true;
    const body = await parseJsonBody(request);
    const prompt = String(body.prompt || "").trim();
    if (!prompt || prompt.length > 8_000) {
      sendJson(response, 400, {error: "prompt is required and must not exceed 8,000 characters."});
      return true;
    }
    try {
      const imageId = String(body.imageId || "").trim();
      const imageFileName = String(body.imageFileName || "").trim();
      let imageDataUrl: string | undefined;
      if (imageId && imageFileName) {
        if (!await requirePermission("media.download")) return true;
        const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
        imageDataUrl = `data:${String(source.contentType || "image/png")};base64,${source.data.toString("base64")}`;
      }
      const generated = await dependencies.generateVideoFromPrompt({
        prompt,
        negativePrompt: String(body.negativePrompt || "").trim() || undefined,
        seconds: Math.max(1, Math.min(300, Math.round(Number(body.seconds) || 5))),
        fps: Math.max(1, Math.min(60, Math.round(Number(body.fps) || 24))),
        width: Math.max(64, Math.min(4096, Math.round(Number(body.width) || 1024))),
        height: Math.max(64, Math.min(4096, Math.round(Number(body.height) || 576))),
        steps: Number.isFinite(Number(body.steps)) ? Math.max(1, Math.min(250, Math.round(Number(body.steps)))) : undefined,
        seed: Number.isFinite(Number(body.seed)) ? Math.max(0, Math.round(Number(body.seed))) : undefined,
        imageDataUrl,
        imageFileName: imageDataUrl ? imageFileName : undefined,
        requestedBy: `android-companion:${device.id}`
      });
      dependencies.runtimeState.recordAction("companion:video", `Android companion ${device.id} generated video ${generated.id}.`);
      sendJson(response, 200, {item: toGeneratedItem("video", generated as unknown as Record<string, unknown>)});
    } catch (error) {
      sendJson(response, 502, {error: error instanceof Error ? error.message : "Video generation failed."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/workflows/model3d" && request.method === "POST") {
    if (!await requirePermission("workflow.model3d.generate")) return true;
    const body = await parseJsonBody(request);
    const sourceMode = String(body.sourceMode || "").trim();
    const prompt = String(body.prompt || "").trim();
    const requestedImageId = String(body.imageId || "").trim();
    const requestedImageFileName = String(body.imageFileName || "").trim();
    const hasCompleteImageReference = Boolean(requestedImageId && requestedImageFileName);
    const hasPartialImageReference = Boolean(requestedImageId || requestedImageFileName) && !hasCompleteImageReference;
    if (prompt.length > 8_000) {
      sendJson(response, 400, {error: "prompt must not exceed 8,000 characters."});
      return true;
    }
    if (sourceMode && sourceMode !== "existing-image" && sourceMode !== "generate-image") {
      sendJson(response, 400, {error: "sourceMode must be existing-image or generate-image."});
      return true;
    }
    if (hasPartialImageReference) {
      sendJson(response, 400, {error: "imageId and imageFileName must be provided together."});
      return true;
    }
    if (sourceMode === "existing-image" && !hasCompleteImageReference) {
      sendJson(response, 400, {error: "Select or capture a source image before generating the 3D model."});
      return true;
    }
    if (sourceMode === "generate-image" && !prompt) {
      sendJson(response, 400, {error: "A source image prompt is required for generate-image mode."});
      return true;
    }
    let sourceImageId = requestedImageId;
    let sourceImageFileName = requestedImageFileName;
    let generatedSourceImage = false;
    let stage = "loading the source image";
    try {
      let sourceImage;
      if (hasCompleteImageReference) {
        if (!await requirePermission("media.download")) return true;
        sourceImage = await dependencies.readGeneratedImageFile(sourceImageId, sourceImageFileName);
      } else {
        if (!await requirePermission("workflow.image.generate")) return true;
        stage = "generating the source image";
        const generatedImage = await dependencies.generateImageFromPrompt({
          prompt,
          width: 1024,
          height: 1024,
          autoPrompt: true,
          autoFileName: true,
          requestedBy: `android-companion:${device.id}`
        });
        sourceImageId = generatedImage.id;
        sourceImageFileName = generatedImage.imageFileName;
        generatedSourceImage = true;
        sourceImage = await dependencies.readGeneratedImageFile(sourceImageId, sourceImageFileName);
      }
      const contentType = String(sourceImage.contentType || "image/png");
      stage = "generating the 3D model";
      const generatedModel = await dependencies.generate3dModelFromImage({
        imageInput: `data:${contentType};base64,${sourceImage.data.toString("base64")}`,
        imageFileNameHint: sourceImageFileName,
        prompt: prompt || undefined,
        autoPrompt: false,
        useLlmMetadata: true,
        generateLowPolyVersion: body.generateLowPoly === true,
        requestedBy: `android-companion:${device.id}`
      });
      dependencies.runtimeState.recordAction("companion:model3d", `Android companion ${device.id} generated model ${generatedModel.id}.`);
      sendJson(response, 200, {
        item: toGeneratedItem("model3d", generatedModel as unknown as Record<string, unknown>),
        sourceImageId,
        sourceImageFileName
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "3D model generation failed.";
      const generatedSourceNote = generatedSourceImage
        ? ` Source image ${sourceImageFileName} was generated and remains available in Image Studio.`
        : "";
      sendJson(response, 502, {
        error: `Failed while ${stage}: ${detail}.${generatedSourceNote}`.replace(/\.\./g, "."),
        ...(sourceImageId ? {sourceImageId, sourceImageFileName} : {})
      });
    }
    return true;
  }
  if (url.pathname === "/api/companion/model3d/print-applications/launch" && request.method === "POST") {
    if (!await requirePermission("application.3d-print.launch")) return true;
    const body = await parseJsonBody(request);
    const applicationId = String(body.applicationId || "").trim();
    const modelId = String(body.modelId || "").trim();
    const fileName = String(body.fileName || "").trim();
    if (!applicationId || !modelId || !fileName) {
      sendJson(response, 400, {error: "applicationId, modelId, and fileName are required."});
      return true;
    }
    try {
      const modelPath = await dependencies.resolveGeneratedModelFilePath(modelId, fileName);
      const result = await launchModelInPrintApplication({applicationId, modelPath});
      dependencies.runtimeState.recordAction(
        "companion:model3d-print",
        `Android companion ${device.id} opened ${fileName} in ${result.applicationId}.`
      );
      sendJson(response, 200, {result: {
        applicationId: result.applicationId,
        executablePath: result.executablePath,
        fileName,
        launched: result.launched
      }});
    } catch (error) {
      sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not open the model in the 3D print application."});
    }
    return true;
  }
  if (url.pathname === "/api/companion/uploads" && request.method === "POST") {
    if (!await requirePermission("media.upload")) return true;
    const body = await parseJsonBody(request);
    const kind = parseCompanionMediaKind(String(body.kind || ""));
    if (!kind) {
      sendJson(response, 400, { error: "kind must be image, audio, video, or model3d." });
      return true;
    }
    try {
      const session = await createCompanionUploadSession({
        kind,
        fileName: String(body.fileName || "upload.bin"),
        contentType: String(body.contentType || "application/octet-stream"),
        totalSize: Number(body.totalSize),
        deviceId: device.id
      });
      sendJson(response, 201, session);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Could not create upload session." });
    }
    return true;
  }
  if (url.pathname === "/api/companion/uploads/status" && request.method === "GET") {
    if (!await requirePermission("media.upload")) return true;
    try {
      sendJson(response, 200, await readCompanionUploadSession(String(url.searchParams.get("uploadId") || ""), device.id));
    } catch (error) {
      sendJson(response, 404, { error: error instanceof Error ? error.message : "Upload session not found." });
    }
    return true;
  }
  if (url.pathname === "/api/companion/uploads/chunk" && (request.method === "PATCH" || request.method === "POST")) {
    if (!await requirePermission("media.upload")) return true;
    try {
      const uploadId = String(url.searchParams.get("uploadId") || "");
      const offset = Number(readHeader(request, "x-upload-offset"));
      sendJson(response, 200, await appendCompanionUploadChunk(uploadId, device.id, offset, await readBody(request)));
    } catch (error) {
      sendJson(response, 409, { error: error instanceof Error ? error.message : "Could not append upload chunk." });
    }
    return true;
  }
  if (url.pathname === "/api/companion/uploads/complete" && request.method === "POST") {
    if (!await requirePermission("media.upload")) return true;
    try {
      const uploadId = String(url.searchParams.get("uploadId") || "");
      const completed = await completeCompanionUploadSession(uploadId, device.id);
      if (completed.session.result) {
        sendJson(response, 200, completed.session.result);
        return true;
      }
      await beginCompanionUploadCompletion(uploadId, device.id);
      const result = completed.session.kind === "image"
        ? toGeneratedItem("image", await dependencies.importGeneratedImage({
            imageFileName: completed.session.fileName,
            imageData: completed.data,
            prompt: `Uploaded from ${device.name}`,
            model: "Android Companion"
          }) as unknown as Record<string, unknown>)
        : await saveCompanionUpload({
            kind: completed.session.kind,
            fileName: completed.session.fileName,
            contentType: completed.session.contentType,
            data: completed.data
          });
      await markCompanionUploadSessionCompleted(uploadId, device.id, result);
      sendJson(response, 201, result);
    } catch (error) {
      sendJson(response, 409, { error: error instanceof Error ? error.message : "Could not complete upload." });
    }
    return true;
  }
  if (url.pathname === "/api/companion/media" && request.method === "GET") {
    if (!await requirePermission("media.list")) return true;
    const kind = parseCompanionMediaKind(url.searchParams.get("kind"));
    if (!kind) {
      sendJson(response, 400, { error: "kind must be image, audio, video, or model3d." });
      return true;
    }
    const uploads: Record<string, unknown>[] = (await listCompanionUploads(kind)).map(record => ({
      ...record, title: record.title || record.fileName, source: "upload",
      downloadUrl: `/api/companion/media/file?kind=${kind}&id=${record.id}&file=${encodeURIComponent(String(record.fileName || ""))}&source=upload`,
      thumbnailUrl: kind === "image"
        ? `/api/companion/media/thumbnail?kind=${kind}&id=${record.id}&file=${encodeURIComponent(String(record.fileName || ""))}&source=upload`
        : null
    }));
    const items = [...uploads, ...await listGenerated(kind, dependencies)];
    sendJson(response, 200, paginateCompanionMedia(items, url));
    return true;
  }
  if (url.pathname === "/api/companion/media/thumbnail" && request.method === "GET") {
    if (!await requirePermission("media.download")) return true;
    const kind = parseCompanionMediaKind(url.searchParams.get("kind"));
    const id = String(url.searchParams.get("id") || "").trim();
    const fileName = String(url.searchParams.get("file") || "").trim();
    if (kind !== "image" || !id || !fileName) {
      sendJson(response, 400, { error: "An image kind, id, and file are required." });
      return true;
    }
    try {
      const file = url.searchParams.get("source") === "upload"
        ? await readCompanionUpload(kind, id, fileName)
        : await readGenerated(kind, id, fileName, dependencies);
      const thumbnail = await getCompanionThumbnail(`${url.searchParams.get("source") || "generated"}:${kind}:${id}:${fileName}`, file.data);
      sendBinary(response, 200, "image/jpeg", thumbnail);
    } catch (error) {
      sendJson(response, 404, { error: error instanceof Error ? error.message : "Thumbnail unavailable." });
    }
    return true;
  }
  if (url.pathname === "/api/companion/media/file" && request.method === "GET") {
    if (!await requirePermission("media.download")) return true;
    const kind = parseCompanionMediaKind(url.searchParams.get("kind"));
    const id = String(url.searchParams.get("id") || "").trim();
    const fileName = String(url.searchParams.get("file") || "").trim();
    if (!kind || !id || !fileName) {
      sendJson(response, 400, { error: "kind, id, and file are required." });
      return true;
    }
    const file = url.searchParams.get("source") === "upload" ? await readCompanionUpload(kind, id, fileName) : await readGenerated(kind, id, fileName, dependencies);
    sendRangeAwareBinary(request, response, file.contentType, file.data);
    return true;
  }
  if (url.pathname === "/api/companion/media" && request.method === "POST") {
    if (!await requirePermission("media.upload")) return true;
    const kind = parseCompanionMediaKind(url.searchParams.get("kind"));
    if (!kind) {
      sendJson(response, 400, { error: "kind must be image, audio, video, or model3d." });
      return true;
    }
    const fileName = decodeURIComponent(readHeader(request, "x-file-name") || "upload.bin");
    const contentType = readHeader(request, "content-type") || "application/octet-stream";
    const data = await readBody(request);
    if (data.length === 0) {
      sendJson(response, 400, { error: "Upload is empty." });
      return true;
    }
    if (kind === "image") {
      const imported = await dependencies.importGeneratedImage({ imageFileName: fileName, imageData: data, prompt: `Uploaded from ${device.name}`, model: "Android Companion" });
      sendJson(response, 201, toGeneratedItem("image", imported as unknown as Record<string, unknown>));
    } else {
      sendJson(response, 201, await saveCompanionUpload({ kind, fileName, contentType, data }));
    }
    return true;
  }
  if (url.pathname === "/api/companion/media/metadata" && (request.method === "PATCH" || request.method === "PUT")) {
    if (!await requirePermission("media.metadata.update")) return true;
    const kind = parseCompanionMediaKind(url.searchParams.get("kind"));
    const id = String(url.searchParams.get("id") || "").trim();
    const fileName = String(url.searchParams.get("file") || "").trim();
    if (!kind || !id || !fileName || url.searchParams.get("source") !== "upload") {
      sendJson(response, 400, {error: "Metadata editing currently requires an uploaded media kind, id, and file."});
      return true;
    }
    sendJson(response, 200, await updateCompanionUploadMetadata(kind, id, fileName, await parseJsonBody(request)));
    return true;
  }
  if (url.pathname === "/api/companion/media" && request.method === "DELETE") {
    if (!await requirePermission("media.delete")) return true;
    const kind = parseCompanionMediaKind(url.searchParams.get("kind"));
    const id = String(url.searchParams.get("id") || "").trim();
    const fileName = String(url.searchParams.get("file") || "").trim();
    if (!kind || !id || !fileName) {
      sendJson(response, 400, {error: "kind, id, and file are required."});
      return true;
    }
    const deleted = url.searchParams.get("source") === "upload"
      ? await deleteCompanionUpload(kind, id, fileName)
      : await deleteGenerated(kind, id, dependencies);
    sendJson(response, deleted ? 200 : 404, deleted ? {deleted: true} : {error: "Media item not found."});
    return true;
  }
  sendJson(response, 404, { error: "Companion endpoint not found." });
  return true;
}

export function describeCompanionPairing() {
  return getCompanionPairingCode();
}
