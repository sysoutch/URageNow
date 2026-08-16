import type { IncomingMessage, ServerResponse } from "node:http";
import type { DashboardDependencies } from "./runtime/botBridge.js";

type DashboardHttpMethod = "GET" | "POST";

interface DashboardRouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  dependencies: DashboardDependencies;
}

type DashboardRouteHandler = (context: DashboardRouteContext) => Promise<void>;
type DashboardRequestHandler = (request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies) => Promise<void>;
type DashboardRouteTable = Record<DashboardHttpMethod, Map<string, DashboardRouteHandler>>;
type DashboardRouteDefinition = readonly [DashboardHttpMethod, string, DashboardRouteHandler];

function toRouteHandler(handler: DashboardRequestHandler): DashboardRouteHandler {
  return async context => handler(context.request, context.response, context.url, context.dependencies);
}

function getRoute(pathname: string, handler: DashboardRequestHandler): DashboardRouteDefinition {
  return ["GET", pathname, toRouteHandler(handler)];
}

function postRoute(pathname: string, handler: DashboardRequestHandler): DashboardRouteDefinition {
  return ["POST", pathname, toRouteHandler(handler)];
}

function createDashboardRouteTable(entries: DashboardRouteDefinition[]): DashboardRouteTable {
  const table: DashboardRouteTable = {
    GET: new Map<string, DashboardRouteHandler>(),
    POST: new Map<string, DashboardRouteHandler>()
  };
  for (const [method, pathname, handler] of entries) {
    table[method].set(pathname, handler);
  }
  return table;
}

function resolveDashboardMethod(value: string | undefined): DashboardHttpMethod | null {
  if (value === "GET" || value === "POST") {
    return value;
  }
  return null;
}

async function dispatchDashboardRoute(table: DashboardRouteTable, context: DashboardRouteContext): Promise<boolean> {
  const method = resolveDashboardMethod(context.request.method);
  if (!method) {
    return false;
  }
  const handler = table[method].get(context.url.pathname);
  if (!handler) {
    return false;
  }
  await handler(context);
  return true;
}

export { createDashboardRouteTable, dispatchDashboardRoute, getRoute, postRoute };
