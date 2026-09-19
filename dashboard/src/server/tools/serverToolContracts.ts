import type { DashboardDependencies } from "../runtime/botBridge.js";

export interface ServerToolDefinition {
  id: string;
  title: string;
  description: string;
  inputSchema: object;
}

export interface ServerToolAdapter extends ServerToolDefinition {
  action?: string;
  invoke(input: Record<string, unknown>, dependencies: DashboardDependencies): Promise<unknown>;
}