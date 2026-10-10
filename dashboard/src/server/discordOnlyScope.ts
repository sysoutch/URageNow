const discordGetPaths = new Set([
  "/", "/health", "/ready", "/dashboard-login", "/api/discord/status", "/api/guilds",
  "/api/command-definitions", "/api/command-settings", "/api/guild-settings",
  "/api/channels", "/api/games", "/api/invite-link",
  "/api/guild-invites", "/api/users", "/api/roles", "/api/guild-dashboard-settings",
  "/api/channel-bot-messages", "/api/dms", "/api/dm-messages", "/api/discord/automations"
]);
const discordPostPaths = new Set([
  "/dashboard-login", "/dashboard-logout", "/api/discord/runtime", "/api/command-settings/global", "/api/command-settings/guild",
  "/api/command-sync/global", "/api/command-sync/guild", "/api/guild-settings",
  "/api/games", "/api/send-message", "/api/send-dm", "/api/discord/moderation", "/api/discord/automations"
]);

export function isDiscordOnlyDashboardPath(method: string | undefined, pathname: string): boolean {
  if (method === "GET") return discordGetPaths.has(pathname);
  if (method === "POST") return discordPostPaths.has(pathname);
  return false;
}

const botsGetPaths = new Set([
  "/bots-dashboard",
  "/api/messenger-runtimes", "/api/telegram/chats", "/api/matrix/rooms", "/api/matrix/health",
  "/api/matrix/events", "/api/matrix/workflow-permissions", "/api/whatsapp/contacts"
]);
const botsPostPaths = new Set([
  "/api/messenger-runtimes/control", "/api/telegram/send-message", "/api/matrix/rooms/refresh",
  "/api/matrix/workflow-permissions", "/api/matrix/send-message", "/api/whatsapp/send-message"
]);

export function isBotsDashboardPath(method: string | undefined, pathname: string): boolean {
  return isDiscordOnlyDashboardPath(method, pathname)
    || (method === "GET" && botsGetPaths.has(pathname))
    || (method === "POST" && botsPostPaths.has(pathname));
}
