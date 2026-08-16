import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataRoot } from "@urage/server/config/repositoryPaths";
import { fetchLatestGithubRelease, type GithubLatestReleasePayload } from "./toolRepositoryManager.js";

type ImportedAssetPlatform = "unity" | "godot" | "unreal";
type ImportedAssetKind = "repository" | "release";

type ImportedAssetEntry = {
  id: string;
  title: string;
  description: string;
  repoUrl: string;
  repoRef: string;
  slug: string;
  platform: ImportedAssetPlatform;
  importKind: ImportedAssetKind;
  importedAt: string;
  destinationPath: string;
  readmeFound: boolean;
  readmeSummary: string;
  buildInstructions: string;
  notes: string[];
  assetName: string | null;
  tagName: string | null;
  releaseName: string | null;
};

type ReleaseAssetSelectionPayload = {
  repoUrl: string;
  repoRef: string;
  tagName: string;
  releaseName: string;
  assets: GithubLatestReleasePayload["assets"];
};

type AssetImportAnalysis = {
  title: string;
  description: string;
  readmeFound: boolean;
  readmeSummary: string;
  buildInstructions: string;
  notes: string[];
};

class ReleaseAssetSelectionRequiredError extends Error {
  payload: ReleaseAssetSelectionPayload;

  constructor(message: string, payload: ReleaseAssetSelectionPayload) {
    super(message);
    this.name = "ReleaseAssetSelectionRequiredError";
    this.payload = payload;
  }
}

const importedAssetsRoot = path.join(dataRoot, "dashboard-imported-assets");
const importedAssetsRegistryPath = path.join(importedAssetsRoot, "registry.json");
const importedAssetsTempRoot = path.join(importedAssetsRoot, "tmp");

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/\.git$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function sanitizeFileName(value: string): string {
  return normalizeText(value)
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function toTitleCaseFromSlug(value: string): string {
  return value
    .split(/[-_.]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRepoRef(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function buildImportedAssetId(platform: ImportedAssetPlatform, importKind: ImportedAssetKind, slug: string, suffix = ""): string {
  return `${platform}:${importKind}:${slug}${suffix ? `:${suffix}` : ""}`;
}

function normalizeGithubRepositoryInput(value: unknown): { owner: string; repo: string; slug: string; repoRef: string; repoUrl: string; } {
  const input = normalizeText(value);
  if (!input) {
    throw new Error("A GitHub repository is required.");
  }
  if (/^https?:\/\//i.test(input)) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new Error("Enter a valid GitHub repository URL or owner/repo.");
    }
    if (url.hostname.toLowerCase() !== "github.com") {
      throw new Error("Only github.com repositories are supported right now.");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      throw new Error("Enter a full GitHub repository URL.");
    }
    const owner = sanitizeSegment(segments[0] || "");
    const repo = sanitizeSegment(segments[1] || "");
    if (!owner || !repo) {
      throw new Error("Enter a valid GitHub repository URL.");
    }
    return {
      owner,
      repo,
      slug: `${owner}--${repo}`,
      repoRef: formatRepoRef(owner, repo),
      repoUrl: `https://github.com/${owner}/${repo}`
    };
  }
  const shorthandMatch = input.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/);
  if (!shorthandMatch) {
    throw new Error("Enter a GitHub repository as owner/repo or a full GitHub URL.");
  }
  const owner = sanitizeSegment(shorthandMatch[1] || "");
  const repo = sanitizeSegment(shorthandMatch[2] || "");
  if (!owner || !repo) {
    throw new Error("Enter a valid GitHub repository reference.");
  }
  return {
    owner,
    repo,
    slug: `${owner}--${repo}`,
    repoRef: formatRepoRef(owner, repo),
    repoUrl: `https://github.com/${owner}/${repo}`
  };
}

function assertPathInsideRoot(root: string, targetPath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    return resolvedTarget;
  }
  throw new Error("Resolved path escaped the managed import root.");
}

async function runProcess(command: string, args: string[], options: { cwd?: string; timeoutMs?: number; } = {}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd,
      timeout: options.timeoutMs || 120000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8
    }, error => {
      if (error) {
        reject(new Error(error.message || "Process failed."));
        return;
      }
      resolve();
    });
  });
}

async function cloneRepository(repositoryUrl: string, destination: string): Promise<void> {
  await runProcess("git", ["clone", "--depth", "1", repositoryUrl, destination], { timeoutMs: 180000 });
}

async function removeDirectoryIfPresent(root: string, targetPath: string): Promise<void> {
  const safeTargetPath = assertPathInsideRoot(root, targetPath);
  if (!existsSync(safeTargetPath)) {
    return;
  }
  await rm(safeTargetPath, { recursive: true, force: true });
}

async function readOptionalFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function collectRepositoryFiles(root: string, relativeDirectory = "", output: string[] = []): Promise<string[]> {
  const absoluteDirectory = path.join(root, relativeDirectory);
  let entries: { name: string; isDirectory(): boolean; }[];
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return output;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const nextRelativePath = relativeDirectory ? path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name) : entry.name;
    if (entry.isDirectory()) {
      if ([".git", "node_modules", ".next", ".nuxt", ".svelte-kit", ".idea", ".vscode"].includes(entry.name.toLowerCase())) {
        continue;
      }
      await collectRepositoryFiles(root, nextRelativePath, output);
      continue;
    }
    output.push(nextRelativePath.replaceAll("\\", "/"));
  }
  return output;
}

function findReadmePath(files: string[]): string | null {
  for (const relativePath of files) {
    if (path.posix.basename(relativePath).toLowerCase() === "readme.md") {
      return relativePath;
    }
  }
  return null;
}

function cleanReadmeDescriptionLine(line: string): string {
  const value = String(line || "").trim();
  if (!value || value.startsWith("#")) {
    return "";
  }
  if (/^!\[[^\]]*\]\([^)]+\)$/i.test(value) || /^\[[^\]]*\]\([^)]+\)$/i.test(value)) {
    return "";
  }
  if (/^`{3,}/.test(value) || /^-{3,}$/.test(value)) {
    return "";
  }
  return value.replace(/^[*-]\s*/, "").trim();
}

function extractReadmeTitleAndDescription(readmeSource: string, fallbackSlug: string): { title: string; description: string; } {
  if (!readmeSource) {
    return {
      title: toTitleCaseFromSlug(fallbackSlug),
      description: `${toTitleCaseFromSlug(fallbackSlug)} imported from GitHub.`
    };
  }
  const lines = readmeSource.split(/\r?\n/);
  let title = "";
  let description = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!title && trimmed.startsWith("#")) {
      title = trimmed.replace(/^#+\s*/, "").trim();
      continue;
    }
    if (!description) {
      description = cleanReadmeDescriptionLine(trimmed);
    }
    if (title && description) {
      break;
    }
  }
  return {
    title: title || toTitleCaseFromSlug(fallbackSlug),
    description: description || `${title || toTitleCaseFromSlug(fallbackSlug)} imported from GitHub.`
  };
}

function collectInterestingReadmeSections(readmeSource: string): { heading: string; lines: string[]; }[] {
  const interestingReadmeSectionTitles = ["quick start", "installation", "build", "run", "usage", "setup", "prerequisites"];
  if (!readmeSource) {
    return [];
  }
  const sections: { heading: string; lines: string[]; }[] = [];
  let activeSection: { heading: string; lines: string[]; } | null = null;
  for (const line of readmeSource.split(/\r?\n/)) {
    const headingMatch = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      const heading = normalizeText(headingMatch[2]).replace(/[^\w\s+-]+$/g, "");
      const normalizedHeading = heading.toLowerCase();
      activeSection = interestingReadmeSectionTitles.some(title => normalizedHeading.includes(title))
        ? { heading, lines: [] }
        : null;
      if (activeSection) {
        sections.push(activeSection);
      }
      continue;
    }
    if (activeSection) {
      activeSection.lines.push(line);
    }
  }
  return sections;
}

function buildReadmeSummary(readmeSource: string): string {
  if (!readmeSource) {
    return "No README.md found.";
  }
  const lines = readmeSource
    .split(/\r?\n/)
    .map(line => cleanReadmeDescriptionLine(line))
    .filter(Boolean);
  return lines[0] || "README.md found.";
}

function extractBuildInstructions(readmeSource: string): string {
  if (!readmeSource) {
    return "README.md was not found, so no build or setup instructions could be extracted.";
  }
  const sections = collectInterestingReadmeSections(readmeSource);
  if (sections.length === 0) {
    return "README.md was found, but no clear Quick Start, Installation, Build, Run, Usage, Setup, or Prerequisites section was detected.";
  }
  const output: string[] = [];
  for (const section of sections.slice(0, 5)) {
    const cleanedLines = section.lines
      .map(line => line.replace(/\t/g, "  ").trimEnd())
      .filter(line => line.trim().length > 0)
      .slice(0, 18);
    if (cleanedLines.length === 0) {
      continue;
    }
    output.push(`${section.heading}:`);
    cleanedLines.forEach(line => output.push(line));
    output.push("");
  }
  return output.join("\n").trim() || "README.md was found, but no importable setup steps were extracted.";
}

async function analyzeRepository(root: string, slug: string, platform: ImportedAssetPlatform): Promise<AssetImportAnalysis> {
  const files = await collectRepositoryFiles(root);
  const readmeRelativePath = findReadmePath(files);
  const readmeSource = readmeRelativePath ? await readOptionalFile(path.join(root, readmeRelativePath)) : "";
  const titleAndDescription = extractReadmeTitleAndDescription(readmeSource, slug);
  const platformLabel = platform === "godot" ? "Godot" : platform === "unreal" ? "Unreal" : "Unity";
  const notes = [
    `${platformLabel} import cloned into the dashboard asset workspace.`
  ];
  if (readmeRelativePath) {
    notes.push(`README detected at ${readmeRelativePath}.`);
  }
  return {
    title: titleAndDescription.title,
    description: titleAndDescription.description,
    readmeFound: Boolean(readmeRelativePath),
    readmeSummary: buildReadmeSummary(readmeSource),
    buildInstructions: extractBuildInstructions(readmeSource),
    notes
  };
}

async function readImportedAssetRegistry(): Promise<ImportedAssetEntry[]> {
  const raw = await readOptionalFile(importedAssetsRegistryPath);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ImportedAssetEntry[] : [];
  } catch {
    return [];
  }
}

async function writeImportedAssetRegistry(entries: ImportedAssetEntry[]): Promise<void> {
  await mkdir(importedAssetsRoot, { recursive: true });
  await writeFile(importedAssetsRegistryPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

async function upsertImportedAssetEntry(entry: ImportedAssetEntry): Promise<void> {
  const entries = await readImportedAssetRegistry();
  const nextEntries = entries.filter(existing => existing.id !== entry.id);
  nextEntries.unshift(entry);
  await writeImportedAssetRegistry(nextEntries.slice(0, 300));
}

function getImportedAssetPlatformRoot(platform: ImportedAssetPlatform): string {
  return path.join(importedAssetsRoot, platform);
}

function getImportedAssetRepoRoot(platform: ImportedAssetPlatform): string {
  return path.join(getImportedAssetPlatformRoot(platform), "repos");
}

function getImportedAssetReleaseRoot(platform: ImportedAssetPlatform): string {
  return path.join(getImportedAssetPlatformRoot(platform), "releases");
}

async function cloneToTemporaryDirectory(repositoryUrl: string, slug: string): Promise<string> {
  await mkdir(importedAssetsTempRoot, { recursive: true });
  const tempPath = path.join(importedAssetsTempRoot, `${slug}-${Date.now().toString(36)}`);
  await cloneRepository(repositoryUrl, tempPath);
  return tempPath;
}

async function finalizeImportedAssetRepository(tempPath: string, normalizedRepository: { slug: string; repoRef: string; repoUrl: string; }, platform: ImportedAssetPlatform, analysis: AssetImportAnalysis): Promise<ImportedAssetEntry> {
  const repoRoot = getImportedAssetRepoRoot(platform);
  const destinationPath = path.join(repoRoot, normalizedRepository.slug);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await removeDirectoryIfPresent(repoRoot, destinationPath);
  await rename(tempPath, destinationPath);
  const entry: ImportedAssetEntry = {
    id: buildImportedAssetId(platform, "repository", normalizedRepository.slug),
    title: analysis.title,
    description: analysis.description,
    repoUrl: normalizedRepository.repoUrl,
    repoRef: normalizedRepository.repoRef,
    slug: normalizedRepository.slug,
    platform,
    importKind: "repository",
    importedAt: new Date().toISOString(),
    destinationPath: path.resolve(destinationPath),
    readmeFound: analysis.readmeFound,
    readmeSummary: analysis.readmeSummary,
    buildInstructions: analysis.buildInstructions,
    notes: analysis.notes,
    assetName: null,
    tagName: null,
    releaseName: null
  };
  await upsertImportedAssetEntry(entry);
  return entry;
}

async function downloadBinary(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "URageStudio-AssetsDashboard",
      "accept": "application/octet-stream"
    }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail.trim() || `GitHub asset download failed (${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await writeFile(destinationPath, Buffer.from(arrayBuffer));
}

async function downloadImportedAssetRelease(platform: ImportedAssetPlatform, repositoryInput: string, assetName: string | null): Promise<ImportedAssetEntry> {
  const normalizedRepository = normalizeGithubRepositoryInput(repositoryInput);
  const release = await fetchLatestGithubRelease(repositoryInput);
  if (release.assets.length === 0) {
    throw new Error("The latest release has no downloadable assets.");
  }
  const normalizedAssetName = normalizeText(assetName);
  if (!normalizedAssetName && release.assets.length > 1) {
    throw new ReleaseAssetSelectionRequiredError("Multiple release files were found. Choose which asset to download.", {
      repoUrl: release.repoUrl,
      repoRef: release.repoRef,
      tagName: release.tagName,
      releaseName: release.releaseName,
      assets: release.assets
    });
  }
  const selectedAsset = normalizedAssetName
    ? release.assets.find(asset => asset.name.toLowerCase() === normalizedAssetName.toLowerCase())
    : release.assets[0];
  if (!selectedAsset) {
    throw new Error("The selected release asset was not found.");
  }
  const safeTag = sanitizeSegment(release.tagName || "latest") || "latest";
  const safeAssetName = sanitizeFileName(selectedAsset.name);
  if (!safeAssetName) {
    throw new Error("The selected release asset name is invalid.");
  }
  const releaseRoot = getImportedAssetReleaseRoot(platform);
  const destinationDirectory = path.join(releaseRoot, normalizedRepository.slug, safeTag);
  const destinationPath = path.join(destinationDirectory, safeAssetName);
  await mkdir(destinationDirectory, { recursive: true });
  await downloadBinary(selectedAsset.downloadUrl, destinationPath);
  const platformLabel = platform === "godot" ? "Godot" : platform === "unreal" ? "Unreal" : "Unity";
  const entry: ImportedAssetEntry = {
    id: buildImportedAssetId(platform, "release", normalizedRepository.slug, `${safeTag}-${safeAssetName}`),
    title: `${toTitleCaseFromSlug(normalizedRepository.repo)} ${selectedAsset.name}`,
    description: `${platformLabel} release asset downloaded from GitHub.`,
    repoUrl: normalizedRepository.repoUrl,
    repoRef: normalizedRepository.repoRef,
    slug: normalizedRepository.slug,
    platform,
    importKind: "release",
    importedAt: new Date().toISOString(),
    destinationPath: path.resolve(destinationPath),
    readmeFound: false,
    readmeSummary: "Latest release asset downloaded from GitHub.",
    buildInstructions: "This entry is a downloaded release asset. Open the containing folder to inspect, import, or extract it locally.",
    notes: [
      `${platformLabel} release asset saved locally.`,
      `Release: ${release.releaseName || release.tagName || "latest"}`
    ],
    assetName: selectedAsset.name,
    tagName: release.tagName,
    releaseName: release.releaseName
  };
  await upsertImportedAssetEntry(entry);
  return entry;
}

async function listImportedAssetRepositories(platform: ImportedAssetPlatform | null = null): Promise<ImportedAssetEntry[]> {
  const entries = await readImportedAssetRegistry();
  const visibleEntries: ImportedAssetEntry[] = [];
  for (const entry of entries) {
    if (platform && entry.platform !== platform) {
      continue;
    }
    const destinationPath = normalizeText(entry.destinationPath);
    if (!destinationPath) {
      continue;
    }
    try {
      await stat(destinationPath);
      visibleEntries.push(entry);
    } catch {
      continue;
    }
  }
  return visibleEntries;
}

async function importAssetRepositoryFromGithub(platform: ImportedAssetPlatform, repositoryInput: string): Promise<ImportedAssetEntry> {
  const normalizedRepository = normalizeGithubRepositoryInput(repositoryInput);
  let tempPath = "";
  try {
    tempPath = await cloneToTemporaryDirectory(normalizedRepository.repoUrl, normalizedRepository.slug);
    const analysis = await analyzeRepository(tempPath, normalizedRepository.repo, platform);
    const importedEntry = await finalizeImportedAssetRepository(tempPath, normalizedRepository, platform, analysis);
    tempPath = "";
    return importedEntry;
  } finally {
    if (tempPath) {
      await removeDirectoryIfPresent(importedAssetsTempRoot, tempPath).catch(() => {});
    }
  }
}

function isImportedAssetPlatform(value: unknown): value is ImportedAssetPlatform {
  return value === "unity" || value === "godot" || value === "unreal";
}

function isReleaseAssetSelectionRequiredError(error: unknown): error is ReleaseAssetSelectionRequiredError {
  return error instanceof ReleaseAssetSelectionRequiredError;
}

export {
  downloadImportedAssetRelease,
  importAssetRepositoryFromGithub,
  isImportedAssetPlatform,
  isReleaseAssetSelectionRequiredError,
  listImportedAssetRepositories
};
export type {
  ImportedAssetEntry,
  ImportedAssetPlatform,
  ReleaseAssetSelectionPayload
};
