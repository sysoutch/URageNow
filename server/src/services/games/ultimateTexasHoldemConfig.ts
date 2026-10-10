export const ultimateTexasHoldemMinPlayers = 2;
export const ultimateTexasHoldemMaxPlayers = 6;
export const ultimateTexasHoldemMinAnte = 5;
export const ultimateTexasHoldemMaxAnte = 1_000;
export const ultimateTexasHoldemMaxAnteOptions = 8;
export const ultimateTexasHoldemMaxHands = 20;
export const ultimateTexasHoldemMaxTripsBonus = 100_000;
export const ultimateTexasHoldemMaxBet = 1_000_000;

// Ultimate Texas Hold'em stakes every decision as a multiple of the ante, so
// the multipliers are fixed by the ruleset rather than the game package.
export const ultimateTexasHoldemPlayMultiplier = 3;
export const ultimateTexasHoldemBetMultiplier = 2;

export type UltimateTexasHoldemPaytable = {
  royalFlush: number;
  straightFlush: number;
  quads: number;
  trips: number;
};

export type UltimateTexasHoldemConfig = {
  anteOptions: number[];
  defaultAnte: number;
  minBet: number;
  hands: number;
  tripsPaytable: UltimateTexasHoldemPaytable;
};

function isPositiveInteger(value: unknown, maximum: number): boolean {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= maximum;
}

export function resolveUltimateTexasHoldemConfig(configuration: Record<string, unknown>): UltimateTexasHoldemConfig {
  const anteOptions = configuration.anteOptions;
  if (!Array.isArray(anteOptions) || anteOptions.length < 1 || anteOptions.length > ultimateTexasHoldemMaxAnteOptions) {
    throw new Error(`Ultimate Texas Hold'em needs 1-${ultimateTexasHoldemMaxAnteOptions} ante options.`);
  }
  const validatedAnteOptions: number[] = [];
  for (const index in anteOptions) {
    const ante = Number(anteOptions[index]);
    if (!Number.isInteger(ante) || ante < ultimateTexasHoldemMinAnte || ante > ultimateTexasHoldemMaxAnte) {
      throw new Error(`Ante option ${Number(index) + 1} must be an integer from ${ultimateTexasHoldemMinAnte} to ${ultimateTexasHoldemMaxAnte}.`);
    }
    validatedAnteOptions.push(ante);
  }
  const uniqueAnteOptions = [...new Set(validatedAnteOptions)];

  const defaultAnte = Number(configuration.defaultAnte ?? uniqueAnteOptions[0]);
  if (!Number.isInteger(defaultAnte) || !uniqueAnteOptions.includes(defaultAnte)) {
    throw new Error("The default ante must be one of the ante options.");
  }

  const minBet = Number(configuration.minBet ?? ultimateTexasHoldemMinAnte);
  if (!Number.isInteger(minBet) || minBet < 1 || minBet > ultimateTexasHoldemMaxBet) {
    throw new Error(`The minimum bet must be an integer from 1 to ${ultimateTexasHoldemMaxBet}.`);
  }

  const hands = Number(configuration.hands ?? 10);
  if (!Number.isInteger(hands) || hands < 1 || hands > ultimateTexasHoldemMaxHands) {
    throw new Error(`Ultimate Texas Hold'em needs 1-${ultimateTexasHoldemMaxHands} hands.`);
  }

  const paytable = configuration.tripsPaytable;
  if (!paytable || typeof paytable !== "object" || Array.isArray(paytable)) {
    throw new Error("Ultimate Texas Hold'em needs a trips paytable object.");
  }
  const table = paytable as Record<string, unknown>;
  const royalFlush = Number(table.royalFlush ?? 100);
  const straightFlush = Number(table.straightFlush ?? 20);
  const quads = Number(table.quads ?? 2);
  const trips = Number(table.trips ?? 1);
  const paytableEntries: { label: string; value: number }[] = [
    { label: "royalFlush", value: royalFlush },
    { label: "straightFlush", value: straightFlush },
    { label: "quads", value: quads },
    { label: "trips", value: trips },
  ];
  for (const entry of paytableEntries) {
    if (!Number.isFinite(entry.value) || entry.value < 0 || entry.value > 1_000) {
      throw new Error(`The trips paytable ${entry.label} multiplier must be from 0 to 1000.`);
    }
  }
  if (!(royalFlush >= straightFlush && straightFlush >= quads && quads >= trips)) {
    throw new Error("The trips paytable must pay rarer hands at least as much as common ones.");
  }

  return {
    anteOptions: uniqueAnteOptions,
    defaultAnte,
    minBet,
    hands,
    tripsPaytable: { royalFlush, straightFlush, quads, trips },
  };
}

export function validateUltimateTexasHoldemAnte(value: unknown, anteOptions: number[]): boolean {
  return Number.isInteger(value) && anteOptions.includes(Number(value));
}

export function validateUltimateTexasHoldemHands(value: unknown): boolean {
  const hands = Number(value);
  return Number.isInteger(hands) && hands >= 1 && hands <= ultimateTexasHoldemMaxHands;
}
