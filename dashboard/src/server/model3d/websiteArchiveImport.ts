import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { importUploadedSourceModel, toGeneratedModelPublicRecord, type GeneratedModelPublicRecord } from "@urage/server/services/model3d";

const allowedModelExtensions = new Set([".obj", ".glb", ".gltf", ".stl", ".3mf", ".ply", ".fbx"]);
const maxArchiveBytes = 350 * 1024 * 1024;

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
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(new Error(stderr.trim() || "Windows tar could not extract the Sketchfab archive.")));
  });
}

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
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
  const response = await fetch(downloadUrl, { redirect: "error", headers: { Accept: "application/zip" } });
  if (!response.ok) throw new Error(`URage.net import download failed (${response.status}).`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredSize) && declaredSize > maxArchiveBytes) throw new Error("The Sketchfab archive exceeds the 350 MB import limit.");
  const archiveData = Buffer.from(await response.arrayBuffer());
  if (archiveData.length === 0 || archiveData.length > maxArchiveBytes) throw new Error("The Sketchfab archive is empty or exceeds the 350 MB import limit.");
  const workDirectory = await mkdtemp(path.join(tmpdir(), "urage-sketchfab-"));
  try {
    const archivePath = path.join(workDirectory, "model.zip");
    const extractedDirectory = path.join(workDirectory, "extracted");
    await writeFile(archivePath, archiveData);
    await mkdir(extractedDirectory);
    await extractArchive(archivePath, extractedDirectory);
    const files = await listFiles(extractedDirectory);
    const modelRelativePath = selectModelFile(files);
    if (!modelRelativePath || !allowedModelExtensions.has(path.extname(modelRelativePath).toLowerCase())) throw new Error("The Sketchfab archive does not contain a supported 3D model file.");
    const modelPath = path.join(extractedDirectory, ...modelRelativePath.split("/"));
    const sourceDirectory = path.posix.dirname(modelRelativePath);
    const sidecarFiles = await Promise.all(files.filter(file => file !== modelRelativePath && (sourceDirectory === "." || file.startsWith(`${sourceDirectory}/`))).map(async file => ({
      relativePath: sourceDirectory === "." ? file : file.slice(sourceDirectory.length + 1),
      data: await readFile(path.join(extractedDirectory, ...file.split("/")))
    })));
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
