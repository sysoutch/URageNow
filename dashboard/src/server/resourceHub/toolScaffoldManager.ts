import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { toolsRoot } from "@urage/server/config/repositoryPaths";
import { buildToolFileDiff, type ToolFileDiff } from "./toolFileDiff.js";

export type ToolScaffoldOutputKind = "text" | "image" | "json";

export type ToolScaffoldSpec = {
  category: string;
  slug: string;
  title: string;
  description: string;
  purpose: string;
  outputKind: ToolScaffoldOutputKind;
  acceptsFiles: boolean;
  includeSidebar: boolean;
  persistState: boolean;
};

export type ToolScaffoldAudit = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type ToolScaffoldImplementation = {
  summary: string;
  files: Record<string, string>;
  diffs: ToolFileDiff[];
};

const validSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const outputKinds = new Set<ToolScaffoldOutputKind>(["text", "image", "json"]);
const modelEditableScaffoldFiles = new Set(["index.html", "app.js", "style.css"]);

function normalizeSlug(value: unknown, fallback = ""): string {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return validSlugPattern.test(normalized) ? normalized : fallback;
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, maxLength) || fallback;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function extractJsonObject(value: string): Record<string, unknown> {
  const raw = String(value || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function normalizeToolScaffoldSpec(value: unknown): ToolScaffoldSpec {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const title = normalizeText(record.title, "New Dashboard Tool", 80);
  const outputKind = String(record.outputKind || "text") as ToolScaffoldOutputKind;
  return {
    category: normalizeSlug(record.category, "dev"),
    slug: normalizeSlug(record.slug || title, "new-dashboard-tool"),
    title,
    description: normalizeText(record.description, `A dashboard-integrated tool for ${title.toLowerCase()}.`, 180),
    purpose: normalizeText(record.purpose, `Help the user complete a focused ${title.toLowerCase()} workflow.`, 500),
    outputKind: outputKinds.has(outputKind) ? outputKind : "text",
    acceptsFiles: record.acceptsFiles === true,
    includeSidebar: record.includeSidebar !== false,
    persistState: record.persistState === true
  };
}

export function getToolScaffoldInputIssues(value: unknown): string[] {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const requiredTextFields = ["category", "slug", "title", "description", "purpose"] as const;
  const issues = requiredTextFields
    .filter(field => !String(record[field] || "").trim())
    .map(field => `${field} is required`);
  if (record.category && !validSlugPattern.test(String(record.category).trim())) issues.push("category must use lowercase kebab-case");
  if (record.slug && !validSlugPattern.test(String(record.slug).trim())) issues.push("slug must use lowercase kebab-case");
  if (!outputKinds.has(String(record.outputKind || "") as ToolScaffoldOutputKind)) issues.push("outputKind must be text, image, or json");
  return issues;
}

export function buildToolScaffoldPlanningPrompt(userRequest: string): string {
  return [
    "Design a small local web tool for URage NOW.",
    "Return only one compact JSON object with these fields:",
    "{\"category\":\"dev\",\"slug\":\"kebab-case\",\"title\":\"...\",\"description\":\"...\",\"purpose\":\"...\",\"outputKind\":\"text|image|json\",\"acceptsFiles\":false,\"includeSidebar\":true,\"persistState\":false}",
    "Integration rules are non-negotiable and handled by the server template: dashboard theme host, shared theme script, current-output descriptor, tool bridge, README, manifest, accessible controls, and optional dashboard sidebar.",
    "Choose image output only when the primary result is a canvas/image. Choose JSON for structured machine-readable results. Otherwise choose text.",
    "Do not return HTML, JavaScript, Markdown, paths, shell commands, dependencies, or extra keys.",
    "User request:",
    normalizeText(userRequest, "Create a useful development tool.", 1500)
  ].join("\n");
}

export function parseToolScaffoldPlan(answer: string): ToolScaffoldSpec {
  return normalizeToolScaffoldSpec(extractJsonObject(answer));
}

export function buildToolScaffoldImplementationPrompt(specInput: unknown, userRequest: string): string {
  const spec = normalizeToolScaffoldSpec(specInput);
  const baseline = renderToolScaffoldFiles(spec);
  return [
    "Implement the actual behavior of this small URage NOW web tool.",
    "Return only valid JSON in this shape:",
    "{\"summary\":\"short implementation summary\",\"files\":{\"index.html\":\"full file\",\"app.js\":\"full file\",\"style.css\":\"full file\"}}",
    "Return complete replacement contents for all three files. Do not add paths, dependencies, Markdown fences, or extra keys.",
    "Preserve these exact dashboard integration contracts:",
    "- index.html keeps data-dashboard-theme and loads ../../shared/dashboard-theme.js, ../../shared/dashboard-current-output-autodescribe.js, ../../shared/dashboard-tool-bridge.js, and app.js.",
    "- app.js keeps window.__urageToolDescribeCurrentAsset and window.__urageToolLoadAssetPayload.",
    "- Use accessible native controls and keep the tool fully local/offline.",
    "- Implement the requested workflow; do not leave placeholder text or TODO-only behavior.",
    `Specification: ${JSON.stringify(spec)}`,
    `User request: ${normalizeText(userRequest, spec.purpose, 1500)}`,
    "Audited baseline files to improve:",
    JSON.stringify({
      "index.html": baseline["index.html"],
      "app.js": baseline["app.js"],
      "style.css": baseline["style.css"]
    })
  ].join("\n");
}

export function parseToolScaffoldImplementation(answer: string, specInput: unknown): ToolScaffoldImplementation {
  const record = extractJsonObject(answer);
  const rawFiles = record.files && typeof record.files === "object"
    ? record.files as Record<string, unknown>
    : {};
  const missingFiles = Array.from(modelEditableScaffoldFiles)
    .filter(fileName => typeof rawFiles[fileName] !== "string" || !String(rawFiles[fileName]).trim());
  if (missingFiles.length > 0) {
    throw new Error(`LazyDev did not return complete implementation files: ${missingFiles.join(", ")}.`);
  }
  const files = renderToolScaffoldFiles(specInput);
  for (const [fileName, content] of Object.entries(rawFiles)) {
    if (modelEditableScaffoldFiles.has(fileName) && typeof content === "string" && content.trim()) {
      files[fileName] = content.replace(/\r\n/g, "\n");
    }
  }
  return {
    summary: normalizeText(record.summary, "LazyDev implemented the requested tool behavior.", 240),
    files,
    diffs: Array.from(modelEditableScaffoldFiles).map(fileName =>
      buildToolFileDiff(fileName, renderToolScaffoldFiles(specInput)[fileName] || "", files[fileName] || "")
    )
  };
}

export function renderToolScaffoldFiles(specInput: unknown): Record<string, string> {
  const spec = normalizeToolScaffoldSpec(specInput);
  const escapedTitle = escapeHtml(spec.title);
  const escapedDescription = escapeHtml(spec.description);
  const titleJs = JSON.stringify(spec.title);
  const outputMarkup = spec.outputKind === "image"
    ? '<canvas id="tool-output" width="900" height="560" aria-label="Generated output"></canvas>'
    : spec.outputKind === "json"
      ? '<pre id="tool-output" class="tool-output" aria-live="polite">{}</pre>'
      : '<textarea id="tool-output" class="tool-output" aria-label="Tool output" readonly></textarea>';
  const fileMarkup = spec.acceptsFiles
    ? '<label class="field"><span>Input file</span><input id="tool-file-input" type="file"></label>'
    : "";
  const sidebarOpen = spec.includeSidebar ? '<aside class="tool-sidebar" data-dashboard-tool-sidebar>' : '<section class="tool-sidebar">';
  const sidebarClose = spec.includeSidebar ? "</aside>" : "</section>";
  const indexHtml = `<!doctype html>
<html lang="en" data-dashboard-theme="fire">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapedDescription}">
  <title>${escapedTitle}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body data-dashboard-theme="fire">
  <main class="tool-shell">
    <header class="tool-header"><div><h1>${escapedTitle}</h1><p>${escapedDescription}</p></div></header>
    <div class="tool-workspace">
      ${sidebarOpen}
        <label class="field"><span>Input</span><textarea id="tool-input" placeholder="${escapeHtml(spec.purpose)}"></textarea></label>
        ${fileMarkup}
        <button id="tool-run-button" type="button">Run</button>
        <p id="tool-status" class="tool-status" aria-live="polite">Ready.</p>
      ${sidebarClose}
      <section class="tool-stage" aria-label="Tool result">${outputMarkup}</section>
    </div>
  </main>
  <script src="../../shared/dashboard-theme.js"></script>
  <script src="../../shared/dashboard-current-output-autodescribe.js"></script>
  <script src="../../shared/dashboard-tool-bridge.js"></script>
  <script src="app.js"></script>
</body>
</html>
`;
  const outputSetup = spec.outputKind === "image"
    ? `const context = output.getContext("2d");
    context.clearRect(0, 0, output.width, output.height);
    context.fillStyle = "#171b26";
    context.fillRect(0, 0, output.width, output.height);
    context.fillStyle = "#f6edf8";
    context.font = "32px system-ui";
    context.fillText(inputValue || ${titleJs}, 40, 80);`
    : spec.outputKind === "json"
      ? `output.textContent = JSON.stringify({input: inputValue, generatedAt: new Date().toISOString()}, null, 2);`
      : `output.value = inputValue ? "Result: " + inputValue : "Add your " + ${titleJs} + " logic here.";`;
  const descriptor = spec.outputKind === "image"
    ? `return {kind: "image", label: ${titleJs} + " output", fileName: "${spec.slug}-output.png", dataUrl: output.toDataURL("image/png")};`
    : `return {kind: "${spec.outputKind}", label: ${titleJs} + " output", fileName: "${spec.slug}-output.${spec.outputKind === "json" ? "json" : "txt"}", text: output.${spec.outputKind === "text" ? "value" : "textContent"} || ""};`;
  const persistenceWrite = spec.persistState
    ? `localStorage.setItem("urage-tool-${spec.slug}-input", inputNode.value);`
    : "";
  const persistenceRead = spec.persistState
    ? `inputNode.value = localStorage.getItem("urage-tool-${spec.slug}-input") || "";`
    : "";
  const fileSupport = spec.acceptsFiles
    ? `document.getElementById("tool-file-input").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) status.textContent = "Selected " + file.name + ".";
  });`
    : "";
  const appJs = `(function startTool() {
  "use strict";
  const inputNode = document.getElementById("tool-input");
  const output = document.getElementById("tool-output");
  const status = document.getElementById("tool-status");
  ${persistenceRead}

  function run() {
    const inputValue = inputNode.value.trim();
    ${outputSetup}
    ${persistenceWrite}
    status.textContent = "Output updated.";
  }

  document.getElementById("tool-run-button").addEventListener("click", run);
  ${fileSupport}
  window.__urageToolDescribeCurrentAsset = function describeCurrentAsset() {
    ${descriptor}
  };
  window.__urageToolLoadAssetPayload = function loadAsset(payload) {
    const name = String(payload?.fileName || payload?.name || "dashboard asset");
    inputNode.value = "Received " + name;
    status.textContent = "Loaded " + name + " from the dashboard.";
    return {accepted: true};
  };
}());
`;
  const styleCss = `* { box-sizing: border-box; }
body { margin: 0; min-width: 0; background: var(--urage-bg, #0d1018); color: var(--urage-text, #f6edf8); font-family: Inter, system-ui, sans-serif; }
button, textarea, input { font: inherit; }
.tool-shell { min-height: 100vh; padding: 1rem; }
.tool-header, .tool-sidebar, .tool-stage { border: 1px solid var(--urage-border, #56326c); border-radius: .75rem; background: var(--urage-panel, #171b26); padding: 1rem; }
.tool-header h1, .tool-header p { margin: 0; }
.tool-header p, .tool-status { color: var(--urage-text-muted, #c7b8ca); }
.tool-workspace { display: grid; grid-template-columns: minmax(14rem, 20rem) minmax(0, 1fr); gap: 1rem; margin-top: 1rem; }
.tool-sidebar { align-self: start; display: grid; gap: .8rem; }
.field { display: grid; gap: .35rem; }
textarea { width: 100%; min-height: 8rem; resize: vertical; }
button, textarea, input { border: 1px solid var(--urage-border, #56326c); border-radius: .45rem; background: var(--urage-surface, #11151f); color: inherit; padding: .65rem; }
button { cursor: pointer; border-color: var(--urage-accent, #d46cff); }
.tool-stage { min-width: 0; overflow: auto; }
.tool-output { width: 100%; min-height: 26rem; margin: 0; white-space: pre-wrap; }
canvas { display: block; max-width: 100%; height: auto; }
@media (max-width: 720px) { .tool-workspace { grid-template-columns: 1fr; } }
`;
  const readme = `# ${spec.title}

${spec.description}

## Purpose

${spec.purpose}

## Dashboard integration

- Uses \`data-dashboard-theme\` and the shared dashboard theme bridge.
- Uses \`dashboard-current-output-autodescribe.js\` and provides an explicit current-output descriptor.
- Uses \`dashboard-tool-bridge.js\` and accepts dashboard asset payloads.
- ${spec.includeSidebar ? "Exposes one dashboard sidebar marker." : "Uses a single-stage layout without a dashboard sidebar marker."}
- Primary output: \`${spec.outputKind}\`.
- File input: ${spec.acceptsFiles ? "enabled" : "disabled"}.
- Local state persistence: ${spec.persistState ? "enabled" : "disabled"}.

Replace the placeholder transformation inside \`app.js\` while preserving these integration hooks.

See [the canonical tool integration contract](../../TOOL_TEMPLATE.md) for every supported option and validation command.
`;
  const manifest = JSON.stringify({
    schemaVersion: 1,
    id: `${spec.category}__${spec.slug}`,
    title: spec.title,
    description: spec.description,
    integration: {
      theme: true,
      currentOutput: true,
      toolBridge: true,
      dashboardSidebar: spec.includeSidebar,
      acceptsFiles: spec.acceptsFiles,
      outputKind: spec.outputKind,
      persistState: spec.persistState
    }
  }, null, 2) + "\n";
  return {"index.html": indexHtml, "app.js": appJs, "style.css": styleCss, "README.md": readme, "tool.json": manifest};
}

export function auditToolScaffoldFiles(files: Record<string, string>): ToolScaffoldAudit[] {
  const html = files["index.html"] || "";
  const app = files["app.js"] || "";
  return [
    {id: "entry", label: "Runnable index.html", passed: /<html[\s>]/i.test(html), detail: "A catalog tool requires index.html."},
    {id: "theme", label: "Dashboard theme", passed: html.includes("data-dashboard-theme") && html.includes("dashboard-theme.js"), detail: "Theme host and bridge are required."},
    {id: "output", label: "Current output contract", passed: html.includes("dashboard-current-output-autodescribe.js") && app.includes("__urageToolDescribeCurrentAsset"), detail: "Send Resource needs a current-output descriptor."},
    {id: "bridge", label: "Dashboard tool bridge", passed: html.includes("dashboard-tool-bridge.js") && app.includes("__urageToolLoadAssetPayload"), detail: "Tool-to-dashboard and dashboard-to-tool handoff must be wired."},
    {id: "readme", label: "Integration documentation", passed: Boolean(files["README.md"]?.includes("## Dashboard integration")), detail: "The LLM and developers need durable integration guidance."},
    {id: "manifest", label: "Machine-readable manifest", passed: Boolean(files["tool.json"]), detail: "Tool capabilities must be explicit."}
  ];
}

function mergeSubmittedScaffoldFiles(spec: ToolScaffoldSpec, submittedFiles: unknown): Record<string, string> {
  const files = renderToolScaffoldFiles(spec);
  const record = submittedFiles && typeof submittedFiles === "object"
    ? submittedFiles as Record<string, unknown>
    : {};
  for (const [fileName, content] of Object.entries(record)) {
    if (modelEditableScaffoldFiles.has(fileName) && typeof content === "string" && content.trim()) {
      files[fileName] = content.replace(/\r\n/g, "\n");
    }
  }
  return files;
}

export async function createToolFromScaffold(specInput: unknown, submittedFiles?: unknown): Promise<{spec: ToolScaffoldSpec; directory: string; files: string[]; audit: ToolScaffoldAudit[]}> {
  const inputIssues = getToolScaffoldInputIssues(specInput);
  if (inputIssues.length > 0) {
    throw new Error(`Tool specification is incomplete: ${inputIssues.join("; ")}.`);
  }
  const spec = normalizeToolScaffoldSpec(specInput);
  const root = path.resolve(toolsRoot);
  const directory = path.resolve(root, spec.category, spec.slug);
  const relative = path.relative(root, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Tool path must stay inside the tools directory.");
  }
  try {
    await access(directory);
    throw new Error(`Tool ${spec.category}/${spec.slug} already exists.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) throw error;
  }
  const files = mergeSubmittedScaffoldFiles(spec, submittedFiles);
  const audit = auditToolScaffoldFiles(files);
  const missing = audit.filter(item => !item.passed);
  if (missing.length > 0) {
    throw new Error(`Tool template is incomplete: ${missing.map(item => item.label).join(", ")}.`);
  }
  await mkdir(directory, {recursive: false});
  await Promise.all(Object.entries(files).map(([fileName, content]) => writeFile(path.join(directory, fileName), content, "utf8")));
  return {spec, directory, files: Object.keys(files), audit};
}
