import {randomBytes} from "node:crypto";
import {access, mkdir, readFile, rename, writeFile} from "node:fs/promises";
import path from "node:path";
import {toolsRoot} from "@urage/server/config/repositoryPaths";
import {getToolCatalogMetadata, moveToolMetadata} from "./toolCatalogMetadataStore.js";

const toolIdPattern = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:[a-z0-9_.-]*[a-z0-9])?)$/;
let moveQueue = Promise.resolve();

function resolveToolLocation(toolId: string): {categoryId: string; slug: string; directory: string} {
  const normalized = String(toolId || "").trim().toLowerCase().replaceAll("\\", "/");
  const match = normalized.match(toolIdPattern);
  if (!match) throw new Error("Choose a valid tool.");
  const categoryId = match[1]!;
  const slug = match[2]!;
  const directory = path.resolve(toolsRoot, categoryId, slug);
  if (!directory.startsWith(path.resolve(toolsRoot) + path.sep)) throw new Error("Tool path escaped the tools directory.");
  return {categoryId, slug, directory};
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function updateManifest(directory: string, destinationId: string): Promise<string | null> {
  const manifestPath = path.join(directory, "tool.json");
  if (!await pathExists(manifestPath)) return null;
  const original = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(original) as Record<string, unknown>;
  manifest.id = destinationId.replace("/", "__");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return original;
}

async function moveToolNow(toolId: string, destinationCategoryValue: string): Promise<{
  sourceToolId: string;
  destinationToolId: string;
}> {
  const source = resolveToolLocation(toolId);
  const destinationCategory = String(destinationCategoryValue || "").trim().toLowerCase();
  const category = getToolCatalogMetadata().categories.find(entry => entry.id === destinationCategory);
  if (!category || category.hidden) throw new Error("Choose a visible destination category.");
  if (destinationCategory === source.categoryId) throw new Error("The tool is already in that category.");
  const destinationToolId = `${destinationCategory}/${source.slug}`;
  const destination = resolveToolLocation(destinationToolId);
  if (!await pathExists(source.directory)) throw new Error("The source tool no longer exists.");
  if (await pathExists(destination.directory)) throw new Error(`A tool already exists at ${destinationToolId}.`);

  await mkdir(path.dirname(destination.directory), {recursive: true});
  const temporary = path.join(path.dirname(source.directory), `.${source.slug}.${randomBytes(6).toString("hex")}.urage-move`);
  let manifestOriginal: string | null = null;
  let finalMoved = false;
  await rename(source.directory, temporary);
  try {
    manifestOriginal = await updateManifest(temporary, destinationToolId);
    await rename(temporary, destination.directory);
    finalMoved = true;
    await moveToolMetadata(source.categoryId + "__" + source.slug, destinationCategory + "__" + source.slug);
  } catch (error) {
    const rollbackSource = finalMoved ? destination.directory : temporary;
    if (manifestOriginal !== null && await pathExists(rollbackSource)) {
      await writeFile(path.join(rollbackSource, "tool.json"), manifestOriginal, "utf8");
    }
    if (await pathExists(rollbackSource)) await rename(rollbackSource, source.directory);
    throw error;
  }
  return {sourceToolId: `${source.categoryId}/${source.slug}`, destinationToolId};
}

export function moveToolToCategory(toolId: string, destinationCategory: string): Promise<{
  sourceToolId: string;
  destinationToolId: string;
}> {
  const operation = moveQueue.then(() => moveToolNow(toolId, destinationCategory));
  moveQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
