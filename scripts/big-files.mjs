#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const identity = value => value;

function parseArgs(argv) {
  const map = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const separatorIndex = arg.indexOf("=");
    if (separatorIndex < 0) {
      map.set(arg.slice(2), "true");
      continue;
    }
    const key = arg.slice(2, separatorIndex);
    const value = arg.slice(separatorIndex + 1);
    map.set(key, value);
  }
  return map;
}

function getArg(args, name, fallback) {
  return args.get(name) ?? fallback;
}

function readLineCount(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

async function loadChalk() {
  try {
    const module = await import("chalk");
    const resolved = module.default ?? module;
    return {
      cyan: resolved.cyan ?? identity,
      gray: resolved.gray ?? identity,
      green: resolved.green ?? identity,
      yellow: resolved.yellow ?? identity,
      red: resolved.red ?? identity,
      blue: resolved.blue ?? identity,
      white: resolved.white ?? identity
    };
  } catch {
    return {
      cyan: identity,
      gray: identity,
      green: identity,
      yellow: identity,
      red: identity,
      blue: identity,
      white: identity
    };
  }
}

async function loadIgnoreFactory() {
  try {
    const module = await import("ignore");
    return module.default ?? module;
  } catch {
    return null;
  }
}

async function main() {
  const chalk = await loadChalk();
  const ignoreFactory = await loadIgnoreFactory();

  const rootDirectory = path.resolve(process.cwd());
  const args = parseArgs(process.argv.slice(2));
  const minLines = Number.parseInt(getArg(args, "min", "500"), 10);
  const topN = Number.parseInt(getArg(args, "top", "0"), 10);
  const extensions = new Set(
    getArg(args, "ext", ".js,.mjs,.txt,.md,.ts,.scss")
      .split(",")
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  );
  const excludedDirectories = new Set(["node_modules", "dist", "build", ".git", "backup"]);

  let ignoreMatcher = null;
  if (ignoreFactory) {
    ignoreMatcher = ignoreFactory();
    const gitignorePath = path.join(rootDirectory, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      ignoreMatcher.add(fs.readFileSync(gitignorePath, "utf8"));
    }
  }

  function isIgnored(relativePath) {
    if (!ignoreMatcher) {
      return false;
    }
    const normalized = relativePath.split(path.sep).join("/");
    return ignoreMatcher.ignores(normalized);
  }

  const results = [];
  const lineCountByFile = new Map();

  function walk(directoryPath) {
    let entries = [];
    try {
      entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      const relativePath = path.relative(rootDirectory, fullPath);
      if (isIgnored(relativePath)) {
        continue;
      }
      if (entry.isDirectory()) {
        if (excludedDirectories.has(entry.name)) {
          continue;
        }
        walk(fullPath);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!extensions.has(extension)) {
        continue;
      }
      const lineCount = readLineCount(fullPath);
      if (lineCount < minLines) {
        continue;
      }
      results.push(fullPath);
      lineCountByFile.set(fullPath, lineCount);
    }
  }

  console.log(chalk.cyan(`Scanning: ${rootDirectory}`));
  console.log(chalk.gray(`Min lines: ${minLines}`));
  console.log("");

  walk(rootDirectory);
  results.sort((left, right) => (lineCountByFile.get(right) ?? 0) - (lineCountByFile.get(left) ?? 0));
  const finalResults = topN > 0 ? results.slice(0, topN) : results;

  if (finalResults.length === 0) {
    console.log(chalk.green("No large files found."));
    return;
  }

  for (const filePath of finalResults) {
    const count = lineCountByFile.get(filePath) ?? 0;
    const relativePath = path.relative(rootDirectory, filePath);
    let color = chalk.white;
    let label = "info";
    if (count >= 1000) {
      color = chalk.red;
      label = "hot";
    } else if (count >= 700) {
      color = chalk.yellow;
      label = "warn";
    }
    console.log(color(`[${label}] ${String(count).padStart(5)} lines  ${relativePath}`));
  }

  console.log("");
  console.log(chalk.blue(`Found ${results.length} file(s) >= ${minLines} lines`));
}

main().catch(error => {
  console.error("Failed to scan for large files:", error);
  process.exitCode = 1;
});
