import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";
import { toolsRoot } from "@urage/server/config/repositoryPaths";

export type ToolCategoryDefinition = {
  id: string;
  label: string;
  icon: string;
  description: string;
  preset: boolean;
  hidden: boolean;
  assignedToolCount: number;
};

export type ToolCatalogMetadata = {
  categories: ToolCategoryDefinition[];
  toolTags: Record<string, string[]>;
  tags: string[];
  tagColors: Record<string, string>;
};

type StoredToolCatalogMetadata = {
  categories: ToolCategoryDefinition[];
  toolTags: Record<string, string[]>;
  tagColors: Record<string, string>;
};

const presetDirectory = path.join(toolsRoot, "categories");
const metadataPath = path.join(appConfig.dataDirectory, "tool-catalog-metadata.json");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let mutationQueue = Promise.resolve();

function normalizeText(value: unknown, maxLength: number): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeCategory(value: unknown, preset: boolean): ToolCategoryDefinition | null {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const id = normalizeText(record.id, 64).toLowerCase();
  const label = normalizeText(record.label, 80);
  if (!slugPattern.test(id) || !label) return null;
  return {
    id,
    label,
    icon: normalizeText(record.icon, 48) || "grid",
    description: normalizeText(record.description, 240),
    preset,
    hidden: record.hidden === true,
    assignedToolCount: 0
  };
}

function normalizeTag(value: unknown): string {
  return normalizeText(value, 40).replace(/^#+/, "");
}

function normalizeTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return values.flatMap(item => {
    const tag = normalizeTag(item);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) return [];
    seen.add(key);
    return [tag];
  }).slice(0, 30);
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readPresetCategories(): ToolCategoryDefinition[] {
  try {
    return readdirSync(presetDirectory, {withFileTypes: true})
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => normalizeCategory(readJsonFile(path.join(presetDirectory, entry.name)), true))
      .filter((entry): entry is ToolCategoryDefinition => Boolean(entry));
  } catch {
    return [];
  }
}

function readStoredMetadata(): StoredToolCatalogMetadata {
  const record = existsSync(metadataPath) && readJsonFile(metadataPath);
  const source = record && typeof record === "object" ? record as Record<string, unknown> : {};
  const categories = (Array.isArray(source.categories) ? source.categories : [])
    .map(entry => normalizeCategory(entry, false))
    .filter((entry): entry is ToolCategoryDefinition => Boolean(entry));
  const rawToolTags = source.toolTags && typeof source.toolTags === "object"
    ? source.toolTags as Record<string, unknown>
    : {};
  const toolTags = Object.fromEntries(
    Object.entries(rawToolTags)
      .map(([toolId, tags]) => [normalizeText(toolId, 140), normalizeTags(tags)] as const)
      .filter(([toolId, tags]) => Boolean(toolId) && tags.length > 0)
  );
  const rawTagColors = source.tagColors && typeof source.tagColors === "object"
    ? source.tagColors as Record<string, unknown>
    : {};
  const tagColors = Object.fromEntries(Object.entries(rawTagColors)
    .map(([tag, color]) => [normalizeTag(tag), String(color || "").trim()] as const)
    .filter(([tag, color]) => Boolean(tag) && /^#[0-9a-f]{6}$/i.test(color)));
  return {categories, toolTags, tagColors};
}

function mergeCategories(stored: StoredToolCatalogMetadata): ToolCategoryDefinition[] {
  const merged = new Map(readPresetCategories().map(category => [category.id, category]));
  stored.categories.forEach(category => {
    const preset = merged.get(category.id);
    merged.set(category.id, preset
      ? {...preset, ...category, preset: true}
      : category);
  });
  for (const category of merged.values()) {
    category.assignedToolCount = countAssignedTools(category.id);
  }
  return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function countAssignedTools(categoryId: string): number {
  const directory = path.join(toolsRoot, categoryId);
  try {
    return readdirSync(directory, {withFileTypes: true})
      .filter(entry => entry.isDirectory() && existsSync(path.join(directory, entry.name, "index.html")))
      .length;
  } catch {
    return 0;
  }
}

export function getToolCatalogMetadata(): ToolCatalogMetadata {
  const stored = readStoredMetadata();
  const tags = Array.from(new Set(Object.values(stored.toolTags).flat()))
    .sort((a, b) => a.localeCompare(b));
  return {categories: mergeCategories(stored), toolTags: stored.toolTags, tags, tagColors: stored.tagColors};
}

async function saveStoredMetadata(metadata: StoredToolCatalogMetadata): Promise<void> {
  await mkdir(path.dirname(metadataPath), {recursive: true});
  const temporaryPath = `${metadataPath}.${randomBytes(5).toString("hex")}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
  await rename(temporaryPath, metadataPath);
}

function mutateMetadata(mutation: (metadata: StoredToolCatalogMetadata) => void): Promise<ToolCatalogMetadata> {
  const operation = mutationQueue.then(async () => {
    const metadata = readStoredMetadata();
    mutation(metadata);
    await saveStoredMetadata(metadata);
    return getToolCatalogMetadata();
  });
  mutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function upsertToolCategory(value: unknown): Promise<ToolCatalogMetadata> {
  const category = normalizeCategory(value, false);
  if (!category) throw new Error("Category id must use kebab-case and label is required.");
  return mutateMetadata(metadata => {
    metadata.categories = metadata.categories.filter(entry => entry.id !== category.id);
    metadata.categories.push(category);
  });
}

export function changeToolCategoryVisibility(categoryIdValue: unknown, hiddenValue: unknown, confirmAssigned = false): Promise<ToolCatalogMetadata> {
  const categoryId = normalizeText(categoryIdValue, 64).toLowerCase();
  const current = getToolCatalogMetadata().categories.find(category => category.id === categoryId);
  if (!current) throw new Error("Category does not exist.");
  if (hiddenValue === true && current.assignedToolCount > 0 && !confirmAssigned) {
    throw new Error(`Category contains ${current.assignedToolCount} tool(s). Confirm hiding assigned tools.`);
  }
  return mutateMetadata(metadata => {
    metadata.categories = metadata.categories.filter(category => category.id !== categoryId);
    metadata.categories.push({...current, hidden: hiddenValue === true, preset: false, assignedToolCount: 0});
  });
}

export function deleteToolCategory(categoryIdValue: unknown): Promise<ToolCatalogMetadata> {
  const categoryId = normalizeText(categoryIdValue, 64).toLowerCase();
  const current = getToolCatalogMetadata().categories.find(category => category.id === categoryId);
  if (!current) throw new Error("Category does not exist.");
  if (current.assignedToolCount > 0) throw new Error(`Move ${current.assignedToolCount} assigned tool(s) before deleting this category.`);
  if (current.preset) throw new Error("Preset categories cannot be deleted; hide the preset instead.");
  return mutateMetadata(metadata => {
    metadata.categories = metadata.categories.filter(category => category.id !== categoryId);
  });
}

export function setToolTags(toolIdValue: unknown, tagsValue: unknown): Promise<ToolCatalogMetadata> {
  const toolId = normalizeText(toolIdValue, 140);
  if (!toolId) throw new Error("toolId is required.");
  return mutateMetadata(metadata => {
    const tags = normalizeTags(tagsValue);
    if (tags.length > 0) metadata.toolTags[toolId] = tags;
    else delete metadata.toolTags[toolId];
  });
}

export function updateToolTagsBulk(toolIdsValue: unknown, tagsValue: unknown, modeValue: unknown): Promise<ToolCatalogMetadata> {
  const toolIds = Array.isArray(toolIdsValue)
    ? Array.from(new Set(toolIdsValue.map(value => normalizeText(value, 140)).filter(Boolean))).slice(0, 100)
    : [];
  const tags = normalizeTags(tagsValue);
  const mode = modeValue === "add" || modeValue === "remove" ? modeValue : "set";
  if (toolIds.length === 0) throw new Error("Select at least one tool.");
  return mutateMetadata(metadata => {
    toolIds.forEach(toolId => {
      const current = metadata.toolTags[toolId] || [];
      const next = mode === "add"
        ? normalizeTags([...current, ...tags])
        : mode === "remove"
          ? current.filter(tag => !new Set(tags.map(value => value.toLocaleLowerCase())).has(tag.toLocaleLowerCase()))
          : tags;
      if (next.length > 0) metadata.toolTags[toolId] = next;
      else delete metadata.toolTags[toolId];
    });
  });
}

export function setToolTagColor(tagValue: unknown, colorValue: unknown): Promise<ToolCatalogMetadata> {
  const tag = normalizeTag(tagValue);
  const color = String(colorValue || "").trim();
  if (!tag || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Choose a tag and a six-digit hex color.");
  return mutateMetadata(metadata => {
    metadata.tagColors[tag] = color.toLowerCase();
  });
}

export function moveToolMetadata(sourceToolId: string, destinationToolId: string): Promise<ToolCatalogMetadata> {
  return mutateMetadata(metadata => {
    if (metadata.toolTags[sourceToolId]) {
      metadata.toolTags[destinationToolId] = metadata.toolTags[sourceToolId];
      delete metadata.toolTags[sourceToolId];
    }
  });
}

export function renameToolTag(fromValue: unknown, toValue: unknown): Promise<ToolCatalogMetadata> {
  const from = normalizeTag(fromValue);
  const to = normalizeTag(toValue);
  if (!from || !to) throw new Error("Current and replacement tag names are required.");
  return mutateMetadata(metadata => {
    for (const [toolId, tags] of Object.entries(metadata.toolTags)) {
      metadata.toolTags[toolId] = normalizeTags(tags.map(tag => tag.localeCompare(from, undefined, {sensitivity: "accent"}) === 0 ? to : tag));
    }
    const colorEntry = Object.entries(metadata.tagColors).find(([tag]) => tag.localeCompare(from, undefined, {sensitivity: "accent"}) === 0);
    if (colorEntry) {
      delete metadata.tagColors[colorEntry[0]];
      metadata.tagColors[to] = colorEntry[1];
    }
  });
}

export function removeToolTag(tagValue: unknown): Promise<ToolCatalogMetadata> {
  const target = normalizeTag(tagValue).toLocaleLowerCase();
  if (!target) throw new Error("tag is required.");
  return mutateMetadata(metadata => {
    for (const [toolId, tags] of Object.entries(metadata.toolTags)) {
      const next = tags.filter(tag => tag.toLocaleLowerCase() !== target);
      if (next.length > 0) metadata.toolTags[toolId] = next;
      else delete metadata.toolTags[toolId];
    }
    Object.keys(metadata.tagColors)
      .filter(tag => tag.toLocaleLowerCase() === target)
      .forEach(tag => delete metadata.tagColors[tag]);
  });
}
