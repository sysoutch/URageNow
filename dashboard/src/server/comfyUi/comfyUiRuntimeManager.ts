import {spawn, type ChildProcess} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

export type ComfyUiRuntimeConfiguration = {
  launcherPath: string;
  workingDirectory: string;
};

type RuntimeStatus = {
  status: "stopped" | "running";
  pid: number | null;
  launcherPath: string;
  workingDirectory: string;
};

const configPath = path.resolve("data", "comfyui-runtime.json");
const processExitTimeoutMs = 10_000;
let runningProcess: ChildProcess | null = null;
let stopPromise: Promise<void> | null = null;

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

function directory(value: string): string {
  const resolved = path.resolve(value);
  if (!path.isAbsolute(value) || !existsSync(resolved)) {
    throw new Error("ComfyUI working directory must be an existing absolute folder.");
  }
  return resolved;
}

function launcher(value: string): string {
  const resolved = path.resolve(value);
  if (!path.isAbsolute(value) || !/\.(bat|cmd)$/i.test(resolved) || !existsSync(resolved)) {
    throw new Error("ComfyUI launcher must be an existing absolute .bat or .cmd file.");
  }
  return resolved;
}

function isProcessRunning(child: ChildProcess | null): child is ChildProcess {
  return Boolean(child?.pid && child.exitCode === null);
}

async function readConfig(): Promise<ComfyUiRuntimeConfiguration> {
  try {
    return JSON.parse(await readFile(configPath, "utf8"));
  } catch {
    return {launcherPath: "", workingDirectory: ""};
  }
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
    ...config
  };
}

export async function saveComfyUiRuntimeConfiguration(input: Partial<ComfyUiRuntimeConfiguration>): Promise<RuntimeStatus> {
  const previous = await readConfig();
  const launcherPath = input.launcherPath === undefined ? previous.launcherPath : clean(input.launcherPath);
  const workingDirectory = input.workingDirectory === undefined ? previous.workingDirectory : clean(input.workingDirectory);
  const config = {
    launcherPath: launcherPath ? launcher(launcherPath) : "",
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
  const workingDirectory = directory(config.workingDirectory || path.dirname(launcherPath));
  if (process.platform !== "win32") {
    throw new Error("Dashboard batch launchers are currently supported on Windows only.");
  }

  const child = spawn("cmd.exe", ["/d", "/s", "/c", launcherPath], {
    cwd: workingDirectory,
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  runningProcess = child;
  child.once("exit", () => {
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
