import path from "node:path";
import { appConfig } from "../../config/appConfig.js";
import type {
  RustModelBounds3,
  RustModelInspectionResult,
  RustModelInspectionStats,
  RustModelKind,
  RustModelVector3
} from "@urage/shared/model3d/inspectionContracts";
import { asArray, asRecord, asString, parseJsonWithOptionalBom } from "./primitives.js";
import { resolveRustWorkerLaunch, runRustWorkerCli } from "./rustWorkerRunner.js";

export type {
  RustModelBounds3,
  RustModelFileFact,
  RustModelGeometryStats,
  RustModelInspectionResult,
  RustModelInspectionStats,
  RustModelKind,
  RustModelMaterialFact,
  RustModelMaterialTextureSlots,
  RustModelResourceStats,
  RustModelTextureFact,
  RustModelVector3
} from "@urage/shared/model3d/inspectionContracts";

function asNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function normalizeModelKind(value: unknown): RustModelKind {
  const normalized = asString(value)?.toLowerCase();
  return normalized === "glb"
    || normalized === "gltf"
    || normalized === "fbx"
    || normalized === "obj"
    || normalized === "blend"
    ? normalized
    : "unknown";
}

function normalizeVector3(value: unknown): RustModelVector3 | null {
  const raw = asRecord(value);
  const x = asNonNegativeOrSignedNumber(raw?.x);
  const y = asNonNegativeOrSignedNumber(raw?.y);
  const z = asNonNegativeOrSignedNumber(raw?.z);
  return x === null || y === null || z === null ? null : { x, y, z };
}

function normalizeBounds(value: unknown): RustModelBounds3 | null {
  const raw = asRecord(value);
  const min = normalizeVector3(raw?.min);
  const max = normalizeVector3(raw?.max);
  return min && max ? { min, max } : null;
}

function asNonNegativeOrSignedNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeStats(value: unknown): RustModelInspectionStats | null {
  const raw = asRecord(value);
  const geometry = asRecord(raw?.geometry);
  const resources = asRecord(raw?.resources);
  if (!geometry || !resources) {
    return null;
  }
  return {
    geometry: {
      meshCount: asNonNegativeNumber(geometry.meshCount) ?? 0,
      primitiveCount: asNonNegativeNumber(geometry.primitiveCount) ?? 0,
      vertexCount: asNonNegativeNumber(geometry.vertexCount) ?? 0,
      faceCount: asNonNegativeNumber(geometry.faceCount) ?? 0,
      normalCount: asNonNegativeNumber(geometry.normalCount) ?? 0,
      uvChannelCount: asNonNegativeNumber(geometry.uvChannelCount) ?? 0
    },
    resources: {
      sceneCount: asNonNegativeNumber(resources.sceneCount) ?? 0,
      nodeCount: asNonNegativeNumber(resources.nodeCount) ?? 0,
      materialCount: asNonNegativeNumber(resources.materialCount) ?? 0,
      textureCount: asNonNegativeNumber(resources.textureCount) ?? 0,
      animationCount: asNonNegativeNumber(resources.animationCount) ?? 0
    },
    bounds: normalizeBounds(raw?.bounds),
    materials: asArray(raw?.materials).map(entry => {
      const material = asRecord(entry);
      const slots = asRecord(material?.textureSlots);
      return {
        name: asString(material?.name),
        alphaMode: asString(material?.alphaMode),
        doubleSided: typeof material?.doubleSided === "boolean" ? material.doubleSided : null,
        textureSlots: {
          baseColor: asString(slots?.baseColor),
          normal: asString(slots?.normal),
          metallicRoughness: asString(slots?.metallicRoughness),
          emissive: asString(slots?.emissive),
          occlusion: asString(slots?.occlusion)
        }
      };
    }),
    textures: asArray(raw?.textures).map(entry => {
      const texture = asRecord(entry);
      return {
        name: asString(texture?.name),
        reference: asString(texture?.reference),
        mimeType: asString(texture?.mimeType),
        width: asNonNegativeNumber(texture?.width),
        height: asNonNegativeNumber(texture?.height),
        usageCount: asNonNegativeNumber(texture?.usageCount) ?? 0
      };
    })
  };
}

export function normalizeInspectionResult(inputPath: string, value: unknown): RustModelInspectionResult {
  const raw = asRecord(value);
  const file = asRecord(raw?.file);
  return {
    inputPath: asString(raw?.inputPath) || inputPath,
    file: {
      exists: Boolean(file?.exists),
      extension: asString(file?.extension),
      fileName: asString(file?.fileName),
      sizeBytes: asNonNegativeNumber(file?.sizeBytes)
    },
    kind: normalizeModelKind(raw?.kind),
    inspected: Boolean(raw?.inspected),
    parser: asString(raw?.parser),
    stats: normalizeStats(raw?.stats),
    warnings: asArray(raw?.warnings).map(entry => asString(entry)).filter((entry): entry is string => entry !== null)
  };
}

function getModelInspectorExecutableName(): string {
  return process.platform === "win32" ? "model-inspector.exe" : "model-inspector";
}

async function resolveModelInspectorLaunch(): Promise<{ command: string; args: string[]; cwd?: string }> {
  const workspacePath = path.resolve(appConfig.rustWorkerWorkspacePath);
  return resolveRustWorkerLaunch({
    workspacePath,
    executableCandidates: [
    appConfig.rustModelInspectorExecutablePath,
    path.join(workspacePath, "target", "debug", getModelInspectorExecutableName()),
    path.join(workspacePath, "target", "release", getModelInspectorExecutableName())
    ],
    cargoExecutablePath: appConfig.cargoExecutablePath,
    crateName: "model-inspector"
  });
}

async function runModelInspector(inputPath: string): Promise<string> {
  const launch = await resolveModelInspectorLaunch();
  const absoluteInputPath = path.resolve(inputPath);
  return runRustWorkerCli({
    command: launch.command,
    args: [...launch.args, "--input", absoluteInputPath],
    cwd: launch.cwd
  });
}

export async function inspectModelFileWithRust(inputPath: string): Promise<RustModelInspectionResult> {
  const rawOutput = await runModelInspector(inputPath);
  return normalizeInspectionResult(inputPath, parseJsonWithOptionalBom<unknown>(rawOutput));
}
