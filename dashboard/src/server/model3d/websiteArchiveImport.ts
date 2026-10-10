import { mkdir, mkdtemp, open, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { importUploadedSourceModel, toGeneratedModelPublicRecord, type GeneratedModelPublicRecord } from "@urage/server/services/model3d";

const allowedModelExtensions = new Set([".obj", ".glb", ".gltf", ".stl", ".3mf", ".ply", ".fbx"]);
const maxArchiveBytes = 350 * 1024 * 1024;
const maxExpandedArchiveBytes = 1024 * 1024 * 1024;
const maxArchiveFiles = 5_000;
const maxDownloadDurationMs = 120_000;
const maxExtractionDurationMs = 120_000;

function assertApprovedDownloadUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/(^|\.)urage\.net$/i.test(url.hostname) || !/^\/api\/sketchfab\/dashboard-imports\/[^/]+\/download$/.test(url.pathname)) {
    throw new Error("The website import URL is not an approved URage.net one-time download link.");
  }
  return url;
}

async function extractArchive(archivePath: string, destination: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("tar.exe", ["-xf", archivePath, "-C", destination], { windowsHide: true });
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, maxExtractionDurationMs);
    child.stderr.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-8192); });
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", code => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error("Sketchfab archive extraction exceeded its time limit."));
      } else {
        code === 0 ? resolve() : reject(new Error(stderr.trim() || "Windows tar could not extract the Sketchfab archive."));
      }
    });
  });
}

async function streamArchiveToFile(response: Response, archivePath: string): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("URage.net returned an empty archive response.");
  const output = await open(archivePath, "wx");
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxArchiveBytes) {
        await reader.cancel();
        throw new Error("The Sketchfab archive exceeds the 350 MB import limit.");
      }
      const buffer = Buffer.from(chunk.value);
      let offset = 0;
      while (offset < buffer.length) {
        const written = await output.write(buffer, offset, buffer.length - offset);
        if (written.bytesWritten === 0) throw new Error("Failed to write the downloaded Sketchfab archive.");
        offset += written.bytesWritten;
      }
    }
    if (totalBytes === 0) throw new Error("The Sketchfab archive is empty.");
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    await output.close();
  }
}

async function listFiles(directory: string, prefix = "", budget = {files: 0, bytes: 0}): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path.join(directory, entry.name), relative, budget));
    } else if (entry.isFile()) {
      budget.files += 1;
      budget.bytes += (await stat(path.join(directory, entry.name))).size;
      if (budget.files > maxArchiveFiles || budget.bytes > maxExpandedArchiveBytes) {
        throw new Error("The Sketchfab archive exceeds the extracted file or size limit.");
      }
      files.push(relative);
    }
  }
  return files;
}

function selectModelFile(files: string[]): string | null {
  for (const extension of [".glb", ".gltf", ".fbx", ".obj", ".stl", ".3mf", ".ply"]) {
    const file = files.find(candidate => path.extname(candidate).toLowerCase() === extension);
    if (file) return file;
  }
  return null;
}

export async function importWebsiteModelArchive(input: { downloadUrl: string; modelName: string }): Promise<GeneratedModelPublicRecord> {
  const downloadUrl = assertApprovedDownloadUrl(input.downloadUrl);
  const workDirectory = await mkdtemp(path.join(tmpdir(), "urage-sketchfab-"));
  try {
    const archivePath = path.join(workDirectory, "model.zip");
    const extractedDirectory = path.join(workDirectory, "extracted");
    const controller = new AbortController();
    const downloadTimeout = setTimeout(() => controller.abort(), maxDownloadDurationMs);
    try {
      const response = await fetch(downloadUrl, {
        redirect: "error",
        headers: { Accept: "application/zip" },
        signal: controller.signal
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`URage.net import download failed (${response.status}).`);
      }
      const contentType = ((response.headers.get("content-type") || "").split(";", 1)[0] || "").trim().toLowerCase();
      if (contentType !== "application/zip" && contentType !== "application/x-zip-compressed") {
        await response.body?.cancel().catch(() => {});
        throw new Error("URage.net did not return a ZIP archive.");
      }
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (Number.isFinite(declaredSize) && declaredSize > maxArchiveBytes) {
        await response.body?.cancel().catch(() => {});
        throw new Error("The Sketchfab archive exceeds the 350 MB import limit.");
      }
      await streamArchiveToFile(response, archivePath);
    } finally {
      clearTimeout(downloadTimeout);
    }
    await mkdir(extractedDirectory);
    await extractArchive(archivePath, extractedDirectory);
    const files = await listFiles(extractedDirectory);
    const modelRelativePath = selectModelFile(files);
    if (!modelRelativePath || !allowedModelExtensions.has(path.extname(modelRelativePath).toLowerCase())) throw new Error("The Sketchfab archive does not contain a supported 3D model file.");
    const modelPath = path.join(extractedDirectory, ...modelRelativePath.split("/"));
    const sourceDirectory = path.posix.dirname(modelRelativePath);
    const sidecarFiles = [];
    for (const file of files) {
      if (file === modelRelativePath || (sourceDirectory !== "." && !file.startsWith(`${sourceDirectory}/`))) continue;
      sidecarFiles.push({
        relativePath: sourceDirectory === "." ? file : file.slice(sourceDirectory.length + 1),
        data: await readFile(path.join(extractedDirectory, ...file.split("/")))
      });
    }
    const imported = await importUploadedSourceModel({
      fileName: path.basename(modelRelativePath),
      fileData: await readFile(modelPath),
      prompt: `Imported from URage.net Sketchfab: ${input.modelName.trim() || "Sketchfab model"}`,
      useSourceAsCurrent: true,
      sidecarFiles
    });
    return toGeneratedModelPublicRecord(imported);
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}
