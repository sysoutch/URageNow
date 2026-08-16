import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { repoRoot } from "@urage/server/config/repositoryPaths";

const commonWindowsFfmpegPaths = [
  "C:/ffmpeg/bin/ffmpeg.exe",
  "C:/Program Files/ffmpeg/bin/ffmpeg.exe",
  "C:/Program Files/FFmpeg/bin/ffmpeg.exe",
  "C:/Program Files/Gyan/FFmpeg/bin/ffmpeg.exe",
  "C:/Program Files/Gyan/ffmpeg/bin/ffmpeg.exe",
  "C:/Program Files (x86)/ffmpeg/bin/ffmpeg.exe"
];

function normalizeCandidate(value: string): string {
  return String(value || "").trim().replace(/\\/g, "/");
}
function canExecuteFromPath(command: string): boolean {
  try {
    const result = spawnSync(command, ["-version"], {
      windowsHide: true,
      stdio: "ignore",
      timeout: 5_000
    });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}
function canResolveFromWhere(command: string): boolean {
  try {
    const result = spawnSync("where.exe", [command], {
      windowsHide: true,
      stdio: "ignore",
      timeout: 5_000
    });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}
function resolveExistingAbsolutePath(candidate: string): string | null {
  const normalized = normalizeCandidate(candidate);
  if (!normalized) {
    return null;
  }
  const absolute = path.isAbsolute(normalized) ? normalized : path.resolve(repoRoot, normalized);
  return existsSync(absolute) ? absolute : null;
}
function findWingetInstalledFfmpegPath(): string | null {
  const localAppData = normalizeCandidate(process.env.LOCALAPPDATA || "");
  if (!localAppData) {
    return null;
  }
  const packagesRoot = path.resolve(localAppData, "Microsoft", "WinGet", "Packages");
  if (!existsSync(packagesRoot)) {
    return null;
  }
  try {
    const packageDirectories = readdirSync(packagesRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^Gyan\.FFmpeg/i.test(entry.name))
      .map(entry => path.join(packagesRoot, entry.name));
    for (const packageDirectory of packageDirectories) {
      const buildDirectories = readdirSync(packageDirectory, { withFileTypes: true }).filter(entry => entry.isDirectory());
      for (const buildDirectory of buildDirectories) {
        const candidate = path.join(packageDirectory, buildDirectory.name, "bin", "ffmpeg.exe");
        if (existsSync(candidate)) {
          return candidate;
        }
      }
    }
  } catch {}
  return null;
}

export function resolveFfmpegExecutablePath(configuredPath: string): string | null {
  const configured = normalizeCandidate(configuredPath);
  const configuredAbsolute = resolveExistingAbsolutePath(configured);
  if (configuredAbsolute) {
    return configuredAbsolute;
  }
  if (configured && !configured.includes("/") && !configured.includes("\\") && canResolveFromWhere(configured)) {
    return configured;
  }
  for (const candidate of commonWindowsFfmpegPaths) {
    const absolute = resolveExistingAbsolutePath(candidate);
    if (absolute) {
      return absolute;
    }
  }
  const wingetInstalled = findWingetInstalledFfmpegPath();
  if (wingetInstalled) {
    return wingetInstalled;
  }
  if (canResolveFromWhere("ffmpeg") || canExecuteFromPath("ffmpeg")) {
    return "ffmpeg";
  }
  return null;
}

export function buildFfmpegInstallHint(): string {
  return [
    "FFmpeg was not found.",
    "Run `scripts/_install/install-ffmpeg.ps1`, install FFmpeg from Studio Settings, set the FFmpeg executable path in Studio Settings, or set `FFMPEG_EXECUTABLE_PATH` so `ffmpeg` is available."
  ].join(" ");
}
