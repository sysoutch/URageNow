/**
 * Neutral dashboard process entrypoint.
 *
 * Messenger processes are opt-in and are controlled through Dashboard Settings.
 * The legacy Discord composition module still supplies feature adapters while
 * those adapters are moved into dedicated runtime packages incrementally.
 */
process.env.DASHBOARD_ENABLED = "true";
process.env.DISCORD_RUNTIME_AUTOSTART = "false";
process.env.TELEGRAM_BOT_AUTOSTART = "false";
process.env.MATRIX_BOT_AUTOSTART = "false";
process.env.WHATSAPP_BOT_AUTOSTART = "false";
process.env.DISCORD_TOKEN_RUNTIME ||= "";

await import("../bots/discord-bot/src/index.js");
