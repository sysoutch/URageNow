import type { IncomingMessage, ServerResponse } from "node:http";
import {
  deleteGamePackage,
  getInstalledGamePackage,
  importGamePackage,
  installUploadedGamePackage,
  listGamePackages,
  setGameRuntimeEnabled,
  supportedGameRuntimes,
  updateGameConfiguration,
  type GameRuntimeId
} from "@urage/server/services/games/gamePackageStore";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { parseJsonBody, sendJson } from "../http.js";
import { createDashboardRouteTable, dispatchDashboardRoute, getRoute, postRoute } from "../router.js";

async function handleGetGames(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  sendJson(response, 200, await listGamePackages());
}

async function handlePostGames(request: IncomingMessage, response: ServerResponse, _url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const action = typeof body.action === "string" ? body.action : "";
  try {
    if (action === "import-bundled") {
      const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "";
      const installed = await importGamePackage(gameId);
      dependencies.runtimeState.recordAction("dashboard:game-import", `Imported game package ${installed.id}.`);
      sendJson(response, 201, { game: installed });
      return;
    }
    if (action === "import-package") {
      const installed = await installUploadedGamePackage(body.gamePackage);
      dependencies.runtimeState.recordAction("dashboard:game-import", `Imported game package ${installed.id}.`);
      sendJson(response, 201, { game: installed });
      return;
    }
    const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "";
    if (!gameId) {
      sendJson(response, 400, { error: "gameId is required." });
      return;
    }
    if (action === "get-configuration") {
      const game = await getInstalledGamePackage(gameId);
      if (!game) throw new Error("Installed game package was not found or is invalid.");
      sendJson(response, 200, { game: game.packageInfo, configuration: game.configuration });
      return;
    }
    if (action === "update-configuration") {
      const configuration = await updateGameConfiguration(gameId, body.configuration);
      dependencies.runtimeState.recordAction("dashboard:game-configuration", `Updated configuration for ${gameId}.`);
      sendJson(response, 200, { configuration });
      return;
    }
    if (action === "delete") {
      await deleteGamePackage(gameId);
      dependencies.runtimeState.recordAction("dashboard:game-delete", `Deleted installed game package ${gameId}.`);
      sendJson(response, 200, { deleted: gameId });
      return;
    }
    if (action === "enable" || action === "disable") {
      const runtime = typeof body.runtime === "string" ? body.runtime : "";
      if (dependencies.dashboardScope === "discord" && runtime !== "discord") {
        sendJson(response, 400, { error: "This dashboard manages Discord games only." });
        return;
      }
      if (!(supportedGameRuntimes as readonly string[]).includes(runtime)) {
        sendJson(response, 400, { error: "A supported runtime is required." });
        return;
      }
      const updated = await setGameRuntimeEnabled(gameId, runtime as GameRuntimeId, action === "enable");
      dependencies.runtimeState.recordAction(`dashboard:game-${action}`, `${action === "enable" ? "Enabled" : "Disabled"} ${gameId} for ${runtime}.`);
      sendJson(response, 200, { game: updated });
      return;
    }
    sendJson(response, 400, { error: "Unsupported game management action." });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Game package operation failed." });
  }
}

const gameRouteTable = createDashboardRouteTable([
  getRoute("/api/games", handleGetGames),
  postRoute("/api/games", handlePostGames)
]);

export async function handleDashboardGameRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: DashboardDependencies
): Promise<boolean> {
  return dispatchDashboardRoute(gameRouteTable, { request, response, url, dependencies });
}
