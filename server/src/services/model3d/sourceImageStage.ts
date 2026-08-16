import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stripImageMetadataToPng } from "../imageSanitizer.js";
import type { GenerateModelInput } from "../model3d.js";
import { getComfyRuntimeSettings } from "../comfyRuntimeSettings.js";
import { resolveGeneratedImageApiSourceToFilePath } from "../internalGeneratedImageSource.js";
import { extensionFromFileName, mimeToExtension, sanitizeFileName } from "./fileNaming.js";
import { ensureUniqueFileName } from "./fsHelpers.js";
import { createId } from "./primitives.js";
export interface StageComfySourceImageInput {
  imageInput: string;
  imageFileNameHint?: string;
  stripMetadata?: boolean;
  fallbackPrefix?: string;
}

export interface StageComfyMeshInput {
  meshInput: string;
  meshFileNameHint?: string;
}

function parseDataUrlImage(input: string): { mimeType: string; data: Buffer } | null {
  const match = input.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) {
    return null;
  }
  const mimeType = match[1] ?? "image/png";
  const base64Payload = match[2] ?? "";
  if (!base64Payload) {
    return null;
  }
  return {
    mimeType,
    data: Buffer.from(base64Payload, "base64")
  };
}

export async function stageImageInputForComfy(input: StageComfySourceImageInput): Promise<{ fileName: string }> {
  const rawInput = input.imageInput.trim();
  if (!rawInput) {
    throw new Error("An image input is required.");
  }
  const comfySettings = getComfyRuntimeSettings();
  await mkdir(comfySettings.comfyUiInputDir, { recursive: true });
  const dataUrlPayload = parseDataUrlImage(rawInput);
  let imageData: Buffer;
  let extension = "";
  if (dataUrlPayload) {
    imageData = dataUrlPayload.data;
    extension = mimeToExtension(dataUrlPayload.mimeType);
  } else if (/^https?:\/\//i.test(rawInput)) {
    const response = await fetch(rawInput);
    if (!response.ok) {
      throw new Error(`Failed to download source image (${response.status}).`);
    }
    imageData = Buffer.from(await response.arrayBuffer());
    extension = extensionFromFileName(new URL(rawInput).pathname) || mimeToExtension(response.headers.get("content-type"));
  } else {
    const generatedImagePath = await resolveGeneratedImageApiSourceToFilePath(rawInput);
    const normalizedPath = generatedImagePath
      || (/^file:\/\//i.test(rawInput)
        ? decodeURIComponent(new URL(rawInput).pathname).replace(/^\/([A-Za-z]:\/)/, "$1")
        : rawInput);
    imageData = await readFile(normalizedPath);
    extension = extensionFromFileName(normalizedPath);
  }
  if (!extension) {
    extension = ".png";
  }
  const fallbackPrefix = sanitizeFileName(input.fallbackPrefix?.trim() || "source_input", "source_input").replace(path.extname(input.fallbackPrefix?.trim() || ""), "") || "source_input";
  if (input.stripMetadata) {
    try {
      imageData = await stripImageMetadataToPng(imageData);
      extension = ".png";
    } catch (error) {
      throw new Error(`Failed to strip image metadata: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  const fallbackName = `${fallbackPrefix}_${createId()}${extension}`;
  const requestedName = input.imageFileNameHint
    ? sanitizeFileName(input.imageFileNameHint, fallbackName)
    : fallbackName;
  const finalName = await ensureUniqueFileName(comfySettings.comfyUiInputDir, requestedName);
  await writeFile(path.join(comfySettings.comfyUiInputDir, finalName), imageData);
  return { fileName: finalName };
}

export async function stageMeshInputForComfy(input: StageComfyMeshInput): Promise<{ fileName: string }> {
  const rawInput = input.meshInput.trim();
  const match = rawInput.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) throw new Error("A base64-encoded 3D mesh input is required.");
  const requestedName = input.meshFileNameHint?.trim() || "texture-source.glb";
  const extension = extensionFromFileName(requestedName);
  if (!/\.(obj|glb|gltf|stl|3mf|ply)$/i.test(extension)) {
    throw new Error("The texture workflow accepts OBJ, GLB, GLTF, STL, 3MF, or PLY mesh files.");
  }
  const comfySettings = getComfyRuntimeSettings();
  await mkdir(comfySettings.comfyUiInputDir, { recursive: true });
  const fallbackName = `texture_mesh_${createId()}${extension}`;
  const finalName = await ensureUniqueFileName(comfySettings.comfyUiInputDir, sanitizeFileName(requestedName, fallbackName));
  await writeFile(path.join(comfySettings.comfyUiInputDir, finalName), Buffer.from(match[2] || "", "base64"));
  return { fileName: finalName };
}
export async function stageSourceImage(input: GenerateModelInput): Promise<{ fileName: string }> {
  return stageImageInputForComfy({
    imageInput: input.imageInput,
    imageFileNameHint: input.imageFileNameHint,
    stripMetadata: input.stripMetadata,
    fallbackPrefix: "model_input"
  });
}
