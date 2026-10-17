# Task: [SEC-09] Fail closed when Markdown sanitizer is unavailable (id=24)

> Exported from Taskitty at `2026-10-17T22:24:36.401Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-08T12:02:48.886Z
- **Tags:** Serious Bug

## Description

Source evidence: dashboard/src/client/modules/dashboard/shared/presentationHelpers.js:114-129. renderMarkdownHtml obtains HTML from window.marked.parse, calls DOMPurify only when present, and otherwise returns rawHtml. If marked is loaded but the sanitizer is absent or fails to load, untrusted chat/Markdown HTML reaches renderMarkdownInto without sanitization. This is separate from the npm IN_PLACE advisories. Browser end-to-end exploit not tested.

Remediation: when the sanitizer is unavailable, render escaped text or a safe error, never unsanitized parser output. Handle sanitizer-load/runtime failure explicitly and retain normal Markdown sanitization.

Acceptance: browser tests with marked present and DOMPurify absent verify that raw HTML/event handlers cannot execute; assert safe behavior for sanitizer failure and ordinary rendering. Test representative hostile Markdown using inert test fixtures.

Report: docs/security-review-2026-10-08.md

Review only: no dependency changes or application fixes applied.

## Comments (3)

> **rainer** — 2026-10-08T12:02:52.404Z
> Recorded after the user-approved npm audit. Installed dependency tree and selected runtime call sites were inspected. Package audit severity and application exposure are distinguished in the description. No npm audit fix, upgrades or bundle rebuild performed.

> **rainer** — 2026-10-08T17:02:38.183Z
> Implemented SEC-09. renderMarkdownHtml now escapes the original Markdown into a paragraph with line breaks when DOMPurify is absent or its sanitize call throws, rather than returning unsanitized marked HTML. Normal DOMPurify sanitization behavior is retained. Added missing/failing/available sanitizer regression cases and integrated the check into check:dashboard. Verification: npm run check:markdown-sanitizer passed; dashboard TypeScript no-emit passed; git diff --check passed.

> **rainer** — 2026-10-08T17:02:39.684Z
> Cause: The Markdown helper returned raw marked HTML when DOMPurify was missing, creating a fail-open rendering path.
> Solution: Added escaped-source fallback for both absent and throwing sanitizer, plus scripts/check-markdown-sanitizer.mjs covering absent, throwing and successful sanitizer cases. Integrated the focused check into check:dashboard and documented the security boundary in project context.
> Troubles: Focused regression, dashboard TypeScript no-emit and git diff checks passed. The earlier aggregate check:runtime remains blocked by the unrelated Tauri shell assertion recorded in the audit report.
> Findings: With marked present, a missing or throwing DOMPurify previously caused renderMarkdownHtml to return parser output directly. The new behavior escapes the original source and preserves line breaks as text. When DOMPurify is present and succeeds its sanitized HTML is still returned.
> Other: Fallback intentionally displays Markdown syntax as text when the sanitizer cannot be used; readability degrades safely rather than rendering untrusted HTML.

