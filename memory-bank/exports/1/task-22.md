# Task: [DEP-02] Update Sass dependency source-map-js past indexed-map DoS advisory (id=22)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T12:02:36.199Z
- **Tags:** Bug

## Description

Root npm audit reports high severity GHSA-68fv-2mgg-jv7q for source-map-js 1.2.1, transitively installed through sass 1.101.0. Patched version: 1.2.2. Oversized indexed-map offsets can block the event loop. Reviewed dependency tree indicates build-tool exposure; an untrusted runtime source-map ingestion route was not identified. Therefore this remediation is Normal Priority despite upstream High severity. No source-map-js package was found at the inspected top-level desktop bundle location.

Remediation: resolve a compatible patched transitive version via supported dependency/lockfile updates; avoid unnecessary forced major upgrades.

Acceptance: npm ls confirms no affected resolved versions; audit clears this advisory; dashboard Sass build and relevant style checks pass. Evaluate CI/build input trust separately; do not claim a remotely exploitable dashboard DoS without a call path.

Source: https://github.com/advisories/GHSA-68fv-2mgg-jv7q

Review only: no dependency changes or application fixes applied.

## Comments (2)

> **rainer** — 2026-10-08T12:02:40.157Z
> Recorded after the user-approved npm audit. Installed dependency tree and selected runtime call sites were inspected. Package audit severity and application exposure are distinguished in the description. No npm audit fix, upgrades or bundle rebuild performed.

> **rainer** — 2026-10-08T22:15:11.086Z
> Confirmed root package-lock resolves source-map-js 1.2.1; the task requires 1.2.2. I cannot regenerate lockfiles or run npm ls/audit/Sass checks because the local command runner cannot start (helper_unknown_error: setup refresh had errors). I am parking the dependency update for retry when npm tooling is available.

