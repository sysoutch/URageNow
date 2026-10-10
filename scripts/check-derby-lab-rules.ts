import assert from "node:assert/strict";
import {
  racingGameMaxBet,
  racingMultiplier,
  racingPreviewMultiplier,
  racingStakeOnRacer,
  racingTotalStake,
  racingBetPayout,
  racingWinChance,
  racingWinnerIndex,
  resolveRacingRosterConfig,
  type RacingRoster,
  type RacingBet
} from "../server/src/services/games/racingRosterConfig.js";
import { racingFinishRanks } from "../bots/discord-bot/src/runtime/games/racingGameAdapter.js";

const roster: RacingRoster = resolveRacingRosterConfig({
  rosters: [
    {
      label: "Horses",
      racers: [
        { name: "Thunderbolt", color: "#f4bc55", power: 9.4 },
        { name: "Night Rider", color: "#a78bfa", power: 8.1 },
        { name: "Wild Card", color: "#f29cdb", power: 3.4 }
      ]
    }
  ]
}).rosters[0];

// Draw weights follow power^2.3, so the favourite is favoured but never certain.
const chances = roster.racers.map((_, index) => racingWinChance(roster, index));
assert.ok(Math.abs(chances.reduce((sum, value) => sum + value, 0) - 1) < 1e-9, "win chances must cover every racer");
assert.ok(chances[0] > chances[1] && chances[1] > chances[2], "stronger racers must be favoured");
assert.ok(chances[0] > 0.5 && chances[0] < 0.6, "the favourite wins about 56% of the time");
assert.ok(chances[2] > 0.01, "the long shot still pays");
assert.equal(racingWinnerIndex(roster, () => 0), 0);
assert.equal(racingWinnerIndex(roster, () => 0.99), 2);

for (let winner = 0; winner < roster.racers.length; winner += 1) {
  const ranks = racingFinishRanks(roster.racers.length, winner, () => 0.4);
  assert.equal(ranks[winner], 0, "The selected winner must finish first in the replay.");
  assert.deepEqual([...ranks].sort((left, right) => left - right), [0, 1, 2], "Replay ranks must contain every finishing place once.");
}

const bets: RacingBet[] = [
  { racerIndex: 0, amount: 100 },
  { racerIndex: 0, amount: 50 },
  { racerIndex: 2, amount: 25 }
];
assert.equal(racingTotalStake(bets), 175);
assert.equal(racingStakeOnRacer(bets, 0), 150);
assert.equal(racingStakeOnRacer(bets, 1), 0);

// The purse is every stake plus the bonus pool, less the house fee, spread over
// the winning racers' stakes: a crowded racer pays less, a long shot pays more.
const bonusPool = 500;
const houseFee = 5;
assert.ok(Math.abs(racingMultiplier(bets, 0, bonusPool, houseFee) - 4.275) < 1e-9);
assert.ok(Math.abs(racingMultiplier(bets, 2, bonusPool, houseFee) - 25.65) < 1e-9);
assert.equal(racingMultiplier(bets, 1, bonusPool, houseFee), 0, "no stake on the winner pays nothing");
assert.ok(racingMultiplier(bets, 2, bonusPool, houseFee) > racingMultiplier(bets, 0, bonusPool, houseFee));
assert.ok(racingMultiplier(bets, 0, 0, 0) >= 0 && racingMultiplier(bets, 0, 0, 30) >= 0, "payouts never go negative");
assert.ok(Math.abs(racingMultiplier(bets, 0, 0, 0) - 175 / 150) < 1e-9);
assert.ok(Math.abs(racingMultiplier(bets, 0, 0, 30) - (175 * 0.7) / 150) < 1e-9);

// Only bets on the winning racer receive the purse; the rest lose their stake.
assert.equal(racingBetPayout(bets[0]!, 0, bets, bonusPool, houseFee), 428, "100 credits on the crowded favourite pays 4.275x");
assert.equal(racingBetPayout(bets[1]!, 0, bets, bonusPool, houseFee), 214, "50 credits on the same racer pays the same multiplier");
assert.equal(racingBetPayout(bets[2]!, 0, bets, bonusPool, houseFee), 0, "a losing long shot loses its stake");
assert.equal(racingBetPayout(bets[2]!, 2, bets, bonusPool, houseFee), 641, "25 credits on a long shot pays 25.65x");
assert.equal(racingBetPayout(bets[0]!, 1, bets, bonusPool, houseFee), 0, "an unbacked winner pays nothing");

// The preview shows what a new bet would pay, including its own stake.
assert.ok(Math.abs(racingPreviewMultiplier(bets, 1, 40, bonusPool, houseFee) - 16.98125) < 1e-9);
assert.ok(
  racingPreviewMultiplier(bets, 0, 25, bonusPool, houseFee) < racingMultiplier(bets, 0, bonusPool, houseFee),
  "backing an already popular racer dilutes the purse"
);
assert.equal(racingPreviewMultiplier(bets, 1, 0, bonusPool, houseFee), 0);
assert.equal(racingGameMaxBet, 1_000_000);

console.log("Derby Lab beting rules validation passed.");
