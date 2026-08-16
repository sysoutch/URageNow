# Memory Bank

Durable project context for URageStudio. This folder keeps architecture notes, style guides, and active plans so future work can start quickly.

## Files

| File | Purpose |
|------|---------|
| `project-context.md` | What this repo is, how it's structured, current migration status, reliability priorities, and known risks |
| `style-guide.md` | User-preferred TypeScript formatting conventions for future edits |
| `migration-notes.md` | Node.js/TypeScript rewrite recommendation and rollout plan (in progress) |
| `rust-worker-adoption-plan.md` | Selective Rust worker rollout plan and target native boundary |
| `desktop-tauri-plan.md` | Tauri v2 desktop shell plan and current status |
| `architecture-cleanup-roadmap.md` | Package boundaries, runtime composition extraction, and remaining structural cleanup |
| `studio-workflow-ux-plan.md` | Studio home and focused-workflow UX contract, references, rollout, and acceptance criteria |
| `API.md` | API endpoint reference template — fill in as routes are stabilized |

## How to Use This Folder

1. **New feature work** — Read `project-context.md` first for architecture context and known risks.
2. **Code edits** — Follow `style-guide.md` for formatting conventions.
3. **Migration work** — Check `migration-notes.md` for current progress and next port candidates.
4. **Native workers** — See `rust-worker-adoption-plan.md` for the Rust worker boundary definition.

## How to Document Changes

**Do:** Put durable architecture decisions, service boundaries, migration plans, and style conventions here.

**Don't:** Paste per-commit micro-fix summaries into these files. Your git commits already capture that history. If you did a refactor pass with 15 follow-up notes, summarize the *net result* in one line — don't paste all 15.

**Rule of thumb:** If it wouldn't help someone understand this codebase 6 months from now, it belongs in a commit message, not here.

## Git Commit Context

When working with this repo, always check `git log` first. You make manual commits and they contain valuable context about recent changes, decisions, and current work-in-progress state. The commit history is the primary source of truth for what changed recently — this memory-bank folder captures durable knowledge that doesn't expire.
