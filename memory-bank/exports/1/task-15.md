# Task: [SEC-06] Separate remote-worker credentials from dashboard administrator access (id=15)

> Exported from Taskitty at `2026-10-17T22:24:36.401Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T11:57:30.932Z
- **Tags:** Serious Bug

## Description

Security and reliability review — 2026-10-08

Severity: High. Finding: SEC-06.

Evidence: getDashboardAccessTokens includes remoteWorkerSharedSecret. Both x-remote-worker-secret and that secret submitted through browser login grant the same dashboard access as the dashboard token, including admin/native-launch routes. A worker credential compromise therefore crosses the worker/dashboard privilege boundary when the dashboard is remotely exposed and the client is allowed.

Source: dashboard/src/server.ts:126-147,185-225

Remediation: Use separate credential audiences and least-privilege worker callbacks/routes. Dashboard administration must require a dashboard credential; document credential rotation and any migration.

Acceptance criteria: A worker-only credential must fail dashboard login and administrative routes but succeed only at explicitly authorized worker endpoints. Verify existing remote generation still works.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (3)

> **rainer** — 2026-10-08T11:58:14.764Z
> Recorded by the 2026-10-08 source audit. Evidence is from source inspection; live exploit/load/failure-injection tests remain acceptance work. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-08T22:12:10.100Z
> Separated dashboard and worker credentials in dashboard/src/server.ts: browser login and dashboard request authorization now accept only DASHBOARD_ACCESS_TOKEN, while the worker's independent x-remote-worker-secret validation remains in remoteWorkerAuth. Updated the security review and project context. The local command runner still cannot start (helper_unknown_error: setup refresh had errors), so TypeScript, login rejection, admin-route, and remote-generation checks remain unverified.

> **rainer** — 2026-10-09T16:23:42.023Z
> Operational follow-up from 2026-10-09: the worker now fails closed at startup when both REMOTE_WORKER_SHARED_SECRET and the current user's native remote-worker.default.shared-secret credential are absent. Keep this requirement; do not bypass authentication. For a worker and dashboard running as the same Windows user on one machine, create a random secret and save it with `npx tsx scripts/manage-native-secret.ts set remote-worker.default.shared-secret` (read from stdin), then the worker and dashboard both read the same native credential. On separate hosts, configure the same random value through REMOTE_WORKER_SHARED_SECRET on both endpoints. Confirm presence using `npm run secret:status:remote-worker`; that command reports status only.

