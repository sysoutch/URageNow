import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { dashboardChatSkillsRoot, toolsRoot } from "@urage/server/config/repositoryPaths";
import {
  type ChatSkillDefinition,
  type ChatSkillMetadata,
  type LocalToolDefinition,
  defaultChatSkillMetadata,
  describeChatSkillCapabilities,
  normalizeChatSkillId,
  normalizeChatSkillInputMode,
  normalizeChatSkillOutputKind
} from "./types.js";

const chatSkillsDirectoryCandidates = [dashboardChatSkillsRoot];
const toolsRootDirectoryCandidates = [toolsRoot];
const chatSkillShortcutIds = [
  "generate-image",
  "generate-model",
  "generate-autorig",
  "generate-lowpoly",
  "generate-video",
  "generate-audio",
  "generate-music",
  "remove-background",
  "delight-image",
  "create-normal-map",
  "create-pixel-art",
  "regenerate-image-filename",
  "regenerate-model-filename",
  "suggest-model-metadata",
  "suggest-lowpoly-target",
  "comfy-free-memory",
  "add-cron-job",
  "add-cron-job-discord",
  "add-cron-job-telegram"
] as const;
const chatSkillShortcutPattern = new RegExp(`^\\/(${chatSkillShortcutIds.join("|")})\\b`, "i");
const chatSkillShortcutPrefixPattern = new RegExp(`^\\/(${chatSkillShortcutIds.join("|")})\\s*`, "i");

function extractChatSkillName(content: string, fallbackId: string): string {
  const headingLine = content.split(/\r?\n/).find(line => /^#\s+/.test(line.trim()));
  if (headingLine) {
    return headingLine.replace(/^#\s+/, "").trim() || fallbackId;
  }
  return fallbackId;
}

function extractChatSkillDescription(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^#/.test(line));
  return lines[0] || "No description.";
}

function parseChatSkillMetadataValue(value: string): string | boolean {
  const normalized = String(value || "").trim();
  if (/^(true|false)$/i.test(normalized)) {
    return normalized.toLowerCase() === "true";
  }
  return normalized;
}

function parseChatSkillAllowedFollowUps(value: string): string[] {
  return String(value || "")
    .split(",")
    .map(entry => normalizeChatSkillId(entry))
    .filter(Boolean);
}

function parseChatSkillFile(rawContent: string): { metadata: ChatSkillMetadata; content: string; } {
  const raw = String(rawContent || "").trim();
  if (!raw.startsWith("---")) {
    return { metadata: { ...defaultChatSkillMetadata }, content: raw };
  }
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { metadata: { ...defaultChatSkillMetadata }, content: raw };
  }
  const frontmatter = match[1] || "";
  const body = String(match[2] || "").trim();
  const metadata: ChatSkillMetadata = { ...defaultChatSkillMetadata };
  for (const line of frontmatter.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = parseChatSkillMetadataValue(line.slice(separatorIndex + 1).trim());
    if (key === "outputKind" && typeof value === "string") {
      metadata.outputKind = normalizeChatSkillOutputKind(value);
      continue;
    }
    if (key === "inputMode" && typeof value === "string") {
      metadata.inputMode = normalizeChatSkillInputMode(value);
      continue;
    }
    if (key === "supportsMultiple" && typeof value === "boolean") {
      metadata.supportsMultiple = value;
      continue;
    }
    if (key === "allowedFollowUps" && typeof value === "string") {
      metadata.allowedFollowUps = parseChatSkillAllowedFollowUps(value);
      continue;
    }
    if (key === "routerHint" && typeof value === "string") {
      metadata.routerHint = value.trim();
    }
  }
  return { metadata, content: body || raw };
}

export async function resolveChatSkillsDirectory(): Promise<string> {
  for (const candidate of chatSkillsDirectoryCandidates) {
    try {
      const entries = await readdir(candidate, { withFileTypes: true, encoding: "utf8" });
      if (entries.some(entry => entry.isDirectory())) {
        return candidate;
      }
    } catch {}
  }
  return dashboardChatSkillsRoot;
}

function toTitleCaseFromSlug(value: string): string {
  return String(value || "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractToolTitleFromHtml(rawHtml: string): string {
  const match = String(rawHtml || "").match(/<title>([^<]+)<\/title>/i);
  return match && match[1] ? String(match[1]).trim() : "";
}

function extractToolMetaDescriptionFromHtml(rawHtml: string): string {
  const raw = String(rawHtml || "");
  const match = raw.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i)
    || raw.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["'][^>]*>/i);
  return match && match[1] ? String(match[1]).trim() : "";
}

function cleanToolReadmeDescriptionLine(line: string): string {
  const value = String(line || "").trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("#")) {
    return "";
  }
  if (/^!\[[^\]]*\]\([^\)]+\)$/i.test(value)) {
    return "";
  }
  if (/^\[[^\]]*\]\([^\)]+\)$/i.test(value)) {
    return "";
  }
  if (/^`{3,}/.test(value) || /^-{3,}$/.test(value)) {
    return "";
  }
  return value.replace(/^[*-]\s*/, "").trim();
}

function extractToolReadmeMetadata(rawReadme: string): { title: string; description: string; } {
  const lines = String(rawReadme || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  let title = "";
  let description = "";
  for (const line of lines) {
    if (!title && line.startsWith("#")) {
      title = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    if (!description) {
      description = cleanToolReadmeDescriptionLine(line);
    }
    if (title && description) {
      break;
    }
  }
  return { title, description };
}

function buildToolFallbackDescription(title: string, categoryLabel: string, toolSlug: string): string {
  const readableSlug = toTitleCaseFromSlug(toolSlug).toLowerCase();
  const readableCategory = String(categoryLabel || "Tool").trim();
  return `${title} for ${readableCategory.toLowerCase()} workflows (${readableSlug}).`;
}

async function findToolCoverPath(toolDirectory: string, sourceDirectoryPath: string): Promise<string> {
  for (const fileName of ["thumbnail.png", "thumbnail.jpg", "thumbnail.jpeg", "thumbnail.webp"]) {
    try {
      if ((await stat(path.join(toolDirectory, fileName))).isFile()) {
        return `${sourceDirectoryPath}/${fileName}`;
      }
  } catch {}
  }
  return "/tools/shared/tool-cover.png";
}

export async function resolveToolsRootDirectory(): Promise<string | null> {
  for (const candidate of toolsRootDirectoryCandidates) {
    try {
      const entries = await readdir(candidate, { withFileTypes: true, encoding: "utf8" });
      if (entries.some(entry => entry.isDirectory())) {
        return candidate;
      }
    } catch {}
  }
  return null;
}

export async function loadChatSkillsFromDisk(): Promise<ChatSkillDefinition[]> {
  const rootDirectory = await resolveChatSkillsDirectory();
  let directoryEntries: Array<{ isDirectory: () => boolean; name: string }> = [];
  try {
    directoryEntries = await readdir(rootDirectory, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return [];
  }
  const skills: ChatSkillDefinition[] = [];
  for (const entry of directoryEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const rawId = normalizeChatSkillId(entry.name);
    if (!rawId) {
      continue;
    }
    const skillFilePath = path.join(rootDirectory, entry.name, "skill.md");
    let skillContent = "";
    try {
      skillContent = (await readFile(skillFilePath, "utf8")).trim();
    } catch {
      continue;
    }
    if (!skillContent) {
      continue;
    }
    const parsedSkill = parseChatSkillFile(skillContent);
    skills.push({
      id: rawId,
      name: extractChatSkillName(parsedSkill.content, rawId),
      description: extractChatSkillDescription(parsedSkill.content),
      content: parsedSkill.content,
      metadata: parsedSkill.metadata
    });
  }
  skills.sort((left, right) => left.id.localeCompare(right.id));
  return skills;
}

export async function loadLocalToolsFromDisk(): Promise<LocalToolDefinition[]> {
  const toolsRootDirectory = await resolveToolsRootDirectory();
  if (!toolsRootDirectory) {
    return [];
  }
  let categoryEntries: Array<{ isDirectory: () => boolean; name: string }> = [];
  try {
    categoryEntries = await readdir(toolsRootDirectory, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return [];
  }
  const localTools: LocalToolDefinition[] = [];
  for (const categoryEntry of categoryEntries) {
    if (!categoryEntry.isDirectory() || categoryEntry.name.startsWith(".")) {
      continue;
    }
    const category = categoryEntry.name;
    const categoryLabel = toTitleCaseFromSlug(category);
    const categoryDirectory = path.join(toolsRootDirectory, category);
    let toolEntries: Array<{ isDirectory: () => boolean; name: string }> = [];
    try {
      toolEntries = await readdir(categoryDirectory, { withFileTypes: true, encoding: "utf8" });
    } catch {
      continue;
    }
    for (const toolEntry of toolEntries) {
      if (!toolEntry.isDirectory() || toolEntry.name.startsWith(".")) {
        continue;
      }
      const toolSlug = toolEntry.name;
      const toolDirectory = path.join(categoryDirectory, toolSlug);
      const indexFilePath = path.join(toolDirectory, "index.html");
      try {
        await stat(indexFilePath);
      } catch {
        continue;
      }
      const readmePath = path.join(toolDirectory, "README.md");
      let rawHtml = "";
      let rawReadme = "";
      try {
        rawHtml = await readFile(indexFilePath, "utf8");
      } catch {
        continue;
      }
      try {
        rawReadme = await readFile(readmePath, "utf8");
      } catch {}
      const readmeMetadata = extractToolReadmeMetadata(rawReadme);
      const htmlTitle = extractToolTitleFromHtml(rawHtml);
      const htmlDescription = extractToolMetaDescriptionFromHtml(rawHtml);
      const fallbackTitle = toTitleCaseFromSlug(toolSlug);
      const title = readmeMetadata.title || htmlTitle || fallbackTitle;
      const description = readmeMetadata.description || htmlDescription || buildToolFallbackDescription(title, categoryLabel, toolSlug);
      const sourceDirectoryPath = `/tools/${encodeURIComponent(category)}/${encodeURIComponent(toolSlug)}`;
      localTools.push({
        id: `${category}__${toolSlug}`,
        category,
        categoryLabel,
        toolSlug,
        title,
        description,
        sourcePath: `${sourceDirectoryPath}/index.html`,
        coverPath: await findToolCoverPath(toolDirectory, sourceDirectoryPath)
      });
    }
  }
  localTools.sort((left, right) => {
    const categoryCompare = left.categoryLabel.localeCompare(right.categoryLabel);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }
    return left.title.localeCompare(right.title);
  });
  return localTools;
}

export function resolveRequestedChatSkillId(prompt: string, explicitSkillId: string): string {
  const normalizedExplicit = normalizeChatSkillId(explicitSkillId);
  if (normalizedExplicit) {
    return normalizedExplicit;
  }
  const trimmedPrompt = String(prompt || "").trim();
  if (!trimmedPrompt) {
    return "";
  }
  const explicitMatch = trimmedPrompt.match(/^\/skill\s+([a-z0-9-]+)/i);
  if (explicitMatch) {
    return normalizeChatSkillId(explicitMatch[1] || "");
  }
  const shortcutMatch = trimmedPrompt.match(chatSkillShortcutPattern);
  if (shortcutMatch) {
    return normalizeChatSkillId(shortcutMatch[1] || "");
  }
  return "";
}

export function stripChatSkillCommandPrefix(prompt: string): string {
  const trimmed = String(prompt || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed
    .replace(/^\/skill\s+[a-z0-9-]+\s*/i, "")
    .replace(chatSkillShortcutPrefixPattern, "")
    .trim();
}

export function hasChatSkill(skills: ChatSkillDefinition[], skillId: string): boolean {
  return skills.some(entry => entry.id === skillId);
}

export function buildChatSkillsCatalog(skills: ChatSkillDefinition[]): string {
  const validSkills = Array.isArray(skills) ? skills.filter(entry => entry && entry.id) : [];
  if (validSkills.length === 0) {
    return "No chat skills are currently loaded from disk.";
  }
  const lines = validSkills.map(skill => {
    const description = String(skill.description || "").trim() || "No description.";
    return `- ${skill.id}: ${description} [${describeChatSkillCapabilities(skill)}]`;
  });
  return lines.join("\n");
}

export function buildChatSkillRoutingHints(skills: ChatSkillDefinition[]): string {
  const lines = skills
    .filter(skill => skill && skill.id && String(skill.metadata.routerHint || "").trim())
    .map(skill => `- ${skill.id}: ${skill.metadata.routerHint}`);
  return lines.length > 0 ? lines.join("\n") : "No additional routing hints.";
}

export function buildLocalToolsCatalog(tools: LocalToolDefinition[]): string {
  const validTools = Array.isArray(tools) ? tools.filter(entry => entry && entry.id) : [];
  if (validTools.length === 0) {
    return "No local tools are currently available from tools/<category>/<tool>.";
  }
  const lines = validTools.map(tool => {
    const description = String(tool.description || "").trim() || "No description.";
    return `- ${tool.title} (${tool.categoryLabel}): ${description}`;
  });
  return lines.join("\n");
}
