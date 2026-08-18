import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const useWatch = args.has("--watch");
const shouldEnsureCss = !args.has("--skip-css-check");

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd || repoRoot,
      env: options.env || process.env,
      shell: process.platform === "win32",
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

const dashboardEnv = {
  ...process.env,
  DASHBOARD_ENABLED: "true"
};

if (!dashboardEnv.DISCORD_TOKEN_RUNTIME) {
  dashboardEnv.DISCORD_TOKEN_RUNTIME = "";
}

if (shouldEnsureCss) {
  await run(process.execPath, ["scripts/ensure-dashboard-css.mjs"]);
}

const runtimeScript = useWatch ? "runtime:dev" : "runtime:start";
await run("npm.cmd", ["run", runtimeScript], { cwd: repoRoot, env: dashboardEnv });
