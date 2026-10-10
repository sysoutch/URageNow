# Task: [SEC-07] Replace raw dashboard-token cookies with revocable secure sessions (id=16)

> Exported from Taskitty at `2026-10-10T16:13:59.570Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T11:57:32.377Z
- **Tags:** Networking

## Description

Security and reliability review — 2026-10-08

Severity: Medium. Finding: SEC-07.

Evidence: Both login paths put the long-lived access token itself into the cookie; Max-Age only controls browser retention and does not impose server-side expiry on replay. Cookies have HttpOnly/SameSite=Strict, but no Secure flag. A query-string accessToken login also exposes credentials to URL history/logging. HTTP LAN mode leaves the token vulnerable to network interception.

Source: dashboard/src/server.ts:130-170,185-210

Remediation: Exchange credentials through POST for opaque expiring server-side sessions with logout/revocation. Remove durable token query login; require TLS for remote production access and Secure cookies, with explicitly documented local-development behavior.

Acceptance criteria: Test expiry using a captured cookie, logout revocation, secure attributes under supported TLS/proxy configuration, URL credential rejection, and no-store responses. Do not equate cookie Max-Age with server-enforced expiry.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (3)

> **rainer** — 2026-10-08T11:58:17.855Z
> Recorded by the 2026-10-08 source audit. Evidence is from source inspection; live exploit/load/failure-injection tests remain acceptance work. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-09T15:15:37.338Z
> Partial implementation: dashboard login now issues a random opaque session ID, stores only its SHA-256 digest, enforces an eight-hour expiry, prunes expired sessions, caps the table at 4096, and provides POST logout revocation. URL accessToken requests are redirected to a clean path; login/logout are no-store; Secure is set for direct TLS or configured HTTPS public base URL. HTTP remains supported for explicit local/LAN use and sessions are memory-only (restart revokes them). Expiry/logout/cookie/TLS/URL regression tests and a production TLS policy remain; build/test runner is unavailable. Documented and moved Under Review.

> **rainer** — 2026-10-09T15:50:22.640Z
> Follow-up build report from 2026-10-09 found TS2552 in the logout branch: it called readDashboardSessionCookie before that helper existed. Added the missing cookie parser, sharing the urage_dashboard_session parsing behavior used by authentication. I attempted npm run build:dashboard:ts, but the process launcher still fails before npm starts (helper_unknown_error: setup refresh had errors); please rerun the dashboard TypeScript build when the runner is available.

