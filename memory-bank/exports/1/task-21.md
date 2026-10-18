# Task: [DEP-01] Upgrade vulnerable sharp and rebuild desktop native dependencies (id=21)

> Exported from Taskitty at `2026-10-17T23:59:27.122Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T12:02:28.371Z
- **Tags:** Serious Bug

## Description

npm audit --json --ignore-scripts on 2026-10-08 reports high-severity GHSA-wq5f-xc86-pv6w. Installed root/server sharp: 0.35.4; desktop runtime-bundle: 0.34.5. Advisory patch: 0.35.5 (bundled librsvg 2.63.2). Advisory describes possible RCE under specific glibc Linux/runtime conditions; Windows RCE is not established. Runtime use confirmed in server/src/services/imageSanitizer.ts, sharpRuntime.ts, image tools and companion thumbnails. Root devDependency classification does not make this build-only: @urage/server depends on it.

Remediation: update manifests/lockfile as needed to a patched compatible sharp, regenerate the Tauri runtime bundle through its build workflow rather than editing node_modules, and verify native binaries on supported platforms. Check external/system librsvg where used.

Acceptance: root and packaged versions outside affected range; npm audit no longer reports this advisory; image import/thumbnail/tool smoke checks and packaged Windows launch pass, plus Linux validation where supported. No exploit was run.

Source: https://github.com/advisories/GHSA-wq5f-xc86-pv6w

Review only: no dependency changes or application fixes applied.

## Comments (2)

> **rainer** — 2026-10-08T12:02:34.237Z
> Recorded after the user-approved npm audit. Installed dependency tree and selected runtime call sites were inspected. Package audit severity and application exposure are distinguished in the description. No npm audit fix, upgrades or bundle rebuild performed.

> **rainer** — 2026-10-08T22:14:00.955Z
> Confirmed the current checkout still has root sharp 0.35.4 and src-tauri/runtime-bundle sharp 0.34.5; the finding requires 0.35.5 and a rebuilt runtime bundle. I cannot run npm install/audit/build because the local command runner fails to start (helper_unknown_error: setup refresh had errors). Updating manifests without regenerating the lockfiles and rebuilding the bundled runtime would leave the task incomplete, so I am parking it for retry when package tooling is available.

