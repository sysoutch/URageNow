export type DashboardConsoleLogLevel = "info" | "warn" | "error";

export interface DashboardLlmConsoleEventInput {
  source: string;
  provider: string;
  model: string;
  prompt: string;
  response: string;
  reasoning?: string;
  imageCount?: number;
  durationMs: number;
  error?: string;
}

export interface DashboardSystemConsoleEventInput {
  source: string;
  level: DashboardConsoleLogLevel;
  message: string;
  detail?: string;
}

interface DashboardConsoleLogger {
  recordLlm: (event: DashboardLlmConsoleEventInput) => void;
  recordSystem: (event: DashboardSystemConsoleEventInput) => void;
}

let activeLogger: DashboardConsoleLogger | null = null;

export function setDashboardConsoleLogger(logger: DashboardConsoleLogger | null): void {
  activeLogger = logger;
}

export function recordDashboardLlmConsoleEvent(event: DashboardLlmConsoleEventInput): void {
  activeLogger?.recordLlm(event);
}

export function recordDashboardSystemConsoleEvent(event: DashboardSystemConsoleEventInput): void {
  activeLogger?.recordSystem(event);
}
