# Dashboard Client Modules

This folder is still a legacy browser-script bundle, but new work should keep it moving toward clear ownership boundaries.

Rules:
- Every `.js` module under `dashboard/src/client/modules` must be listed in `dashboard/src/client/clientScriptManifest.ts` in dependency order.
- Bootstrap modules must pass late-created helpers through lazy wrappers or proxy functions, never direct shorthand references that can trigger temporal-dead-zone startup crashes.
- Top-level modules should be temporary composition seams. Feature-owned code belongs under folders such as `dashboard/3d`, `dashboard/image`, `dashboard/tools`, or `messenger`.
- Run `npm run check:dashboard` after client changes. It validates the manifest/proxy rules before TypeScript checking.

Current cleanup direction:
- Keep `client/client.js` as the tiny entrypoint only.
- Keep `dashboardClientBootstrap.js` as orchestration glue while moving real behavior into owner modules.
- Prefer deleting dead compatibility modules over leaving unlisted files in this folder.
