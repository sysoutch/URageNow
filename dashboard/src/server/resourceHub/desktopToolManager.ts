import { spawn } from "node:child_process";
import { existsSync, promises as fsPromises } from "node:fs";
import os from "node:os";
import path from "node:path";

type DesktopToolLaunchResult = {
  path: string;
  extension: string;
  launched: boolean;
};

export type DesktopToolIconPayload = {
  toolPath: string;
  iconDataUrl: string | null;
  error: string | null;
};

const supportedDesktopToolExtensions = new Set([".exe", ".bat", ".cmd", ".sh", ".ps1", ".lnk", ".app", ".command", ".py"]);

function getDesktopToolExtension(toolPath: string): string {
  return path.extname(toolPath).toLowerCase();
}

function assertDesktopToolPath(toolPath: string): string {
  const normalizedPath = path.resolve(toolPath);
  const extension = getDesktopToolExtension(normalizedPath);
  if (!path.isAbsolute(toolPath)) throw new Error("Desktop tool path must be absolute.");
  if (!supportedDesktopToolExtensions.has(extension)) throw new Error("Unsupported desktop tool type.");
  if (!existsSync(normalizedPath)) throw new Error("Desktop tool file does not exist.");
  return normalizedPath;
}

function spawnDetached(command: string, args: string[]): void {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}

export function launchDesktopTool(toolPath: string): DesktopToolLaunchResult {
  const normalizedPath = assertDesktopToolPath(toolPath);
  const extension = getDesktopToolExtension(normalizedPath);
  if (process.platform === "win32" && [".bat", ".cmd", ".lnk"].includes(extension)) {
    // Use start /b to avoid spawning a new console window; pass path as separate arg to prevent injection
    spawnDetached("cmd.exe", ["/c", "start", "/b", "", normalizedPath]);
  } else if (process.platform === "win32" && extension === ".py") {
    spawnDetached("py", ["-3", normalizedPath]);
  } else if (process.platform === "win32" && extension === ".ps1") {
    spawnDetached("powershell.exe", ["-ExecutionPolicy", "Bypass", "-File", normalizedPath]);
  } else if (process.platform === "win32" && extension === ".sh") {
    spawnDetached("bash", [normalizedPath]);
  } else if (process.platform === "darwin" && extension === ".app") {
    spawnDetached("open", [normalizedPath]);
  } else {
    spawnDetached(normalizedPath, []);
  }
  return { path: normalizedPath, extension, launched: true };
}

export async function extractDesktopToolIcon(toolPathStr: string): Promise<Buffer | null> {
  const normalizedPath = assertDesktopToolPath(toolPathStr);
  const ext = getDesktopToolExtension(normalizedPath).toLowerCase();

  if (process.platform !== "win32") {
    return null;
  }

  if (![".exe", ".lnk"].includes(ext)) {
    return null;
  }

  // Encode the path as standard base64 to eliminate shell injection risk.
  // PowerShell decodes it internally via [Convert]::FromBase64String().
  // Standard base64 is required because .NET Framework's FromBase64String()
  // does not support URL-safe base64 (- and _ replacements).
  const pathBytes = Buffer.from(normalizedPath, "utf8");
  const encodedPath = pathBytes.toString("base64");

  return new Promise((resolve) => {
    const psScriptPath = path.join(os.tmpdir(), "extract-icon-" + Date.now() + ".ps1");
    // -File does NOT pass extra args to $args, so we embed the encoded path directly
    // into the script body — it's safe because standard base64 only contains [A-Za-z0-9+/=].
    const psScriptContent = [
      '$encodedPath = "' + encodedPath + '";',
      'try {',
      '  $rawBytes = [Convert]::FromBase64String($encodedPath);',
      '  $targetPath = [System.Text.Encoding]::UTF8.GetString($rawBytes);',
      '  if (-not (Test-Path $targetPath)) { "ERROR: path not found"; exit 0 }',
      '  [System.Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null;',
      '  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($targetPath);',
      '  if ($null -ne $icon) {',
      '    try {',
      '      $bmp = $icon.ToBitmap();',
      '      $ms = New-Object IO.MemoryStream;',
      '      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);',
      '      $bytes = $ms.ToArray();',
      '      [Convert]::ToBase64String($bytes);',
      '      $ms.Close();',
      '    } finally {',
      // Dispose bitmap BEFORE icon — bitmap holds GDI handle that depends on icon.
      '      if ($null -ne $bmp) { $bmp.Dispose() }',
      '      if ($null -ne $icon)  { $icon.Dispose() }',
      '    }',
      '  } else { "ERROR" }',
      '} catch { "ERROR: $($_.Exception.Message)" }'
    ].join("\n");

    fsPromises.writeFile(psScriptPath, psScriptContent, "utf8").then(() => {
      const child = spawn("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", psScriptPath
      ], {
        windowsHide: true,
        env: process.env
      });

      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: any) => { stdout += String(chunk); });
      child.stderr?.on("data", (chunk: any) => { stderr += String(chunk); });
      child.once("close", (code: number | null) => {
        fsPromises.unlink(psScriptPath).catch(() => { /* ignore */ });
        if (code === 0 && stdout.trim() && !stdout.includes("ERROR")) {
          const b64 = stdout.trim().replace(/\r?\n/g, "");
          try {
            resolve(Buffer.from(b64, "base64"));
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
      child.once("error", () => {
        fsPromises.unlink(psScriptPath).catch(() => { /* ignore */ });
        resolve(null);
      });
    }).catch(() => {
      resolve(null);
    });
  });
}

export async function getDesktopToolIconDataUrl(toolPath: string): Promise<string | null> {
  const iconBuffer = await extractDesktopToolIcon(toolPath);
  if (!iconBuffer) return null;
  const base64 = iconBuffer.toString("base64");
  return "data:image/png;base64," + base64;
}
