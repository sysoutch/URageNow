import type { IncomingMessage, ServerResponse } from "node:http";
import { sendBinary, sendJson } from "../http.js";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { appConfig } from "../runtime/botBridge.js";
import { createDashboardRouteTable, dispatchDashboardRoute, getRoute, postRoute } from "../router.js";
import { buildFfmpegInstallHint, resolveFfmpegExecutablePath } from "../mediaConverter/ffmpeg.js";
import { convertMedia, listRecentMediaConverterGifs, readMediaConverterJobFile, type MediaConverterMode } from "../mediaConverter/service.js";

async function readJsonBody(request: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function resolveMediaConverterMode(value: unknown): MediaConverterMode | null {
  return value === "video-to-gif" || value === "video-to-png-frames" ? value : null;
}

async function handlePostApiMediaConvert(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await readJsonBody(request);
  const mode = resolveMediaConverterMode(body.mode);
  const sourceDataUrl = typeof body.sourceDataUrl === "string" ? body.sourceDataUrl.trim() : "";
  const sourceFileName = typeof body.sourceFileName === "string" ? body.sourceFileName.trim() : "";
  if (!mode || !sourceDataUrl || !sourceFileName) {
    sendJson(response, 400, { error: "mode, sourceDataUrl, and sourceFileName are required." });
    return;
  }
  try {
    const settings = dependencies.runtimeState.getGlobalDashboardSettings();
    const ffmpegExecutablePath = resolveFfmpegExecutablePath(settings.ffmpegExecutablePath || appConfig.ffmpegExecutablePath);
    if (!ffmpegExecutablePath) {
      sendJson(response, 500, { error: buildFfmpegInstallHint(), code: "ffmpeg-missing" });
      return;
    }
    const result = await convertMedia({
      mode,
      sourceDataUrl,
      sourceFileName,
      fps: body.fps,
      width: body.width
    }, ffmpegExecutablePath);
    sendJson(response, 200, result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Media conversion failed.";
    sendJson(response, 500, { error: detail });
  }
}

async function handleGetApiMediaConverterFile(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const jobId = url.searchParams.get("jobId")?.trim() ?? "";
  const fileName = url.searchParams.get("file")?.trim() ?? "";
  if (!jobId || !fileName) {
    sendJson(response, 400, { error: "jobId and file are required." });
    return;
  }
  try {
    const file = await readMediaConverterJobFile(jobId, fileName);
    sendBinary(response, 200, file.contentType, file.data);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Converted file was not found.";
    sendJson(response, 404, { error: detail });
  }
}

async function handleGetApiMediaConverterGifs(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const limit = Number.parseInt(url.searchParams.get("limit") || "24", 10);
  try {
    sendJson(response, 200, await listRecentMediaConverterGifs(Number.isFinite(limit) ? limit : 24));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to load media converter GIFs.";
    sendJson(response, 500, { error: detail });
  }
}

const mediaConverterRouteTable = createDashboardRouteTable([
  postRoute("/api/media-convert", handlePostApiMediaConvert),
  getRoute("/api/media-converter-gifs", handleGetApiMediaConverterGifs),
  getRoute("/api/media-converter-file", handleGetApiMediaConverterFile)
]);

export async function handleDashboardMediaConverterRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: DashboardDependencies
): Promise<boolean> {
  return dispatchDashboardRoute(mediaConverterRouteTable, { request, response, url, dependencies });
}
