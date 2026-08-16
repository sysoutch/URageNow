// Dashboard Theme Initialization
// Provides global theme configuration and utility functions for the shell runtime.
// This replaces the inline IIFE previously embedded in page.ts HTML template.
//
// IMPORTANT: Must run at top scope (not inside an IIFE) so that bare identifier
// lookups like `dashboardThemeOrder.slice()` in shellRuntimeThemeHelpers.js
// resolve correctly even when clientScript uses "use strict".

var themes = window.__DASHBOARD_THEMES_DATA__ || [];
var order = window.__DASHBOARD_THEME_ORDER__ || [];
var defaultTheme = window.__DEFAULT_DASHBOARD_THEME__ || (themes[0] && themes[0].id) || "urage";

var metaMap = {};
var aliasMap = {};

themes.forEach(function(t) {
  metaMap[t.id] = t;
  if (t.aliases && Array.isArray(t.aliases)) {
    t.aliases.forEach(function(a) { aliasMap[a] = t.id; });
  }
});

function normalizeDashboardThemeKey(value) {
  var n = String(value || "").trim().toLowerCase();
  if (!n) return defaultTheme;
  var resolved = aliasMap[n] || n;
  return metaMap[resolved] ? resolved : defaultTheme;
}

function getDashboardThemeMeta(value) {
  return metaMap[normalizeDashboardThemeKey(value)] || metaMap[defaultTheme];
}

function getDashboardThemeLabel(value) {
  var m = getDashboardThemeMeta(value);
  return m ? m.label : "URage";
}

// Expose on window for dynamic access and as bare globals for strict-mode callers
window.dashboardThemes = themes;
window.dashboardThemeOrder = order;
window.defaultDashboardTheme = defaultTheme;
window.normalizeDashboardThemeKey = normalizeDashboardThemeKey;
window.getDashboardThemeMeta = getDashboardThemeMeta;
window.getDashboardThemeLabel = getDashboardThemeLabel;
