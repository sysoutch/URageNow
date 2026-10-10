# Task: [DEP-03] Upgrade DOMPurify in root and packaged dashboard for IN_PLACE advisories (id=23)

> Exported from Taskitty at `2026-10-10T16:13:59.570Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T12:02:42.450Z
- **Tags:** Bug

## Description

npm audit reports low severity for dompurify 3.4.15, with GHSA-p98j-92pf-mc4p and GHSA-6688-9rhm-gjv2. Both patched in 3.4.16. Desktop runtime-bundle contains 3.4.10, within the latter advisory's affected range. The reviewed dashboard helper calls DOMPurify.sanitize(rawHtml) with a string, not IN_PLACE or node-removing hooks, so exploit prerequisites were not found there. This does not certify all tools or generated bundles.

Remediation: update compatible DOMPurify resolution and regenerate/check the served browser assets and desktop runtime bundle, not just the root lockfile.

Acceptance: verify installed, actually served and packaged sanitizer versions; npm audit clears these advisories; malicious Markdown fixtures remain sanitized and normal formatting works. Track missing-sanitizer fallback separately as SEC-09.

Sources: https://github.com/advisories/GHSA-p98j-92pf-mc4p and https://github.com/advisories/GHSA-6688-9rhm-gjv2

Review only: no dependency changes or application fixes applied.

## Comments (2)

> **rainer** — 2026-10-08T12:02:46.792Z
> Recorded after the user-approved npm audit. Installed dependency tree and selected runtime call sites were inspected. Package audit severity and application exposure are distinguished in the description. No npm audit fix, upgrades or bundle rebuild performed.

> **rainer** — 2026-10-08T22:15:18.016Z
> Confirmed root package-lock resolves DOMPurify 3.4.15 (task requires 3.4.16) and the packaged runtime bundle resolves 3.4.10. I cannot update both dependency trees, rebuild packaged browser assets, or run audit/Markdown checks because the local command runner cannot start (helper_unknown_error: setup refresh had errors). I am parking this until package/build tooling is available.

