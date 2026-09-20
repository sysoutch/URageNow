import type { ManifestActionContext } from "./serverToolActionDispatcher.js";
import { saveToolArtifact } from "./toolArtifactStore.js";
import { ToolInvocationError } from "./toolInvocationError.js";

type DialogueNode = {
  id: string | number;
  x: number;
  y: number;
  type: "speech" | "choice";
  character: string;
  text: string;
  condition: string;
  action: string;
};

function boundedText(value: unknown, label: string, maximum: number, required = false): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new ToolInvocationError(400, `${label} is required.`);
  if (Buffer.byteLength(text, "utf8") > maximum) throw new ToolInvocationError(413, `${label} exceeds the ${maximum} byte limit.`);
  return text;
}

function finiteNumber(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > 100_000) throw new ToolInvocationError(400, `${label} must be a finite position within the supported range.`);
  return Math.round(number);
}

function parseVariables(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 128) throw new ToolInvocationError(400, "variables must contain at most 128 names.");
  const variables = value.map((entry, index) => boundedText(entry, `variables[${index}]`, 128, true));
  if (new Set(variables).size !== variables.length) throw new ToolInvocationError(400, "variables must not contain duplicate names.");
  return variables;
}

function parseNodes(value: unknown): DialogueNode[] {
  if (!Array.isArray(value) || !value.length || value.length > 256) throw new ToolInvocationError(400, "nodes must contain between 1 and 256 entries.");
  const nodes = value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new ToolInvocationError(400, `nodes[${index}] must be an object.`);
    const node = entry as Record<string, unknown>;
    const id = typeof node.id === "string" || typeof node.id === "number" ? node.id : null;
    if (id === null || String(id).trim() === "") throw new ToolInvocationError(400, `nodes[${index}].id is required.`);
    const type: DialogueNode["type"] | null = node.type === "speech" || node.type === "choice" ? node.type : null;
    if (!type) throw new ToolInvocationError(400, `nodes[${index}].type must be speech or choice.`);
    return {
      id,
      x: finiteNumber(node.x, `nodes[${index}].x`),
      y: finiteNumber(node.y, `nodes[${index}].y`),
      type,
      character: boundedText(node.character, `nodes[${index}].character`, 256, true),
      text: boundedText(node.text, `nodes[${index}].text`, 8192),
      condition: boundedText(node.condition, `nodes[${index}].condition`, 2048),
      action: boundedText(node.action, `nodes[${index}].action`, 2048)
    };
  });
  if (new Set(nodes.map(node => String(node.id))).size !== nodes.length) throw new ToolInvocationError(400, "nodes must not contain duplicate ids.");
  return nodes;
}

function parseConnections(value: unknown, nodeIds: Set<string>): Array<{ from: string | number; to: string | number }> {
  if (!Array.isArray(value) || value.length > 1024) throw new ToolInvocationError(400, "connections must contain at most 1,024 entries.");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new ToolInvocationError(400, `connections[${index}] must be an object.`);
    const connection = entry as Record<string, unknown>;
    const from = typeof connection.from === "string" || typeof connection.from === "number" ? connection.from : null;
    const to = typeof connection.to === "string" || typeof connection.to === "number" ? connection.to : null;
    if (from === null || to === null || !nodeIds.has(String(from)) || !nodeIds.has(String(to)) || String(from) === String(to)) {
      throw new ToolInvocationError(400, `connections[${index}] must connect two distinct existing nodes.`);
    }
    return { from, to };
  });
}

export async function exportDialogueTree({ manifest, input, dependencies }: ManifestActionContext): Promise<unknown> {
  const variables = parseVariables(input.variables ?? []);
  const nodes = parseNodes(input.nodes);
  const connections = parseConnections(input.connections ?? [], new Set(nodes.map(node => String(node.id))));
  const engine = { variables, nodes, connections };
  const artifact = await saveToolArtifact({
    sourceToolId: manifest.id,
    fileName: "urage_engine_data.json",
    mimeType: "application/json",
    data: JSON.stringify(engine, null, 2),
    metadata: { variableCount: variables.length, nodeCount: nodes.length, connectionCount: connections.length }
  });
  dependencies.runtimeState.recordAction("dashboard:dialogue-tree-visualizer", `Exported dialogue tree with ${nodes.length} nodes and ${connections.length} connections.`);
  return { ...engine, artifact };
}
