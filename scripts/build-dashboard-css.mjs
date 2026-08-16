import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(scriptDirectory, "..", "dashboard");
const workspaceRoot = path.resolve(scriptDirectory, "..");
const sourcePath = path.join(dashboardRoot, "src", "styles.scss");
const cssOutputPath = path.join(dashboardRoot, "src", "generated.css");

function loadSass() {
  try {
    const requireFromCwd = createRequire(path.join(process.cwd(), "package.json"));
    return requireFromCwd("sass");
  } catch {
    try {
      return createRequire(path.join(dashboardRoot, "package.json"))("sass");
    } catch {
      const requireFromBot = createRequire(path.join(scriptDirectory, "..", "bots", "discord-bot", "package.json"));
      return requireFromBot("sass");
    }
  }
}

const sass = loadSass();

async function main() {
  console.log("Building dashboard CSS from:", path.relative(workspaceRoot, sourcePath));

  const source = await readFile(sourcePath, "utf8");
  const result = sass.compileString(source, {
    style: "compressed",
    quietDeps: true,
    loadPaths: [
      path.dirname(sourcePath),
      path.join(workspaceRoot, "node_modules"),
      path.join(workspaceRoot, "bots", "discord-bot", "node_modules")
    ]
  });

  const css = result.css.trim();
  await mkdir(path.dirname(cssOutputPath), { recursive: true });
  await writeFile(cssOutputPath, css, "utf8");

  console.log("Built dashboard CSS:", Math.round(css.length / 1024) + "KB");
  console.log("Output:", path.relative(workspaceRoot, cssOutputPath));
}

main().catch(error => {
  console.error("Failed to build dashboard CSS", error);
  process.exitCode = 1;
});