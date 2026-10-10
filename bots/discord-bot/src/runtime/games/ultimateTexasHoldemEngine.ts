import type { UltimateTexasHoldemPaytable } from "@urage/server/services/games/ultimateTexasHoldemConfig";

// =========================================================
// CARD REPRESENTATION
// =========================================================
// Ranks are ordered 2..14 (14 = Ace, which also closes the 5-4-3-2-A wheel).
// Suits are only used to detect flushes, so their order never matters.
export const rankCodes = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
export const suitCodes = ["C", "D", "H", "S"];
export const suitSymbols = ["♣", "♦", "♥", "♠"];

export type PlayingCard = { rank: number; suit: number };

export function cardId(card: PlayingCard): string {
  return `${rankCodes[card.rank]}${suitCodes[card.suit]}`;
}

export function cardLabel(card: PlayingCard): string {
  return `${rankCodes[card.rank]}${suitSymbols[card.suit]}`;
}

export function buildDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (let suit = 0; suit < suitCodes.length; suit += 1) {
    for (let rank = 2; rank <= 14; rank += 1) deck.push({ rank, suit });
  }
  return deck;
}

// Fisher-Yates over a copy so a session can never mutate a shared deck.
export function shuffleDeck(deck: PlayingCard[], random: () => number = Math.random): PlayingCard[] {
  const shuffled = [...deck];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const held = shuffled[index]!;
    shuffled[index] = shuffled[swap]!;
    shuffled[swap] = held;
  }
  return shuffled;
}

// =========================================================
// HAND EVALUATION
// =========================================================
// A score packs a category (0-8) above five rank tiebreakers in base 15, so
// any larger score is always a better poker hand.
const categoryScale = 1_000_000;

function packRanks(ranks: number[]): number {
  let packed = 0;
  for (const rank of ranks) packed = packed * 15 + rank;
  return packed;
}

// Evaluate exactly five cards. Returns 0 for malformed input so a caller can
// never mistake a broken evaluation for a winning hand.
export function evaluateFive(cards: PlayingCard[]): number {
  if (cards.length !== 5) return 0;
  const countsByRank = new Map<number, number>();
  const countsBySuit = new Map<number, number>();
  for (const card of cards) {
    countsByRank.set(card.rank, (countsByRank.get(card.rank) ?? 0) + 1);
    countsBySuit.set(card.suit, (countsBySuit.get(card.suit) ?? 0) + 1);
  }
  const ranksDesc = cards.map((card) => card.rank).sort((left, right) => right - left);
  const isFlush = [...countsBySuit.values()].some((count) => count === 5);

  const distinctDesc = [...countsByRank.keys()].sort((left, right) => right - left);
  let straightRanks: number[] = [];
  if (distinctDesc.length === 5) {
    const highRank = distinctDesc[0]!;
    const lowRank = distinctDesc[4]!;
    if (highRank - lowRank === 4) {
      straightRanks = distinctDesc;
    } else if (highRank === 14 && distinctDesc[1]! === 5 && distinctDesc[2]! === 4 && distinctDesc[3]! === 3 && lowRank === 2) {
      // The wheel scores on its five-low run, so the Ace drops to rank 1.
      straightRanks = [5, 4, 3, 2, 1];
    }
  }

  // Sort groups by count first, then by rank, so the made hand is groups[0].
  const groups = [...countsByRank.entries()].sort((left, right) => right[1] - left[1] || right[0] - left[0]);
  const topGroup = groups[0]!;
  const secondGroup = groups[1]!;
  const thirdGroup = groups[2]!;
  const fourthGroup = groups[3]!;
  const topCount = topGroup[1];

  if (isFlush && straightRanks.length) return 8 * categoryScale + packRanks(straightRanks);
  if (topCount === 4) {
    const quad = topGroup[0];
    const kicker = secondGroup[0];
    return 7 * categoryScale + packRanks([quad, quad, quad, quad, kicker]);
  }
  if (topCount === 3 && secondGroup[1] === 2) {
    const trips = topGroup[0];
    const pair = secondGroup[0];
    return 6 * categoryScale + packRanks([trips, trips, trips, pair, pair]);
  }
  if (isFlush) return 5 * categoryScale + packRanks(ranksDesc);
  if (straightRanks.length) return 4 * categoryScale + packRanks(straightRanks);
  if (topCount === 3) {
    const trips = topGroup[0];
    return 3 * categoryScale + packRanks([trips, trips, trips, secondGroup[0], thirdGroup[0]]);
  }
  if (topCount === 2 && secondGroup[1] === 2) {
    const highPair = topGroup[0];
    const lowPair = secondGroup[0];
    return 2 * categoryScale + packRanks([highPair, highPair, lowPair, lowPair, thirdGroup[0]]);
  }
  if (topCount === 2) {
    const pair = topGroup[0];
    return 1 * categoryScale + packRanks([pair, pair, secondGroup[0], thirdGroup[0], fourthGroup[0]]);
  }
  return packRanks(ranksDesc);
}

// Choose the best five-card hand out of any set of five or more cards. Ultimate
// Texas Hold'em gives both the player and the dealer seven cards to choose from.
export function bestHandScore(cards: PlayingCard[]): number {
  if (cards.length < 5) return 0;
  if (cards.length === 5) return evaluateFive(cards);
  let best = 0;
  const window: PlayingCard[] = [];
  const choose = (start: number): void => {
    if (window.length === 5) {
      const score = evaluateFive(window);
      if (score > best) best = score;
      return;
    }
    for (let index = start; index <= cards.length - (5 - window.length); index += 1) {
      window.push(cards[index]!);
      choose(index + 1);
      window.pop();
    }
  };
  choose(0);
  return best;
}

export const handCategoryNames = [
  "High Card",
  "One Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

export function handCategoryLabel(score: number): string {
  if (score <= 0) return "No Hand";
  const category = Math.floor(score / categoryScale);
  if (category < 0 || category >= handCategoryNames.length) return "No Hand";
  return handCategoryNames[category]!;
}

// =========================================================
// UTH RULES
// =========================================================
// The dealer qualifies with an Ace or King high. The best five-card hand always
// keeps the highest available rank when that rank is an Ace or King, so the
// highest rank across the dealer's cards is the qualification test.
export function dealerQualifies(dealerCards: PlayingCard[]): boolean {
  return dealerCards.some((card) => card.rank >= 13);
}

export const tripsPaytableOrder = ["royalFlush", "straightFlush", "quads", "trips"];

function isRoyalFlush(score: number): boolean {
  if (Math.floor(score / categoryScale) !== 8) return false;
  // A royal is the straight flush whose run tops out at the Ace.
  return score % categoryScale >= 14 * 15 ** 4;
}

export function tripsBonusMultiplier(score: number, paytable: UltimateTexasHoldemPaytable): number {
  const category = Math.floor(score / categoryScale);
  if (category === 8) return isRoyalFlush(score) ? paytable.royalFlush : paytable.straightFlush;
  if (category === 7) return paytable.quads;
  if (category === 3) return paytable.trips;
  return 0;
}

export type UltimateTexasHoldemOutcome = {
  kind: "fold" | "lose" | "push" | "dealer-fails" | "win";
  net: number;
  tripsNet: number;
  playerLabel: string;
  dealerLabel: string;
  playerScore: number;
  dealerScore: number;
  qualified: boolean;
};

// Resolve one hand. `playMultiplier` is 0 after a fold, 1 for Call, 3 for Play;
// `betMultiplier` is 0 for Check or 2 for Bet. Every multiplier scales the ante.
export function resolveHand(
  playerCards: PlayingCard[],
  dealerCards: PlayingCard[],
  ante: number,
  playMultiplier: number,
  betMultiplier: number,
  blind: number,
  trips: number,
  paytable: UltimateTexasHoldemPaytable,
): UltimateTexasHoldemOutcome {
  const playerScore = bestHandScore(playerCards);
  const dealerScore = bestHandScore(dealerCards);
  const tripsNet = Math.round(trips * tripsBonusMultiplier(playerScore, paytable));
  const qualified = dealerQualifies(dealerCards);
  const labels = {
    playerLabel: handCategoryLabel(playerScore),
    dealerLabel: handCategoryLabel(dealerScore),
    playerScore,
    dealerScore,
    qualified,
  };

  if (playMultiplier === 0) {
    // A fold forfeits the ante and any blind before the cards are revealed.
    return { kind: "fold", net: -(ante + blind), tripsNet, ...labels };
  }

  const atRisk = ante * (playMultiplier + betMultiplier) + blind;

  if (!qualified) {
    // A non-qualifying dealer pushes the ante and loses the rest even money.
    return { kind: "dealer-fails", net: atRisk, tripsNet, ...labels };
  }
  if (playerScore > dealerScore) return { kind: "win", net: atRisk, tripsNet, ...labels };
  if (playerScore < dealerScore) return { kind: "lose", net: -atRisk, tripsNet, ...labels };
  return { kind: "push", net: 0, tripsNet, ...labels };
}

