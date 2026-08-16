import path from "node:path";
import { appConfig } from "../../config/appConfig.js";
import type {
  RustAssetIndexResult,
  RustIndexedDirectoryFile,
  RustIndexedModelArtifact
} from "@urage/shared/model3d/assetIndexContracts";
import { asArray, asRecord, asString, parseJsonWithOptionalBom } from "./primitives.js";
import { resolveRustWorkerLaunch, runRustWorkerCli } from "./rustWorkerRunner.js";

export type {
  RustAssetIndexResult,
  RustIndexedDirectoryFile,
  RustIndexedModelArtifact
} from "@urage/shared/model3d/assetIndexContracts";

function asNonNegativeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function getAssetIndexerExecutableName(): string {
  return process.platform === "win32" ? "asset-indexer.exe" : "asset-indexer";
}

function normalizeIndexedFile(value: unknown): RustIndexedDirectoryFile | null {
  const raw = asRecord(value);
  const relativePath = asString(raw?.relativePath);
  if (!relativePath) return null;
  return {
    relativePath,
    fileName: asString(raw?.fileName) || path.basename(relativePath),
    sizeBytes: asNonNegativeNumber(raw?.sizeBytes)
  };
}

function normalizeIndexedArtifact(value: unknown): RustIndexedModelArtifact | null {
  const raw = asRecord(value);
  const id = asString(raw?.id);
  if (!id) return null;
  return {
    id,
    directoryPath: asString(raw?.directoryPath) || id,
    topLevelFileCount: asNonNegativeNumber(raw?.topLevelFileCount),
    nestedFileCount: asNonNegativeNumber(raw?.nestedFileCount),
    files: asArray(raw?.files).map(normalizeIndexedFile).filter((entry): entry is RustIndexedDirectoryFile => entry !== null),
    warnings: asArray(raw?.warnings).map(entry => asString(entry)).filter((entry): entry is string => entry !== null)
  };
}

function normalizeAssetIndexResult(inputPath: string, value: unknown): RustAssetIndexResult {
  const raw = asRecord(value);
  return {
    inputPath: asString(raw?.inputPath) || inputPath,
    indexed: Boolean(raw?.indexed),
    artifactCount: asNonNegativeNumber(raw?.artifactCount),
    orphanFiles: asArray(raw?.orphanFiles).map(normalizeIndexedFile).filter((entry): entry is RustIndexedDirectoryFile => entry !== null),
    artifacts: asArray(raw?.artifacts).map(normalizeIndexedArtifact).filter((entry): entry is RustIndexedModelArtifact => entry !== null),
    warnings: asArray(raw?.warnings).map(entry => asString(entry)).filter((entry): entry is string => entry !== null)
  };
}

async function resolveAssetIndexerLaunch(): Promise<{ command: string; args: string[]; cwd?: string }> {
  const workspacePath = path.resolve(appConfig.rustWorkerWorkspacePath);
  return resolveRustWorkerLaunch({
    workspacePath,
    executableCandidates: [
      appConfig.rustAssetIndexerExecutablePath,
      path.join(workspacePath, "target", "debug", getAssetIndexerExecutableName()),
      path.join(workspacePath, "target", "release", getAssetIndexerExecutableName())
    ],
    cargoExecutablePath: appConfig.cargoExecutablePath,
    crateName: "asset-indexer"
  });
}

export async function indexGeneratedModelAssetsWithRust(inputPath: string): Promise<RustAssetIndexResult> {
  const absoluteInputPath = path.resolve(inputPath);
  const launch = await resolveAssetIndexerLaunch();
  const rawOutput = await runRustWorkerCli({
    command: launch.command,
    args: [...launch.args, "--input", absoluteInputPath],
    cwd: launch.cwd
  });
  return normalizeAssetIndexResult(absoluteInputPath, parseJsonWithOptionalBom<unknown>(rawOutput));
}
