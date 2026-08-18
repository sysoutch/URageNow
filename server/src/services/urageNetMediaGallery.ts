import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { resolveUrageNetMediaGalleryCredentials } from "./urageNetMediaGallerySettings.js";
import type { PublishedMediaAsset } from "@urage/shared/automation/index";

export interface UrageNetMediaUpload {
  kind: PublishedMediaAsset["kind"];
  fileName?: string;
  directUrl?: string;
}

export interface UrageNetMediaUploadResult extends UrageNetMediaUpload {
  websiteUrl: string;
}

const contentTypesByExtension: Record<string, string> = {
  ".avif": "image/avif", ".fbx": "application/octet-stream", ".gif": "image/gif",
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg", ".obj": "model/obj", ".png": "image/png", ".webm": "video/webm",
  ".webp": "image/webp"
};

async function configuredCredentials(): Promise<{ baseUrl: string; username: string; password: string; }> {
  const credentials = await resolveUrageNetMediaGalleryCredentials();
  const baseUrl = credentials.baseUrl.replace(/\/+$/, "");
  if (!baseUrl || !credentials.username || !credentials.password) {
    throw new Error("URageNet Media Library publishing needs URAGENET_MEDIA_API_BASE_URL, URAGENET_MEDIA_API_USERNAME, and URAGENET_MEDIA_API_PASSWORD.");
  }
  return { ...credentials, baseUrl };
}

function resolveDashboardAssetUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const baseUrl = appConfig.dashboardPublicBaseUrl.replace(/\/+$/, "");
  if (!baseUrl) throw new Error("DASHBOARD_PUBLIC_BASE_URL is required to publish generated media.");
  return `${baseUrl}/${value.replace(/^\/+/, "")}`;
}

function deriveFileName(asset: UrageNetMediaUpload, sourceUrl: string): string {
  if (asset.fileName?.trim()) return asset.fileName.trim();
  const pathname = new URL(sourceUrl).pathname;
  const candidate = path.basename(pathname);
  return candidate && candidate !== "/" ? candidate : `automation-${asset.kind}`;
}

function contentTypeFor(asset: UrageNetMediaUpload, response: Response, fileName: string): string {
  const responseType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (responseType && responseType !== "application/octet-stream") return responseType;
  return contentTypesByExtension[path.extname(fileName).toLowerCase()] || "application/octet-stream";
}

function toAbsoluteWebsiteUrl(baseUrl: string, url: unknown): string {
  const value = String(url || "").trim();
  if (!value) throw new Error("URageNet upload response did not include a media URL.");
  return new URL(value, `${baseUrl}/`).toString();
}

export async function publishAssetsToUrageNetMediaGallery(assets: UrageNetMediaUpload[]): Promise<UrageNetMediaUploadResult[]> {
  const config = await configuredCredentials();
  const baseUrl = config.baseUrl;
  const credentials = Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64");
  const results: UrageNetMediaUploadResult[] = [];

  for (const asset of assets) {
    if (!asset.directUrl) continue;
    const sourceUrl = resolveDashboardAssetUrl(asset.directUrl);
    const dashboardToken = appConfig.dashboardAccessToken.trim();
    const sourceResponse = await fetch(sourceUrl, {
      headers: dashboardToken ? { "x-dashboard-access-token": dashboardToken } : undefined
    });
    if (!sourceResponse.ok) throw new Error(`Could not read generated ${asset.kind} from Dashboard (${sourceResponse.status}).`);
    const fileName = deriveFileName(asset, sourceUrl);
    const contentType = contentTypeFor(asset, sourceResponse, fileName);
    const form = new FormData();
    form.append("file", new Blob([await sourceResponse.arrayBuffer()], { type: contentType }), fileName);
    form.append("tags", "AI Generated");
    form.append("visibility", "post");

    const uploadResponse = await fetch(`${baseUrl}/api/media/upload`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
      body: form
    });
    if (!uploadResponse.ok) {
      throw new Error(`URageNet Media Library upload failed (${uploadResponse.status}): ${(await uploadResponse.text()).slice(0, 500)}`);
    }
    const uploaded = await uploadResponse.json() as { url?: unknown };
    results.push({ ...asset, fileName, websiteUrl: toAbsoluteWebsiteUrl(baseUrl, uploaded.url) });
  }
  return results;
}
