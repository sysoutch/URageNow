import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataRoot, toolsRoot } from "@urage/server/config/repositoryPaths";

type ImportedToolType = "web" | "desktop";

type ImportedToolLauncher = {
  absolutePath: string;
  label: string;
  relativePath: string;
};

type ImportedToolEntry = {
  id: string;
  title: string;
  description: string;
  repoUrl: string;
  repoRef: string;
  slug: string;
  toolType: ImportedToolType;
  importedAt: string;
  destinationPath: string;
  openUrl: string | null;
  browserReady: boolean;
  readmeFound: boolean;
  readmeSummary: string;
  buildInstructions: string;
  launcherCandidates: ImportedToolLauncher[];
  notes: string[];
};

type ToolImportTypeChoicePayload = {
  title: string;
  description: string;
  repoUrl: string;
  repoRef: string;
  notes: string[];
};

type GithubReleaseAsset = {
  name: string;
  size: number;
  downloadUrl: string;
  contentType: string;
};

type GithubLatestReleasePayload = {
  repoUrl: string;
  repoRef: string;
  tagName: string;
  releaseName: string;
  publishedAt: string;
  body: string;
  assets: GithubReleaseAsset[];
};

type DownloadedGithubReleaseAsset = {
  repoUrl: string;
  repoRef: string;
  slug: string;
  tagName: string;
  releaseName: string;
  publishedAt: string;
  assetName: string;
  downloadPath: string;
  autoPinnable: boolean;
  notes: string[];
};

type ReleaseAssetSelectionPayload = {
  repoUrl: string;
  repoRef: string;
  tagName: string;
  releaseName: string;
  assets: GithubReleaseAsset[];
};

type ToolImportAnalysis = {
  title: string;
  description: string;
  readmeSummary: string;
  buildInstructions: string;
  readmeFound: boolean;
  webIndexCandidates: string[];
  launcherCandidates: ImportedToolLauncher[];
  packageJsonDetected: boolean;
  webScore: number;
  desktopScore: number;
  notes: string[];
};

class ToolImportTypeRequiredError extends Error {
  payload: ToolImportTypeChoicePayload;

  constructor(message: string, payload: ToolImportTypeChoicePayload) {
    super(message);
    this.name = "ToolImportTypeRequiredError";
    this.payload = payload;
  }
}

class ReleaseAssetSelectionRequiredError extends Error {
  payload: ReleaseAssetSelectionPayload;

  constructor(message: string, payload: ReleaseAssetSelectionPayload) {
    super(message);
    this.name = "ReleaseAssetSelectionRequiredError";
    this.payload = payload;
  }
}

const importedToolsRoot = path.join(dataRoot, "dashboard-imported-tools");
const importedDesktopRoot = path.join(importedToolsRoot, "desktop");
const importedRegistryPath = path.join(importedToolsRoot, "registry.json");
const importedWebRoot = path.join(toolsRoot, "imported");
const importedTempRoot = path.join(importedToolsRoot, "tmp");
const downloadedReleaseRoot = path.join(importedToolsRoot, "releases");
const toolImportMetadataFileName = ".urage-tool-import.json";
const supportedDesktopToolExtensions = new Set([".exe", ".bat", ".cmd", ".sh", ".ps1", ".lnk", ".app", ".command", ".py"]);
const ignoredDirectoryNames = new Set([".git", "node_modules", ".next", ".nuxt", ".svelte-kit", ".idea", ".vscode"]);
const interestingReadmeSectionTitles = ["quick start", "installation", "build", "run", "usage", "setup", "prerequisites"];

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

function buildImportedToolId(toolType: ImportedToolType, slug: string): string {
  return `${toolType}:${slug}`;
}

function sanitizeFileName(value: string): string {
  return normalizeText(value)
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
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

async function runProcess(command: string, args: string[], options: { cwd?: string; timeoutMs?: number; } = {}): Promise<{ stdout: string; stderr: string; }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd,
      timeout: options.timeoutMs || 120000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || error.message || "Process failed").trim()));
        return;
      }
      resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

async function cloneRepository(repositoryUrl: string, destination: string): Promise<void> {
  await runProcess("git", ["clone", "--depth", "1", repositoryUrl, destination], { timeoutMs: 180000 });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail.trim() || `GitHub request failed (${response.status}).`);
  }
  return await response.json() as T;
}

async function downloadBinary(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "URageStudio-ToolsDashboard",
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
      if (ignoredDirectoryNames.has(entry.name.toLowerCase())) {
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
    if (!activeSection) {
      continue;
    }
    activeSection.lines.push(line);
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

function buildLauncherLabel(relativePath: string): string {
  const fileName = path.posix.basename(relativePath);
  const parent = path.posix.dirname(relativePath);
  if (!parent || parent === ".") {
    return fileName;
  }
  return `${fileName} (${parent})`;
}

function detectLauncherCandidates(root: string, files: string[]): ImportedToolLauncher[] {
  return files
    .filter(relativePath => supportedDesktopToolExtensions.has(path.extname(relativePath).toLowerCase()))
    .sort((a, b) => {
      const depthCompare = a.split("/").length - b.split("/").length;
      if (depthCompare !== 0) {
        return depthCompare;
      }
      return a.localeCompare(b);
    })
    .slice(0, 8)
    .map(relativePath => ({
      absolutePath: path.join(root, relativePath),
      label: buildLauncherLabel(relativePath),
      relativePath
    }));
}

function detectWebIndexCandidates(files: string[]): string[] {
  return files
    .filter(relativePath => path.posix.basename(relativePath).toLowerCase() === "index.html")
    .sort((a, b) => {
      const depthCompare = a.split("/").length - b.split("/").length;
      if (depthCompare !== 0) {
        return depthCompare;
      }
      return a.localeCompare(b);
    })
    .slice(0, 8);
}

function detectToolType(choice: ImportedToolType | null, analysis: ToolImportAnalysis): ImportedToolType | null {
  if (choice) {
    return choice;
  }
  if (analysis.webScore >= 3 && analysis.webScore >= analysis.desktopScore + 2) {
    return "web";
  }
  if (analysis.desktopScore >= 3 && analysis.desktopScore >= analysis.webScore + 2) {
    return "desktop";
  }
  return null;
}

async function analyzeRepository(root: string, slug: string): Promise<ToolImportAnalysis> {
  const files = await collectRepositoryFiles(root);
  const readmeRelativePath = findReadmePath(files);
  const readmeSource = readmeRelativePath ? await readOptionalFile(path.join(root, readmeRelativePath)) : "";
  const titleAndDescription = extractReadmeTitleAndDescription(readmeSource, slug);
  const webIndexCandidates = detectWebIndexCandidates(files);
  const launcherCandidates = detectLauncherCandidates(root, files);
  const packageJsonSource = await readOptionalFile(path.join(root, "package.json"));
  const packageJsonDetected = Boolean(packageJsonSource);
  const packageJsonLower = packageJsonSource.toLowerCase();
  const rootEntries = new Set(files.filter(file => !file.includes("/")).map(file => file.toLowerCase()));
  let webScore = 0;
  let desktopScore = 0;
  const notes: string[] = [];

  if (webIndexCandidates.some(candidate => candidate.toLowerCase() === "index.html")) {
    webScore += 4;
    notes.push("A root index.html was found, so this can open directly as a browser tool.");
  } else if (webIndexCandidates.length > 0) {
    webScore += 2;
    notes.push(`An index.html entry was found at ${webIndexCandidates[0]}, so this looks web-capable after a wrapper is added.`);
  }

  if (packageJsonDetected && /(vite|react|vue|svelte|parcel|webpack|astro|next)/i.test(packageJsonLower)) {
    webScore += 1;
    notes.push("package.json includes common web build tooling.");
  }

  if (packageJsonDetected && /(electron|tauri|wails)/i.test(packageJsonLower)) {
    desktopScore += 3;
    notes.push("package.json includes desktop app tooling.");
  }

  if (launcherCandidates.length > 0) {
    desktopScore += 3;
    notes.push(`Launchable desktop files were found, including ${launcherCandidates[0]?.relativePath}.`);
  }

  if (rootEntries.has("requirements.txt") || rootEntries.has("pyproject.toml") || rootEntries.has("cargo.toml")) {
    desktopScore += 2;
    notes.push("The repo includes local runtime/build files for a desktop or script-driven tool.");
  }

  if (!webIndexCandidates.length && /\.py\b/i.test(files.join("\n"))) {
    desktopScore += 1;
  }

  if (!webIndexCandidates.length && /pip install|python |ffmpeg|gradio/i.test(readmeSource)) {
    desktopScore += 1;
    notes.push("The README focuses on local runtime steps instead of a browser entry.");
  }

  return {
    title: titleAndDescription.title,
    description: titleAndDescription.description,
    readmeSummary: buildReadmeSummary(readmeSource),
    buildInstructions: extractBuildInstructions(readmeSource),
    readmeFound: Boolean(readmeRelativePath),
    webIndexCandidates,
    launcherCandidates,
    packageJsonDetected,
    webScore,
    desktopScore,
    notes: Array.from(new Set(notes))
  };
}

async function createWebEntryWrapperIfNeeded(root: string, relativeTargetPath: string): Promise<void> {
  const wrapperPath = path.join(root, "index.html");
  if (existsSync(wrapperPath)) {
    return;
  }
  const normalizedTarget = relativeTargetPath.replaceAll("\\", "/");
  const wrapper = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${normalizedTarget}">
  <title>Opening Imported Tool</title>
  <script>
    location.replace(${JSON.stringify(normalizedTarget)});
  </script>
</head>
<body>
  <p>Opening imported tool: <a href="${normalizedTarget}">${normalizedTarget}</a></p>
</body>
</html>
`;
  await writeFile(wrapperPath, wrapper, "utf8");
}

async function readImportedToolRegistry(): Promise<ImportedToolEntry[]> {
  const raw = await readOptionalFile(importedRegistryPath);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ImportedToolEntry[] : [];
  } catch {
    return [];
  }
}

async function writeImportedToolRegistry(entries: ImportedToolEntry[]): Promise<void> {
  await mkdir(importedToolsRoot, { recursive: true });
  await writeFile(importedRegistryPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

async function writeImportedToolMetadata(destinationPath: string, entry: ImportedToolEntry): Promise<void> {
  await writeFile(path.join(destinationPath, toolImportMetadataFileName), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

async function upsertImportedToolEntry(entry: ImportedToolEntry): Promise<void> {
  const entries = await readImportedToolRegistry();
  const nextEntries = entries.filter(existing => existing.id !== entry.id);
  nextEntries.unshift(entry);
  await writeImportedToolRegistry(nextEntries.slice(0, 200));
}

async function cloneToTemporaryDirectory(repositoryUrl: string, slug: string): Promise<string> {
  await mkdir(importedTempRoot, { recursive: true });
  const tempPath = path.join(importedTempRoot, `${slug}-${Date.now().toString(36)}`);
  await cloneRepository(repositoryUrl, tempPath);
  return tempPath;
}

function resolveDestinationPath(slug: string, toolType: ImportedToolType): string {
  return toolType === "web"
    ? path.join(importedWebRoot, slug)
    : path.join(importedDesktopRoot, slug);
}

function buildImportedToolOpenUrl(entry: { slug: string; toolType: ImportedToolType; browserReady: boolean; }): string | null {
  if (entry.toolType !== "web" || !entry.browserReady) {
    return null;
  }
  return `/tools/imported/${encodeURIComponent(entry.slug)}/index.html`;
}

async function finalizeImportedTool(tempPath: string, slug: string, toolType: ImportedToolType, analysis: ToolImportAnalysis, repoUrl: string, repoRef: string): Promise<ImportedToolEntry> {
  const destinationPath = resolveDestinationPath(slug, toolType);
  const managedRoot = toolType === "web" ? importedWebRoot : importedDesktopRoot;
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await removeDirectoryIfPresent(managedRoot, destinationPath);
  await rename(tempPath, destinationPath);

  let browserReady = false;
  if (toolType === "web") {
    const webEntry = analysis.webIndexCandidates[0] || "";
    if (webEntry) {
      if (webEntry.toLowerCase() !== "index.html") {
        await createWebEntryWrapperIfNeeded(destinationPath, webEntry);
      }
      browserReady = true;
    }
  }

  const entry: ImportedToolEntry = {
    id: buildImportedToolId(toolType, slug),
    title: analysis.title,
    description: analysis.description,
    repoUrl,
    repoRef,
    slug,
    toolType,
    importedAt: new Date().toISOString(),
    destinationPath: path.resolve(destinationPath),
    openUrl: buildImportedToolOpenUrl({ slug, toolType, browserReady }),
    browserReady,
    readmeFound: analysis.readmeFound,
    readmeSummary: analysis.readmeSummary,
    buildInstructions: analysis.buildInstructions,
    launcherCandidates: analysis.launcherCandidates.map(candidate => ({
      absolutePath: path.join(destinationPath, candidate.relativePath),
      label: candidate.label,
      relativePath: candidate.relativePath
    })),
    notes: [
      ...analysis.notes,
      ...(toolType === "web" && !browserReady ? ["No index.html entry was found yet. Build the repo first if it generates a web app."] : [])
    ]
  };
  await writeImportedToolMetadata(destinationPath, entry);
  await upsertImportedToolEntry(entry);
  return entry;
}

async function listImportedToolRepositories(): Promise<ImportedToolEntry[]> {
  const entries = await readImportedToolRegistry();
  const visibleEntries: ImportedToolEntry[] = [];
  for (const entry of entries) {
    const destinationPath = normalizeText(entry.destinationPath);
    if (!destinationPath) {
      continue;
    }
    try {
      const destinationStat = await stat(destinationPath);
      if (!destinationStat.isDirectory()) {
        continue;
      }
      visibleEntries.push(entry);
    } catch {
      continue;
    }
  }
  return visibleEntries;
}

async function fetchLatestGithubRelease(repositoryInput: string): Promise<GithubLatestReleasePayload> {
  const normalizedRepository = normalizeGithubRepositoryInput(repositoryInput);
  const apiUrl = `https://api.github.com/repos/${normalizedRepository.owner}/${normalizedRepository.repo}/releases/latest`;
  const payload = await fetchJson<any>(apiUrl, {
    headers: {
      "accept": "application/vnd.github+json",
      "user-agent": "URageStudio-ToolsDashboard"
    }
  });
  const assets = Array.isArray(payload?.assets) ? payload.assets : [];
  return {
    repoUrl: normalizedRepository.repoUrl,
    repoRef: normalizedRepository.repoRef,
    tagName: normalizeText(payload?.tag_name) || "latest",
    releaseName: normalizeText(payload?.name) || normalizeText(payload?.tag_name) || "Latest Release",
    publishedAt: normalizeText(payload?.published_at),
    body: normalizeText(payload?.body),
    assets: assets
      .map((asset: any) => ({
        name: normalizeText(asset?.name),
        size: Number.isFinite(asset?.size) ? Number(asset.size) : 0,
        downloadUrl: normalizeText(asset?.browser_download_url),
        contentType: normalizeText(asset?.content_type) || "application/octet-stream"
      }))
      .filter((asset: GithubReleaseAsset) => asset.name && asset.downloadUrl)
  };
}

async function downloadLatestGithubReleaseAsset(repositoryInput: string, assetName: string | null): Promise<DownloadedGithubReleaseAsset> {
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
  const destinationDirectory = path.join(downloadedReleaseRoot, normalizedRepository.slug, safeTag);
  await mkdir(destinationDirectory, { recursive: true });
  const destinationPath = path.join(destinationDirectory, safeAssetName);
  await downloadBinary(selectedAsset.downloadUrl, destinationPath);
  const extension = path.extname(safeAssetName).toLowerCase();
  const autoPinnable = supportedDesktopToolExtensions.has(extension);
  return {
    repoUrl: normalizedRepository.repoUrl,
    repoRef: normalizedRepository.repoRef,
    slug: normalizedRepository.slug,
    tagName: release.tagName,
    releaseName: release.releaseName,
    publishedAt: release.publishedAt,
    assetName: selectedAsset.name,
    downloadPath: path.resolve(destinationPath),
    autoPinnable,
    notes: autoPinnable
      ? ["This release asset can be pinned directly as a desktop tool."]
      : ["This release asset was downloaded locally. If it is an archive, extract it before pinning a launcher."]
  };
}

async function importToolRepositoryFromGithub(repositoryInput: string, requestedType: ImportedToolType | null): Promise<ImportedToolEntry> {
  const normalizedRepository = normalizeGithubRepositoryInput(repositoryInput);
  let tempPath = "";
  try {
    tempPath = await cloneToTemporaryDirectory(normalizedRepository.repoUrl, normalizedRepository.slug);
    const analysis = await analyzeRepository(tempPath, normalizedRepository.repo);
    const detectedType = detectToolType(requestedType, analysis);
    if (!detectedType) {
      throw new ToolImportTypeRequiredError("This repo could not be classified clearly. Choose Web or Desktop and import it again.", {
        title: analysis.title,
        description: analysis.description,
        repoUrl: normalizedRepository.repoUrl,
        repoRef: normalizedRepository.repoRef,
        notes: analysis.notes.length > 0 ? analysis.notes : ["Automatic detection did not find a strong web or desktop signal."]
      });
    }
    const importedEntry = await finalizeImportedTool(
      tempPath,
      normalizedRepository.slug,
      detectedType,
      analysis,
      normalizedRepository.repoUrl,
      normalizedRepository.repoRef
    );
    tempPath = "";
    return importedEntry;
  } finally {
    if (tempPath) {
      await removeDirectoryIfPresent(importedTempRoot, tempPath).catch(() => {});
    }
  }
}

function isToolImportTypeRequiredError(error: unknown): error is ToolImportTypeRequiredError {
  return error instanceof ToolImportTypeRequiredError;
}

function isReleaseAssetSelectionRequiredError(error: unknown): error is ReleaseAssetSelectionRequiredError {
  return error instanceof ReleaseAssetSelectionRequiredError;
}

export {
  downloadLatestGithubReleaseAsset,
  fetchLatestGithubRelease,
  importToolRepositoryFromGithub,
  isReleaseAssetSelectionRequiredError,
  isToolImportTypeRequiredError,
  listImportedToolRepositories
};
export type {
  DownloadedGithubReleaseAsset,
  GithubLatestReleasePayload,
  ImportedToolEntry,
  ImportedToolType,
  ReleaseAssetSelectionPayload,
  ToolImportTypeChoicePayload
};
