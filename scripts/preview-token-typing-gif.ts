import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderTypingGif } from "../bots/discord-bot/src/runtime/games/typingSpeedGameAdapter.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(repoRoot, "bots", "discord-bot", "game-packs", "token-typing.uragegame.json");
const packageDocument = JSON.parse(await readFile(packagePath, "utf8")) as { configuration: { text: string } };
const speed = Number(process.argv[2] || 140);
if (!Number.isFinite(speed) || speed < 5 || speed > 150) throw new Error("Preview speed must be 5-150 tokens/second.");
const text = process.argv[3] === "max"
  ? Array.from({ length: 100 }, () => "word").join(" ")
  : packageDocument.configuration.text;

const gif = await renderTypingGif(text, speed, 1, 5);
const outputPath = path.join(repoRoot, "bots", "discord-bot", "token-typing-preview.gif");
await writeFile(outputPath, gif);
console.log(`Wrote ${outputPath} (${gif.length} bytes, ${speed} tokens/second).`);
