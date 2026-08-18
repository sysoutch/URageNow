import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../../config/appConfig.js";
import { recordDashboardSystemConsoleEvent } from "../dashboardConsoleLogger.js";

export interface LowPolyModelRunInput {
  sourceModelPath: string;
  outputModelPath: string;
  targetFaceCount: number;
  newMeshName?: string;
  mergeVertices?: boolean;
  shouldDecimate?: boolean;
  maxColors?: number;
  blockSize?: number;
  timeoutMs?: number;
}

export interface ModelPreviewRenderInput {
  sourceModelPath: string;
  outputImagePath: string;
  timeoutMs?: number;
}

export interface ModelPreviewFrameRenderInput {
  sourceModelPath: string;
  outputDirectoryPath: string;
  frameCount?: number;
  timeoutMs?: number;
}

export interface ModelMetallicRunInput {
  sourceModelPath: string;
  outputModelPath: string;
  metallicEnabled: boolean;
  timeoutMs?: number;
}

export interface ModelMaterialRunInput {
  sourceModelPath: string;
  outputModelPath: string;
  metallicEnabled?: boolean | null;
  roughnessValue?: number | null;
  timeoutMs?: number;
}

export interface ModelAlbedoToGeometryRunInput {
  sourceModelPath: string;
  outputModelPath: string;
  strength?: number;
  subdivisions?: number;
  topologyMode?: "subdivision" | "multiresolution";
  blur?: number;
  autoSmooth?: boolean;
  selectedFacesOnly?: boolean;
  mergeBeforeSubdivide?: boolean;
  mergeAfterSubdivide?: boolean;
  mergeDistance?: number;
  timeoutMs?: number;
}

export interface ModelSeparateByLoosePartsRunInput {
  sourceModelPath: string;
  outputModelPath: string;
  exportMode?: "per_part" | "single_file";
  mergeDistance?: number;
  timeoutMs?: number;
}

export interface ModelSeparateByLoosePartsRunResult {
  outputPaths: string[];
  partCount: number;
}

export interface ModelMergeVerticesRunInput {
  sourceModelPath: string;
  outputModelPath: string;
  mergeDistance?: number;
  timeoutMs?: number;
}

export interface ModelDecimateRunInput {
  sourceModelPath: string;
  outputModelPath: string;
  targetFaceCount: number;
  timeoutMs?: number;
}

export interface ModelScaleRunInput {
  sourceModelPath: string;
  outputModelPath: string;
  targetHeightMeters: number;
  timeoutMs?: number;
}

export interface ModelAutoRigRunInput {
  sourceModelPath: string;
  outputModelPath: string;
  llmProvider: "ollama" | "lmstudio" | "none";
  llmModel: string;
  ollamaUrl?: string;
  lmStudioBaseUrl?: string;
  lmStudioApiKey?: string;
  rigProfile?: string;
  useVision?: boolean;
  timeoutMs?: number;
  landmarksPath?: string;
}

export interface ModelAutoRigPreviewInput {
  sourceModelPath: string;
  resultJsonPath: string;
  previewDirectoryPath: string;
  llmProvider: "ollama" | "lmstudio" | "none";
  llmModel: string;
  ollamaUrl?: string;
  lmStudioBaseUrl?: string;
  lmStudioApiKey?: string;
  rigProfile?: string;
  useVision?: boolean;
  timeoutMs?: number;
  landmarksPath?: string;
}

interface ProcessResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  output: string;
}

interface BlenderAttemptResult {
  args: string[];
  startedAtMs: number;
  result: ProcessResult;
}

function assertScriptPath(envName: string, scriptPathValue: string, ...expectedPathParts: string[]): void {
  const scriptPath = path.resolve(scriptPathValue);
  const normalizedScriptPath = scriptPath.replace(/\\/g, "/").toLowerCase();
  const normalizedExpectedPath = expectedPathParts.join("/").replace(/\\/g, "/").toLowerCase();

  if (!normalizedExpectedPath || !normalizedScriptPath.endsWith(normalizedExpectedPath)) {
    throw new Error(`${envName} must point to ${normalizedExpectedPath}. Current: ${scriptPath}`);
  }
}

function assertLowPolyUvScriptPath(): void {
  assertScriptPath("BLENDER_LOWPOLY_SCRIPT_PATH", appConfig.blenderLowPolyScriptPath, "lowpolyuv.py");
}

function assertModelMetallicScriptPath(): void {
  assertScriptPath("BLENDER_MODEL_METALLIC_SCRIPT_PATH", appConfig.blenderModelMetallicScriptPath, "apply_metallic.py");
}

function assertModelSeparateByLoosePartsScriptPath(): void {
  assertScriptPath("BLENDER_MODEL_SEPARATE_BY_LOOSE_PARTS_SCRIPT_PATH", appConfig.blenderModelSeparateByLoosePartsScriptPath, "separate", "separate_by_loose_parts.py");
}

function assertModelMergeVerticesScriptPath(): void {
  assertScriptPath("BLENDER_MODEL_MERGE_VERTICES_SCRIPT_PATH", appConfig.blenderModelMergeVerticesScriptPath, "merge_vertices.py");
}

function assertModelDecimateScriptPath(): void {
  assertScriptPath("BLENDER_MODEL_DECIMATE_SCRIPT_PATH", appConfig.blenderModelDecimateScriptPath, "decimate", "decimatetofaces.py");
}

function assertModelMaterialScriptPath(): void {
  assertScriptPath("BLENDER_MODEL_MATERIAL_SCRIPT_PATH", appConfig.blenderModelMaterialScriptPath, "apply_material_finish.py");
}

function assertModelAlbedoToGeometryScriptPath(): void {
  assertScriptPath("BLENDER_MODEL_ALBEDO_TO_GEOMETRY_SCRIPT_PATH", appConfig.blenderModelAlbedoToGeometryScriptPath, "albedo_to_geometry.py");
}

function assertModelScaleScriptPath(): void {
  assertScriptPath("BLENDER_MODEL_SCALE_SCRIPT_PATH", appConfig.blenderModelScaleScriptPath, "scale.py");
}

function assertModelAutoRigScriptPath(): void {
  assertScriptPath("BLENDER_MODEL_AUTORIG_SCRIPT_PATH", appConfig.blenderModelAutoRigScriptPath, "autorig.py");
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : fallback;
}

function boolToArg(value: boolean): string {
  return value ? "true" : "false";
}

function trimProcessOutput(output: string): string {
  const normalized = output.trim();
  if (!normalized) {
    return "(no Blender output)";
  }
  return normalized.length > 3000 ? `${normalized.slice(0, 3000)}\n...(truncated)` : normalized;
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function parseExportedModelPathFromOutput(output: string): string | null {
  const matches = [...output.matchAll(/Exported model to:\s*(.+)$/gim)];
  const lastMatch = matches.length > 0 ? matches[matches.length - 1] : null;
  const rawPath = lastMatch?.[1]?.trim() ?? "";
  if (!rawPath) {
    return null;
  }
  return rawPath.replace(/^['"]+|['"]+$/g, "").trim() || null;
}

function parseExportedModelPathsFromOutput(output: string): string[] {
  return [...output.matchAll(/Exported split model to:\s*(.+)$/gim)]
    .map(match => String(match[1] || "").trim().replace(/^['"]+|['"]+$/g, "").trim())
    .filter(Boolean);
}

function parseSplitPartCountFromOutput(output: string): number | null {
  const match = output.match(/Exported split part count:\s*(\d+)/i) || output.match(/Separated loose parts:\s*(\d+)/i);
  if (!match || !match[1]) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function pickNewestLowPolyCandidate(directory: string, startedAtMs: number): Promise<string | null> {
  const entries = await readdir(directory, { withFileTypes: true });
  const candidates: Array<{ absolutePath: string; mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(fbx|glb)$/i.test(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    try {
      const metadata = await stat(absolutePath);
      candidates.push({
        absolutePath,
        mtimeMs: metadata.mtimeMs
      });
    } catch {
      continue;
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const freshCandidate = candidates.find(entry => entry.mtimeMs >= startedAtMs - 1500);
  return freshCandidate?.absolutePath ?? candidates[0]?.absolutePath ?? null;
}

async function resolveLowPolyOutputPath(requestedOutputPath: string, processOutput: string, startedAtMs: number): Promise<string> {
  const requestedAbsolutePath = path.resolve(requestedOutputPath);
  if (await fileExists(requestedAbsolutePath)) {
    return requestedAbsolutePath;
  }
  const exportedPathFromOutput = parseExportedModelPathFromOutput(processOutput);
  if (exportedPathFromOutput) {
    const resolvedExportedPath = path.resolve(exportedPathFromOutput);
    if (await fileExists(resolvedExportedPath)) {
      return resolvedExportedPath;
    }
  }
  const directoryFallback = await pickNewestLowPolyCandidate(path.dirname(requestedAbsolutePath), startedAtMs);
  if (directoryFallback) {
    return directoryFallback;
  }
  const detail = trimProcessOutput(processOutput);
  throw new Error(`Low Poly output file was not found. Expected "${requestedAbsolutePath}".\n${detail}`);
}

async function resolveScriptOutputPath(requestedOutputPath: string, processOutput: string): Promise<string> {
  const requestedAbsolutePath = path.resolve(requestedOutputPath);
  if (await fileExists(requestedAbsolutePath)) {
    return requestedAbsolutePath;
  }
  const exportedPathFromOutput = parseExportedModelPathFromOutput(processOutput);
  if (exportedPathFromOutput) {
    const resolvedExportedPath = path.resolve(exportedPathFromOutput);
    if (await fileExists(resolvedExportedPath)) {
      return resolvedExportedPath;
    }
  }
  const detail = trimProcessOutput(processOutput);
  throw new Error(`Blender output file was not found. Expected "${requestedAbsolutePath}".\n${detail}`);
}

function buildBlenderArgs(input: LowPolyModelRunInput): string[] {
  const args = [
    "--background",
    "--python",
    appConfig.blenderLowPolyScriptPath,
    "--",
    `--filepath=${path.resolve(input.sourceModelPath)}`,
    `--merge_vertices=${boolToArg(input.mergeVertices ?? appConfig.blenderLowPolyMergeVertices)}`,
    `--should_decimate=${boolToArg(input.shouldDecimate ?? appConfig.blenderLowPolyShouldDecimate)}`,
    `--decimate_face_count=${normalizePositiveInteger(input.targetFaceCount, appConfig.lowPolyDefaultTargetFaceCount)}`,
    `--max_colors=${normalizePositiveInteger(input.maxColors, appConfig.blenderLowPolyMaxColors)}`,
    `--block_size=${normalizePositiveInteger(input.blockSize, appConfig.blenderLowPolyBlockSize)}`,
    `--output_path=${path.resolve(input.outputModelPath)}`
  ];
  const newMeshName = input.newMeshName?.trim() ?? "";
  if (newMeshName) {
    args.push(`--new_mesh_name=${newMeshName}`);
  }
  return args;
}

function resolveMergeVerticesValue(input: LowPolyModelRunInput): boolean {
  return input.mergeVertices ?? appConfig.blenderLowPolyMergeVertices;
}

function resolveShouldDecimateValue(input: LowPolyModelRunInput): boolean {
  return input.shouldDecimate ?? appConfig.blenderLowPolyShouldDecimate;
}

function isAttemptSuccessful(result: ProcessResult): boolean {
  return result.exitCode === 0 && !result.signal;
}

function isLowPolyCompatibilityFailure(output: string): boolean {
  const checks = [
    /object\.merge_vertices/i,
    /mesh\.merge_by_distance/i,
    /object\.decimate_to_target/i,
    /decimate_target_face_count/i,
    /could not be found/i
  ];
  return checks.some(check => check.test(output));
}

function shouldRetryWithDecimateDisabled(input: LowPolyModelRunInput, output: string): boolean {
  if (!isLowPolyCompatibilityFailure(output)) {
    return false;
  }
  const shouldDecimateEnabled = resolveShouldDecimateValue(input);
  return shouldDecimateEnabled;
}

function shouldRetryWithMergeDisabled(input: LowPolyModelRunInput, output: string): boolean {
  if (!isLowPolyCompatibilityFailure(output)) {
    return false;
  }
  return resolveMergeVerticesValue(input);
}

async function runBlenderAttempt(input: LowPolyModelRunInput, timeoutMs: number): Promise<BlenderAttemptResult> {
  const startedAtMs = Date.now();
  const args = buildBlenderArgs(input);
  const result = await runBlenderProcess(args, timeoutMs);
  return { args, startedAtMs, result };
}

async function tryResolveOutputPathFromAttempt(outputModelPath: string, attempt: BlenderAttemptResult): Promise<string | null> {
  try {
    return await resolveLowPolyOutputPath(outputModelPath, attempt.result.output, attempt.startedAtMs);
  } catch {
    return null;
  }
}

function formatBlenderFailure(label: string, attempt: BlenderAttemptResult): string {
  const detail = trimProcessOutput(attempt.result.output);
  return `${label} (code=${attempt.result.exitCode}, signal=${attempt.result.signal ?? "none"}).\n${detail}`;
}

function runBlenderProcess(args: string[], timeoutMs: number): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(appConfig.blenderExecutablePath, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let settled = false;
    let output = "";
    const finish = (result: ProcessResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };
    const fail = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      reject(error);
    };
    const timeoutHandle = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore kill failures
      }
      fail(new Error(`Blender lowpoly script timed out after ${timeoutMs}ms.`));
    }, Math.max(10_000, timeoutMs));
    child.stdout.on("data", chunk => {
      const text = chunk.toString();
      output += text;
      recordDashboardSystemConsoleEvent({ source: "blender:lowpoly:stdout", level: "info", message: text.trim() || text });
    });
    child.stderr.on("data", chunk => {
      const text = chunk.toString();
      output += text;
      recordDashboardSystemConsoleEvent({ source: "blender:lowpoly:stderr", level: "warn", message: text.trim() || text });
    });
    child.once("error", error => {
      recordDashboardSystemConsoleEvent({ source: "blender:lowpoly", level: "error", message: error.message });
      fail(error);
    });
    child.once("close", (exitCode, signal) => {
      recordDashboardSystemConsoleEvent({
        source: "blender:lowpoly",
        level: exitCode === 0 ? "info" : "error",
        message: `Blender lowpoly process closed with code=${exitCode ?? -1}, signal=${signal ?? "none"}.`
      });
      finish({
        exitCode: exitCode ?? -1,
        signal: signal ?? null,
        output
      });
    });
  });
}

export async function runLowPolyModelScript(input: LowPolyModelRunInput): Promise<string> {
  assertLowPolyUvScriptPath();
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputModelPath = path.resolve(input.outputModelPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderLowPolyTimeoutMs);
  await stat(sourceModelPath);
  const normalizedInput: LowPolyModelRunInput = {
    ...input,
    sourceModelPath,
    outputModelPath
  };
  const primaryAttempt = await runBlenderAttempt(normalizedInput, timeoutMs);
  if (isAttemptSuccessful(primaryAttempt.result)) {
    return resolveLowPolyOutputPath(outputModelPath, primaryAttempt.result.output, primaryAttempt.startedAtMs);
  }
  const recoveredPrimaryPath = await tryResolveOutputPathFromAttempt(outputModelPath, primaryAttempt);
  if (recoveredPrimaryPath) {
    console.warn("Blender lowpoly process returned an error state, but an export file was found. Continuing with recovered file.");
    return recoveredPrimaryPath;
  }
  if (!shouldRetryWithDecimateDisabled(normalizedInput, primaryAttempt.result.output)) {
    throw new Error(`Blender lowpoly generation failed. ${formatBlenderFailure("Primary attempt failed", primaryAttempt)}`);
  }
  const decimateDisabledAttempt = await runBlenderAttempt({
    ...normalizedInput,
    shouldDecimate: false
  }, timeoutMs);
  if (isAttemptSuccessful(decimateDisabledAttempt.result)) {
    return resolveLowPolyOutputPath(outputModelPath, decimateDisabledAttempt.result.output, decimateDisabledAttempt.startedAtMs);
  }
  const recoveredDecimateDisabledPath = await tryResolveOutputPathFromAttempt(outputModelPath, decimateDisabledAttempt);
  if (recoveredDecimateDisabledPath) {
    console.warn("Decimate-disabled lowpoly attempt returned an error state, but an export file was found. Continuing with recovered file.");
    return recoveredDecimateDisabledPath;
  }
  if (!shouldRetryWithMergeDisabled(normalizedInput, decimateDisabledAttempt.result.output)) {
    const primaryDetail = formatBlenderFailure("Primary attempt failed", primaryAttempt);
    const decimateDetail = formatBlenderFailure("Fallback attempt failed (decimate disabled)", decimateDisabledAttempt);
    throw new Error(`Blender lowpoly generation failed after fallback retry.\n${primaryDetail}\n\n${decimateDetail}`);
  }
  const mergeAndDecimateDisabledAttempt = await runBlenderAttempt({
    ...normalizedInput,
    mergeVertices: false,
    shouldDecimate: false
  }, timeoutMs);
  if (isAttemptSuccessful(mergeAndDecimateDisabledAttempt.result)) {
    return resolveLowPolyOutputPath(outputModelPath, mergeAndDecimateDisabledAttempt.result.output, mergeAndDecimateDisabledAttempt.startedAtMs);
  }
  const recoveredMergeAndDecimateDisabledPath = await tryResolveOutputPathFromAttempt(outputModelPath, mergeAndDecimateDisabledAttempt);
  if (recoveredMergeAndDecimateDisabledPath) {
    console.warn("Merge/decimate-disabled lowpoly attempt returned an error state, but an export file was found. Continuing with recovered file.");
    return recoveredMergeAndDecimateDisabledPath;
  }
  const primaryDetail = formatBlenderFailure("Primary attempt failed", primaryAttempt);
  const decimateDetail = formatBlenderFailure("Fallback attempt failed (decimate disabled)", decimateDisabledAttempt);
  const mergeAndDecimateDetail = formatBlenderFailure("Fallback attempt failed (merge/decimate disabled)", mergeAndDecimateDisabledAttempt);
  throw new Error(`Blender lowpoly generation failed after fallback retries.\n${primaryDetail}\n\n${decimateDetail}\n\n${mergeAndDecimateDetail}`);
}

export async function runModelPreviewRender(input: ModelPreviewRenderInput): Promise<string> {
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputImagePath = path.resolve(input.outputImagePath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelPreviewTimeoutMs);
  await stat(sourceModelPath);
  const args = [
    "--background",
    "--python",
    appConfig.blenderModelPreviewScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--output_path=${outputImagePath}`
  ];
  const result = await runBlenderProcess(args, timeoutMs);
  if (!isAttemptSuccessful(result)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender lowpoly preview render failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }
  if (!(await fileExists(outputImagePath))) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Low poly preview image was not found at "${outputImagePath}".\n${detail}`);
  }
  return outputImagePath;
}

export async function runModelPreviewFrameRender(input: ModelPreviewFrameRenderInput): Promise<string[]> {
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputDirectoryPath = path.resolve(input.outputDirectoryPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelPreviewTimeoutMs);
  const frameCount = normalizePositiveInteger(input.frameCount, 32);
  await stat(sourceModelPath);
  const args = [
    "--background",
    "--python",
    appConfig.blenderModelPreviewScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--output_dir=${outputDirectoryPath}`,
    `--frame_count=${frameCount}`
  ];
  const result = await runBlenderProcess(args, timeoutMs);
  if (!isAttemptSuccessful(result)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender lowpoly frame render failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }
  const entries = await readdir(outputDirectoryPath, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && /^frame_\d+\.png$/i.test(entry.name))
    .map(entry => path.join(outputDirectoryPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
  if (files.length === 0) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`No low poly preview frames were rendered in "${outputDirectoryPath}".\n${detail}`);
  }
  return files;
}

export async function runModelSeparateByLoosePartsScript(input: ModelSeparateByLoosePartsRunInput): Promise<ModelSeparateByLoosePartsRunResult> {
  assertModelSeparateByLoosePartsScriptPath();
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputModelPath = path.resolve(input.outputModelPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelSeparateByLoosePartsTimeoutMs);
  const exportMode = input.exportMode === "single_file" ? "single_file" : "per_part";
  const mergeDistance = typeof input.mergeDistance === "number" && Number.isFinite(input.mergeDistance)
    ? Math.max(0, input.mergeDistance)
    : 0.0001;
  await stat(sourceModelPath);
  const args = [
    "--background",
    "--python",
    appConfig.blenderModelSeparateByLoosePartsScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--output_path=${outputModelPath}`,
    `--export_mode=${exportMode}`,
    `--merge_distance=${mergeDistance}`
  ];
  const result = await runBlenderProcess(args, timeoutMs);
  if (!isAttemptSuccessful(result)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender separate by loose parts script failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }
  const outputPaths = parseExportedModelPathsFromOutput(result.output);
  if (outputPaths.length > 0) {
    return {
      outputPaths: outputPaths.map(entry => path.resolve(entry)),
      partCount: parseSplitPartCountFromOutput(result.output) ?? outputPaths.length
    };
  }
  const resolvedOutputPath = await resolveScriptOutputPath(outputModelPath, result.output);
  return {
    outputPaths: [resolvedOutputPath],
    partCount: parseSplitPartCountFromOutput(result.output) ?? 1
  };
}

export async function runModelMergeVerticesScript(input: ModelMergeVerticesRunInput): Promise<string> {
  assertModelMergeVerticesScriptPath();
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputModelPath = path.resolve(input.outputModelPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelMergeVerticesTimeoutMs);
  const mergeDistance = typeof input.mergeDistance === "number" && Number.isFinite(input.mergeDistance)
    ? Math.max(0, input.mergeDistance)
    : 0.0001;
  await stat(sourceModelPath);
  const args = [
    "--background",
    "--python",
    appConfig.blenderModelMergeVerticesScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--output_path=${outputModelPath}`,
    `--merge_distance=${mergeDistance}`
  ];
  const result = await runBlenderProcess(args, timeoutMs);
  if (!isAttemptSuccessful(result)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender merge vertices script failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }
  return resolveScriptOutputPath(outputModelPath, result.output);
}

export async function runModelDecimateToFacesScript(input: ModelDecimateRunInput): Promise<string> {
  assertModelDecimateScriptPath();
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputModelPath = path.resolve(input.outputModelPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelDecimateTimeoutMs);
  const targetFaceCount = normalizePositiveInteger(input.targetFaceCount, 1000);
  await stat(sourceModelPath);
  const args = [
    "--background",
    "--python",
    appConfig.blenderModelDecimateScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--output_path=${outputModelPath}`,
    `--target_faces=${targetFaceCount}`
  ];
  const result = await runBlenderProcess(args, timeoutMs);
  if (!isAttemptSuccessful(result) || /Traceback \(most recent call last\):/i.test(result.output)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender decimate-to-faces script failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }
  return resolveScriptOutputPath(outputModelPath, result.output);
}

export async function runModelMetallicScript(input: ModelMetallicRunInput): Promise<string> {
  assertModelMetallicScriptPath();
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputModelPath = path.resolve(input.outputModelPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelMetallicTimeoutMs);
  await stat(sourceModelPath);
  const args = [
    "--background",
    "--python",
    appConfig.blenderModelMetallicScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--metallic_enabled=${boolToArg(input.metallicEnabled)}`,
    `--output_path=${outputModelPath}`
  ];
  const result = await runBlenderProcess(args, timeoutMs);
  if (!isAttemptSuccessful(result)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender metallic script failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }
  return resolveScriptOutputPath(outputModelPath, result.output);
}

export async function runModelMaterialScript(input: ModelMaterialRunInput): Promise<string> {
  assertModelMaterialScriptPath();
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputModelPath = path.resolve(input.outputModelPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelMetallicTimeoutMs);
  const roughnessValue = typeof input.roughnessValue === "number" && Number.isFinite(input.roughnessValue)
    ? Math.max(0, Math.min(1, input.roughnessValue))
    : null;
  await stat(sourceModelPath);
  const args = [
    "--background",
    "--python",
    appConfig.blenderModelMaterialScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--output_path=${outputModelPath}`
  ];
  if (typeof input.metallicEnabled === "boolean") {
    args.push(`--metallic_enabled=${boolToArg(input.metallicEnabled)}`);
  }
  if (roughnessValue !== null) {
    args.push(`--roughness_value=${roughnessValue}`);
  }
  const result = await runBlenderProcess(args, timeoutMs);
  if (!isAttemptSuccessful(result)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender material finish script failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }
  return resolveScriptOutputPath(outputModelPath, result.output);
}

export async function runModelAlbedoToGeometryScript(input: ModelAlbedoToGeometryRunInput): Promise<string> {
  assertModelAlbedoToGeometryScriptPath();
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputModelPath = path.resolve(input.outputModelPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelAlbedoToGeometryTimeoutMs);
  const strength = typeof input.strength === "number" && Number.isFinite(input.strength) ? Math.max(0, Math.min(10, input.strength)) : 0.05;
  const subdivisions = typeof input.subdivisions === "number" && Number.isFinite(input.subdivisions) ? Math.max(0, Math.min(8, Math.round(input.subdivisions))) : 0;
  const topologyMode = input.topologyMode === "multiresolution" ? "multiresolution" : "subdivision";
  const blur = typeof input.blur === "number" && Number.isFinite(input.blur) ? Math.max(0, Math.min(10, Math.round(input.blur))) : 1;
  const mergeDistance = typeof input.mergeDistance === "number" && Number.isFinite(input.mergeDistance) ? Math.max(0, Math.min(0.1, input.mergeDistance)) : 0.000001;
  await stat(sourceModelPath);
  const args = [
    "--background",
    "--python",
    appConfig.blenderModelAlbedoToGeometryScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--output_path=${outputModelPath}`,
    `--strength=${strength}`,
    `--subdivisions=${subdivisions}`,
    `--topology_mode=${topologyMode}`,
    `--blur=${blur}`,
    `--auto_smooth=${boolToArg(input.autoSmooth !== false)}`,
    `--selected_faces_only=${boolToArg(input.selectedFacesOnly === true)}`,
    `--merge_before_subdivide=${boolToArg(input.mergeBeforeSubdivide !== false)}`,
    `--merge_after_subdivide=${boolToArg(input.mergeAfterSubdivide !== false)}`,
    `--merge_distance=${mergeDistance}`
  ];
  const result = await runBlenderProcess(args, timeoutMs);
  if (!isAttemptSuccessful(result) || /Traceback \(most recent call last\):/i.test(result.output)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender albedo-to-geometry script failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }
  return resolveScriptOutputPath(outputModelPath, result.output);
}

export async function runModelScaleScript(input: ModelScaleRunInput): Promise<string> {
  assertModelScaleScriptPath();
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputModelPath = path.resolve(input.outputModelPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelScaleTimeoutMs);
  const targetHeightMeters = typeof input.targetHeightMeters === "number" && Number.isFinite(input.targetHeightMeters)
    ? Math.max(0.03, Math.min(4000, input.targetHeightMeters))
    : 1.8;
  await stat(sourceModelPath);
  const args = [
    "--background",
    "--python",
    appConfig.blenderModelScaleScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--target_height_meters=${targetHeightMeters}`,
    `--output_path=${outputModelPath}`
  ];
  const result = await runBlenderProcess(args, timeoutMs);
  if (!isAttemptSuccessful(result)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender scale script failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }
  return resolveScriptOutputPath(outputModelPath, result.output);
}

export async function runModelAutoRigScript(input: ModelAutoRigRunInput): Promise<string> {
  assertModelAutoRigScriptPath();

  const sourceModelPath = path.resolve(input.sourceModelPath);
  const outputModelPath = path.resolve(input.outputModelPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelAutoRigTimeoutMs);

  await stat(sourceModelPath);

  const args = [
    "--background",
    "--python",
    appConfig.blenderModelAutoRigScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    `--output_path=${outputModelPath}`,
    "--mode=final",
    `--llm-provider=${input.llmProvider}`,
    `--llm-model=${input.llmModel}`,
    `--rig-profile=${input.rigProfile?.trim() || "auto"}`,
    `--use-vision=${boolToArg(input.useVision !== false)}`
  ];

  if (input.landmarksPath?.trim()) {
    args.push(`--landmarks_path=${path.resolve(input.landmarksPath.trim())}`);
    args.push("--trust-landmarks=true");
  }

  if (input.ollamaUrl?.trim()) {
    args.push(`--ollama-url=${input.ollamaUrl.trim()}`);
  }

  if (input.lmStudioBaseUrl?.trim()) {
    args.push(`--lmstudio-url=${input.lmStudioBaseUrl.trim()}`);
  }

  if (input.lmStudioApiKey?.trim()) {
    args.push(`--lmstudio-api-key=${input.lmStudioApiKey.trim()}`);
  }

  const result = await runBlenderProcess(args, timeoutMs);

  if (!isAttemptSuccessful(result) || /Traceback \(most recent call last\):/i.test(result.output)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender AutoRig script failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }

  return resolveScriptOutputPath(outputModelPath, result.output);
}

export async function runModelAutoRigPreviewScript(input: ModelAutoRigPreviewInput): Promise<string> {
  assertModelAutoRigScriptPath();

  const sourceModelPath = path.resolve(input.sourceModelPath);
  const resultJsonPath = path.resolve(input.resultJsonPath);
  const previewDirectoryPath = path.resolve(input.previewDirectoryPath);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, appConfig.blenderModelAutoRigTimeoutMs);

  await stat(sourceModelPath);

  const args = [
    "--background",
    "--python",
    appConfig.blenderModelAutoRigScriptPath,
    "--",
    `--filepath=${sourceModelPath}`,
    "--mode=preview",
    `--preview_dir=${previewDirectoryPath}`,
    `--result_json_path=${resultJsonPath}`,
    `--llm-provider=${input.llmProvider}`,
    `--llm-model=${input.llmModel}`,
    `--rig-profile=${input.rigProfile?.trim() || "auto"}`,
    `--use-vision=${boolToArg(input.useVision !== false)}`
  ];

  if (input.landmarksPath?.trim()) {
    args.push(`--landmarks_path=${path.resolve(input.landmarksPath.trim())}`);
    args.push("--trust-landmarks=true");
  }

  if (input.ollamaUrl?.trim()) {
    args.push(`--ollama-url=${input.ollamaUrl.trim()}`);
  }

  if (input.lmStudioBaseUrl?.trim()) {
    args.push(`--lmstudio-url=${input.lmStudioBaseUrl.trim()}`);
  }

  if (input.lmStudioApiKey?.trim()) {
    args.push(`--lmstudio-api-key=${input.lmStudioApiKey.trim()}`);
  }

  const result = await runBlenderProcess(args, timeoutMs);

  if (!isAttemptSuccessful(result) || /Traceback \(most recent call last\):/i.test(result.output)) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender AutoRig preview failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${detail}`);
  }

  if (!(await fileExists(resultJsonPath))) {
    const detail = trimProcessOutput(result.output);
    throw new Error(`Blender AutoRig preview JSON was not found at "${resultJsonPath}".\n${detail}`);
  }

  return resultJsonPath;
}
