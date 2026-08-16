export const MAIN_HAND_OUTCOME = Object.freeze({
  WIN: 'WIN',
  LOSE: 'LOSE',
  TIE: 'Dealer has the same hand as you',
  DEALER_DISQUALIFIED: "Dealer didn't qualify",
});

export function resolveMainHandOutcome({
  comparison,
  isFolded,
  dealerQualifies,
  dealerQualificationEnabled,
}) {
  if (isFolded) {
    return MAIN_HAND_OUTCOME.LOSE;
  }

  if (dealerQualificationEnabled && !dealerQualifies) {
    return MAIN_HAND_OUTCOME.DEALER_DISQUALIFIED;
  }

  if (comparison < 0) {
    return MAIN_HAND_OUTCOME.LOSE;
  }

  if (comparison === 0) {
    return MAIN_HAND_OUTCOME.TIE;
  }

  return MAIN_HAND_OUTCOME.WIN;
}
