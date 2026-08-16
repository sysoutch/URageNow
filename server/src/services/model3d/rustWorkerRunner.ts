import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

export async function resolveExistingFilePath(candidate: string): Promise<string | null> {
  const normalized = String(candidate || "").trim();
  if (!normalized) {
    return null;
  }
  try {
    const entry = await stat(normalized);
    return entry.isFile() ? normalized : null;
  } catch {
    return null;
  }
}

export async function resolveRustWorkerLaunch(input: {
  workspacePath: string;
  executableCandidates: string[];
  cargoExecutablePath: string;
  crateName: string;
}): Promise<{ command: string; args: string[]; cwd?: string }> {
  for (const candidate of input.executableCandidates) {
    const executablePath = await resolveExistingFilePath(candidate);
    if (executablePath) {
      return {
        command: executablePath,
        args: []
      };
    }
  }
  return {
    command: input.cargoExecutablePath,
    args: ["run", "--quiet", "-p", input.crateName, "--"],
    cwd: input.workspacePath
  };
}

export async function runRustWorkerCli(input: {
  command: string;
  args: string[];
  cwd?: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", error => {
      reject(error);
    });
    child.on("close", code => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`Rust worker failed with exit code ${code}.${stderr ? ` ${stderr.trim()}` : ""}`));
    });
  });
}
