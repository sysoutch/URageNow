import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { appConfigEnvFiles } from "@urage/server/config/appConfig";
import { repoRoot } from "@urage/shared/runtime/repositoryPaths";

function getConfigIndex(relativePath: string): number {
  return appConfigEnvFiles.findIndex(entry => entry.relativePath === relativePath);
}

function assertOrdered(source: string, earlier: string, later: string): void {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `Missing runtime config path: ${earlier}`);
  assert.notEqual(laterIndex, -1, `Missing runtime config path: ${later}`);
  assert.ok(earlierIndex < laterIndex, `${later} must load after ${earlier}`);
}

assert.ok(getConfigIndex(".env.public") < getConfigIndex("bots/discord-bot/.env.public"));
assert.ok(getConfigIndex("bots/discord-bot/.env.public.local") < getConfigIndex(".env.public.local"));
assert.ok(getConfigIndex("bots/discord-bot/.env.main.local") < getConfigIndex(".env.main.local"));

const launcherSource = await readFile(path.join(repoRoot, "scripts", "bots", "launch.ps1"), "utf8");
assertOrdered(launcherSource, '(Join-Path $discordProjectRoot ".env.public")', '(Join-Path $repoRoot ".env.public")');
assertOrdered(launcherSource, '(Join-Path $discordProjectRoot ".env.public.local")', '(Join-Path $repoRoot ".env.public.local")');
assertOrdered(launcherSource, '(Join-Path $discordProjectRoot ".env.main.local")', '(Join-Path $repoRoot ".env.main.local")');
assertOrdered(launcherSource, 'Join-Path $discordProjectRoot ".env.main.$ResolvedProfile.local"', 'Join-Path $repoRoot ".env.main.$ResolvedProfile.local"');

assert.equal(existsSync(path.join(repoRoot, ".env.public.example")), true);
assert.equal(existsSync(path.join(repoRoot, ".env.main.local.example")), true);
assert.equal(existsSync(path.join(repoRoot, "bots", "discord-bot", ".env.public.example")), false);
assert.equal(existsSync(path.join(repoRoot, "bots", "discord-bot", ".env.main.local.example")), false);

console.log("Runtime configuration validation passed.");
