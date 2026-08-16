import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appConfig } from "../config/appConfig.js";

export const matrixWorkflowActions = ["chat", "image", "audio", "music", "video", "model3d"] as const;
export type MatrixWorkflowAction = typeof matrixWorkflowActions[number];
export type MatrixRoomWorkflowPermission = { workflows: MatrixWorkflowAction[]; allowAllMembers: boolean };
export type MatrixWorkflowPermissionConfig = { version: 1; rooms: Record<string, MatrixRoomWorkflowPermission> };

const filePath = path.join(appConfig.dataDirectory, "matrix-workflow-permissions.json");
let pending = Promise.resolve();

function normalizeActions(value: unknown): MatrixWorkflowAction[] {
  const allowed = new Set(matrixWorkflowActions);
  return [...new Set(Array.isArray(value) ? value.map(String).filter((action): action is MatrixWorkflowAction => allowed.has(action as MatrixWorkflowAction)) : [])];
}

function normalizeConfig(value: unknown): MatrixWorkflowPermissionConfig {
  const rooms: Record<string, MatrixRoomWorkflowPermission> = {};
  if (value && typeof value === "object" && !Array.isArray(value) && (value as { rooms?: unknown }).rooms && typeof (value as { rooms: unknown }).rooms === "object") {
    for (const [roomId, actions] of Object.entries((value as { rooms: Record<string, unknown> }).rooms)) {
      const normalizedRoomId = roomId.trim();
      const legacyActions = normalizeActions(actions);
      const entry = actions && typeof actions === "object" && !Array.isArray(actions) ? actions as { workflows?: unknown; allowAllMembers?: unknown } : null;
      const workflows = entry ? normalizeActions(entry.workflows) : legacyActions;
      if (normalizedRoomId.startsWith("!") && workflows.length > 0) {
        rooms[normalizedRoomId] = { workflows, allowAllMembers: entry?.allowAllMembers === true };
      }
    }
  }
  return { version: 1, rooms };
}

async function readConfig(): Promise<MatrixWorkflowPermissionConfig> {
  return normalizeConfig(await readFile(filePath, "utf8").then(JSON.parse).catch(() => null));
}

async function writeConfig(config: MatrixWorkflowPermissionConfig): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(config, null, 2), "utf8");
  await rename(temporaryPath, filePath);
}

function queue<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation, operation);
  pending = result.then(() => undefined, () => undefined);
  return result;
}

export function listMatrixWorkflowPermissions(): Promise<MatrixWorkflowPermissionConfig> {
  return queue(readConfig);
}

export function setMatrixRoomWorkflowPermissions(roomId: string, actions: unknown, allowAllMembers: boolean): Promise<MatrixWorkflowPermissionConfig> {
  return queue(async () => {
    const normalizedRoomId = roomId.trim();
    if (!normalizedRoomId.startsWith("!")) throw new Error("Matrix room ID must start with !.");
    const config = await readConfig();
    const normalizedActions = normalizeActions(actions);
    if (normalizedActions.length > 0) config.rooms[normalizedRoomId] = { workflows: normalizedActions, allowAllMembers: allowAllMembers === true };
    else delete config.rooms[normalizedRoomId];
    await writeConfig(config);
    return config;
  });
}
