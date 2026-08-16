# Project Style Guide  
**Version:** 1.0  
**Philosophy:** Clarity first. Density second. Consistency always.

---

## Core Principles

- Code should be **readable in seconds**, not impressive after minutes.
- Prefer **predictable patterns** over personal style.
- Optimize for **maintenance and scanning**, not writing speed.
- Every file should feel like it was written by the same person.

---

## TypeScript / Code Formatting

### Structure

- Group code in this order:
  1. `import`
  2. types / interfaces
  3. constants
  4. main logic (functions / classes)

- Use spacing **only to separate concepts**, not for aesthetics.
- No vertical padding inside logic blocks.

### Functions

- Keep functions **short and linear**.
- One responsibility per function—no mixed concerns.
- Prefer early returns over nested conditions.

```ts
function getUserName(user: User | null) {
  if (!user) return null
  if (!user.name) return "Anonymous"
  return user.name
}
```

- Avoid multiline signatures unless absolutely necessary.

---

### Control Flow

- Always use braces.

```ts
if (condition) {
  doSomething()
}
```

- Avoid deep nesting (max ~2 levels preferred).
- Extract logic instead of stacking conditions.

---

### Expressions

- Keep expressions compact but readable.
- Inline only when it improves clarity.

```ts
const status = isActive ? "active" : "inactive"
```

- Break lines only when it meaningfully improves readability.

---

### Variables

- Use **short but meaningful names**.
- Avoid vague names (`data`, `value`, `thing`) unless obvious in context.
- Prefer `const` by default.

---

### Objects & Arrays

- Keep small objects inline.
- Expand only when complexity increases.

```ts
const options = { loop: 0, delay: 200 }
```

---

### Comments

- Comments should explain **why**, not what.
- Keep them minimal and intentional.

```ts
// Retry once to handle flaky API responses
```

---

## Code Quality

- User intent, routing, prompt planning, and follow-up workflow selection must be language-independent. Do not add English-only keyword heuristics, regex intent parsers, or word-list shortcuts for these paths; use structured model decisions, explicit user commands, metadata, or typed parameters instead.
- Prefer **simple solutions that scale**, not clever shortcuts.
- Duplicate once → tolerate. Duplicate twice → extract.
- Don’t abstract prematurely.
- Avoid “magic behavior”—make things explicit.

---

## File Design

- Files should have a **clear purpose**.
- Avoid “utility dumping grounds.”
- If a file grows beyond easy scanning, split it.

---

## UI / Dashboard Design

### Philosophy

- Build interfaces that feel like **tools, not templates**.
- Avoid empty, flat, overly minimal layouts.

### Layout

- Use **clear visual hierarchy**:
  - defined sections
  - structured spacing
  - intentional grouping

- Sidebars:
  - Must feel like **real UI elements**, not hacks
  - Smooth expand/collapse behavior
  - Clear affordances

### Responsiveness

- Design per breakpoint—not just stacking everything vertically.
- Preserve usability, not just layout.

---

## Consistency Rules

- Same patterns = same implementation everywhere.
- Don’t introduce new styles without a strong reason.
- When improving code, **leave it better than you found it**—but stay consistent with surrounding code.

## Decision Rule

When unsure:

> Choose the option that is easiest to read at a glance by someone unfamiliar with the code.
