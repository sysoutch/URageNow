---
name: commit-and-push
description: Review repository changes, create a professional Git commit with a descriptive message and body, then push to the current branch.
---

# Commit and Push

## Purpose

Use this skill whenever the user asks to:

- commit
- commit changes
- commit everything
- commit and push
- push changes
- publish changes
- create a commit

Your responsibility is to produce a clean, professional Git commit that accurately documents the work performed and, when requested, push it to the current branch.

Git history is permanent documentation. Treat every commit as if another engineer will rely on it months from now.

---

# Workflow

## 1. Review the Repository

Before committing:

- Review staged and unstaged changes.
- Read the complete diff.
- Understand what changed and why.
- Group related changes into a logical commit.
- If unrelated work exists, separate it when practical or explain why it should not be committed together.

Never commit code you do not understand.

---

## 2. Verify the Changes

Inspect the repository for:

- Debug logging
- Temporary debugging code
- Commented-out code
- Merge conflict markers
- Accidentally committed secrets
- Credentials or API keys
- Temporary files
- Generated files that should be ignored
- Unused imports
- Obvious dead code
- Accidental formatting-only changes
- Unintended modifications

Remove or exclude these whenever appropriate.

If something appears unsafe to commit, stop and explain the issue instead of committing.

---

## 3. Validate Quality

When practical, ensure that:

- The project builds successfully.
- Relevant tests pass.
- No obvious regressions were introduced.

Do not ignore failing tests simply to create a commit.

---

# Commit Message

The commit title should:

- Use the imperative mood.
- Clearly describe the primary change.
- Prefer fewer than 72 characters.
- Focus on intent rather than implementation details.

Good examples:

- Refactor authentication service
- Extract shared validation utilities
- Improve startup configuration
- Simplify dependency injection
- Reduce duplication in API handlers
- Fix race condition during cache initialization

Avoid titles such as:

- update
- fixes
- cleanup
- misc
- changes
- work
- final
- stuff
- test

---

# Commit Body

Always include a descriptive commit body.

The body should explain:

## What Changed

Summarize the implementation.

Examples:

- Extracted duplicated business logic into reusable services.
- Split oversized modules into focused components.
- Removed obsolete code.
- Consolidated validation logic.
- Simplified control flow.
- Improved project organization.

---

## Why

Explain the motivation.

Examples:

- Improve maintainability.
- Reduce duplicated logic.
- Simplify future development.
- Improve readability.
- Improve modularity.
- Reduce coupling.
- Increase cohesion.
- Improve testability.

---

## How

Briefly explain the implementation strategy.

Examples:

- Introduced reusable abstractions.
- Extracted shared helper functions.
- Reorganized feature modules.
- Applied dependency injection.
- Replaced duplicated logic with reusable components.
- Introduced interfaces where appropriate.
- Applied SOLID principles.

---

## Impact

State any important effects.

Examples:

- No intended behavioral changes.
- Public API unchanged.
- Internal refactor only.
- Existing functionality preserved.
- Reduced maintenance complexity.
- Slight performance improvements due to eliminating redundant work.

---

# Example Commit

Subject:

Refactor order processing pipeline

Body:

- Extract duplicated pricing calculations into a shared PricingService
- Split the OrderProcessor into smaller feature-focused modules
- Centralize validation logic
- Remove obsolete helper functions
- Improve dependency injection

Why:

The previous implementation duplicated business logic across multiple modules,
making maintenance difficult and increasing the risk of inconsistent behavior.

How:

Shared functionality was extracted into reusable services while preserving
existing behavior. Responsibilities were redistributed into cohesive modules.

Impact:

No intended behavioral changes. Existing APIs remain compatible.

---

# Commit Standards

Every commit should answer:

- What changed?
- Why was it changed?
- How was it implemented?
- What is the expected impact?

Someone reviewing the commit months later should understand its purpose without
having to inspect every changed file.

---

# Push

If the user requested a push:

- Verify the commit completed successfully.
- Push to the current tracked remote branch.

---

# Final Report

After completing the task, report:

- Branch name
- Commit hash
- Commit title
- Whether the changes were pushed successfully

---

# Principles

- Never use generic commit messages.
- Never hide problems simply to complete a commit.
- Prefer one logical commit over many meaningless commits.
- Avoid combining unrelated changes.
- Keep Git history clean and informative.
- Prioritize clarity over brevity.
- Preserve a commit history that another engineer can understand without additional context.