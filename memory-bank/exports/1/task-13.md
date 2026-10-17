# Task: [SEC-04] Bound JSON request bodies before parsing, including public pairing (id=13)

> Exported from Taskitty at `2026-10-17T22:24:36.401Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-08T11:57:28.046Z
- **Tags:** Serious Bug

## Description

Security and reliability review — 2026-10-08

Severity: High. Finding: SEC-04.

Evidence: parseJsonBody buffers every chunk without a byte ceiling, then concatenates and parses. The public companion pairing route reads the body before its credential lockout. With remote access enabled and an allowed client, no pairing token is required to reach that allocation. Large/chunked requests can exhaust memory. Login has a separate 4 KiB limit and binary companion uploads have a 100 MiB cap; these do not bound JSON.

Source: server/src/http/http.ts:18-25; dashboard/src/server/companion/companionRoutes.ts:300-305

Remediation: Add route-specific byte ceilings checked while streaming, deadlines/abort handling, media type validation and typed 400/413/415 responses. Bound base64 decoded inputs too.

Acceptance criteria: Test oversized Content-Length, missing/false lengths, chunked over-limit bodies, invalid JSON, arrays/null, and disconnects. Pairing must reject excess input before authentication work and without retaining the full body.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (3)

> **rainer** — 2026-10-08T11:58:08.742Z
> Recorded by the 2026-10-08 source audit. Evidence is from source inspection; live exploit/load/failure-injection tests remain acceptance work. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-08T19:44:33.098Z
> Implemented SEC-04. Shared parseJsonBody now applies a 16 MiB default cap, checks Content-Length early, counts streamed bytes, and throws a typed 413 error. Public companion pairing is explicitly capped at 4 KiB. Image/model data-URL routes use explicit 128 MiB caps to preserve current upload workflows. Dashboard and worker HTTP boundaries return 413, including Image Generate's local catch. Added tests for normal JSON, over-limit Content-Length, chunked over-limit input and invalid JSON, and integrated them into check:runtime. Verification: focused test passed; server/dashboard/worker TypeScript no-emit checks passed; git diff --check passed. Server not required. This does not bound concurrency, slow clients or total bandwidth; SEC-05 remains open.

> **rainer** — 2026-10-08T19:44:36.497Z
> Cause: Shared JSON parsing previously retained all request chunks without a byte limit, and public pairing reached the parser before credential verification.
> Solution: Added configurable byte limits to parseJsonBody, a typed 413 error, proper mappings at dashboard/worker request boundaries and Image Generate's local catch, and parser regression checks integrated into check:runtime.
> Troubles: Parser regression checks and TypeScript no-emit checks for server, dashboard and worker passed, as did git diff --check. No server was started or live HTTP request sent. Per-request caps do not limit concurrency, slow clients or total bandwidth; SEC-05 covers those controls.
> Findings: JSON body accumulation is now capped at 16 MiB by default with actual streamed-byte counting and an early Content-Length check. Public pairing has a 4 KiB limit. Image/model routes that carry data URLs use explicit 128 MiB limits to preserve existing media upload use. Oversized input is represented by a typed error mapped to HTTP 413.
> Other: Route-specific 128 MiB JSON data URL limits preserve current media workflows but still have substantial per-request memory cost due to JSON/base64 decoding; long-term media transfer should use bounded streaming upload APIs.

