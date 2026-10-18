# Task: [REL-01] Catch worker request failures before URL parsing and capability discovery (id=18)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T11:57:35.544Z
- **Tags:** Serious Bug

## Description

Security and reliability review — 2026-10-08

Severity: High. Finding: REL-01.

Evidence: URL construction uses the untrusted Host header before the try/catch. Capability/readiness awaits also sit outside that handler guard, and the createServer callback discards the promise with void and no catch. A local URL probe confirms malformed Host '[' throws. Such failures can become unhandled rejections and terminate Node under its default rejection policy. The real worker was not crashed.

Source: workers/remote-worker/src/remoteWorker.ts:1126-1175

Remediation: Wrap the entire request lifecycle or attach a top-level rejection handler; validate URL/Host and return 400 for malformed requests. Handle headers-sent and socket-aborted cases safely.

Acceptance criteria: A disposable server subprocess must survive malformed Host and injected capability errors, return bounded error responses and answer a subsequent health request without unhandledRejection.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (3)

> **rainer** — 2026-10-08T11:58:23.996Z
> Recorded by the 2026-10-08 source audit. A local malformed-Host URL probe threw as expected; no live worker crash was attempted. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-08T22:13:10.299Z
> Moved URL construction and the full worker request flow under one error boundary, return 400 for malformed request target/Host input, catch capability/readiness and route failures, guard the server callback promise, and avoid responding after headers are sent or the response is destroyed. Updated the security review and project context. The local command runner cannot start (helper_unknown_error: setup refresh had errors), so the required disposable subprocess test (malformed Host, injected capability failure, then healthy request) remains unverified.

> **rainer** — 2026-10-08T22:13:43.590Z
> Source remediation is in place and documented: malformed URL/Host input now returns 400, capability/readiness and route failures are caught, and a final callback rejection guard prevents an unhandled promise from escaping. I could not run the disposable worker subprocess acceptance check because exec_command cannot start in this session. Please verify the malformed-Host, capability-failure, subsequent-health sequence before closing.

