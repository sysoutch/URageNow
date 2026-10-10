import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderRacingGif } from "../bots/discord-bot/src/runtime/games/racingGameAdapter.js";
import { resolveRacingRosterConfig, type RacingRoster } from "../server/src/services/games/racingRosterConfig.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(repoRoot, "bots", "discord-bot", "game-packs", "derby-lab.uragegame.json");
const packageDocument = JSON.parse(await readFile(packagePath, "utf8"));
const rosters: RacingRoster[] = resolveRacingRosterConfig(packageDocument.configuration).rosters;
const rosterIndex = Number(process.argv[2] ?? 0);
if (!Number.isInteger(rosterIndex) || rosterIndex < 0 || rosterIndex >= rosters.length) {
  throw new Error(`Preview roster must be an integer from 0 to ${rosters.length - 1}.`);
}
const roster = rosters[rosterIndex];
const winnerIndex = Number(process.argv[3] ?? 0);
if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= roster.racers.length) {
  throw new Error(`Preview winner must be an integer from 0 to ${roster.racers.length - 1}.`);
}
const gif = await renderRacingGif(roster, winnerIndex, rosterIndex + 1, rosters.length);
const outputPath = path.join(repoRoot, "bots", "discord-bot", "derby-lab-preview.gif");
await writeFile(outputPath, gif);
console.log(`Wrote ${outputPath} (${gif.length} bytes, ${roster.label} roster, ${roster.racers[winnerIndex].name} won).`);
