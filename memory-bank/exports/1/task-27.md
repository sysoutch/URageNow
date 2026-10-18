# Task: Make dashboard Ctrl+C shutdown immediate and clearly reported (id=27)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-09T17:16:31.180Z

## Description

Windows dashboard launcher currently shows both the runtime confirmation and cmd.exe 'Terminate batch job' prompt, then remains at 'Stopping dashboard' with no completion signal. Make one Ctrl+C initiate dashboard shutdown without an app-level confirmation, report completed or forced process exit clearly, and keep headless-server confirmation behavior. Validate the signal handler and launch checks; document the Windows terminal behavior and live-test limits.

## Comments (2)

> **rainer** — 2026-10-09T17:18:54.859Z
> Implemented dashboard-only immediate Ctrl+C shutdown: skips the app confirmation and dependency lookup, reports request/start/completion, waits up to 10 seconds for cleanup, then forces process exit with a clear error if cleanup hangs. API/headless roles retain confirmation. Added child-process checks for successful cleanup and timeout, and documented cmd.exe's separate batch-job prompt in README. Verified `node scripts/check-interactive-runtime-shutdown.mjs`, `npm run check:discord`, `node scripts/check-runtime-launch-separation.mjs`, and focused `git diff --check`. The exact user's Windows Command Prompt/launcher interaction was not exercised live.

> **rainer** — 2026-10-09T17:19:01.633Z
> Cause: The dashboard runtime and Windows cmd.exe batch launcher both handled Ctrl+C; the runtime required a confirmation and gave no completion message while awaiting cleanup.
> Solution: Dashboard UI now begins shutdown on first Ctrl+C, bounds cleanup to 10 seconds, and prints success or forced-exit status. The command prompt's own batch termination question is documented separately.
> Findings: Focused child-process shutdown checks and Discord type check pass. The exact interactive cmd.exe launcher was not run in this environment; that remains a live UX validation boundary.

