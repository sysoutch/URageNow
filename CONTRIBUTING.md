# Contributing to URageStudio

## How This Repo Works

This is a monorepo with multiple packages and tool directories:

- `dashboard/` — Frontend dashboard (TypeScript, SCSS)
- `server/` — Backend server routes and services
- `bots/` — Discord, Telegram, WhatsApp, Matrix bot implementations
- `tools/` — Standalone web tools (art, audio, video, dev utilities)
- `workers/` — Rust and remote worker processes
- `src-tauri/` — Tauri desktop shell wrapper

## Getting Started

1. Read `memory-bank/project-context.md` for architecture overview.
2. Read `AGENTS.md` for code quality rules.
3. Read `memory-bank/style-guide.md` for TypeScript formatting conventions.
4. Check `git log` — you make manual commits with valuable context about recent changes.

## Commit Style

You already commit manually, which is great. Good commits should:

- Use a short imperative subject line (`fix: resolve CSS cascade in dashboard sidebar`)
- Include body text explaining *why*, not just *what* changed
- Reference related memory-bank docs when the change affects architecture

## Documentation Rules

**Durable docs go here:** `memory-bank/` — architecture decisions, migration plans, style guides.

**Micro-fixes belong in git commits.** Don't paste per-commit notes into these files. If you did 15 follow-up edits, summarize the net result in one line.

Rule of thumb: if it wouldn't help someone understand this codebase 6 months from now, it belongs in a commit message, not here.

## Pull Requests (when applicable)

Not strictly required for solo work, but when collaborating:

1. Branch from `main` (or your working branch).
2. Describe the change and its impact on related modules.
3. Note any manual testing performed.