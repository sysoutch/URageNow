import { evaluateFive, bestHandScore, handCategoryLabel, resolveHand, dealerQualifies } from "../bots/discord-bot/src/runtime/games/ultimateTexasHoldemEngine.js";

const ranks = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const suits = ["C", "D", "H", "S"];
const c = (notation: string) => {
  const rank = ranks.indexOf(notation.slice(0, -1));
  const suit = suits.indexOf(notation.slice(-1));
  return { rank, suit };
};

const highCard = ["2C", "5D", "7H", "9S", "JC"].map(c);
const queenHigh = ["QH", "JD", "TC", "9C", "8S", "7C"].map(c);
const kingHigh = ["KH", "QD", "JC", "TD", "9S", "8C"].map(c);

const playerCards = [...highCard, ...queenHigh];
const dealerCards = [...kingHigh];
console.log("player best", bestHandScore(playerCards), handCategoryLabel(bestHandScore(playerCards)));
console.log("dealer best", bestHandScore(dealerCards), handCategoryLabel(bestHandScore(dealerCards)));
console.log("qualified", dealerQualifies(dealerCards));
console.log(JSON.stringify(resolveHand(playerCards, dealerCards, 10, 3, 2, 10, 0, { royalFlush: 100, straightFlush: 20, quads: 2, trips: 1 })));
