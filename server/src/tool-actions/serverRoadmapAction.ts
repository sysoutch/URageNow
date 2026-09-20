import type { ManifestActionContext } from "./serverToolActionDispatcher.js";
import { saveToolArtifact } from "./toolArtifactStore.js";
import { ToolInvocationError } from "./toolInvocationError.js";

function text(value: unknown, label: string, maximum: number, required = false): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ToolInvocationError(400, `${label} is required.`);
  if (Buffer.byteLength(result, "utf8") > maximum) throw new ToolInvocationError(413, `${label} exceeds the ${maximum} byte limit.`);
  return result;
}

export async function exportRoadmap({ manifest, input, dependencies }: ManifestActionContext): Promise<unknown> {
  if (!Array.isArray(input.milestones) || !input.milestones.length || input.milestones.length > 256) {
    throw new ToolInvocationError(400, "milestones must contain between 1 and 256 entries.");
  }
  const milestones = input.milestones.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new ToolInvocationError(400, `milestones[${index}] must be an object.`);
    const milestone = entry as Record<string, unknown>;
    return { title: text(milestone.title, `milestones[${index}].title`, 256, true), desc: text(milestone.desc, `milestones[${index}].desc`, 4096, true) };
  });
  const roadmap = { milestones };
  const artifact = await saveToolArtifact({
    sourceToolId: manifest.id,
    fileName: "roadmap.json",
    mimeType: "application/json",
    data: JSON.stringify(roadmap, null, 2),
    metadata: { milestoneCount: milestones.length }
  });
  dependencies.runtimeState.recordAction("dashboard:roadmap-builder", `Exported roadmap with ${milestones.length} milestones.`);
  return { ...roadmap, artifact };
}
