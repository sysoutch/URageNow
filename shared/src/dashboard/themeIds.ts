export const dashboardThemeIds = [
  "blood",
  "fire",
  "nature",
  "water",
  "love",
  "crystal",
  "light",
  "smoke",
  "rock"
] as const;

export type DashboardThemeId = typeof dashboardThemeIds[number];

export const defaultDashboardTheme: DashboardThemeId = "fire";

const dashboardThemeAliases = new Map<string, DashboardThemeId>([
  ["purple", "crystal"]
]);

export function normalizeDashboardThemeKey(value: unknown): DashboardThemeId {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return defaultDashboardTheme;
  const resolved = dashboardThemeAliases.get(normalized) || normalized;
  return dashboardThemeIds.includes(resolved as DashboardThemeId)
    ? resolved as DashboardThemeId
    : defaultDashboardTheme;
}
