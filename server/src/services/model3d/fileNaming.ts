import path from "node:path";

export function sanitizeFileName(input: string, fallback: string): string {
  const base = path.basename((input || "").trim());
  const cleaned = base
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+/, "")
    .slice(0, 120);
  if (cleaned.length > 0) {
    return cleaned;
  }
  return fallback;
}

export function mimeToExtension(mimeType: string | null | undefined): string {
  const normalized = (mimeType ?? "").toLowerCase();
  if (normalized.includes("png")) {
    return ".png";
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return ".jpg";
  }
  if (normalized.includes("webp")) {
    return ".webp";
  }
  if (normalized.includes("gif")) {
    return ".gif";
  }
  if (normalized.includes("bmp")) {
    return ".bmp";
  }
  if (normalized.includes("tiff")) {
    return ".tiff";
  }
  if (normalized.includes("gltf")) {
    return ".gltf";
  }
  if (normalized.includes("glb")) {
    return ".glb";
  }
  return ".bin";
}

export function extensionFromFileName(name: string | null | undefined): string {
  const ext = path.extname(name ?? "").toLowerCase();
  return ext.length > 0 ? ext : "";
}

export function buildPublicModelFileUrl(modelId: string, fileName: string): string {
  return `/api/model3d-file?modelId=${encodeURIComponent(modelId)}&file=${encodeURIComponent(fileName)}`;
}

export function extensionToContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  if (ext === ".gif") {
    return "image/gif";
  }
  if (ext === ".bmp") {
    return "image/bmp";
  }
  if (ext === ".tiff" || ext === ".tif") {
    return "image/tiff";
  }
  if (ext === ".glb") {
    return "model/gltf-binary";
  }
  if (ext === ".gltf") {
    return "model/gltf+json";
  }
  return "application/octet-stream";
}
