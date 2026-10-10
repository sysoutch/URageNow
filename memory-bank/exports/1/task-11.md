# Task: [SEC-02] Confine encoded /tools static paths to the tools directory (id=11)

> Exported from Taskitty at `2026-10-10T16:13:59.570Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-08T11:57:25.138Z
- **Tags:** Serious Bug

## Description

Security and reliability review — 2026-10-08

Severity: High. Finding: SEC-02.

Evidence: The /tools/ prefix is checked before decodeURIComponent, but the containment root is the repository. Local Node probes confirmed /tools/..%2fpackage.json and /tools/%2e%2e%5cpackage.json both resolve to repository package.json. The same construction can address other repository files. Dashboard auth still applies; this is not an unauthenticated remote read by itself. No secret files were requested.

Source: dashboard/src/server.ts:30-39,341-391

Remediation: Use the tools directory as the static root, validate the decoded relative path and realpath containment, and define dotfile/symlink policy. Avoid synchronous reads for large static files.

Acceptance criteria: Harmless HTTP fixtures must reject encoded slash/backslash traversal, dotfiles, and symlink escapes while serving valid tools and vendor assets.

Validation: source review; isolated local probes only where explicitly stated. No production exploitation or remediation performed.

Report: docs/security-review-2026-10-08.md

## Comments (3)

> **rainer** — 2026-10-08T11:58:02.342Z
> Recorded by the 2026-10-08 source audit. Harmless Node URL/path probes reproduced repository-root resolution for encoded slash and backslash paths. Remediation is not implemented. See docs/security-review-2026-10-08.md.

> **rainer** — 2026-10-08T17:03:53.374Z
> Implemented SEC-02. /tools/ now resolves relative to the tools directory. New static path resolution rejects dotfile segments, decodes before containment, canonicalizes both root and candidate with realpath, requires a regular file, and checks symlink target containment. The same containment helper protects asset/vendor static roots. Focused traversal/backslash/dotfile/missing-file checks passed; dashboard and server TypeScript no-emit checks and git diff --check passed. No live HTTP endpoint was exercised.

> **rainer** — 2026-10-08T17:03:55.393Z
> Cause: The /tools URL prefix was mapped to the repository root, allowing encoded traversal to files elsewhere in the repository.
> Solution: Mapped /tools/ directly to the tools directory and added shared realpath-based static-file containment. Decoding precedes resolution, dotfile path segments and non-files are rejected, and canonical symlink targets must remain under the canonical asset root. Other static roots use the same helper.
> Troubles: Focused traversal, backslash, dotfile and missing-file checks passed. Dashboard/server TypeScript no-emit checks and git diff --check passed. Live HTTP validation and explicit symlink fixture validation were not run.
> Findings: Encoded slash and backslash paths could escape the intended tools directory while remaining inside the broad repository static root. Lexical checks alone would also have allowed symlink escapes.
> Other: No secret/config file was read and no HTTP request was sent.

