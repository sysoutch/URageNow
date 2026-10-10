/** Start the Discord bot dashboard without the Studio dashboard or other messenger runtimes. */
process.env.URAGE_DASHBOARD_SCOPE = "discord";
process.env.DASHBOARD_ENABLED = "true";
process.env.DASHBOARD_UI_ENABLED = "true";

await import("../bots/discord-bot/src/index.js");
