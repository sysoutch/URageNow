import { readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "..");
const dashboardSourceRoot = path.join(workspaceRoot, "dashboard", "src");
const outputPath = path.join(dashboardSourceRoot, "generated.css");
const buildScriptPath = path.join(scriptDirectory, "build-dashboard-css.mjs");

async function collectStyleSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectStyleSources(absolutePath);
    }
    return entry.isFile() && entry.name.endsWith(".scss") ? [absolutePath] : [];
  }));
  return nested.flat();
}

async function getModifiedTime(filePath) {
  try {
    return (await stat(filePath)).mtimeMs;
  } catch {
    return 0;
  }
}

function runCssBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [buildScriptPath], {
      cwd: workspaceRoot,
      env: process.env,
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Dashboard CSS build exited with code ${code ?? "unknown"}.`));
    });
  });
}

const outputModifiedAt = await getModifiedTime(outputPath);
const styleSources = await collectStyleSources(dashboardSourceRoot);
const dependencyInputs = [
  ...styleSources,
  buildScriptPath,
  path.join(workspaceRoot, "package-lock.json")
];
const newestInputModifiedAt = Math.max(...await Promise.all(dependencyInputs.map(getModifiedTime)));

if (outputModifiedAt > 0 && outputModifiedAt >= newestInputModifiedAt) {
  console.log("Dashboard CSS is current; skipping rebuild.");
} else {
  console.log(outputModifiedAt > 0
    ? "Dashboard style inputs changed; rebuilding CSS."
    : "Dashboard CSS is missing; building it now.");
  await runCssBuild();
}
