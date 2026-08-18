# URage NOW Tauri Desktop Plan

## Goal

URage NOW should run as both:

- a normal browser dashboard at `http://127.0.0.1:4782`
- a Tauri desktop window that loads that same local dashboard URL

This keeps the current browser workflow intact while adding a desktop shell.

## Browser Compatibility Contract

Browser mode stays first-class. The dashboard UI, routes, generated CSS, static tools, and API endpoints should continue to work over the local HTTP server without Tauri present. Desktop-only affordances can be added later, but core navigation and creation workflows should not require Tauri IPC.

Practical rule: if a feature can reasonably work in the browser, implement it through the dashboard server/API first. Use Tauri commands only for desktop-only OS integration such as app window controls, installer behavior, tray integration, native file associations, or launching a bundled sidecar.

## Current Shape

The dashboard is not a static frontend yet. It is served by the existing Node/Discord-bot runtime through `dashboard/src/server.ts`, with API routes, generated CSS, static tool serving, and runtime dependencies. Because of that, the first Tauri step should wrap the local dashboard server instead of pretending the app can be bundled as pure static files.

Today there are two launch families:

- Browser/admin path: `npm run dev:dashboard` or `npm run start:dashboard`
- Local desktop-friendly path: `npm run dev:dashboard:local` or `npm run start:dashboard:local`

The local path avoids the runas prompt and is what Tauri uses from `beforeDevCommand`.

## Scripts

- `npm run dev:dashboard`: existing runas/admin launcher path.
- `npm run dev:dashboard:local`: direct local launcher for tools such as Tauri that should not open the runas prompt.
- `npm run desktop:dev`: starts Tauri and lets Tauri run the local dashboard server through `beforeDevCommand`.
- `npm run desktop:build`: builds the dashboard and Tauri shell.
- `npm run start:dashboard`: starts the dashboard HTTP/API server and browser UI through one Windows launcher. They are two surfaces of the same process, not two servers.

`runtime/dashboardRuntime.ts` is the shared composition entrypoint and respects the caller's role. `run-dashboard.cmd` owns the dashboard HTTP/API server; `run-server.cmd` remains headless and suppresses messenger autostart. The existing Discord composition adapter still supplies several feature dependencies behind that entrypoint and is now explicit technical debt rather than launcher policy.

Development Tauri builds can still start `npm run start:dashboard:local`. Production builds stage source, dependencies, and a target-specific Node executable through `scripts/prepare-tauri-runtime.mjs`; Tauri embeds them as a sidecar plus resources and redirects mutable data to the per-user application-data directory. Runtime readiness runs off the setup thread, and the window navigates after readiness. The Windows bundle uses the silent WebView2 download bootstrapper.

The NSIS installer is self-contained and does not require a repository, Node, or npm after installation. The frameless desktop window exposes theme-matched minimize, maximize/restore, and hide-to-tray controls. Its titlebar uses an explicit native start-drag command, supports double-click maximize/restore, and retains HTML/CSS drag-region hints as a fallback. Bootstrap Icons CSS and font files are vendored under dashboard assets and served by the packaged runtime, so desktop chrome and workflow controls do not depend on resolving a development `node_modules` path. The tray can reopen the window, restart the owned runtime, open its log, or quit both processes. Set `URAGE_STUDIO_AUTOSTART_DASHBOARD=false` to open the desktop shell against an already-running browser dashboard server.

## Follow-Up

1. Move remaining dashboard feature adapters out of the legacy Discord composition module.
2. Prune development-only dependencies from the staged runtime to reduce build and installer time.
3. Add signed installer publishing and clean-machine installation coverage.
4. Keep browser dashboard access independent of Tauri.
5. Keep Tauri IPC limited to desktop-only OS integration.
