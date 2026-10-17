# Task: Fix VS Code build task selecting Tauri runtime bundle (id=28)

> Exported from Taskitty at `2026-10-17T22:24:36.401Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-09T17:42:38.833Z

## Description

`npm run build:all` was launched from src-tauri/target/debug/runtime-bundle and failed because staged runtime resources omit scripts/build-dashboard-css.mjs. Add a source-root VS Code default build task, prevent packaging of source-only npm scripts into future runtime bundles, repair current staged metadata, and verify root build plus packaged runtime contract.

## Comments (3)

> **rainer** — 2026-10-09T17:45:29.798Z
> Fixed wrong-cwd VS Code build. Added `.vscode/tasks.json` default 'Build URage NOW from source' task with cwd `${workspaceFolder}`. Desktop packaging now strips source-only npm scripts from copied runtime package.json, so the generated bundle no longer advertises build:all despite lacking scripts/build-dashboard-css.mjs. Repaired both existing ignored bundle manifests in the current checkout. Documented source-vs-runtime build boundary in README and memory-bank/desktop-tauri-plan.md. `npm run build:all` passes from source root; Tauri shell/native application contract checks pass after updating their stale Rust-module path assertions. Confirmed both existing runtime manifests have no scripts. No full Tauri installer build was run.

> **rainer** — 2026-10-09T17:45:32.286Z
> Cause: The Tauri packaging script copied the repository's development package.json into runtime bundles while omitting source build scripts. VS Code discovered build:all from the copied manifest and ran it with the bundle as cwd.
> Solution: Give VS Code an explicit source-root default build task and omit npm scripts from staged runtime package metadata. Repair existing generated manifests in this checkout.
> Findings: Source npm build and focused Tauri checks pass. Full installer packaging remains untested; the generated runtime code is started directly by the packaged Node sidecar, not through npm scripts.

> **rainer** — 2026-10-09T17:51:07.053Z
> User found that target/release/runtime-bundle still advertised build:all after the prior debug-bundle repair. Removed scripts from that existing release manifest too and set workspace npm.exclude to **/runtime-bundle/** so VS Code ignores generated bundle package.json files. The explicit source-root default task remains. Verified root npm run build:all passes. Existing VS Code task cache may need Developer: Reload Window; actual VS Code task discovery was not exercised here.

