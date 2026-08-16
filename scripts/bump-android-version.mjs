import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionPath = path.join(repoRoot, "apps", "android-companion", "version.properties");
const usage = "Usage: npm run version:android -- <patch|minor|major|prerelease|x.y.z> [--dry-run]";
const argumentsList = process.argv.slice(2);
const dryRun = argumentsList.includes("--dry-run");
const requestedVersion = argumentsList.find(value => value !== "--dry-run");

if (!requestedVersion || requestedVersion === "--help" || requestedVersion === "-h") {
  console.log(usage);
  process.exit(requestedVersion ? 0 : 1);
}

const source = await readFile(versionPath, "utf8");
const properties = new Map(
  source.split(/\r?\n/)
    .map(line => line.split("=", 2))
    .filter(parts => parts.length === 2)
    .map(([key, value]) => [key.trim(), value.trim()])
);
const currentName = properties.get("VERSION_NAME") || "";
const currentCode = Number(properties.get("VERSION_CODE"));
const versionMatch = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(currentName);

if (!versionMatch || !Number.isInteger(currentCode) || currentCode < 1) {
  throw new Error("apps/android-companion/version.properties must contain a semantic VERSION_NAME and positive VERSION_CODE.");
}

const [, majorText, minorText, patchText] = versionMatch;
const current = {major: Number(majorText), minor: Number(minorText), patch: Number(patchText)};

function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function resolveNextVersion(request) {
  if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(request)) {
    return request;
  }
  if (request === "patch") return formatVersion({...current, patch: current.patch + 1});
  if (request === "minor" || request === "feature") return formatVersion({major: current.major, minor: current.minor + 1, patch: 0});
  if (request === "major") return formatVersion({major: current.major + 1, minor: 0, patch: 0});
  if (request === "prerelease") return `${formatVersion(current)}-rc.${currentCode + 1}`;
  throw new Error(`${usage}\nUnsupported version target: ${request}`);
}

const nextName = resolveNextVersion(requestedVersion);
if (nextName === currentName) {
  throw new Error("The requested Android version is already current; choose a newer semantic version.");
}
const nextCode = currentCode + 1;
const nextSource = `VERSION_CODE=${nextCode}\nVERSION_NAME=${nextName}\n`;

if (dryRun) {
  console.log(`Android version: ${currentName} (${currentCode}) -> ${nextName} (${nextCode}) [dry run]`);
} else {
  await writeFile(versionPath, nextSource, "utf8");
  console.log(`Android version: ${currentName} (${currentCode}) -> ${nextName} (${nextCode})`);
}
