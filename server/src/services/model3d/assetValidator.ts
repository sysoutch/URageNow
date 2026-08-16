import path from "node:path";
import { appConfig } from "../../config/appConfig.js";
import type {
  RustAssetValidationResult,
  RustValidationSeverity
} from "@urage/shared/model3d/inspectionContracts";
import { asArray, asRecord, asString, parseJsonWithOptionalBom } from "./primitives.js";
import { normalizeInspectionResult, type RustModelInspectionResult } from "./modelInspector.js";
import { resolveRustWorkerLaunch, runRustWorkerCli } from "./rustWorkerRunner.js";

export type {
  RustAssetValidationResult,
  RustValidationIssue,
  RustValidationSeverity
} from "@urage/shared/model3d/inspectionContracts";

function getAssetValidatorExecutableName(): string {
  return process.platform === "win32" ? "asset-validator.exe" : "asset-validator";
}

function normalizeSeverity(value: unknown): RustValidationSeverity {
  return String(value || "").trim().toLowerCase() === "error" ? "error" : "warning";
}

function normalizeValidationResult(inputPath: string, value: unknown): RustAssetValidationResult {
  const raw = asRecord(value);
  const inspection = raw?.inspection;
  return {
    inputPath: asString(raw?.inputPath) || inputPath,
    valid: Boolean(raw?.valid),
    issues: asArray(raw?.issues).map(entry => {
      const issue = asRecord(entry);
      return {
        severity: normalizeSeverity(issue?.severity),
        code: asString(issue?.code) || "unknown",
        message: asString(issue?.message) || "Validation issue"
      };
    }),
    inspection: inspection
      ? normalizeInspectionResult(inputPath, inspection)
      : normalizeInspectionResult(inputPath, { warnings: ["Validation result did not include inspection details."] })
  };
}

async function resolveAssetValidatorLaunch(): Promise<{ command: string; args: string[]; cwd?: string }> {
  const workspacePath = path.resolve(appConfig.rustWorkerWorkspacePath);
  return resolveRustWorkerLaunch({
    workspacePath,
    executableCandidates: [
      appConfig.rustAssetValidatorExecutablePath,
      path.join(workspacePath, "target", "debug", getAssetValidatorExecutableName()),
      path.join(workspacePath, "target", "release", getAssetValidatorExecutableName())
    ],
    cargoExecutablePath: appConfig.cargoExecutablePath,
    crateName: "asset-validator"
  });
}

export async function validateModelFileWithRust(inputPath: string): Promise<RustAssetValidationResult> {
  const absoluteInputPath = path.resolve(inputPath);
  const launch = await resolveAssetValidatorLaunch();
  const rawOutput = await runRustWorkerCli({
    command: launch.command,
    args: [...launch.args, "--input", absoluteInputPath],
    cwd: launch.cwd
  });
  return normalizeValidationResult(absoluteInputPath, parseJsonWithOptionalBom<unknown>(rawOutput));
}
