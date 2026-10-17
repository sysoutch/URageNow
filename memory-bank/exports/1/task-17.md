# Task: [SEC-08] Consume pairing credentials atomically and avoid global lockout abuse (id=17)

> Exported from Taskitty at `2026-10-17T22:24:36.401Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-08T11:57:33.958Z
- **Tags:** Bug

## Description

Security and reliability review — 2026-10-08

Severity: Medium. Finding: SEC-08.

Evidence: Credential validation occurs before awaiting mutateDevices; invalidation happens afterward. A probe executing the real pairing function body with in-memory persistence/hash/audit stubs accepted two concurrent requests using the same credential and created two devices. Separately, five bad attempts lock every client out for 30 seconds, allowing repeated denial of pairing by one allowed network client.

Source: dashboard/src/server/companion/companionAccessService.ts:148-172; dashboard/src/server/companion/companionRoutes.ts:300-305

Remediation: Atomically validate/reserve/consume a pairing credential with device creation, with clear persistence-failure behavior. Add bounded per-source attempt budgets plus a global safety budget and return 429/Retry-After for throttling.

Acceptance criteria: Concurrent requests using one code or QR token must produce at most one device. Test expired/replayed credentials, persistence failure, and one abusive source alongside a legitimate device.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (3)

> **rainer** — 2026-10-08T11:58:20.700Z
> Recorded by the 2026-10-08 source audit. The actual pairing function body accepted two concurrent uses of one code in a probe with in-memory dependency stubs. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-08T19:46:03.581Z
> Implemented SEC-08. Pairing credentials are now consumed synchronously before the first awaited persistence operation, so a concurrent replay cannot create another device. Pairing failures are tracked per TCP peer address; five misses lock that source for 30 seconds without blocking other clients. Expired entries are pruned and the map is capped at 256 clients. Extended the companion policy check to cover concurrent QR-token exchange, a locked attacker address, and another client's successful pairing. Verification: companion policy check passed; dashboard TypeScript no-emit and git diff --check passed. A reverse proxy would make socket addresses shared, so proxy-aware identity needs explicit trusted-proxy design.

> **rainer** — 2026-10-08T19:46:05.544Z
> Cause: Pairing credential consumption occurred after awaiting device persistence, allowing concurrent requests to reuse one pairing code. Failure tracking was global, so one source could lock out all clients.
> Solution: Consume the global short-lived code/QR credential before the first await, and pass the socket peer address into pairing. Added concurrent replay and independent-client lockout tests to the existing companion access-policy check.
> Troubles: Companion policy check, dashboard TypeScript no-emit and git diff --check passed. No live HTTP listener was tested. Reverse proxies collapse peer identity unless trusted proxy handling is explicitly configured.
> Findings: Valid pairing credentials are invalidated synchronously before device-store persistence yields. Pairing failures are now scoped to the TCP source address with five misses and a 30-second lockout. Per-source state is pruned and bounded to 256 entries.
> Other: A failed device persistence after code consumption intentionally requires the user to obtain a fresh pairing code rather than making the credential reusable.

