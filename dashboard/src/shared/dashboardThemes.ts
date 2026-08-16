import {
  dashboardThemeIds,
  defaultDashboardTheme,
  normalizeDashboardThemeKey
} from "@urage/shared/dashboard/themeIds";

export { dashboardThemeIds, defaultDashboardTheme, normalizeDashboardThemeKey };

export type DashboardThemeGroupId = "all" | "core" | "mood";

export type DashboardThemeDefinition = {
  id: string;
  label: string;
  group: Exclude<DashboardThemeGroupId, "all">;
  imagePath: string;
  swatchStart: string;
  swatchEnd: string;
  swatchGlow: string;
  aliases?: string[];
};

export const dashboardThemeGroups: Array<{ id: DashboardThemeGroupId; label: string; }> = [
  { id: "all", label: "All" },
  { id: "core", label: "Core" },
  { id: "mood", label: "Mood" }
];

export const dashboardThemes: DashboardThemeDefinition[] = [
  {
    id: "blood",
    label: "UDead",
    group: "mood",
    imagePath: "/assets/dashboard-theme-logo.png?theme=blood",
    swatchStart: "#ff6e6e",
    swatchEnd: "#9c2828",
    swatchGlow: "#ff3b3b"
  },
  {
    id: "fire",
    label: "URage",
    group: "core",
    imagePath: "/assets/dashboard-theme-logo.png?theme=fire",
    swatchStart: "#ffcb66",
    swatchEnd: "#9c3820",
    swatchGlow: "#ff934d"
  },
  {
    id: "nature",
    label: "UDope",
    group: "mood",
    imagePath: "/assets/dashboard-theme-logo.png?theme=nature",
    swatchStart: "#8ff0a4",
    swatchEnd: "#247c43",
    swatchGlow: "#6ede86"
  },
  {
    id: "water",
    label: "UCool",
    group: "core",
    imagePath: "/assets/dashboard-theme-logo.png?theme=water",
    swatchStart: "#8ad8ff",
    swatchEnd: "#1f5cb7",
    swatchGlow: "#59b8ff"
  },
  {
    id: "love",
    label: "ULove",
    group: "mood",
    imagePath: "/assets/dashboard-theme-logo.png?theme=love",
    swatchStart: "#ff8cff",
    swatchEnd: "#9c289c",
    swatchGlow: "#ff5cff"
  },
  {
    id: "crystal",
    label: "UChill",
    group: "mood",
    imagePath: "/assets/dashboard-theme-logo.png?theme=crystal",
    swatchStart: "#df9cff",
    swatchEnd: "#5c2bc5",
    swatchGlow: "#b070ff",
    aliases: ["purple"]
  },
  {
    id: "light",
    label: "ULight",
    group: "core",
    imagePath: "/assets/dashboard-theme-logo.png?theme=light",
    swatchStart: "#ffffff",
    swatchEnd: "#cfd8e6",
    swatchGlow: "#dfe8f6"
  },
  {
    id: "smoke",
    label: "USmoke",
    group: "core",
    imagePath: "/assets/dashboard-theme-logo.png?theme=smoke",
    swatchStart: "#bfc5cf",
    swatchEnd: "#4d525b",
    swatchGlow: "#8b93a0"
  },
  {
    id: "rock",
    label: "URock",
    group: "core",
    imagePath: "/assets/dashboard-theme-logo.png?theme=rock",
    swatchStart: "#d5d8df",
    swatchEnd: "#62656e",
    swatchGlow: "#aeb4c0"
  }
];

const themeMetaMap = new Map<string, DashboardThemeDefinition>();
for (const theme of dashboardThemes) {
  themeMetaMap.set(theme.id, theme);
}

export const dashboardThemeOrder = [...dashboardThemeIds];

export function getDashboardThemeMeta(value: unknown): DashboardThemeDefinition {
  return themeMetaMap.get(normalizeDashboardThemeKey(value)) || themeMetaMap.get(defaultDashboardTheme)!;
}

export function getDashboardThemeLabel(value: unknown): string {
  return getDashboardThemeMeta(value).label || "URage";
}

export function getDashboardThemesByGroup(group: DashboardThemeGroupId): DashboardThemeDefinition[] {
  if (group === "all") {
    return dashboardThemes.slice();
  }
  return dashboardThemes.filter(theme => theme.group === group);
}
