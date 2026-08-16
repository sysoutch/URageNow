# URage NOW Tauri Shell

This is a desktop shell that wraps the local dashboard server at `http://127.0.0.1:4782`.

Development builds locate a URage NOW checkout, start its dashboard runtime without blocking the window setup thread, and navigate once its port is ready. Set `URAGE_STUDIO_REPO_ROOT` when launching development binaries outside the checkout.

Production builds run `npm run desktop:runtime`, which stages the dashboard sources, prunes development-only Node packages, copies the build machine's Node runtime as the target-specific `urage-dashboard-runtime` sidecar, builds the target-specific Rust `native-application-broker`, and embeds those artifacts in NSIS. Installed builds therefore do not require Node, npm, Rust, or a repository checkout. Mutable dashboard data is redirected to the per-user Tauri application-data directory.

The desktop window uses dashboard-themed custom chrome and hides to the tray. Drag its titlebar to move it and double-click the titlebar to maximize or restore it; minimize, maximize/restore, and close-to-tray remain native Tauri commands. Bootstrap Icons are bundled with dashboard assets rather than loaded through an installed `node_modules` path. The tray owns **Open Dashboard**, **Restart Runtime**, **View Logs**, and **Quit**. Runtime output is written to the per-user Tauri log directory.

The neutral `runtime/dashboardRuntime.ts` entrypoint disables messenger autostart. It still calls the legacy Discord composition adapter for several dashboard feature dependencies; removing that implementation dependency is a separate incremental refactor and does not affect installed runtime independence.

Packaged desktop launches of Bambu Studio and Blender use the Rust broker through
the shared `NativeApplicationPort`. Development and headless installations keep
the TypeScript adapter, so building Rust is not required to run the browser
dashboard. The broker accepts typed application IDs and validated arguments; it
does not expose a general command runner to dashboard routes.

For architecture, scripts, and follow-up items, see [`memory-bank/desktop-tauri-plan.md`](../memory-bank/desktop-tauri-plan.md).
