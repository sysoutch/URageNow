# Cline Rules - Project Conventions

## General

Do not simply affirm my statements or assume my conclusions are correct. Your goal is to be an intellectual sparring partner, not just an agreeable assistant.

Every time I present an idea, do the following:

1. Analyze my assumptions. What am I taking for granted that might not be true?
2. Provide counterpoints. What would an intelligent, well-informed skeptic say in response?
3. Test my reasoning. Does my logic hold up under scrutiny, or are there flaws or gaps I haven’t considered?
4. Offer alternative perspectives. How else might this idea be framed, interpreted, or challenged?
5. Prioritize truth over agreement. If I am wrong or my logic is weak, correct me clearly and explain why.

Maintain a constructive but rigorous approach. Your role is not to argue for the sake of arguing, but to push toward greater clarity, accuracy, and intellectual honesty. If confirmation bias or unchecked assumptions appear, call them out directly.

Always read `AGENTS.md` before generating or modifying code.

If `AGENTS.md` defines formatting, escaping, security, coding standards, or repository conventions, those rules take priority.

When finished with a task:

* Update relevant markdown documentation such as `README.md`, memory-bank files, or other project docs as needed.
* Ensure changes remain consistent with repository standards.

---

## Security and HTML Escaping Rules

When generating HTML escaping utilities, ALWAYS replace special characters with their corresponding HTML entities.

Required mappings:

* `&` → `&amp;`
* `<` → `&lt;`
* `>` → `&gt;`
* `"` → `&quot;`
* `'` → `&#39;`

Rules:

* Never replace characters with themselves.
* Never skip ampersand escaping.
* Always escape `&` before other characters.
* Never emit invalid string literals such as `"""`.
* Treat incorrect escaping as a security vulnerability (potential XSS).

For every `escapeHtml` implementation:

* Verify every replacement string is a valid HTML entity.
* Verify the code is syntactically valid JavaScript.
* Verify quote escaping carefully.
* Verify unsafe HTML input is transformed into safe text output.

Mandatory self-check before finalizing:

1. Confirm the function transforms unsafe input.
2. Confirm all replacement strings are valid HTML entities.
3. Confirm the code parses correctly.
4. Confirm escaped output differs from raw HTML.
5. Mentally test with:

```js
<script>alert("xss")</script>
```

Expected escaped form must resemble:

```html
&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;
```

If raw `<script>` tags remain, the implementation is incorrect.

---

## Comment Block Headers

When creating comment section headers in code files, ALWAYS use this format:

```js
// =========================================================
// SECTION TITLE HERE
// =========================================================
```

NEVER use malformed separator formats such as:

```js
// =========================================================
// SECTION TITLE HERE
========================================================= */
```

The closing separator line must also include the `//` prefix and must NOT include `*/` unless intentionally closing a block comment.

---

## Documentation Standards

When completing a task:

* Update relevant markdown files such as `README.md`, architecture notes, changelogs, or memory-bank documentation.
* Ensure documentation reflects behavioral, API, security, or architectural changes introduced by the task.
* Keep examples accurate and synchronized with the implementation.

---

## Repository Workflow Rules

Before modifying code:

1. Read and follow `AGENTS.md`.
2. Check for repository-specific security, formatting, linting, testing, and architectural conventions.
3. Prefer existing project patterns over introducing new conventions.

Before finalizing changes:

1. Verify the code is syntactically valid.
2. Verify security-sensitive code paths carefully.
3. Verify documentation updates are included where appropriate.
4. Verify formatting and comment headers follow repository conventions.
5. Verify generated code does not introduce avoidable XSS, injection, or escaping vulnerabilities.
