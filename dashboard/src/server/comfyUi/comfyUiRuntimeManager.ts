import {spawn, type ChildProcess} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {resolveRepoPath} from "@urage/server/config/repositoryPaths";

export type ComfyUiRuntimeConfiguration = {
  launcherPath: string;
  workingDirectory: string;
};

type RuntimeStatus = {
  status: "stopped" | "running";
  pid: number | null;
  launcherPath: string;
  workingDirectory: string;
  startedAt: string | null;
  output: string[];
};

const configPath = path.resolve("data", "comfyui-runtime.json");
const bundledLauncherPath = "scripts/comfyui/run-comfyui.bat";
const processExitTimeoutMs = 10_000;
const maxRuntimeOutputLines = 160;
let runningProcess: ChildProcess | null = null;
let stopPromise: Promise<void> | null = null;
let runtimeStartedAt: string | null = null;
let runtimeOutput: string[] = [];

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

function resolveRuntimePath(value: string): string {
  return path.isAbsolute(value) ? path.resolve(value) : resolveRepoPath(value);
}

function directory(value: string): string {
  const resolved = resolveRuntimePath(value);
  if (!existsSync(resolved)) {
    throw new Error("ComfyUI working directory must be an existing folder.");
  }
  return resolved;
}

function launcher(value: string): string {
  const resolved = resolveRuntimePath(value);
  if (!/\.(bat|cmd)$/i.test(resolved) || !existsSync(resolved)) {
    throw new Error("ComfyUI launcher must be an existing .bat or .cmd file.");
  }
  return resolved;
}

function isProcessRunning(child: ChildProcess | null): child is ChildProcess {
  return Boolean(child?.pid && child.exitCode === null);
}

async function readConfig(): Promise<ComfyUiRuntimeConfiguration> {
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8")) as Partial<ComfyUiRuntimeConfiguration>;
    return {launcherPath: clean(parsed.launcherPath) || bundledLauncherPath, workingDirectory: clean(parsed.workingDirectory)};
  } catch {
    return {launcherPath: bundledLauncherPath, workingDirectory: ""};
  }
}

function appendRuntimeOutput(chunk: unknown): void {
  const lines = String(chunk || "").replace(/\r/g, "").split("\n").map(line => line.trimEnd()).filter(Boolean);
  if (lines.length === 0) return;
  runtimeOutput = [...runtimeOutput, ...lines].slice(-maxRuntimeOutputLines);
}

async function writeConfig(config: ComfyUiRuntimeConfiguration): Promise<ComfyUiRuntimeConfiguration> {
  await mkdir(path.dirname(configPath), {recursive: true});
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  return config;
}

function waitForProcessExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("ComfyUI did not stop within 10 seconds.")), processExitTimeoutMs);
    timeout.unref();
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function terminateWindowsProcessTree(pid: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const taskkill = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore"
    });
    taskkill.once("error", error => reject(new Error(`Could not stop ComfyUI: ${error.message}`)));
    taskkill.once("exit", code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Could not stop ComfyUI process tree (taskkill exited with code ${code ?? "unknown"}).`));
    });
  });
}

async function terminateRuntimeProcess(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    await terminateWindowsProcessTree(child.pid);
  } else if (!child.kill("SIGTERM")) {
    throw new Error("Could not send the ComfyUI stop signal.");
  }
  await waitForProcessExit(child);
}

export async function getComfyUiRuntimeStatus(): Promise<RuntimeStatus> {
  const config = await readConfig();
  const child = runningProcess;
  const active = isProcessRunning(child);
  return {
    status: active ? "running" : "stopped",
    pid: active ? child.pid || null : null,
    startedAt: active ? runtimeStartedAt : null,
    output: runtimeOutput,
    ...config
  };
}

export async function saveComfyUiRuntimeConfiguration(input: Partial<ComfyUiRuntimeConfiguration>): Promise<RuntimeStatus> {
  const previous = await readConfig();
  const launcherPath = input.launcherPath === undefined ? previous.launcherPath : clean(input.launcherPath) || bundledLauncherPath;
  const workingDirectory = input.workingDirectory === undefined ? previous.workingDirectory : clean(input.workingDirectory);
  const config = {
    launcherPath: launcherPath === bundledLauncherPath ? bundledLauncherPath : launcher(launcherPath),
    workingDirectory: workingDirectory ? directory(workingDirectory) : ""
  };
  await writeConfig(config);
  return getComfyUiRuntimeStatus();
}

export async function startComfyUiRuntime(): Promise<RuntimeStatus> {
  if (isProcessRunning(runningProcess)) {
    return getComfyUiRuntimeStatus();
  }
  const config = await readConfig();
  const launcherPath = launcher(config.launcherPath);
  if (!config.workingDirectory) {
    throw new Error("Choose the ComfyUI launcher folder before starting the runtime.");
  }
  const workingDirectory = directory(config.workingDirectory);
  if (process.platform !== "win32") {
    throw new Error("Dashboard batch launchers are currently supported on Windows only.");
  }

  const child = spawn("cmd.exe", ["/d", "/s", "/c", launcherPath], {
    cwd: workingDirectory,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false
  });
  runningProcess = child;
  runtimeStartedAt = new Date().toISOString();
  runtimeOutput = [`[${runtimeStartedAt}] Starting ${config.launcherPath} from ${workingDirectory}`];
  child.stdout?.on("data", appendRuntimeOutput);
  child.stderr?.on("data", appendRuntimeOutput);
  child.once("error", error => appendRuntimeOutput(`[ERROR] ${error.message}`));
  child.once("exit", () => {
    appendRuntimeOutput("ComfyUI process stopped.");
    if (runningProcess === child) {
      runningProcess = null;
    }
  });
  return getComfyUiRuntimeStatus();
}

export async function stopComfyUiRuntime(): Promise<RuntimeStatus> {
  if (!isProcessRunning(runningProcess)) {
    return getComfyUiRuntimeStatus();
  }
  if (!stopPromise) {
    const child = runningProcess;
    stopPromise = terminateRuntimeProcess(child).finally(() => {
      stopPromise = null;
      if (runningProcess === child && child.exitCode !== null) {
        runningProcess = null;
      }
    });
  }
  await stopPromise;
  return getComfyUiRuntimeStatus();
}

export async function createComfyUiLauncherBatches(rootPath: string) {
  const root = directory(rootPath);
  const presets = [
    ["run_urage_cpu.bat", "--cpu"],
    ["run_urage_nvidia_gpu.bat", ""],
    ["run_urage_nvidia_fast_fp16_accumulation.bat", "--fast fp16_accumulation"],
    ["run_urage_nvidia_fast_fp16_accumulation_listen.bat", "--fast fp16_accumulation --listen 127.0.0.1"]
  ] as const;
  const files: string[] = [];
  for (const [name, args] of presets) {
    const target = path.join(root, name);
    if (!existsSync(target)) {
      await writeFile(target, `@echo off\r\ncall venv\\Scripts\\activate\r\npython -s ComfyUI\\main.py --windows-standalone-build ${args}\r\npause\r\n`);
    }
    files.push(target);
  }
  const selectedLauncherPath = path.join(root, "run_urage_nvidia_fast_fp16_accumulation_listen.bat");
  await writeConfig({launcherPath: selectedLauncherPath, workingDirectory: root});
  return {directory: root, files, selectedLauncherPath};
}

async function browseWithPowerShell(script: string, fallbackMessage: string): Promise<string> {
  if (process.platform !== "win32") throw new Error("The native picker is currently available on Windows only.");
  return await new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {windowsHide: false, stdio: ["ignore", "pipe", "pipe"]});
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => stdout += String(chunk));
    child.stderr.on("data", chunk => stderr += String(chunk));
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || fallbackMessage)));
  });
}

export async function browseForComfyUiLauncherFolder(): Promise<string> {
  return await browseWithPowerShell([
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Select the folder containing venv and ComfyUI'",
    "$dialog.ShowNewFolderButton = $false",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }"
  ].join("; "), "ComfyUI folder picker failed.");
}

export async function browseForComfyUiLauncherBatch(): Promise<string> {
  return await browseWithPowerShell([
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
    "$dialog.Title = 'Select a ComfyUI launcher batch'",
    "$dialog.Filter = 'Batch files (*.bat;*.cmd)|*.bat;*.cmd'",
    "$dialog.Multiselect = $false",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }"
  ].join("; "), "ComfyUI launcher picker failed.");
}
