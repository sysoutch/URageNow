import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dashboardSourceRoot, repoRoot } from "@urage/server/config/repositoryPaths";
import { getDashboardClientComfyWorkflowPathsScript } from "../shared/comfyWorkflowPaths.js";
import { dashboardClientScriptParts, type DashboardClientScriptPart } from "./clientScriptManifest.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const dashboardSourceDirectory = path.resolve(moduleDirectory, "..");

function getDashboardClientScriptCandidates(relativePath: string): string[] {
  return [...new Set([
    path.resolve(dashboardSourceRoot, relativePath),
    path.resolve(repoRoot, "dist", "dashboard", "src", relativePath),
    path.resolve(dashboardSourceDirectory, relativePath)
  ])];
}

export function readDashboardClientScriptPart(part: DashboardClientScriptPart): string {
  for (const candidate of getDashboardClientScriptCandidates(part.relativePath)) {
    try {
      return readFileSync(candidate, "utf8").replace(/<\/script/gi, "<\\/script");
    } catch {
      continue;
    }
  }
  if (part.required === false) {
    return "";
  }
  return `console.error('Dashboard client script part could not be loaded: ${part.relativePath}');`;
}

export function buildDashboardClientScript(): string {
  const parts = [
    getDashboardClientComfyWorkflowPathsScript(),
    ...dashboardClientScriptParts.map(readDashboardClientScriptPart)
  ];
  return parts.filter(Boolean).join("\n");
}
