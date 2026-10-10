import assert from "node:assert/strict";
import { buildTypingResultsEmbeds, type PlayerScore } from "../bots/discord-bot/src/runtime/games/typingSpeedResults.js";

const speeds = Array.from({ length: 10 }, (_, index) => 10 + index * 10);
const players: PlayerScore[] = Array.from({ length: 100 }, (_, index) => ({
  userId: String(100000000000000000n + BigInt(index)),
  guesses: speeds.map((speed, round) => ({ round: round + 1, guess: speed + index / 10, score: 100 - index / 10 }))
}));
const embeds = buildTypingResultsEmbeds("Token Typing", speeds, players);
assert.ok(embeds.length > 1, "large leaderboard should be paginated");
const rendered = embeds.map(embed => embed.toJSON());
const renderedText = JSON.stringify(rendered);
for (const [index, embed] of rendered.entries()) {
  assert.ok((embed.title?.length || 0) <= 256);
  assert.ok((embed.description?.length || 0) <= 4096);
  assert.ok((embed.fields?.length || 0) <= 25);
  assert.match(embed.footer?.text || "", new RegExp(`Page ${index + 1}/${embeds.length}`));
  let textLength = (embed.title?.length || 0) + (embed.description?.length || 0) + (embed.footer?.text.length || 0);
  for (const field of embed.fields || []) {
    assert.ok(field.name.length <= 256);
    assert.ok(field.value.length <= 1024);
    textLength += field.name.length + field.value.length;
  }
  assert.ok(textLength <= 6000, `embed page ${index + 1} is too long`);
  assert.match(embed.fields?.[0]?.value || "", /Round 10: \*\*100\.0 tokens\/s\*\*/);
}
for (const player of players) assert.ok(renderedText.includes(player.userId), `missing player ${player.userId}`);
assert.match(JSON.stringify(buildTypingResultsEmbeds("Token Typing", [42], [])[0]?.toJSON()), /No one submitted a guess/);
console.log("Token Typing result embeds fit Discord limits and retain every player.");
