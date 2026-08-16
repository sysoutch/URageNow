import assert from "node:assert/strict";
import {dealerMeetsQualification} from "../tools/game/ultimate-texas-holdem/dist/js/poker/DealerQualification.js";
import {PayoutEngine} from "../tools/game/ultimate-texas-holdem/dist/js/engine/PayoutEngine.js";
import {HandEvaluator} from "../tools/game/ultimate-texas-holdem/dist/js/poker/HandEvaluator.js";
import {Card} from "../tools/game/ultimate-texas-holdem/dist/js/poker/Card.js";
import {Player} from "../tools/game/ultimate-texas-holdem/dist/js/players/Player.js";
import {
  MAIN_HAND_OUTCOME,
  resolveMainHandOutcome,
} from "../tools/game/ultimate-texas-holdem/dist/js/engine/MainHandOutcome.js";

assert.equal(dealerMeetsQualification({rank: 0, kickers: [14]}, "PAIR_4"), false);
assert.equal(dealerMeetsQualification({rank: 1, tiebreakers: [3, 14, 9, 2]}, "PAIR_4"), false);
assert.equal(dealerMeetsQualification({rank: 1, tiebreakers: [4, 14, 9, 2]}, "PAIR_4"), true);
assert.equal(dealerMeetsQualification({rank: 2, kickers: [2, 14, 9]}, "PAIR_4"), true);

const dealerWithBoardPairOfFours = HandEvaluator.evaluate([
  new Card(14, "spades"),
  new Card(9, "hearts"),
  new Card(4, "clubs"),
  new Card(4, "diamonds"),
  new Card(13, "spades"),
  new Card(7, "clubs"),
  new Card(2, "hearts"),
]);
assert.equal(dealerWithBoardPairOfFours.rank, 1);
assert.equal(dealerWithBoardPairOfFours.tiebreakers[0], 4);
assert.equal(dealerMeetsQualification(dealerWithBoardPairOfFours, "PAIR_4"), true);

const payouts = new PayoutEngine();
const pushed = payouts.calculatePayouts(
  {rank: 0, name: "Ace High"},
  {rank: 1, name: "Pair of Threes"},
  10, 20, false, -1, 5, false,
  {blindBet: 10, tableRulePreset: "official", pushMainBetsWhenDealerDisqualified: true}
);
assert.equal(pushed.antePayout, 10);
assert.equal(pushed.blindPayout, 10);
assert.equal(pushed.playPayout, 20);
assert.equal(pushed.tripsPayout, 0);
assert.equal(pushed.netProfit, -5);
assert.equal(pushed.details[0].type, "push");
assert.match(pushed.details[0].message, /Dealer didn't qualify/);
assert.deepEqual(
  pushed.breakdown
    .filter(entry => ["Ante", "Blind", "Play"].includes(entry.label))
    .map(entry => [entry.label, entry.profit, entry.multiplierLabel]),
  [["Ante", 0, "Push"], ["Blind", 0, "Push"], ["Play", 0, "Push"]]
);
assert.equal(resolveMainHandOutcome({
  comparison: -1,
  isFolded: false,
  dealerQualifies: false,
  dealerQualificationEnabled: true,
}), MAIN_HAND_OUTCOME.DEALER_DISQUALIFIED);

const pushedWithWinningTrips = payouts.calculatePayouts(
  {rank: 3, name: "Three of a Kind"},
  {rank: 1, name: "Pair of Threes"},
  10, 20, false, -1, 5, false,
  {blindBet: 10, tableRulePreset: "official", pushMainBetsWhenDealerDisqualified: true}
);
assert.equal(pushedWithWinningTrips.antePayout, 10);
assert.equal(pushedWithWinningTrips.blindPayout, 10);
assert.equal(pushedWithWinningTrips.playPayout, 20);
assert.equal(pushedWithWinningTrips.tripsPayout, 20);
assert.equal(pushedWithWinningTrips.netProfit, 15);

const paidWinningAnte = payouts.calculatePayouts(
  {rank: 2, name: "Two Pair"},
  {rank: 1, name: "Pair of Threes"},
  10, 20, false, 1, 0, false,
  {
    blindBet: 10,
    tableRulePreset: "official",
    pushMainBetsWhenDealerDisqualified: true,
    dealerDisqualifiedAnteMode: "PAY_ON_PLAYER_WIN",
  }
);
assert.equal(paidWinningAnte.antePayout, 20);
assert.equal(paidWinningAnte.blindPayout, 10);
assert.equal(paidWinningAnte.playPayout, 20);
assert.equal(paidWinningAnte.netProfit, 10);
assert.deepEqual(
  paidWinningAnte.breakdown
    .filter(entry => ["Ante", "Blind", "Play"].includes(entry.label))
    .map(entry => [entry.label, entry.profit, entry.multiplierLabel]),
  [["Ante", 10, "1x"], ["Blind", 0, "Push"], ["Play", 0, "Push"]]
);
assert.match(paidWinningAnte.details[0].message, /winning Ante pays 1 to 1/);

const losingAnteStillPushes = payouts.calculatePayouts(
  {rank: 0, name: "Ace High"},
  {rank: 1, name: "Pair of Threes"},
  10, 20, false, -1, 0, false,
  {
    blindBet: 10,
    tableRulePreset: "official",
    pushMainBetsWhenDealerDisqualified: true,
    dealerDisqualifiedAnteMode: "PAY_ON_PLAYER_WIN",
  }
);
assert.equal(losingAnteStillPushes.antePayout, 10);
assert.equal(losingAnteStillPushes.netProfit, 0);

const disabled = payouts.calculatePayouts(
  {rank: 0, name: "Ace High"},
  {rank: 1, name: "Pair of Threes"},
  10, 20, true, -1, 0, false,
  {blindBet: 10, tableRulePreset: "official", pushMainBetsWhenDealerDisqualified: false}
);
assert.equal(disabled.netProfit, -40);
assert.equal(resolveMainHandOutcome({
  comparison: 0,
  isFolded: false,
  dealerQualifies: true,
  dealerQualificationEnabled: true,
}), MAIN_HAND_OUTCOME.TIE);
assert.equal(resolveMainHandOutcome({
  comparison: -1,
  isFolded: false,
  dealerQualifies: true,
  dealerQualificationEnabled: true,
}), MAIN_HAND_OUTCOME.LOSE);

Player.resetCounter();
const shortStack = new Player({name: "Short Stack", bankroll: 20});
assert.equal(shortStack.actionRaise(25), false);
assert.equal(shortStack.bankroll, 20);
assert.equal(shortStack.playBet, 0);
assert.equal(shortStack.actionRaise(20), true);
assert.equal(shortStack.bankroll, 0);
assert.equal(shortStack.playBet, 20);

console.log("Ultimate Texas Hold'em dealer qualification validation passed.");
