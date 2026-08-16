import {existsSync} from "node:fs";
import {readdir} from "node:fs/promises";
import path from "node:path";

export type ThreeDSuiteKey = "3ds-max" | "houdini" | "cinema-4d";
export type ThreeDSuiteInstall = {id: string; label: string; executablePath: string;};

const suiteLabels: Record<ThreeDSuiteKey, string> = {
  "3ds-max": "3ds Max",
  houdini: "Houdini",
  "cinema-4d": "Cinema 4D"
};

function installationId(executablePath: string): string {
  return Buffer.from(executablePath, "utf8").toString("base64url");
}

async function childExecutables(root: string, executableName: string): Promise<string[]> {
  try {
    const entries = await readdir(root, {withFileTypes: true});
    return entries.filter(entry => entry.isDirectory()).map(entry => path.join(root, entry.name, executableName)).filter(existsSync);
  } catch {
    return [];
  }
}

async function discoverWindowsInstalls(suite: ThreeDSuiteKey): Promise<string[]> {
  const programFiles = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter((value): value is string => Boolean(value));
  const searches = programFiles.flatMap(root => {
    if (suite === "3ds-max") return [[path.join(root, "Autodesk"), "3dsmax.exe"]] as const;
    if (suite === "houdini") return [[path.join(root, "Side Effects Software"), path.join("bin", "houdini.exe")]] as const;
    return [[path.join(root, "Maxon"), "Cinema 4D.exe"], [root, "Cinema 4D.exe"]] as const;
  });
  return (await Promise.all(searches.map(([root, executable]) => childExecutables(root, executable)))).flat();
}

export async function listThreeDSuiteInstalls(suite: ThreeDSuiteKey): Promise<ThreeDSuiteInstall[]> {
  const paths = process.platform === "win32" ? await discoverWindowsInstalls(suite) : [];
  return Array.from(new Set(paths)).sort((left, right) => left.localeCompare(right)).map(executablePath => ({
    id: installationId(executablePath),
    label: `${suiteLabels[suite]} · ${path.basename(path.dirname(executablePath))}`,
    executablePath
  }));
}

export function isThreeDSuiteKey(value: string): value is ThreeDSuiteKey {
  return value === "3ds-max" || value === "houdini" || value === "cinema-4d";
}
