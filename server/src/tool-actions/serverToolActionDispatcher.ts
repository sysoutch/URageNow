import type { ToolActionDependencies } from "./serverToolContracts.js";
import type { ServerToolManifest } from "./serverToolManifest.js";
import { hasManifestAction as hasRegisteredManifestAction, invokeManifestAction as invokeRegisteredManifestAction } from "./serverToolActionRegistry.js";

export interface ManifestActionContext {
  manifest: ServerToolManifest;
  input: Record<string, unknown>;
  dependencies: ToolActionDependencies;
}

/** Public boundary for vetted actions selected by declarative server-tool manifests. */
export function hasManifestAction(action: string): boolean {
  return hasRegisteredManifestAction(action);
}

export function invokeManifestAction(context: ManifestActionContext): Promise<unknown> {
  return invokeRegisteredManifestAction(context);
}