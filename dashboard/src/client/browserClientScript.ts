import { buildDashboardClientScript } from "./clientScriptAssembler.js";

/**
 * Builds the browser-side dashboard script from the ordered client manifest.
 */
export function getDashboardBrowserClientScript(): string {
  return buildDashboardClientScript();
}

export const dashboardBrowserClientScript = getDashboardBrowserClientScript();
