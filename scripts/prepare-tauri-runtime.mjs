import { cp, copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptRoot, "..");
const tauriRoot = path.join(workspaceRoot, "src-tauri");
const runtimeBundle = path.join(tauriRoot, "runtime-bundle");
const binariesRoot = path.join(tauriRoot, "binaries");
const rustWorkersRoot = path.join(workspaceRoot, "workers", "rust");

function resolveTargetTriple() {
  const result = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "rustc -vV failed while resolving the Tauri target triple.");
  }
  const host = result.stdout.match(/^host:\s*(.+)$/m)?.[1]?.trim();
  if (!host) throw new Error("rustc did not report a host target triple.");
  return host;
}

async function copyRuntimeSource(relativePath, filter = () => true) {
  await cp(path.join(workspaceRoot, relativePath), path.join(runtimeBundle, relativePath), {
    recursive: true,
    dereference: true,
    filter(source) {
      const normalized = source.replaceAll("\\", "/");
      return !normalized.includes("/target/")
        && !normalized.includes("/generated-media/")
        && filter(source);
    }
  });
}

async function directorySize(root) {
  let total = 0;
  for (const entry of await readdir(root, {withFileTypes: true})) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(entryPath);
    } else if (entry.isFile()) {
      total += (await stat(entryPath)).size;
    }
  }
  return total;
}

async function copyFileIfChanged(source, destination) {
  const sourceStat = await stat(source);
  try {
    const destinationStat = await stat(destination);
    if (destinationStat.size === sourceStat.size && destinationStat.mtimeMs >= sourceStat.mtimeMs) {
      return false;
    }
  } catch {
    // A missing destination is the normal first-build case.
  }
  await copyFile(source, destination);
  return true;
}

await rm(runtimeBundle, { recursive: true, force: true });
await mkdir(runtimeBundle, { recursive: true });
await mkdir(binariesRoot, { recursive: true });

const productionTreeResult = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["ls", "--omit=dev", "--all", "--json", "--long"],
  {cwd: workspaceRoot, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 8 * 1024 * 1024}
);
if (productionTreeResult.status !== 0) {
  throw new Error(productionTreeResult.stderr || "Failed to resolve the production dependency graph.");
}
const productionTree = JSON.parse(productionTreeResult.stdout);
const productionDependencyRoots = new Set();
function collectProductionDependencyPaths(node) {
  if (!node || typeof node !== "object") return;
  const dependencyPath = typeof node.path === "string" ? path.resolve(node.path) : "";
  if (dependencyPath.startsWith(path.join(workspaceRoot, "node_modules") + path.sep)) {
    productionDependencyRoots.add(dependencyPath);
  }
  Object.values(node.dependencies || {}).forEach(collectProductionDependencyPaths);
}
collectProductionDependencyPaths(productionTree);
productionDependencyRoots.add(path.join(workspaceRoot, "node_modules", "@urage"));
const productionRoots = [...productionDependencyRoots];
const shouldCopyProductionDependency = source => {
  const resolvedSource = path.resolve(source);
  return productionRoots.some(root =>
    resolvedSource === root
    || resolvedSource.startsWith(root + path.sep)
    || root.startsWith(resolvedSource + path.sep)
  );
};
const unprunedNodeModulesSize = await directorySize(path.join(workspaceRoot, "node_modules"));

for (const relativePath of [
  "runtime",
  "bots",
  "dashboard",
  "server",
  "shared",
  "tools",
  "comfyui-workflows"
]) {
  await copyRuntimeSource(relativePath);
}
await copyRuntimeSource("node_modules", shouldCopyProductionDependency);

for (const relativePath of ["package.json", "package-lock.json", ".env.public.example"]) {
  await copyFile(path.join(workspaceRoot, relativePath), path.join(runtimeBundle, relativePath));
}

const prunedNodeModulesSize = await directorySize(path.join(runtimeBundle, "node_modules"));
for (const requiredPackage of ["tsx"]) {
  const requiredPath = path.join(runtimeBundle, "node_modules", requiredPackage);
  try {
    await stat(requiredPath);
  } catch {
    throw new Error(`Production runtime dependency "${requiredPackage}" was removed during pruning.`);
  }
}
for (const developmentOnlyPackage of ["@tauri-apps/cli", "sass", "typescript"]) {
  const developmentPath = path.join(runtimeBundle, "node_modules", ...developmentOnlyPackage.split("/"));
  try {
    await stat(developmentPath);
    throw new Error(`Development-only dependency "${developmentOnlyPackage}" leaked into the desktop runtime.`);
  } catch (error) {
    if (error instanceof Error && !("code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

const targetTriple = resolveTargetTriple();
const extension = process.platform === "win32" ? ".exe" : "";
const sidecarName = `urage-dashboard-runtime-${targetTriple}${extension}`;
await copyFileIfChanged(process.execPath, path.join(binariesRoot, sidecarName));

const brokerExecutableName = `native-application-broker${extension}`;
const brokerExecutablePath = path.join(rustWorkersRoot, "target", "release", brokerExecutableName);
const brokerInputs = [
  path.join(rustWorkersRoot, "Cargo.toml"),
  path.join(rustWorkersRoot, "Cargo.lock"),
  path.join(rustWorkersRoot, "crates", "native-application-broker", "Cargo.toml"),
  path.join(rustWorkersRoot, "crates", "native-application-broker", "src", "main.rs")
];
let brokerNeedsBuild = false;
let brokerModifiedAt = 0;
try {
  brokerModifiedAt = (await stat(brokerExecutablePath)).mtimeMs;
} catch {
  brokerNeedsBuild = true;
}
for (const brokerInput of brokerInputs) {
  if ((await stat(brokerInput)).mtimeMs > brokerModifiedAt) {
    brokerNeedsBuild = true;
    break;
  }
}
if (brokerNeedsBuild) {
  const brokerBuild = spawnSync(
    "cargo",
    ["build", "--release", "-p", "native-application-broker"],
    {cwd: rustWorkersRoot, encoding: "utf8", shell: process.platform === "win32"}
  );
  if (brokerBuild.status !== 0) {
    throw new Error(brokerBuild.stderr || "Failed to build the native application broker.");
  }
}
const packagedBrokerName = `urage-native-application-broker-${targetTriple}${extension}`;
await copyFileIfChanged(
  brokerExecutablePath,
  path.join(binariesRoot, packagedBrokerName)
);

const manifest = {
  builtAt: new Date().toISOString(),
  nodeVersion: process.version,
  targetTriple,
  entrypoint: "runtime/dashboardRuntime.ts",
  nativeApplicationBroker: packagedBrokerName,
  dependencyBytes: {
    beforePrune: unprunedNodeModulesSize,
    afterPrune: prunedNodeModulesSize,
    removed: unprunedNodeModulesSize - prunedNodeModulesSize
  }
};
await writeFile(
  path.join(runtimeBundle, "runtime-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);

const packageJson = JSON.parse(await readFile(path.join(workspaceRoot, "package.json"), "utf8"));
console.log(
  `Prepared ${packageJson.name} desktop runtime for ${targetTriple} with ${process.version}. `
  + `Production dependency pruning removed ${Math.round((unprunedNodeModulesSize - prunedNodeModulesSize) / 1_048_576)} MiB.`
);
