import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AutomationTextSourceSelectionMode } from "@urage/shared/automation/types";
import type { TextSourcePreview, TextSourceSummary } from "@urage/shared/automation/textSources";
import { appConfig } from "../config/appConfig.js";

const dataDirectory = path.resolve(appConfig.dataDirectory);
const selectionStatePath = path.join(dataDirectory, "text-source-selection-state.json");

interface TextSourceSelectionEntry {
  id: string;
  fileName: string;
  text: string;
}

interface TextSourceSelectionPoolState {
  signature: string;
  remainingEntryIds: string[];
  lastPickedText: string;
  updatedAt: string;
}

interface TextSourceSelectionState {
  pools: Record<string, TextSourceSelectionPoolState>;
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  const normalized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!normalized) throw new Error("A file name is required.");
  return normalized.toLowerCase().endsWith(".txt") ? normalized : `${normalized}.txt`;
}

async function ensureDataDirectory(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
}

function resolveTextFilePath(fileName: string): string {
  return path.join(dataDirectory, sanitizeFileName(fileName));
}

function pickRandomEntry<T>(entries: T[]): T {
  const index = Math.floor(Math.random() * entries.length);
  const picked = entries[index];
  return picked !== undefined ? picked : entries[0] as T;
}

function getSelectionPoolKey(fileNames: string[]): string {
  return fileNames.map(sanitizeFileName).sort((left, right) => left.localeCompare(right)).join("|");
}

function getSelectionPoolSignature(entries: TextSourceSelectionEntry[]): string {
  const hash = createHash("sha1");
  for (const entry of entries) {
    hash.update(entry.fileName);
    hash.update("\0");
    hash.update(entry.id);
    hash.update("\0");
    hash.update(entry.text);
    hash.update("\n");
  }
  return hash.digest("hex");
}

async function readTextSourceSelectionState(): Promise<TextSourceSelectionState> {
  await ensureDataDirectory();
  const raw = await readFile(selectionStatePath, "utf8").catch(() => "");
  if (!raw) return { pools: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<TextSourceSelectionState> | null;
    return typeof parsed === "object" && parsed && typeof parsed.pools === "object" && parsed.pools
      ? { pools: parsed.pools as Record<string, TextSourceSelectionPoolState> }
      : { pools: {} };
  } catch {
    return { pools: {} };
  }
}

async function writeTextSourceSelectionState(state: TextSourceSelectionState): Promise<void> {
  await ensureDataDirectory();
  await writeFile(selectionStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function readAutomationTextSourceEntries(fileNames: string[]): Promise<TextSourceSelectionEntry[]> {
  const normalizedFileNames = fileNames.map(entry => entry.trim()).filter(Boolean);
  const entries = await Promise.all(normalizedFileNames.map(async fileName => {
    const sanitizedFileName = sanitizeFileName(fileName);
    const lines = await readAutomationTextSourceLines(sanitizedFileName);
    return lines.map((text, index) => ({ id: `${sanitizedFileName}:${index}`, fileName: sanitizedFileName, text }));
  }));
  return entries.flat();
}

async function readNoRepeatAutomationTextSourceLine(fileNames: string[]): Promise<string> {
  const entries = await readAutomationTextSourceEntries(fileNames);
  if (entries.length === 0) {
    const [firstFileName] = fileNames;
    throw new Error(`No non-empty lines found in ${sanitizeFileName(firstFileName ?? "")}.`);
  }
  const state = await readTextSourceSelectionState();
  const poolKey = getSelectionPoolKey(fileNames);
  const signature = getSelectionPoolSignature(entries);
  const savedPool = state.pools[poolKey];
  const validRemainingIds = savedPool?.signature === signature
    ? new Set(savedPool.remainingEntryIds.filter(Boolean))
    : new Set(entries.map(entry => entry.id));
  const availableEntries = entries.filter(entry => validRemainingIds.has(entry.id));
  let candidates = availableEntries.length > 0 ? availableEntries : entries;
  if (availableEntries.length === 0 && savedPool?.lastPickedText) {
    const withoutLastPickedText = entries.filter(entry => entry.text !== savedPool.lastPickedText);
    if (withoutLastPickedText.length > 0) candidates = withoutLastPickedText;
  }
  const picked = pickRandomEntry(candidates);
  const nextRemainingEntryIds = (availableEntries.length > 0 ? availableEntries : entries)
    .filter(entry => entry.id !== picked.id)
    .map(entry => entry.id);
  state.pools[poolKey] = {
    signature,
    remainingEntryIds: nextRemainingEntryIds,
    lastPickedText: picked.text,
    updatedAt: new Date().toISOString()
  };
  await writeTextSourceSelectionState(state);
  return picked.text;
}

export async function readAutomationTextSourceLines(fileName: string): Promise<string[]> {
  const fullPath = resolveTextFilePath(fileName);
  await ensureDataDirectory();
  const raw = await readFile(fullPath, "utf8");
  return raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

export async function readAutomationTextSourceLine(fileName: string, mode: AutomationTextSourceSelectionMode = "random"): Promise<string> {
  return readAutomationTextSourceLineFromFiles([fileName], mode);
}

export async function readAutomationTextSourceLineFromFiles(
  fileNames: string[],
  mode: AutomationTextSourceSelectionMode = "random"
): Promise<string> {
  const normalizedFileNames = fileNames.map(entry => entry.trim()).filter(Boolean);
  if (normalizedFileNames.length === 0) throw new Error("At least one text source file is required.");
  if (mode === "no-repeat") return readNoRepeatAutomationTextSourceLine(normalizedFileNames);
  const entries = await readAutomationTextSourceEntries(normalizedFileNames);
  if (entries.length === 0) {
    throw new Error(`No non-empty lines found in ${sanitizeFileName(normalizedFileNames[0] ?? "")}.`);
  }
  return pickRandomEntry(entries).text;
}

export async function readRandomAutomationTextSourceLine(fileName: string): Promise<string> {
  return readAutomationTextSourceLine(fileName, "random");
}

export async function listAutomationTextSources(): Promise<TextSourceSummary[]> {
  await ensureDataDirectory();
  const entries = await readdir(dataDirectory, { withFileTypes: true });
  const summaries: TextSourceSummary[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".txt")) continue;
    const fullPath = path.join(dataDirectory, entry.name);
    const raw = await readFile(fullPath, "utf8").catch(() => "");
    const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const fileStat = await stat(fullPath);
    summaries.push({ fileName: entry.name, fullPath, lineCount: lines.length, updatedAt: fileStat.mtime.toISOString() });
  }
  return summaries.sort((left, right) => left.fileName.localeCompare(right.fileName));
}

async function readTextSourcePreviewLines(fullPath: string, maxLines: number): Promise<{ lines: string[]; truncated: boolean }> {
  const lines: string[] = [];
  let pending = "";
  let truncated = false;
  readLoop:
  for await (const chunk of createReadStream(fullPath, { encoding: "utf8" })) {
    pending += chunk;
    const parts = pending.split("\n");
    pending = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.replace(/\r$/, "").trim();
      if (!line) continue;
      if (lines.length >= maxLines) {
        truncated = true;
        break readLoop;
      }
      lines.push(line);
    }
  }
  const finalLine = pending.replace(/\r$/, "").trim();
  if (!truncated && finalLine) {
    if (lines.length >= maxLines) truncated = true;
    else lines.push(finalLine);
  }
  return { lines, truncated };
}

export async function readAutomationTextSourcePreview(input: { fileName: string; maxLines?: number; }): Promise<TextSourcePreview> {
  const fullPath = resolveTextFilePath(input.fileName);
  await ensureDataDirectory();
  const limit = Math.min(Math.max(Math.trunc(input.maxLines ?? 24), 1), 200);
  const preview = await readTextSourcePreviewLines(fullPath, limit);
  const fileStat = await stat(fullPath);
  return {
    fileName: path.basename(fullPath),
    fullPath,
    updatedAt: fileStat.mtime.toISOString(),
    content: preview.lines.join("\n"),
    previewLines: preview.lines,
    previewLineCount: preview.lines.length,
    truncated: preview.truncated
  };
}

export async function saveAutomationTextSource(input: { fileName: string; content: string; mode: "append" | "replace"; }): Promise<TextSourceSummary> {
  const fullPath = resolveTextFilePath(input.fileName);
  await ensureDataDirectory();
  const normalizedLines = input.content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (normalizedLines.length === 0) throw new Error("No generated lines to save.");
  let nextLines = normalizedLines;
  if (input.mode === "append") {
    const existing = await readFile(fullPath, "utf8").catch(() => "");
    nextLines = existing.split(/\r?\n/).map(line => line.trim()).filter(Boolean).concat(normalizedLines);
  }
  await writeFile(fullPath, `${nextLines.join("\n")}\n`, "utf8");
  const [summary] = (await listAutomationTextSources()).filter(entry => entry.fileName === path.basename(fullPath));
  if (!summary) throw new Error("Saved the text file, but could not reload its summary.");
  return summary;
}

export async function saveGeneratedAutomationText(input: { fileName: string; content: string; mode: "append" | "replace"; }): Promise<TextSourceSummary> {
  return saveAutomationTextSource(input);
}
