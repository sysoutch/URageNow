import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import type { DashboardMessengerRuntimeLaunchConfig } from "@urage/shared/dashboard/types";

export type MessengerRuntimeKey = "discord" | "telegram" | "matrix" | "whatsapp";
export type MessengerRuntimeStatus = "running" | "stopped" | "starting" | "stopping" | "error";
export type MessengerRuntimeMode = "embedded" | "process";
export type MessengerRuntimeControlAction = "start" | "stop" | "restart";
type ExternalMessengerRuntimeKey = Exclude<MessengerRuntimeKey, "discord">;
const discordStoppedMessage = "Stopped in this dashboard runtime. Standalone or legacy headless bot processes are not tracked here.";

export interface MessengerRuntimeRecord {
  messenger: MessengerRuntimeKey;
  label: string;
  mode: MessengerRuntimeMode;
  configured: boolean;
  status: MessengerRuntimeStatus;
  message: string;
  pid: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  lastExitCode: number | null;
  lastExitSignal: string | null;
}

export interface MessengerRuntimeEvent {
  id: string;
  createdAt: string;
  messenger: MessengerRuntimeKey;
  level: "info" | "error";
  message: string;
}

export interface MessengerRuntimeSnapshot {
  runtimes: MessengerRuntimeRecord[];
  events: MessengerRuntimeEvent[];
}

export interface ExternalMessengerRuntimeConfig {
  entryPath: string;
  workingDirectory?: string;
  autoStart?: boolean;
}

interface MessengerRuntimeManagerDependencies {
  startDiscord: (tokenOverride?: string) => Promise<void>;
  stopDiscord: () => Promise<void>;
  isDiscordRunning: () => boolean;
  resolveSharedEnvironment?: () => Record<string, string>;
  telegram: ExternalMessengerRuntimeConfig;
  matrix: ExternalMessengerRuntimeConfig;
  whatsapp: ExternalMessengerRuntimeConfig;
  maxEvents?: number;
}

interface ManagedExternalRuntime {
  key: ExternalMessengerRuntimeKey;
  process: ChildProcessWithoutNullStreams | null;
  stopRequested: boolean;
}

function createEventId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function cleanLine(input: string): string {
  return input
    .replace(/\r/g, "")
    .trim()
    .slice(0, 700);
}

function toAbsolutePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
}

function toDisplayCommand(entryPath: string): string {
  if (!entryPath) {
    return "";
  }
  return `node ${entryPath}`;
}

function getExternalRuntimeLabel(key: ExternalMessengerRuntimeKey): string {
  if (key === "telegram") {
    return "Telegram";
  }
  if (key === "matrix") {
    return "Matrix";
  }
  return "WhatsApp";
}

function describeCredentialSource(launchConfig?: DashboardMessengerRuntimeLaunchConfig): string {
  if (launchConfig?.credentialSource === "manual") {
    return "manual entry";
  }
  if (launchConfig?.credentialSource === "safe-file") {
    return "safe env file";
  }
  return "default environment";
}

export class MessengerRuntimeManager {
  private readonly startDiscord: (tokenOverride?: string) => Promise<void>;
  private readonly stopDiscord: () => Promise<void>;
  private readonly isDiscordRunning: () => boolean;
  private readonly resolveSharedEnvironment: () => Record<string, string>;
  private readonly maxEvents: number;
  private readonly records = new Map<MessengerRuntimeKey, MessengerRuntimeRecord>();
  private readonly events: MessengerRuntimeEvent[] = [];
  private readonly externalConfigs: Record<ExternalMessengerRuntimeKey, { entryPath: string; workingDirectory: string; autoStart: boolean }>;
  private readonly externalStates: Record<ExternalMessengerRuntimeKey, ManagedExternalRuntime>;

  constructor(dependencies: MessengerRuntimeManagerDependencies) {
    this.startDiscord = dependencies.startDiscord;
    this.stopDiscord = dependencies.stopDiscord;
    this.isDiscordRunning = dependencies.isDiscordRunning;
    this.resolveSharedEnvironment = dependencies.resolveSharedEnvironment ?? (() => ({}));
    this.maxEvents = Math.max(30, dependencies.maxEvents ?? 250);
    this.externalConfigs = {
      telegram: {
        entryPath: toAbsolutePath(dependencies.telegram.entryPath),
        workingDirectory: toAbsolutePath(dependencies.telegram.workingDirectory ?? ""),
        autoStart: dependencies.telegram.autoStart === true
      },
      matrix: {
        entryPath: toAbsolutePath(dependencies.matrix.entryPath),
        workingDirectory: toAbsolutePath(dependencies.matrix.workingDirectory ?? ""),
        autoStart: dependencies.matrix.autoStart === true
      },
      whatsapp: {
        entryPath: toAbsolutePath(dependencies.whatsapp.entryPath),
        workingDirectory: toAbsolutePath(dependencies.whatsapp.workingDirectory ?? ""),
        autoStart: dependencies.whatsapp.autoStart === true
      }
    };
    this.externalStates = {
      telegram: {
        key: "telegram",
        process: null,
        stopRequested: false
      },
      matrix: {
        key: "matrix",
        process: null,
        stopRequested: false
      },
      whatsapp: {
        key: "whatsapp",
        process: null,
        stopRequested: false
      }
    };
    const discordRunning = this.isDiscordRunning();
    this.records.set("discord", {
      messenger: "discord",
      label: "Discord",
      mode: "embedded",
      configured: true,
      status: discordRunning ? "running" : "stopped",
      message: discordRunning ? "Connected to Discord." : discordStoppedMessage,
      pid: process.pid,
      startedAt: discordRunning ? new Date().toISOString() : null,
      stoppedAt: discordRunning ? null : new Date().toISOString(),
      lastExitCode: null,
      lastExitSignal: null
    });
    this.records.set("telegram", this.createExternalInitialRecord("telegram"));
    this.records.set("matrix", this.createExternalInitialRecord("matrix"));
    this.records.set("whatsapp", this.createExternalInitialRecord("whatsapp"));
  }

  private createExternalInitialRecord(key: ExternalMessengerRuntimeKey): MessengerRuntimeRecord {
    const config = this.externalConfigs[key];
    const configured = config.entryPath.length > 0;
    return {
      messenger: key,
      label: getExternalRuntimeLabel(key),
      mode: "process",
      configured,
      status: "stopped",
      message: configured
        ? `Ready. Command: ${toDisplayCommand(config.entryPath)}`
        : "Not configured.",
      pid: null,
      startedAt: null,
      stoppedAt: new Date().toISOString(),
      lastExitCode: null,
      lastExitSignal: null
    };
  }

  private pushEvent(messenger: MessengerRuntimeKey, level: "info" | "error", message: string): void {
    this.events.unshift({
      id: createEventId(),
      createdAt: new Date().toISOString(),
      messenger,
      level,
      message: message.slice(0, 1400)
    });
    this.events.splice(this.maxEvents);
  }

  private updateRecord(key: MessengerRuntimeKey, patch: Partial<MessengerRuntimeRecord>): MessengerRuntimeRecord {
    const current = this.records.get(key);
    if (!current) {
      throw new Error(`Runtime ${key} is not initialized.`);
    }
    const next: MessengerRuntimeRecord = {
      ...current,
      ...patch
    };
    this.records.set(key, next);
    return next;
  }

  private cloneRecord(key: MessengerRuntimeKey): MessengerRuntimeRecord {
    const current = this.records.get(key);
    if (!current) {
      throw new Error(`Runtime ${key} is not initialized.`);
    }
    return {
      ...current
    };
  }

  private refreshDiscordRecord(): void {
    const current = this.records.get("discord");
    if (!current || current.status === "starting" || current.status === "stopping") {
      return;
    }
    const running = this.isDiscordRunning();
    if (running && current.status !== "running") {
      this.updateRecord("discord", {
        status: "running",
        message: "Connected to Discord.",
        pid: process.pid,
        startedAt: current.startedAt ?? new Date().toISOString(),
        stoppedAt: null
      });
      return;
    }
    if (!running && current.status === "running") {
      this.updateRecord("discord", {
        status: "stopped",
        message: discordStoppedMessage,
        pid: null,
        stoppedAt: new Date().toISOString()
      });
    }
  }

  getSnapshot(): MessengerRuntimeSnapshot {
    this.refreshDiscordRecord();
    return {
      runtimes: (["discord", "telegram", "matrix", "whatsapp"] as const).map(key => this.cloneRecord(key)),
      events: this.events.map(event => ({ ...event }))
    };
  }

  async autoStartConfiguredRuntimes(): Promise<void> {
    const tasks: Promise<void>[] = [];
    if (this.externalConfigs.telegram.autoStart) {
      tasks.push(this.control({ messenger: "telegram", action: "start" }).then(() => undefined).catch(error => {
        this.pushEvent("telegram", "error", error instanceof Error ? error.message : String(error));
      }));
    }
    if (this.externalConfigs.matrix.autoStart) {
      tasks.push(this.control({ messenger: "matrix", action: "start" }).then(() => undefined).catch(error => {
        this.pushEvent("matrix", "error", error instanceof Error ? error.message : String(error));
      }));
    }
    if (this.externalConfigs.whatsapp.autoStart) {
      tasks.push(this.control({ messenger: "whatsapp", action: "start" }).then(() => undefined).catch(error => {
        this.pushEvent("whatsapp", "error", error instanceof Error ? error.message : String(error));
      }));
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  async control(input: {
    messenger: MessengerRuntimeKey;
    action: MessengerRuntimeControlAction;
    launchConfig?: DashboardMessengerRuntimeLaunchConfig;
  }): Promise<MessengerRuntimeRecord> {
    if (input.messenger === "discord") {
      if (input.action === "restart") {
        await this.stopDiscordRuntime();
        await this.startDiscordRuntime(input.launchConfig);
      } else if (input.action === "start") {
        await this.startDiscordRuntime(input.launchConfig);
      } else {
        await this.stopDiscordRuntime();
      }
      return this.cloneRecord("discord");
    }
    if (input.action === "restart") {
      await this.stopExternalRuntime(input.messenger);
      await this.startExternalRuntime(input.messenger, input.launchConfig);
    } else if (input.action === "start") {
      await this.startExternalRuntime(input.messenger, input.launchConfig);
    } else {
      await this.stopExternalRuntime(input.messenger);
    }
    return this.cloneRecord(input.messenger);
  }

  private async startDiscordRuntime(launchConfig?: DashboardMessengerRuntimeLaunchConfig): Promise<void> {
    const current = this.records.get("discord");
    if (!current) {
      return;
    }
    const credentialSourceLabel = describeCredentialSource(launchConfig);
    if (this.isDiscordRunning()) {
      this.updateRecord("discord", {
        status: "running",
        message: "Connected to Discord.",
        pid: process.pid,
        startedAt: current.startedAt ?? new Date().toISOString(),
        stoppedAt: null
      });
      return;
    }
    this.updateRecord("discord", {
      status: "starting",
      message: `Starting Discord runtime via ${credentialSourceLabel}...`,
      pid: process.pid,
      lastExitCode: null,
      lastExitSignal: null
    });
    this.pushEvent("discord", "info", `Starting Discord runtime via ${credentialSourceLabel}.`);
    try {
      await this.startDiscord(launchConfig?.discordToken?.trim() || undefined);
      this.updateRecord("discord", {
        status: "running",
        message: "Connected to Discord.",
        pid: process.pid,
        startedAt: new Date().toISOString(),
        stoppedAt: null
      });
      this.pushEvent("discord", "info", "Discord runtime is running.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.updateRecord("discord", {
        status: "error",
        message: detail || `Failed to start Discord runtime via ${credentialSourceLabel}.`,
        pid: null,
        stoppedAt: new Date().toISOString()
      });
      this.pushEvent("discord", "error", `Failed to start Discord runtime via ${credentialSourceLabel}: ${detail || "Unknown error"}`);
      throw error;
    }
  }

  private async stopDiscordRuntime(): Promise<void> {
    const current = this.records.get("discord");
    if (!current) {
      return;
    }
    if (!this.isDiscordRunning() && current.status !== "starting") {
      this.updateRecord("discord", {
        status: "stopped",
        message: discordStoppedMessage,
        pid: null,
        stoppedAt: new Date().toISOString()
      });
      return;
    }
    this.updateRecord("discord", {
      status: "stopping",
      message: "Stopping Discord runtime..."
    });
    this.pushEvent("discord", "info", "Stopping Discord runtime.");
    try {
      await this.stopDiscord();
      this.updateRecord("discord", {
        status: "stopped",
        message: discordStoppedMessage,
        pid: null,
        stoppedAt: new Date().toISOString()
      });
      this.pushEvent("discord", "info", "Discord runtime stopped.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.updateRecord("discord", {
        status: "error",
        message: detail || "Failed to stop Discord runtime."
      });
      this.pushEvent("discord", "error", `Failed to stop Discord runtime: ${detail || "Unknown error"}`);
      throw error;
    }
  }

  private getExternalRuntimeConfig(key: ExternalMessengerRuntimeKey): { entryPath: string; workingDirectory: string; autoStart: boolean } {
    return this.externalConfigs[key];
  }

  private getExternalRuntimeState(key: ExternalMessengerRuntimeKey): ManagedExternalRuntime {
    return this.externalStates[key];
  }

  private handleExternalStream(key: ExternalMessengerRuntimeKey, source: "stdout" | "stderr", chunk: Buffer): void {
    const raw = chunk.toString("utf8");
    const lines = raw.split("\n");
    for (const line of lines) {
      const cleaned = cleanLine(line);
      if (!cleaned) {
        continue;
      }
      this.pushEvent(key, source === "stderr" ? "error" : "info", `[${source}] ${cleaned}`);
    }
  }

  private async startExternalRuntime(key: ExternalMessengerRuntimeKey, launchConfig?: DashboardMessengerRuntimeLaunchConfig): Promise<void> {
    const config = this.getExternalRuntimeConfig(key);
    const state = this.getExternalRuntimeState(key);
    const current = this.records.get(key);
    const credentialSourceLabel = describeCredentialSource(launchConfig);
    if (!current) {
      return;
    }
    if (!config.entryPath) {
      const detail = `${current.label} runtime is not configured. Set an entry path in env.`;
      this.updateRecord(key, {
        status: "error",
        message: detail
      });
      this.pushEvent(key, "error", detail);
      throw new Error(detail);
    }
    if (state.process && !state.process.killed) {
      this.updateRecord(key, {
        status: "running",
        message: `${current.label} runtime is already running.`,
        pid: state.process.pid ?? null,
        startedAt: current.startedAt ?? new Date().toISOString(),
        stoppedAt: null
      });
      return;
    }
    const workingDirectory = config.workingDirectory || path.dirname(config.entryPath);
    this.updateRecord(key, {
      status: "starting",
      message: `Starting ${current.label} runtime via ${credentialSourceLabel}...`,
      pid: null,
      lastExitCode: null,
      lastExitSignal: null
    });
    this.pushEvent(key, "info", `Starting ${current.label} runtime via ${credentialSourceLabel} with command: ${toDisplayCommand(config.entryPath)}`);
    try {
      const sharedEnvironment = this.resolveSharedEnvironment();
      const nextProcess = spawn(process.execPath, [config.entryPath], {
        cwd: workingDirectory || process.cwd(),
        env: {
          ...process.env,
          ...sharedEnvironment,
          ...this.toExternalCredentialEnvironment(key, launchConfig)
        },
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      });
      nextProcess.stdin.end();
      state.process = nextProcess;
      state.stopRequested = false;
      nextProcess.stdout.on("data", chunk => this.handleExternalStream(key, "stdout", chunk));
      nextProcess.stderr.on("data", chunk => this.handleExternalStream(key, "stderr", chunk));
      nextProcess.on("error", error => {
        const detail = error instanceof Error ? error.message : String(error);
        this.updateRecord(key, {
          status: "error",
          message: detail || `Failed to run ${current.label}.`,
          pid: null,
          stoppedAt: new Date().toISOString()
        });
        this.pushEvent(key, "error", `${current.label} runtime process error: ${detail || "Unknown error"}`);
      });
      nextProcess.on("exit", (code, signal) => {
        const requestedStop = state.stopRequested;
        state.process = null;
        state.stopRequested = false;
        const status: MessengerRuntimeStatus = requestedStop || code === 0 ? "stopped" : "error";
        const summary = requestedStop
          ? `${current.label} runtime stopped.`
          : code === 0
            ? `${current.label} runtime exited normally.`
            : `${current.label} runtime exited with code ${code ?? "null"}${signal ? ` (${signal})` : ""}.`;
        this.updateRecord(key, {
          status,
          message: summary,
          pid: null,
          stoppedAt: new Date().toISOString(),
          lastExitCode: typeof code === "number" ? code : null,
          lastExitSignal: signal ?? null
        });
        this.pushEvent(key, status === "error" ? "error" : "info", summary);
      });
      await new Promise<void>((resolve, reject) => {
        nextProcess.once("spawn", () => resolve());
        nextProcess.once("error", error => reject(error));
      });
      this.updateRecord(key, {
        status: "running",
        message: `${current.label} runtime is running.`,
        pid: nextProcess.pid ?? null,
        startedAt: new Date().toISOString(),
        stoppedAt: null
      });
      this.pushEvent(key, "info", `${current.label} runtime is running${nextProcess.pid ? ` (pid ${nextProcess.pid})` : ""}.`);
    } catch (error) {
      state.process = null;
      state.stopRequested = false;
      const detail = error instanceof Error ? error.message : String(error);
      this.updateRecord(key, {
        status: "error",
        message: detail || `Failed to start ${current.label} via ${credentialSourceLabel}.`,
        pid: null,
        stoppedAt: new Date().toISOString()
      });
      this.pushEvent(key, "error", `Failed to start ${current.label} runtime via ${credentialSourceLabel}: ${detail || "Unknown error"}`);
      throw error;
    }
  }

  private async stopExternalRuntime(key: ExternalMessengerRuntimeKey): Promise<void> {
    const state = this.getExternalRuntimeState(key);
    const current = this.records.get(key);
    if (!current) {
      return;
    }
    if (!state.process) {
      this.updateRecord(key, {
        status: "stopped",
        message: `${current.label} runtime is already stopped.`,
        pid: null,
        stoppedAt: new Date().toISOString()
      });
      return;
    }
    const processToStop = state.process;
    state.stopRequested = true;
    this.updateRecord(key, {
      status: "stopping",
      message: `Stopping ${current.label} runtime...`
    });
    this.pushEvent(key, "info", `Stopping ${current.label} runtime.`);
    const waitForExit = new Promise<void>(resolve => {
      processToStop.once("exit", () => resolve());
    });
    processToStop.kill();
    const timeout = new Promise<void>(resolve => setTimeout(resolve, 5_000));
    await Promise.race([waitForExit, timeout]);
    if (state.process && !state.process.killed) {
      state.process.kill("SIGKILL");
      await new Promise<void>(resolve => {
        state.process?.once("exit", () => resolve());
        setTimeout(resolve, 1_500);
      });
    }
    this.updateRecord(key, {
      status: "stopped",
      message: `${current.label} runtime stopped.`,
      pid: null,
      stoppedAt: new Date().toISOString()
    });
    this.pushEvent(key, "info", `${current.label} runtime stopped.`);
  }

  private toExternalCredentialEnvironment(
    key: ExternalMessengerRuntimeKey,
    launchConfig?: DashboardMessengerRuntimeLaunchConfig
  ): Record<string, string> {
    if (!launchConfig) {
      return {};
    }
    if (key === "telegram") {
      return launchConfig.telegramBotToken?.trim()
        ? { TELEGRAM_BOT_TOKEN: launchConfig.telegramBotToken.trim() }
        : {};
    }
    if (key === "matrix") {
      return {
        ...(launchConfig.matrixHomeserverUrl?.trim() ? { MATRIX_HOMESERVER_URL: launchConfig.matrixHomeserverUrl.trim() } : {}),
        ...(launchConfig.matrixAccessToken?.trim() ? { MATRIX_ACCESS_TOKEN: launchConfig.matrixAccessToken.trim() } : {}),
        ...(launchConfig.matrixBotUserId?.trim() ? { MATRIX_BOT_USER_ID: launchConfig.matrixBotUserId.trim() } : {})
      };
    }
    return {
      ...(launchConfig.whatsappAccessToken?.trim() ? { WHATSAPP_ACCESS_TOKEN: launchConfig.whatsappAccessToken.trim() } : {}),
      ...(launchConfig.whatsappPhoneNumberId?.trim() ? { WHATSAPP_PHONE_NUMBER_ID: launchConfig.whatsappPhoneNumberId.trim() } : {}),
      ...(launchConfig.whatsappApiVersion?.trim() ? { WHATSAPP_API_VERSION: launchConfig.whatsappApiVersion.trim() } : {})
    };
  }
}

export function createMessengerRuntimeManager(dependencies: MessengerRuntimeManagerDependencies): MessengerRuntimeManager {
  return new MessengerRuntimeManager(dependencies);
}
