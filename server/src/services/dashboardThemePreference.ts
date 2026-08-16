import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultDashboardTheme,
  normalizeDashboardThemeKey,
  type DashboardThemeId
} from "@urage/shared/dashboard/themeIds";
import { appConfig } from "../config/appConfig.js";

export type DashboardThemePreference = {
  theme: DashboardThemeId;
  updatedAt: string | null;
};

export function createDashboardThemePreferenceStore(
  input: {storePath?: string} = {}
) {
  const preferencePath = path.resolve(input.storePath
    ?? path.join(appConfig.dataDirectory, "dashboard-theme-preference.json"));
  let writeQueue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<DashboardThemePreference> {
    try {
      const value = JSON.parse(await readFile(preferencePath, "utf8")) as Record<string, unknown>;
      return {
        theme: normalizeDashboardThemeKey(value.theme),
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null
      };
    } catch {
      return {theme: defaultDashboardTheme, updatedAt: null};
    }
  }

  async function save(theme: unknown): Promise<DashboardThemePreference> {
    const preference = {
      theme: normalizeDashboardThemeKey(theme),
      updatedAt: new Date().toISOString()
    } satisfies DashboardThemePreference;
    const task = writeQueue.then(async () => {
      await mkdir(path.dirname(preferencePath), {recursive: true});
      await writeFile(preferencePath, JSON.stringify(preference, null, 2), "utf8");
    });
    writeQueue = task.catch(() => undefined);
    await task;
    return preference;
  }

  return {read, save};
}

const dashboardThemePreferenceStore = createDashboardThemePreferenceStore();
export const readDashboardThemePreference = dashboardThemePreferenceStore.read;
export const saveDashboardThemePreference = dashboardThemePreferenceStore.save;
