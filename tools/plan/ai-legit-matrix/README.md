# AI Legitimacy Matrix

An editable planning matrix for assessing AI use cases across source ownership, permission, protected-expression copying, transformation, and disclosure.

## Features

- Editable use-case, source, and notes columns
- Four-state assessment markers: blank, positive, negative, and context-dependent
- Automatic rough verdict calculation
- Browser-local persistence through `localStorage`
- JSON and Markdown export/copy actions

The verdict is a planning aid, not legal advice.

## Dashboard Integration

The tool is discovered automatically from `tools/plan/ai-legit-matrix/index.html`.

- `dashboard-theme.js` maps the active dashboard theme to the matrix surfaces and controls.
- The toolbar is marked as `Matrix Controls` for dashboard tool metadata.
- `describeCurrentAssets()` exposes the current matrix as JSON and Markdown resources.
- `dashboard-current-output-autodescribe.js` provides the shared output fallback.

## Standalone Use

Open `index.html` directly in a modern browser. The dashboard scripts retain their local fallback colors when the page is not embedded.
