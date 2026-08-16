# tetris

Tetris Clone

## Purpose

Just play testris

## Dashboard integration

- Uses `data-dashboard-theme` and the shared dashboard theme bridge.
- Uses `dashboard-current-output-autodescribe.js` and provides an explicit current-output descriptor.
- Uses `dashboard-tool-bridge.js` and accepts dashboard asset payloads.
- Exposes one dashboard sidebar marker.
- Primary output: `image`.
- File input: enabled.
- Local state persistence: disabled.

Replace the placeholder transformation inside `app.js` while preserving these integration hooks.

See [the canonical tool integration contract](../../TOOL_TEMPLATE.md) for every supported option and validation command.
