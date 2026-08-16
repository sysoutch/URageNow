import {existsSync} from "node:fs";
import path from "node:path";
import type {NativeApplicationPort} from "@urage/shared/runtime/nativeApplicationPort";
import {getNativeApplicationPort} from "@urage/shared/runtime/nativeApplicationRuntime";
import {appConfig} from "../runtime/botBridge.js";

export type Model3dPrintApplicationId = "bambu-studio";

export type Model3dPrintApplicationDescriptor = {
  id: Model3dPrintApplicationId;
  label: string;
  executablePath: string;
  executableDetected: boolean;
  platform: NodeJS.Platform;
};

export type Model3dPrintLaunchSpec = {
  command: string;
  args: string[];
  workingDirectory: string;
};

const supportedModelExtensions = new Set([
  ".3mf",
  ".amf",
  ".fbx",
  ".glb",
  ".gltf",
  ".obj",
  ".step",
  ".stl",
  ".stp"
]);

export function isBambuStudioSupportedModelPath(modelPath: string): boolean {
  return supportedModelExtensions.has(path.extname(modelPath).toLowerCase());
}

function getBambuStudioExecutableCandidates(platform: NodeJS.Platform): string[] {
  if (platform === "win32") {
    return [
      "C:\\Program Files\\Bambu Studio\\bambu-studio.exe",
      "C:\\Program Files\\BambuStudio\\bambu-studio.exe"
    ];
  }
  if (platform === "darwin") {
    return ["/Applications/BambuStudio.app"];
  }
  return [
    "/usr/bin/bambu-studio",
    "/usr/local/bin/bambu-studio",
    "/usr/bin/flatpak"
  ];
}

function resolveBambuStudioExecutablePath(
  platform: NodeJS.Platform,
  configuredPath: string,
  fileExists: (candidate: string) => boolean
): {path: string; detected: boolean} {
  const configured = configuredPath.trim();
  if (configured) {
    return {path: configured, detected: fileExists(configured)};
  }
  const candidates = getBambuStudioExecutableCandidates(platform);
  const detected = candidates.find(fileExists);
  return {path: detected || candidates[0] || "", detected: Boolean(detected)};
}

export function getModel3dPrintApplications(input: {
  platform?: NodeJS.Platform;
  configuredBambuStudioPath?: string;
  fileExists?: (candidate: string) => boolean;
} = {}): Model3dPrintApplicationDescriptor[] {
  const platform = input.platform || process.platform;
  const resolved = resolveBambuStudioExecutablePath(
    platform,
    input.configuredBambuStudioPath ?? appConfig.bambuStudioExecutablePath,
    input.fileExists || existsSync
  );
  return [{
    id: "bambu-studio",
    label: "BambuLab Studio",
    executablePath: resolved.path,
    executableDetected: resolved.detected,
    platform
  }];
}

export function buildBambuStudioLaunchSpec(
  platform: NodeJS.Platform,
  executablePath: string,
  modelPath: string
): Model3dPrintLaunchSpec {
  const platformPath = platform === "win32" ? path.win32 : path.posix;
  const workingDirectory = platformPath.dirname(executablePath);

  if (platform === "darwin" && platformPath.extname(executablePath).toLowerCase() === ".app") {
    return {command: "open", args: ["-a", executablePath, modelPath], workingDirectory};
  }
  if (platform === "linux" && platformPath.basename(executablePath).toLowerCase() === "flatpak") {
    return {
      command: executablePath,
      args: ["run", "com.bambulab.BambuStudio", modelPath],
      workingDirectory
    };
  }
  return {command: executablePath, args: [modelPath], workingDirectory};
}

export async function launchModelInPrintApplication(input: {
  applicationId: string;
  modelPath: string;
  platform?: NodeJS.Platform;
  nativeApplicationPort?: NativeApplicationPort;
}): Promise<{
  applicationId: Model3dPrintApplicationId;
  executablePath: string;
  modelPath: string;
  launched: true;
}> {
  if (input.applicationId !== "bambu-studio") {
    throw new Error("Unsupported 3D print application.");
  }
  const application = getModel3dPrintApplications({platform: input.platform})[0];
  if (!application) {
    throw new Error("BambuLab Studio destination is unavailable.");
  }
  if (!application.executableDetected || !existsSync(application.executablePath)) {
    throw new Error(
      `BambuLab Studio was not found at "${application.executablePath}". `
      + "Install it there or configure BAMBU_STUDIO_EXECUTABLE_PATH before starting URage NOW."
    );
  }
  if (!path.isAbsolute(input.modelPath) || !existsSync(input.modelPath)) {
    throw new Error("Selected model file was not found.");
  }
  const modelExtension = path.extname(input.modelPath).toLowerCase();
  if (!isBambuStudioSupportedModelPath(input.modelPath)) {
    throw new Error(`BambuLab Studio does not support the selected "${modelExtension || "unknown"}" model format.`);
  }
  const platform = input.platform || process.platform;
  const launchSpec = buildBambuStudioLaunchSpec(platform, application.executablePath, input.modelPath);
  await (input.nativeApplicationPort || getNativeApplicationPort()).launch({
    applicationId: "bambu-studio",
    executablePath: launchSpec.command,
    args: launchSpec.args,
    workingDirectory: launchSpec.workingDirectory,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  return {
    applicationId: "bambu-studio",
    executablePath: application.executablePath,
    modelPath: input.modelPath,
    launched: true
  };
}
