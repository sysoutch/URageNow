export function registerToolTheme(onApply) {
  const applyVars = (themeName, tokens) => {
    const root = document.documentElement;
    root.style.setProperty("--bg", tokens.bg);
    root.style.setProperty("--panel", tokens.surface);
    root.style.setProperty("--panel-soft", tokens.surfaceStrong);
    root.style.setProperty("--line", tokens.line);
    root.style.setProperty("--text", tokens.text);
    root.style.setProperty("--muted", tokens.muted);
    root.style.setProperty("--accent", tokens.accent);
    root.style.setProperty("--accent-2", tokens.accentStrong);
    if (typeof onApply === "function") {
      onApply(themeName, tokens);
    }
  };
  if (typeof window.registerDashboardThemeSync === "function") {
    window.registerDashboardThemeSync(applyVars);
    return;
  }
  applyVars("earth", {
    accent: "#8fd36a",
    accentStrong: "#d6a24c",
    bg: "#11160f",
    surface: "rgba(17, 24, 15, 0.94)",
    surfaceStrong: "rgba(10, 15, 9, 0.98)",
    line: "rgba(199, 221, 167, 0.18)",
    text: "#f5f7ef",
    muted: "#bdc8aa"
  });
}
