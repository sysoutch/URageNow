# Add Cron Job

Create or update a scheduled automation (cron job) for Messenger Bots like Discord or Telegram.

## Inputs
- Messenger target (`discord` or `telegram`).
- Destination ID (`channelId` for Discord, `chatId` for Telegram).
- Job name.
- Action source (`template`, `jokes-file`, `ollama`, `image`, or `model-3d`).
- Cron expression (or interval configuration if the user prefers interval mode).

## Behavior
- Gather missing required fields before finalizing the job.
- Build a clean automation payload that can be sent to `/api/scheduled-automations`.
- Use `targetMessenger: "telegram"` only for Telegram jobs.
- Never use `source: "model-3d"` for Telegram scheduled automations.

## Output
- Return a concise summary of the cron job and the final payload JSON.
- If required details are missing, return a short checklist of what is still needed.
