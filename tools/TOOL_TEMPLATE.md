# Dashboard Tool Integration Contract

Local web tools are discovered at `tools/<category>/<tool-slug>/index.html`. Use the Tools catalog **Add Tool** workflow for new tools so manual and LazyDev-assisted creation share the same audited template.

Category labels, descriptions, and Bootstrap Icon names come from `tools/categories/*.json`. The directory id remains the stable category identifier. Users may add or override category metadata and tool tags from the dashboard; those personal catalog changes are stored in dashboard data rather than modifying repository presets.

Changing a category label does not move tools. Use the dashboard's transactional **Move Tool** operation to change a tool's category id: it moves the directory, updates `tool.json`, migrates tag metadata, rejects collisions, and rolls the filesystem back on failure. Presets may be hidden but not deleted; custom categories may be deleted only when no tools remain assigned.

Changing a category label does not move tools. Use the dashboard's transactional **Move Tool** operation to change a tool's category id: it moves the directory, updates `tool.json`, migrates tag metadata, rejects collisions, and rolls the filesystem back on failure. Presets may be hidden but not deleted; custom categories may be deleted only when no tools remain assigned.

## Required files

- `index.html`: runnable catalog entry point with a title and description.
- `app.js`: tool behavior plus dashboard input/output hooks.
- `style.css`: responsive tool-owned presentation.
- `README.md`: purpose and integration notes that LazyDev can read through Chat Studio.
- `tool.json`: machine-readable capabilities and template schema version.

## Required dashboard contracts

Every generated tool includes:

1. `data-dashboard-theme` on the HTML/body theme host and `../../shared/dashboard-theme.js`.
2. `../../shared/dashboard-current-output-autodescribe.js`.
3. `window.__urageToolDescribeCurrentAsset()` for explicit text, JSON, or image output.
4. `../../shared/dashboard-tool-bridge.js`.
5. `window.__urageToolLoadAssetPayload(payload)` for dashboard-to-tool asset handoff.
6. Zero or one `data-dashboard-tool-sidebar` marker. More than one is invalid.

The shared fallback can describe ordinary visible output, but generated tools intentionally provide an explicit descriptor so Send Resource behavior stays deterministic.

## Template options

- `outputKind`: `text`, `json`, or `image`.
- `acceptsFiles`: includes a local file picker and declares dashboard asset support.
- `includeSidebar`: marks the configuration column as the dashboard tool sidebar.
- `persistState`: stores the primary input under a tool-specific local-storage key.
- `category`, `slug`, `title`, `description`, and `purpose`: drive discovery, documentation, and starter behavior.

LazyDev planning is constrained to these options. A second constrained pass implements complete HTML, CSS, and JavaScript files; the server retains the canonical documentation and manifest and audits the merged result.

## Validation

Run:

```powershell
npm run check:tools
npx tsx scripts/check-tool-scaffold.ts
```

The dashboard Add Tool overlay also displays each integration requirement before creation and reports missing fields or a colliding tool directory. LazyDev-assisted creation uses two passes: a constrained specification, then complete `index.html`, `style.css`, and `app.js` implementations. Only those implementation files are accepted from the model; the server owns the manifest and README and rejects results that break integration hooks.

Before writing anything, the overlay shows the complete generated source and a per-file diff against the audited baseline.

Before writing anything, the overlay shows the complete generated source and a per-file diff against the audited baseline.
