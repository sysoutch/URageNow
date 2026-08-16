import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";
import { toolsRoot } from "@urage/server/config/repositoryPaths";
import { auditToolScaffoldFiles, type ToolScaffoldAudit } from "./toolScaffoldManager.js";
import { buildToolFileDiff, type ToolFileDiff } from "./toolFileDiff.js";

const editableExtensions = new Set([".html", ".css", ".js", ".mjs", ".json", ".md", ".txt"]);
const maxFileBytes = 512 * 1024;
const maxPlanContextCharacters = 180_000;

type ToolEditPlan = {
  summary: string;
  files: Record<string, string>;
};

type StagedToolEdit = {
  id: string;
  toolId: string;
  createdAt: string;
  originalHashes: Record<string, string>;
  files: Record<string, string>;
  diffs: ToolFileDiff[];
  audit: ToolScaffoldAudit[];
};

const stageRoot = path.resolve(appConfig.dataDirectory, "tool-edit-stages");
const transactionRoot = path.resolve(appConfig.dataDirectory, "tool-edit-transactions");

function resolveToolDirectory(toolId: string): string {
  const normalized = String(toolId || "").trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(normalized)) throw new Error("Choose a valid category/tool directory.");
  const root = path.resolve(toolsRoot);
  const directory = path.resolve(root, normalized);
  if (!directory.startsWith(root + path.sep)) throw new Error("Tool path must stay inside the tools directory.");
  return directory;
}

function resolveEditableFile(directory: string, fileName: string): string {
  const normalized = String(fileName || "").trim().replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || !editableExtensions.has(path.extname(normalized).toLowerCase())) {
    throw new Error("Only existing tool text files can be edited.");
  }
  const target = path.resolve(directory, normalized);
  if (!target.startsWith(directory + path.sep)) throw new Error("Edited files must stay inside the selected tool.");
  return target;
}

async function listEditableFileNames(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.filter(entry => entry.isFile() && editableExtensions.has(path.extname(entry.name).toLowerCase()))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function listEditableTools(): Promise<Array<{ id: string; title: string; files: string[] }>> {
  const root = path.resolve(toolsRoot);
  const categories = await readdir(root, { withFileTypes: true });
  const tools = [];
  for (const category of categories.filter(entry => entry.isDirectory() && !entry.name.startsWith("."))) {
    const categoryDirectory = path.join(root, category.name);
    const entries = await readdir(categoryDirectory, { withFileTypes: true });
    for (const entry of entries.filter(candidate => candidate.isDirectory() && !candidate.name.startsWith("."))) {
      const directory = path.join(categoryDirectory, entry.name);
      const files = await listEditableFileNames(directory);
      if (!files.includes("index.html")) continue;
      let title = entry.name;
      try {
        const manifest = JSON.parse(await readFile(path.join(directory, "tool.json"), "utf8")) as { title?: string };
        title = String(manifest.title || title);
      } catch {
        // Legacy tools remain editable and receive explicit integration audit warnings.
      }
      tools.push({ id: `${category.name}/${entry.name}`, title, files });
    }
  }
  return tools.sort((left, right) => left.title.localeCompare(right.title));
}

export async function readEditableToolFile(toolId: string, fileName: string): Promise<{ toolId: string; fileName: string; content: string }> {
  const directory = resolveToolDirectory(toolId);
  const target = resolveEditableFile(directory, fileName);
  const stats = await stat(target);
  if (stats.size > maxFileBytes) throw new Error("That tool file is too large for the browser editor.");
  return { toolId, fileName, content: await readFile(target, "utf8") };
}

async function readToolFiles(toolId: string): Promise<Record<string, string>> {
  const directory = resolveToolDirectory(toolId);
  const files: Record<string, string> = {};
  let characters = 0;
  for (const fileName of await listEditableFileNames(directory)) {
    const content = await readFile(resolveEditableFile(directory, fileName), "utf8");
    characters += content.length;
    if (characters > maxPlanContextCharacters) throw new Error("The selected tool is too large for one LLM edit plan.");
    files[fileName] = content;
  }
  return files;
}

export function buildToolEditPrompt(toolId: string, request: string, files: Record<string, string>): string {
  return [
    "You are editing an existing URage NOW dashboard tool.",
    `Tool: ${toolId}`,
    `Requested change: ${request}`,
    "Return one JSON object only: {\"summary\":\"...\",\"files\":{\"relative-file-name\":\"complete replacement content\"}}.",
    "Include only files that must change. Do not use markdown fences.",
    "Preserve dashboard-theme.js, dashboard-current-output-autodescribe.js, dashboard-tool-bridge.js, __urageToolDescribeCurrentAsset, __urageToolLoadAssetPayload, tool.json, and README integration documentation.",
    "Never reference paths outside the selected tool.",
    "Current files:",
    ...Object.entries(files).map(([name, content]) => `--- ${name} ---\n${content}`)
  ].join("\n");
}

export function parseToolEditPlan(raw: string): ToolEditPlan {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LazyDev did not return a tool edit plan.");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { summary?: unknown; files?: unknown };
  if (!parsed.files || typeof parsed.files !== "object" || Array.isArray(parsed.files)) throw new Error("The tool edit plan has no files.");
  const files = Object.fromEntries(Object.entries(parsed.files).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  if (Object.keys(files).length === 0) throw new Error("The tool edit plan contains no text changes.");
  return { summary: String(parsed.summary || "LazyDev tool update"), files };
}

export async function planToolEdit(toolId: string, request: string, askModel: (prompt: string) => Promise<string>): Promise<ToolEditPlan & { audit: ToolScaffoldAudit[] }> {
  const existing = await readToolFiles(toolId);
  const plan = parseToolEditPlan(await askModel(buildToolEditPrompt(toolId, request, existing)));
  for (const fileName of Object.keys(plan.files)) {
    if (!Object.hasOwn(existing, fileName)) {
      throw new Error(`LazyDev proposed unknown file ${fileName}. Only existing tool files may be changed.`);
    }
  }
  const merged = { ...existing, ...plan.files };
  return { ...plan, audit: auditToolScaffoldFiles(merged) };
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function readStage(stageId: string): Promise<StagedToolEdit> {
  if (!/^[a-z0-9-]{12,80}$/i.test(stageId)) throw new Error("Invalid tool edit stage.");
  return JSON.parse(await readFile(path.join(stageRoot, `${stageId}.json`), "utf8")) as StagedToolEdit;
}

export async function stageToolEdit(toolId: string, changes: Record<string, string>): Promise<StagedToolEdit> {
  const directory = resolveToolDirectory(toolId);
  const existing = await readToolFiles(toolId);
  const entries = Object.entries(changes).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  if (entries.length === 0) throw new Error("No tool file changes were provided.");
  entries.forEach(([fileName, content]) => {
    if (!Object.hasOwn(existing, fileName)) throw new Error(`Tool file ${fileName} does not exist. Edit Tool cannot create arbitrary files.`);
    resolveEditableFile(directory, fileName);
    if (Buffer.byteLength(content, "utf8") > maxFileBytes) throw new Error(`Tool file ${fileName} exceeds the editor size limit.`);
  });
  const files = Object.fromEntries(entries);
  const merged = { ...existing, ...files };
  const stage: StagedToolEdit = {
    id: `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`,
    toolId,
    createdAt: new Date().toISOString(),
    originalHashes: Object.fromEntries(entries.map(([fileName]) => [fileName, hashContent(existing[fileName] ?? "")])),
    files,
    diffs: entries.map(([fileName, content]) => buildToolFileDiff(fileName, existing[fileName] ?? "", content)),
    audit: auditToolScaffoldFiles(merged)
  };
  await mkdir(stageRoot, { recursive: true });
  await writeFile(path.join(stageRoot, `${stage.id}.json`), JSON.stringify(stage, null, 2) + "\n", "utf8");
  return stage;
}

async function commitStagedFiles(stage: StagedToolEdit): Promise<void> {
  const directory = resolveToolDirectory(stage.toolId);
  const prepared: Array<{ fileName: string; target: string; temporary: string; rollback: string }> = [];
  const committed: Array<{ target: string; rollback: string }> = [];
  try {
    for (const [fileName, content] of Object.entries(stage.files)) {
      const target = resolveEditableFile(directory, fileName);
      const nonce = randomBytes(5).toString("hex");
      const temporary = path.join(directory, `.${fileName}.${nonce}.urage-stage`);
      const rollback = path.join(directory, `.${fileName}.${nonce}.urage-rollback`);
      await writeFile(temporary, content, "utf8");
      prepared.push({ fileName, target, temporary, rollback });
    }
    for (const file of prepared) {
      const currentHash = hashContent(await readFile(file.target, "utf8"));
      if (currentHash !== stage.originalHashes[file.fileName]) {
        throw new Error(`${file.fileName} changed during commit. The staged transaction was not applied.`);
      }
      await rename(file.target, file.rollback);
      try {
        await rename(file.temporary, file.target);
        committed.push({ target: file.target, rollback: file.rollback });
      } catch (error) {
        await rename(file.rollback, file.target);
        throw error;
      }
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const file of committed.reverse()) {
      try {
        await rm(file.target, { force: true });
        await rename(file.rollback, file.target);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
      }
    }
    if (rollbackErrors.length > 0) {
      throw new Error(`Tool edit failed and automatic rollback was incomplete: ${rollbackErrors.join("; ")}`);
    }
    throw error;
  } finally {
    await Promise.all(prepared.map(file => rm(file.temporary, { force: true }).catch(() => undefined)));
  }
  await Promise.all(committed.map(file => rm(file.rollback, { force: true }).catch(() => undefined)));
}

export async function applyStagedToolEdit(stageId: string): Promise<{
  transactionId: string;
  files: string[];
  audit: ToolScaffoldAudit[];
  backupDirectory: string;
}> {
  const stage = await readStage(stageId);
  const existing = await readToolFiles(stage.toolId);
  for (const [fileName, expectedHash] of Object.entries(stage.originalHashes)) {
    if (hashContent(existing[fileName] ?? "") !== expectedHash) {
      throw new Error(`${fileName} changed after staging. Review and stage the edit again.`);
    }
  }
  const toolId = stage.toolId;
  const entries = Object.entries(stage.files);
  const backupDirectory = path.resolve(appConfig.dataDirectory, "tool-edit-backups", toolId.replaceAll("/", "__"), new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(backupDirectory, { recursive: true });
  await Promise.all(entries.map(async ([fileName]) => {
    await writeFile(path.join(backupDirectory, fileName), existing[fileName] ?? "", "utf8");
  }));
  await commitStagedFiles(stage);
  const transactionId = stage.id;
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(path.join(transactionRoot, `${transactionId}.json`), JSON.stringify({
    transactionId,
    toolId,
    files: entries.map(([fileName]) => fileName),
    backupDirectory,
    appliedAt: new Date().toISOString()
  }, null, 2) + "\n", "utf8");
  await rm(path.join(stageRoot, `${stage.id}.json`), { force: true });
  return { transactionId, files: entries.map(([fileName]) => fileName), audit: stage.audit, backupDirectory };
}

export async function rollbackToolEdit(transactionId: string): Promise<Awaited<ReturnType<typeof applyStagedToolEdit>>> {
  if (!/^[a-z0-9-]{12,80}$/i.test(transactionId)) throw new Error("Invalid tool edit transaction.");
  const transaction = JSON.parse(await readFile(path.join(transactionRoot, `${transactionId}.json`), "utf8")) as {
    toolId: string;
    files: string[];
    backupDirectory: string;
  };
  const files = Object.fromEntries(await Promise.all(transaction.files.map(async fileName => [
    fileName,
    await readFile(path.join(transaction.backupDirectory, fileName), "utf8")
  ])));
  const stage = await stageToolEdit(transaction.toolId, files);
  return applyStagedToolEdit(stage.id);
}
