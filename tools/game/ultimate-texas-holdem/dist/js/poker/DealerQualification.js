import { HAND_RANKINGS } from './HandEvaluator.js';

export const DEFAULT_DEALER_QUALIFICATION = 'PAIR_4';

export const DEALER_QUALIFICATION_OPTIONS = [
  ['HIGH_CARD', 'Any hand (high card)'],
  ...[
    [2, 'Twos'], [3, 'Threes'], [4, 'Fours'], [5, 'Fives'], [6, 'Sixes'], [7, 'Sevens'],
    [8, 'Eights'], [9, 'Nines'], [10, 'Tens'], [11, 'Jacks'], [12, 'Queens'], [13, 'Kings'], [14, 'Aces'],
  ].map(([rank, label]) => [`PAIR_${rank}`, `Pair of ${label}`]),
  ['TWO_PAIR', 'Two Pair'],
  ['THREE_OF_A_KIND', 'Three of a Kind'],
  ['STRAIGHT', 'Straight'],
  ['FLUSH', 'Flush'],
  ['FULL_HOUSE', 'Full House'],
  ['FOUR_OF_A_KIND', 'Four of a Kind'],
  ['STRAIGHT_FLUSH', 'Straight Flush'],
  ['ROYAL_FLUSH', 'Royal Flush'],
];

export function dealerMeetsQualification(result, minimum = DEFAULT_DEALER_QUALIFICATION) {
  if (!result || typeof result.rank !== 'number') {
    return false;
  }
  if (minimum === 'HIGH_CARD') {
    return true;
  }
  if (minimum.startsWith('PAIR_')) {
    if (result.rank > HAND_RANKINGS.ONE_PAIR) {
      return true;
    }
    if (result.rank < HAND_RANKINGS.ONE_PAIR) {
      return false;
    }
    const pairRank = Number(result.tiebreakers?.[0])
      || Number(Object.entries(result.counts || {})
        .filter(([, count]) => Number(count) >= 2)
        .map(([rank]) => Number(rank))
        .sort((left, right) => right - left)[0])
      || 0;
    return pairRank >= Number(minimum.slice(5));
  }
  const minimumRank = HAND_RANKINGS[minimum];
  return Number.isInteger(minimumRank) && result.rank >= minimumRank;
}
