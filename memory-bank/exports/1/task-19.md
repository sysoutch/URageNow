# Task: [REL-02] Enforce streaming and expanded archive budgets for website model imports (id=19)

> Exported from Taskitty at `2026-10-10T16:13:59.570Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T11:57:37.030Z
- **Tags:** Bug

## Description

Security and reliability review — 2026-10-08

Severity: Medium. Finding: REL-02.

Evidence: The importer validates an approved HTTPS URage.net URL and disallows redirects, which are useful controls. However it calls arrayBuffer before checking actual downloaded size when Content-Length is absent/inaccurate, tar extraction has no deadline or expanded-size/file-count budget, and all sidecars are read concurrently into memory. Large approved-source archives can exhaust RAM/disk or hang import processing. No claim is made that tar traversal was demonstrated.

Source: dashboard/src/server/model3d/websiteArchiveImport.ts:9,18-25,48-72

Remediation: Stream with an enforced byte ceiling and timeout; preflight entries and constrain expanded bytes/file counts/path types; bound extraction runtime and sidecar-read concurrency. Guarantee cleanup on abort.

Acceptance criteria: Use synthetic approved-source fixtures for chunked over-limit downloads, slow streams, excessive expansion/file counts and extraction timeout; assert bounded memory/disk and cleanup.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (2)

> **rainer** — 2026-10-08T11:58:28.557Z
> Recorded by the 2026-10-08 source audit. Evidence is from source inspection; live exploit/load/failure-injection tests remain acceptance work. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-09T15:07:24.096Z
> Implemented streaming download to disk with a 350 MiB actual-byte ceiling and 120-second abort deadline, ZIP content-type validation, a 120-second tar extraction timeout, post-extraction limits (5,000 files/1 GiB), and sequential sidecar reads. Cleanup remains in the surrounding finally. The archive limits are checked after extraction, so ZIP preflight is still needed to cap disk expansion before it occurs. I could not run TypeScript/build or synthetic failure-injection checks because exec_command still fails to start (helper_unknown_error: setup refresh had errors).

