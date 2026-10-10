/** Start the shared bot dashboard without Studio, media, or companion services. */
process.env.URAGE_DASHBOARD_SCOPE = "bots";
process.env.DASHBOARD_ENABLED = "true";
process.env.DASHBOARD_UI_ENABLED = "true";

await import("../bots/discord-bot/src/index.js");
