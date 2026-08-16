# Matrix Bot

This runtime is managed by the main `discord-bot` process (Messenger Runtime panel in dashboard).

## Environment

Copy `.env.example` to `.env` and set:

- `MATRIX_HOMESERVER_URL`
- `MATRIX_ACCESS_TOKEN`
- optionally `MATRIX_BOT_USER_ID`
- optionally `MATRIX_STATE_DIRECTORY` for persistent sync and encryption state
- `DASHBOARD_BASE_URL` and `DASHBOARD_ACCESS_TOKEN` for Chat/Image/3D generation
- `MATRIX_ALLOWED_USER_IDS` and/or `MATRIX_ALLOWED_ROOM_IDS` to authorize workflow commands when a room has no dashboard rule

Workflow access is locked by default until at least one allowlist or Dashboard Matrix room rule is configured. In Messenger > Matrix, choose a room, enable its exact workflows, and explicitly allow its members. A room rule is inactive until member access is enabled; rooms without a rule retain the legacy environment allowlist behavior. Set `MATRIX_WORKFLOW_REQUIRE_ALLOWLIST=false` only for a private, tightly controlled room.

For an interactive user-run process, `MATRIX_ACCESS_TOKEN` can instead be stored as `matrix.default.access-token` in the operating system credential store. The environment variable remains the explicit service and CI override.

If these are missing, the process still starts, but Matrix API actions are disabled until configured.

The bot now uses `matrix-bot-sdk` with the Matrix Rust crypto store instead of maintaining a custom `/sync` client. Incoming encrypted room events are decrypted by the SDK, outgoing text is encrypted automatically in encrypted rooms, and uploaded Image/3D artifacts use Matrix encrypted-file descriptors. Preserve `MATRIX_STATE_DIRECTORY`: deleting it creates a new cryptographic device and loses the old local session state.

The selected SDK release supports this repository's Node 22 baseline, but its legacy HTTP dependency tree currently has unresolved npm advisories. The homeserver origin remains fixed by configuration and must use HTTPS. Keep this service isolated and update to the Node 24-compatible SDK line when the repository baseline permits it.

## Admin API

- `GET /health`
- `GET /rooms`
- `GET /events`
- `POST /refresh-rooms`
- `POST /send-message` with `{ "roomId": "...", "text": "..." }`

## Room commands

- `!ask <prompt>` asks the active dashboard text model and is the readable command used by Android Companion Chat.
- `!chat <prompt>` remains supported for existing Matrix users.
- `!image <prompt>` runs Image Studio, uploads the result to Matrix, and posts it as `m.image`.
- `!3d <prompt>` generates a source image, runs the configured image-to-3D workflow, uploads the model, and posts it as `m.file`.

Android Companion uses readable `!ask <prompt>` messages for Chat. Its media workflows continue to use a correlated `!urage` protocol with an opaque request ID and base64url JSON payload, because their results can include encrypted attachments. Correlated results are accepted only from the configured Matrix bot user ID, preventing another room member from spoofing successful responses. The Android client uses the official Matrix Rust SDK bindings for persistent sync, E2EE, and encrypted `mxc://` downloads.

Android source images use an encrypted `m.image` event captioned with an opaque `URAGE_SOURCE` token before the correlated workflow request. The bot retains only the encrypted descriptor for up to 30 minutes, requires the source sender and room to match the allowlisted workflow request, consumes each token once, decrypts through the SDK, validates the actual image signature, and rejects files above 20 MiB. Plaintext Matrix media URLs are never accepted as workflow sources.

Android Chat Studio recordings are encrypted `m.file` attachments captioned with an opaque `URAGE_AUDIO_SOURCE` token. Sending the attached clip uses the correlated `stt` relay action, which consumes that exact attachment once, runs the dashboard `stt.json` workflow, and returns the transcript to Android. STT is authorized through the existing `audio` workflow permission.

Media relay responses use ordered `URAGE_PROGRESS` events followed by one `URAGE_RESULT`. Progress is buffered to avoid a Matrix event per model token. The bot and Android must use different Matrix accounts because the bot deliberately ignores its own events.

Allowlisted rooms also support `!audio <prompt>`, `!music <tags>`, and `!video <prompt>` alongside Chat, Image, and 3D. Android Internet mode uses the same encrypted relay actions for all five media Studios.

Production credentials are stored in the operating-system credential store as `matrix.default.access-token` and `matrix.bot.password`; keep `MATRIX_ACCESS_TOKEN` blank in `.env`. `node scripts/rotate-matrix-bot-credentials.mjs` is a one-time administrator migration: it creates a dedicated non-admin bot and encrypted companion room, validates the replacement, updates the allowlists, and only then revokes the old token.
