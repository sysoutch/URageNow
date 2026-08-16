import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {NativeApplicationPort} from "./nativeApplicationPort.js";
import {getNativeApplicationPort} from "./nativeApplicationRuntime.js";
import { resolveRepoPath } from "./repositoryPaths.js";

export type BlenderOpenMode = "model" | "image-plane";

export interface BlenderOpenAssetInput {
  mode: BlenderOpenMode;
  assetPath?: string;
  sourcePath?: string;
  dataUrl?: string;
  fileName?: string;
  label?: string;
}

export interface BlenderOpenRuntimeConfig {
  blenderExecutablePath: string;
  dataDirectory: string;
  blenderModelAutoRigScriptPath?: string;
  blenderLowPolyScriptPath?: string;
  blenderOpenScriptPath?: string;
}

export interface BlenderOpenConsoleEvent {
  source: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface BlenderOpenServiceDependencies {
  config: BlenderOpenRuntimeConfig;
  nativeApplicationPort?: NativeApplicationPort;
  recordConsoleEvent?: (event: BlenderOpenConsoleEvent) => void;
}

function sanitizeBlenderImportFileName(value: string, fallback: string): string {
  const normalized = value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ");
  const compact = normalized.replace(/^\.+/, "").slice(0, 120).trim();
  return compact || fallback;
}

function extensionFromImageMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("bmp")) return ".bmp";
  if (normalized.includes("tiff")) return ".tiff";
  return ".png";
}

function parseImageDataUrl(dataUrl: string): { mimeType: string; data: Buffer } {
  const match = dataUrl.trim().match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("A valid image data URL is required for Blender image import.");
  }
  return {
    mimeType: match[1] || "image/png",
    data: Buffer.from(match[2] || "", "base64")
  };
}

export function createBlenderOpenService({ config, nativeApplicationPort = getNativeApplicationPort(), recordConsoleEvent }: BlenderOpenServiceDependencies) {
  const blenderOpenTempDirectory = path.join(path.resolve(config.dataDirectory), "blender-open-temp");

  function getBlenderOpenScriptCandidates(): string[] {
    const configured = String(
      config.blenderOpenScriptPath ||
      process.env.BLENDER_OPEN_SCRIPT_PATH ||
      ""
    ).trim();

    return Array.from(new Set([
      configured,
      resolveRepoPath("blender-scripts", "import.py")
    ].filter(Boolean)));
  }

  async function resolveBlenderOpenScriptPath(): Promise<string> {
    const candidates = getBlenderOpenScriptCandidates();
    for (const candidate of candidates) {
      try {
        const entry = await stat(candidate);
        if (entry.isFile()) {
          return candidate;
        }
      } catch {
        continue;
      }
    }
    throw new Error("Blender open script was not found. Set BLENDER_OPEN_SCRIPT_PATH or keep blender-scripts/import.py in the workspace.");
  }

  function buildBlenderOpenArgs(input: { mode: BlenderOpenMode; assetPath: string; sourcePath?: string; label?: string; scriptPath: string }): string[] {
    const args = [
      "--python",
      input.scriptPath,
      "--",
      `--mode=${input.mode}`,
      `--filepath=${input.assetPath}`
    ];
    if (input.sourcePath) {
      args.push(`--source_filepath=${input.sourcePath}`);
    }
    if (input.label) {
      args.push("--name", input.label);
    }
    return args;
  }

  function buildBlenderOpenBatchArgs(input: { manifestPath: string; scriptPath: string }): string[] {
    return [
      "--python",
      input.scriptPath,
      "--",
      `--filelist=${input.manifestPath}`
    ];
  }

  async function stageImageDataForBlender(input: { dataUrl: string; fileName?: string }): Promise<{ assetPath: string; fileName: string }> {
    const parsed = parseImageDataUrl(input.dataUrl);
    if (parsed.data.length === 0) {
      throw new Error("Image data for Blender import is empty.");
    }
    await mkdir(blenderOpenTempDirectory, { recursive: true });
    const requestedName = sanitizeBlenderImportFileName(input.fileName || "image-plane", "image-plane");
    const requestedExt = path.extname(requestedName) || extensionFromImageMimeType(parsed.mimeType);
    const stem = path.basename(requestedName, path.extname(requestedName)) || "image-plane";
    const fileName = sanitizeBlenderImportFileName(`${stem}-${Date.now()}${requestedExt}`, `image-plane-${Date.now()}${requestedExt}`);
    const assetPath = path.join(blenderOpenTempDirectory, fileName);
    await writeFile(assetPath, parsed.data);
    return { assetPath, fileName };
  }

  async function prepareAssetForBlender(input: BlenderOpenAssetInput): Promise<{ mode: BlenderOpenMode; assetPath: string; sourcePath: string; label?: string }> {
    if (input.dataUrl) {
      const staged = await stageImageDataForBlender({ dataUrl: input.dataUrl, fileName: input.fileName });
      return {
        mode: input.mode || "image-plane",
        assetPath: staged.assetPath,
        sourcePath: staged.assetPath,
        label: input.label || input.fileName || staged.fileName
      };
    }
    const originalAssetPath = path.resolve(String(input.assetPath || "").trim());
    const sourcePath = path.resolve(String(input.sourcePath || input.assetPath || "").trim());
    const assetEntry = await stat(originalAssetPath);
    if (!assetEntry.isFile()) {
      throw new Error("Blender asset target is not a file.");
    }
    return {
      mode: input.mode,
      assetPath: originalAssetPath,
      sourcePath,
      label: input.label || input.fileName || path.basename(originalAssetPath)
    };
  }

  async function launchBlender(args: string[], sourceLabel: string): Promise<{ launched: boolean; pid: number | null }> {
    const launched = await nativeApplicationPort.launch({
      applicationId: "blender",
      executablePath: config.blenderExecutablePath,
      args,
      detached: false,
      stdio: "inherit",
      windowsHide: false
    });
    recordConsoleEvent?.({
      source: "blender:open",
      level: "info",
      message: sourceLabel
    });
    return {
      launched: true,
      pid: launched.pid
    };
  }

  async function openAssetInBlender(input: BlenderOpenAssetInput & { mode: BlenderOpenMode; assetPath: string }): Promise<{ launched: boolean; pid: number | null; assetPath: string; sourcePath: string }> {
    const prepared = await prepareAssetForBlender(input);
    const scriptPath = await resolveBlenderOpenScriptPath();
    const args = buildBlenderOpenArgs({ mode: prepared.mode, assetPath: prepared.assetPath, sourcePath: prepared.sourcePath, label: prepared.label, scriptPath });
    const launched = await launchBlender(args, `Opened ${path.basename(prepared.assetPath)} in Blender (${prepared.mode}).`);
    return {
      ...launched,
      assetPath: prepared.assetPath,
      sourcePath: prepared.sourcePath
    };
  }

  async function openAssetsInBlender(input: { assets: BlenderOpenAssetInput[] }): Promise<{ launched: boolean; pid: number | null; assetPaths: string[] }> {
    const assets = Array.isArray(input.assets) ? input.assets : [];
    if (assets.length === 0) {
      throw new Error("At least one Blender asset is required.");
    }
    const preparedAssets = [];
    for (const asset of assets) {
      preparedAssets.push(await prepareAssetForBlender(asset));
    }
    await mkdir(blenderOpenTempDirectory, { recursive: true });
    const manifestPath = path.join(blenderOpenTempDirectory, `blender-open-batch-${Date.now()}.json`);
    await writeFile(manifestPath, JSON.stringify({
      assets: preparedAssets.map(asset => ({
        mode: asset.mode,
        filepath: asset.assetPath,
        source_filepath: asset.sourcePath,
        name: asset.label || path.basename(asset.assetPath)
      }))
    }, null, 2), "utf8");
    const scriptPath = await resolveBlenderOpenScriptPath();
    const launched = await launchBlender(
      buildBlenderOpenBatchArgs({ manifestPath, scriptPath }),
      `Opened ${preparedAssets.length} assets in one Blender scene.`
    );
    return {
      ...launched,
      assetPaths: preparedAssets.map(asset => asset.assetPath)
    };
  }

  async function openImageDataInBlender(input: { dataUrl: string; fileName?: string; label?: string }): Promise<{ launched: boolean; pid: number | null; assetPath: string }> {
    const { assetPath } = await stageImageDataForBlender({ dataUrl: input.dataUrl, fileName: input.fileName });
    const requestedName = sanitizeBlenderImportFileName(input.fileName || "image-plane", "image-plane");
    return openAssetInBlender({ mode: "image-plane", assetPath, label: input.label || requestedName });
  }

  return {
    openAssetInBlender,
    openAssetsInBlender,
    openImageDataInBlender
  };
}
