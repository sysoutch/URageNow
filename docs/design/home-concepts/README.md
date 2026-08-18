# Home Dashboard Concepts

These references were generated before the August 2026 home-layout revision so implementation decisions can be reviewed against a concrete ultrawide composition.

- `urage-home-ultrawide-concept.png`: URage NOW command center with a dominant Continue/Create/Recent row and a full-width product strip.
- `lazydev-home-ultrawide-concept.png`: LazyDev work dashboard with a compact workflow launcher, prominent multi-series usage chart, KPI matrix, and three-column work area.

The images are direction references rather than pixel-perfect specifications. Production UI keeps live data, existing routes, accessibility semantics, and responsive behavior.

Browser-rendered implementation audits are produced by `scripts/check-home-command-centers-browser.mjs` under the ignored `artifacts/home-command-center-audit/` directory by default. The check covers 2560×1440 and 390×844, plus the named 3D LLM height action at desktop size, without committing private local generation history in screenshots.

The `ultrawide-*`, `phone-*`, and `desktop-model3d-*` captures are browser-rendered implementation audits produced by `scripts/check-home-command-centers-browser.mjs`. They verify the design against live records at 2560×1440 and 390×844, plus the named 3D LLM height action at desktop size.
