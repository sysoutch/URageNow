# WhatsApp Bot

This runtime is managed by the main `discord-bot` process (Messenger Runtime panel in dashboard).

## Environment

Copy `.env.example` to `.env` and set:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

For an interactive user-run process, `WHATSAPP_ACCESS_TOKEN` can instead be stored as `whatsapp.default.access-token` in the operating system credential store. The environment variable remains the explicit service and CI override.

Optional:

- `WHATSAPP_CONTACTS` to prefill common recipients in dashboard.

If credentials are missing, the process still starts, but WhatsApp Cloud API actions are disabled until configured.

## Admin API

- `GET /health`
- `GET /contacts`
- `GET /events`
- `POST /send-message` with `{ "to": "+15551234567", "text": "Hello" }`
