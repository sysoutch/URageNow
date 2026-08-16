import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const dataRoot = path.join(repoRoot, "data");
export const toolsRoot = path.join(repoRoot, "tools");
export const workflowRoot = path.join(repoRoot, "comfyui-workflows");
export const dashboardRoot = path.join(repoRoot, "dashboard");
export const dashboardSourceRoot = path.join(dashboardRoot, "src");
export const dashboardChatSkillsRoot = path.join(dashboardRoot, "chat-skills");
export const sharedConfigRoot = path.join(repoRoot, "shared");
export const repositoryRootCandidates = [repoRoot] as const;

export function resolveRepoPath(...segments: string[]): string {
  return path.resolve(repoRoot, ...segments);
}
