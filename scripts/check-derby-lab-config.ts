import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveRacingRosterConfig,
  selectRacingRoundRosters,
  type RacingRosterConfig
} from "../server/src/services/games/racingRosterConfig.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packDocument = JSON.parse(await readFile(path.join(root, "bots", "discord-bot", "game-packs", "derby-lab.uragegame.json"), "utf8"));
type Racer = { name: string; color: string; power: number };
type Roster = { label: string; racers: Racer[] };

function labels(rosters: Roster[]): string[] {
  return rosters.map(roster => roster.label);
}

function sampleRacers(count: number): Racer[] {
  return Array.from({ length: count }, (_, index) => ({ name: `Racer ${index + 1}`, color: "#f4bc55", power: 5 }));
}

function sampleRoster(label: string, count = 3): Roster {
  return { label, racers: sampleRacers(count) };
}

const config: RacingRosterConfig = resolveRacingRosterConfig(packDocument.configuration);
assert.deepEqual(labels(config.rosters), ["Horses", "Emus", "Penguins"]);
assert.deepEqual(config.rosters.map(roster => roster.species), ["horse", "emu", "penguin"]);
assert.deepEqual(config.rosters.map(roster => roster.racers.length), [6, 6, 6]);
assert.deepEqual(config.rosters[1].racers[0], { name: "Turbo Feathers", color: "#f4bc55", power: 9.4 });
assert.equal(config.rosterMode, "sequential");
assert.equal(config.houseFee, 5);
assert.equal(config.bonusPool, 500);

// The store must reject the same rows the dashboard editor refuses.
assert.throws(() => resolveRacingRosterConfig({ rosters: [] }), /needs 1-10 rosters/);
assert.throws(() => resolveRacingRosterConfig({ rosters: Array.from({ length: 11 }, (_, index) => sampleRoster(`Roster ${index + 1}`)) }), /needs 1-10 rosters/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [sampleRoster("Too few", 2)] }), /needs 3-8 racers/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [sampleRoster("Too many", 9)] }), /needs 3-8 racers/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [{ label: "Bad color", racers: [{ name: "Fido", color: "blue", power: 5 }, ...sampleRacers(2)] }] }), /needs a #rrggbb color/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [{ label: "Bad strength", racers: [{ name: "Fido", color: "#f4bc55", power: 0 }, ...sampleRacers(2)] }] }), /needs a strength from 1 to 10/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [{ label: " ".repeat(3), racers: sampleRacers(3) }] }), /needs a label of at most 24 characters/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [{ label: "Blank racer", racers: [{ name: "   ", color: "#f4bc55", power: 5 }, ...sampleRacers(2)] }] }), /needs a name of at most 24 characters/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [{ ...sampleRoster("Bad species"), species: "goat" }] }), /species must be horse, penguin, or emu/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [sampleRoster("Fee"), sampleRoster("Fee")], houseFee: 31 }), /house fee must be an integer from 0 to 30 percent/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [sampleRoster("Pool")], bonusPool: 100_001 }), /bonus pool must be an integer from 0 to 100000/);
assert.throws(() => resolveRacingRosterConfig({ rosters: [sampleRoster("Mode")], rosterMode: "unknown" }), /roster mode must be sequential, random, or shuffle/);

// Roster selection honours the three rotation modes.
assert.deepEqual(labels(selectRacingRoundRosters(config, 5)), ["Horses", "Emus", "Penguins", "Horses", "Emus"]);
const randomConfig: RacingRosterConfig = { ...config, rosterMode: "random" };
assert.deepEqual(labels(selectRacingRoundRosters(randomConfig, 4, () => 0.9)), Array.from({ length: 4 }, () => "Penguins"));
const shuffleConfig: RacingRosterConfig = { ...config, rosterMode: "shuffle" };
const shuffled = labels(selectRacingRoundRosters(shuffleConfig, 7, () => 0.2));
assert.equal(shuffled.length, 7);
assert.deepEqual(new Set(shuffled.slice(0, 3)), new Set(["Horses", "Emus", "Penguins"]));
assert.deepEqual(new Set(shuffled.slice(3, 6)), new Set(["Horses", "Emus", "Penguins"]));

const scratch = await mkdtemp(path.join(tmpdir(), "urage-derby-config-"));
try {
  process.env.DASHBOARD_DATA_DIR = scratch;
  const { getInstalledGamePackage, importGamePackage, setGameRuntimeEnabled, updateGameConfiguration } =
    await import("../server/src/services/games/gamePackageStore.js");
  await importGamePackage("derby-lab");
  await setGameRuntimeEnabled("derby-lab", "discord", true);
  const initial = await getInstalledGamePackage("derby-lab");
  assert.ok(initial);
  assert.deepEqual(labels(resolveRacingRosterConfig(initial.configuration).rosters), ["Horses", "Emus", "Penguins"]);
  const updated = { ...packDocument.configuration, rounds: 5, rosterMode: "shuffle", houseFee: 0, bonusPool: 0 };
  await updateGameConfiguration("derby-lab", updated);
  const saved = await getInstalledGamePackage("derby-lab");
  assert.deepEqual(saved?.configuration, updated);
  assert.deepEqual(saved?.packageInfo.enabledRuntimes, ["discord"]);
  await assert.rejects(
    updateGameConfiguration("derby-lab", { rounds: 3, rosters: [sampleRoster("Solo", 1)] }),
    /needs 3-8 racers/
  );
  assert.deepEqual((await getInstalledGamePackage("derby-lab"))?.configuration, updated);
} finally {
  const resolvedScratch = path.resolve(scratch);
  if (!resolvedScratch.startsWith(`${path.resolve(tmpdir())}${path.sep}`)) throw new Error("Unsafe test cleanup path.");
  await rm(resolvedScratch, { recursive: true, force: true });
}

console.log("Derby Lab roster configuration validation passed.");
