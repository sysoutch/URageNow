# Task: [SEC-05] Add server-side request quotas and generation admission limits (id=14)

> Exported from Taskitty at `2026-10-17T23:59:27.122Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T11:57:29.442Z
- **Tags:** Optimization

## Description

Security and reliability review — 2026-10-08

Severity: High. Finding: SEC-05.

Evidence: No application-level request rate limiter was found in the reviewed dashboard/worker dispatch and generation paths. Each accepted request reaches handlers directly; the active-request Map tracks cancellation, not bounded admission. Browser login attempts also have no throttle. Companion pairing does have five failures followed by a global 30-second lockout, so it is incorrect to say there are no limits anywhere.

Source: dashboard/src/server.ts:processDashboardRequest; dashboard/src/server/routes/messagingAndModelRoutes.ts:1188-1314; dashboard/src/server/companion/companionRoutes.ts:508-548; workers/remote-worker/src/remoteWorker.ts:1126-1175; dashboard/src/server/dashboardInterrupts.ts:24-64

Remediation: Define configurable budgets per client/IP and authenticated device/principal, stricter authentication limits, global CPU/GPU concurrency and bounded waiting queues, request deadlines, cancellation and idempotency. Return 429 with Retry-After where appropriate; coordinate provider backoff without duplicating paid jobs.

Acceptance criteria: Use fake generation providers and a controllable clock to verify burst/steady limits, queue saturation, fairness, bounded limiter storage, cleanup after failure/disconnect, forwarded-header spoof resistance and independent devices. Do not load-test real paid providers.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (2)

> **rainer** — 2026-10-08T11:58:11.686Z
> Recorded by the 2026-10-08 source audit. Evidence is from source inspection; live exploit/load/failure-injection tests remain acceptance work. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-08T22:12:28.398Z
> I inspected the open finding and started implementation planning. Its acceptance spans per-client burst/steady quotas, principal fairness, bounded queues, cancellation/disconnect cleanup, idempotency, and CPU/GPU admission across both dashboard and worker runtimes. I cannot run the required controlled-clock/fake-provider checks because the local command runner fails to start (helper_unknown_error: setup refresh had errors). I am parking this in Under Review so the concurrency policy and its behavior can be reviewed before treating a partial limiter as remediation.

