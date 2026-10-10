import assert from "node:assert/strict";
import { buildRacingResultsEmbeds, type PlayerLedger, type RacingRoundLedger } from "../bots/discord-bot/src/runtime/games/racingResults.js";

const roundSummaries = Array.from({ length: 3 }, (_, round) => `R${round + 1} · Horses · **Thunderbolt** won · 12 bet(s), 1,234 staked · 300 on winner · **4.27× payout`);
const players: PlayerLedger[] = Array.from({ length: 100 }, (_, index) => ({
  userId: String(100000000000000000n + BigInt(index)),
  rounds: Array.from({ length: 3 }, (unused, round) => ({
    round: round + 1,
    racerIndex: round,
    racerName: `Racer ${round + 1}`,
    amount: 100 + index,
    payout: round === 0 ? 427 : 0,
    net: round === 0 ? 327 : -(100 + index)
  }) as RacingRoundLedger)
}));

const embeds = buildRacingResultsEmbeds(roundSummaries, players);
assert.ok(embeds.length > 1, "large leaderboards must be paginated");
const rendered = embeds.map(embed => embed.toJSON());
for (const [index, embed] of rendered.entries()) {
  assert.ok((embed.title?.length ?? 0) <= 256);
  assert.ok((embed.description?.length ?? 0) <= 4096);
  assert.ok((embed.fields?.length ?? 0) <= 20);
  assert.match(embed.footer?.text ?? "", new RegExp(`Page ${index + 1}/${embeds.length}`));
  let textLength = (embed.title?.length ?? 0) + (embed.description?.length ?? 0) + (embed.footer?.text?.length ?? 0);
  for (const field of embed.fields ?? []) {
    assert.ok(field.name.length <= 256);
    assert.ok(field.value.length <= 1024);
    textLength += field.name.length + field.value.length;
  }
  assert.ok(textLength <= 6000, `embed page ${index + 1} is too long`);
}
const renderedText = JSON.stringify(rendered);
for (const player of players) {
  assert.ok(renderedText.includes(player.userId), `missing player ${player.userId}`);
}
assert.match(JSON.stringify(buildRacingResultsEmbeds([], [])[0]?.toJSON()), /No bets/);
console.log("Derby Lab result embeds fit Discord limits and retain every player.");
