# Task: [REL-03] Make generated-image overwrite transactional to avoid losing the original (id=20)

> Exported from Taskitty at `2026-10-17T23:59:27.122Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T11:57:38.785Z
- **Tags:** Bug

## Description

Security and reliability review — 2026-10-08

Severity: Medium. Finding: REL-03.

Evidence: The overwrite branch reads the new image, deletes overwriteImageId, and only then imports the replacement under that ID. If import fails after deletion, the original asset is lost. This is a source-confirmed failure window; no real image was deleted in the review.

Source: dashboard/src/server/routes/messagingAndModelRoutes.ts:1277-1301

Remediation: Stage the replacement, validate it and atomically swap metadata/files while retaining rollback data until success. Serialize conflicting overwrites and define recovery after a crash.

Acceptance criteria: Inject failures at write/metadata/rename boundaries and verify original bytes and metadata remain accessible until commit. Concurrent replacements must not leave broken references.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (2)

> **rainer** — 2026-10-08T11:58:31.735Z
> Recorded by the 2026-10-08 source audit. Evidence is from source inspection; live exploit/load/failure-injection tests remain acceptance work. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-09T15:12:18.829Z
> Implemented stage-first replacement and per-image in-process serialization. The old indexed image remains accessible through successful import; a failed import leaves it intact. The replacement is saved with a fresh artifact ID, and the old record is removed only after staging succeeds. Remaining acceptance gaps: no injected write/index/rename failures, no crash-recovery protocol, and no build/test run because the command runner is failing to initialize. Parked Under Review until those transactional guarantees are validated and completed.

