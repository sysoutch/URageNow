# Task: [SEC-03] Protect loopback dashboard mutations against cross-origin requests and DNS rebinding (id=12)

> Exported from Taskitty at `2026-10-10T16:13:59.570Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T11:57:26.597Z
- **Tags:** Serious Bug

## Description

Security and reliability review — 2026-10-08

Severity: High. Finding: SEC-03.

Evidence: Loopback socket addresses bypass authentication. The request gate does not validate Host, Origin or Fetch Metadata, and parseJsonBody accepts JSON bytes regardless of Content-Type. Thus a browser-capable attacker has a route to unauthenticated local mutations on browsers/network configurations that permit such requests; DNS rebinding is another concern. Browser end-to-end exploitation was not tested. SameSite cookies do not protect a loopback bypass.

Source: dashboard/src/server.ts:213-225; server/src/http/http.ts:18-25; dashboard/src/server/routes/messagingAndModelRoutes.ts:1628-1644

Remediation: Validate allowed Host values and browser origins, enforce expected mutation content types and CSRF protection, and authenticate privileged loopback operations. Specify trusted-proxy handling rather than trusting forwarded headers.

Acceptance criteria: Exercise cross-origin text/plain JSON POSTs with stubbed delete operations, unexpected Host values, legitimate local UI, remote authenticated UI, and companion requests. Rejected requests must cause no mutation.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (3)

> **rainer** — 2026-10-08T11:58:05.561Z
> Recorded by the 2026-10-08 source audit. Evidence is from source inspection; live exploit/load/failure-injection tests remain acceptance work. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-08T22:11:31.198Z
> Implemented Host authority allowlisting and browser mutation checks in dashboard/src/server.ts: configured/loopback host validation, Origin and Fetch Metadata rejection for cross-site mutations, and JSON/multipart content-type enforcement for browser API mutations. The edit was reviewed from source and documented in docs/security-review-2026-10-08.md and memory-bank/project-context.md. I could not run the required TypeScript or HTTP integration checks because the local command runner fails to start (helper_unknown_error: setup refresh had errors). Please verify cross-origin text/plain JSON, unexpected Host, local/remote dashboard, and companion requests before closing this finding.

> **rainer** — 2026-10-09T15:04:29.183Z
> Fixed the reported TS2532 by making the missing Content-Type split segment fall back to an empty string before trim(). The current environment still cannot start exec_command (helper_unknown_error: setup refresh had errors), so I could not rerun npm run build:all or the HTTP acceptance checks. Leaving this in Under Review until those checks run.

