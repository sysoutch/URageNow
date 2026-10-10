# Task: [SEC-01] Fail closed when the remote worker has no authentication secret (id=10)

> Exported from Taskitty at `2026-10-10T16:13:59.570Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-08T11:57:23.673Z
- **Tags:** Serious Bug

## Description

Security and reliability review — 2026-10-08

Severity: High. Finding: SEC-01.

Evidence: hasValidWorkerSecret returns true when the configured secret is empty. The worker binds to 0.0.0.0 by default; no startup guard was found. This exposes generation, model operations and artifact reads if the optional worker is started without a stored/environment secret on a reachable host. Actual deployment configuration was not inspected.

Source: workers/remote-worker/src/remoteWorker.ts:441-457,1173-1178; server/src/config/appConfig.ts:164-167

Remediation: Require a nonempty credential before listening; default to loopback, with explicit authenticated remote exposure. Keep liveness narrowly public.

Acceptance criteria: Test unset/empty credentials, loopback and non-loopback binds, invalid/valid secrets, and protected read/write routes. A fresh worker must not accept unauthenticated operations.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (3)

> **rainer** — 2026-10-08T11:57:58.683Z
> Recorded by the 2026-10-08 source audit. Evidence is from source inspection; live exploit/load/failure-injection tests remain acceptance work. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-08T17:01:31.185Z
> Implemented SEC-01. Worker startup now throws before listener creation/bind when the configured/native shared secret is empty. Removed the empty-secret authorization bypass and use timingSafeEqual for candidate comparison. Public /health remains unchanged; the default all-interface bind therefore now requires a real secret. README and memory-bank project context document provisioning and trusted-LAN/TLS expectations. Verification: focused remote-worker-auth checks passed; worker and server TypeScript no-emit checks passed; git diff --check passed. Aggregate npm run check:runtime stopped at an existing unrelated check-tauri-shell.mjs assertion expecting URAGE_STUDIO_REPO_ROOT in src-tauri/src/lib.rs; no further runtime suite checks ran.

> **rainer** — 2026-10-08T17:01:32.575Z
> Cause: Security review found that an unset worker secret disabled authentication while the listener defaulted to all interfaces.
> Solution: Added shared remoteWorkerAuth helpers, used them in worker startup and request authorization, added focused credential tests to check:runtime, and documented mandatory secret provisioning and LAN/TLS guidance.
> Troubles: Focused helper check and worker/server TypeScript checks passed. Aggregate check:runtime halted on an unrelated existing Tauri shell assertion in check-tauri-shell.mjs: it expects URAGE_STUDIO_REPO_ROOT in src-tauri/src/lib.rs but the checked source differs. Therefore the full runtime suite is not verified.
> Findings: Worker authentication previously failed open when the configured secret was empty. The worker now fails startup before creating or binding its listener without a non-empty secret. Secret comparisons use timingSafeEqual. Public /health remains public, while capability, readiness and operation routes require the credential.
> Other: Task #10 is complete at the source/build/check boundary; no live deployed worker was restarted or network-tested.

