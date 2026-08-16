export type NativeApplicationId = "bambu-studio" | "blender";

export interface NativeApplicationLaunchRequest {
  applicationId: NativeApplicationId;
  executablePath: string;
  args: string[];
  workingDirectory?: string;
  detached?: boolean;
  stdio?: "ignore" | "inherit";
  windowsHide?: boolean;
}

export interface NativeApplicationLaunchResult {
  launched: true;
  pid: number | null;
  adapter: "typescript" | "rust";
}

export interface NativeApplicationPort {
  launch(request: NativeApplicationLaunchRequest): Promise<NativeApplicationLaunchResult>;
}

const windowsExecutableNames: Record<NativeApplicationId, Set<string>> = {
  "bambu-studio": new Set(["bambu-studio.exe", "bambustudio.exe"]),
  blender: new Set(["blender.exe"])
};

const unixExecutableNames: Record<NativeApplicationId, Set<string>> = {
  "bambu-studio": new Set(["bambu-studio", "bambustudio", "flatpak", "open"]),
  blender: new Set(["blender"])
};

export function isAllowlistedNativeApplicationExecutable(
  applicationId: NativeApplicationId,
  executablePath: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  const normalized = String(executablePath || "").trim().replaceAll("\\", "/");
  const name = normalized.split("/").pop()?.toLowerCase() || "";
  if (applicationId === "bambu-studio" && platform === "darwin" && normalized.toLowerCase().endsWith(".app")) {
    return true;
  }
  if (applicationId === "bambu-studio" && platform === "linux" && name.endsWith(".appimage") && name.includes("bambu")) {
    return true;
  }
  return (platform === "win32" ? windowsExecutableNames : unixExecutableNames)[applicationId].has(name);
}

export function assertAllowlistedNativeApplicationRequest(
  request: NativeApplicationLaunchRequest,
  platform: NodeJS.Platform = process.platform
): void {
  if (!isAllowlistedNativeApplicationExecutable(request.applicationId, request.executablePath, platform)) {
    throw new Error(`Executable is not allowlisted for ${request.applicationId}.`);
  }
  if (!Array.isArray(request.args) || request.args.some(argument => typeof argument !== "string" || argument.includes("\0"))) {
    throw new Error("Native application arguments must be NUL-free strings.");
  }
}
