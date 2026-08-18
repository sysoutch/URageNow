/**
 * Shared runtime composition entrypoint.
 *
 * Its launch role is configured by the caller. In particular, do not override
 * DASHBOARD_ENABLED here: run-server.cmd deliberately runs headless, while
 * run-dashboard.cmd owns the dashboard HTTP server.
 */

await import("../bots/discord-bot/src/index.js");
