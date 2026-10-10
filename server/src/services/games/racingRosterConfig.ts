export const racingGameMinRacers = 3;
export const racingGameMaxRacers = 8;
export const racingGameMaxRosters = 10;
export const racingGameMaxRosterLabelLength = 24;
export const racingGameMaxRacerNameLength = 24;
export const racingGameMinPower = 1;
export const racingGameMaxPower = 10;
export const racingGameMaxHouseFeePercent = 30;
export const racingGameMaxBonusPool = 100_000;
export const racingGameMaxBet = 1_000_000;

export type RacingRosterMode = "sequential" | "random" | "shuffle";
export type RacingSpecies = "horse" | "penguin" | "emu";
export type Racer = { name: string; color: string; power: number };
export type RacingRoster = { label: string; species: RacingSpecies; racers: Racer[] };
export type RacingRosterConfig = {
  rosters: RacingRoster[];
  rosterMode: RacingRosterMode;
  houseFee: number;
  bonusPool: number;
};
export type RacingBet = { racerIndex: number; amount: number };

// The source simulator weights a racer's draw with power^2.3, so a strong
// racer is favoured but never guaranteed. Keep this exponent in one place.
const racingPowerExponent = 2.3;

function racingRacerStrength(power: number): number {
  return Math.pow(power, racingPowerExponent);
}

function isRacingColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function inferRacingSpecies(value: unknown, label: string): RacingSpecies {
  if (value === "horse" || value === "penguin" || value === "emu") return value;
  // Keep packages saved before species was added playable. Their labels were
  // the only species marker, so migrate those three conventional names here.
  if (value !== undefined) throw new Error("Racing roster species must be horse, penguin, or emu.");
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel.includes("penguin")) return "penguin";
  if (normalizedLabel.includes("emu")) return "emu";
  return "horse";
}

export function resolveRacingRosterConfig(configuration: Record<string, unknown>): RacingRosterConfig {
  const rosters = configuration.rosters;
  if (!Array.isArray(rosters) || rosters.length < 1 || rosters.length > racingGameMaxRosters) {
    throw new Error(`Racing game needs 1-${racingGameMaxRosters} rosters.`);
  }
  const validatedRosters = rosters.map((value, rosterIndex) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Roster ${rosterIndex + 1} must be an object.`);
    const roster = value as Record<string, unknown>;
    const label = typeof roster.label === "string" ? roster.label.trim() : "";
    if (!label || label.length > racingGameMaxRosterLabelLength) {
      throw new Error(`Roster ${rosterIndex + 1} needs a label of at most ${racingGameMaxRosterLabelLength} characters.`);
    }
    const racers = roster.racers;
    if (!Array.isArray(racers) || racers.length < racingGameMinRacers || racers.length > racingGameMaxRacers) {
      throw new Error(`Roster ${rosterIndex + 1} needs ${racingGameMinRacers}-${racingGameMaxRacers} racers.`);
    }
    const validatedRacers = racers.map((entry, racerIndex) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`Racer ${racerIndex + 1} in roster ${rosterIndex + 1} must be an object.`);
      }
      const racer = entry as Record<string, unknown>;
      const name = typeof racer.name === "string" ? racer.name.trim() : "";
      if (!name || name.length > racingGameMaxRacerNameLength) {
        throw new Error(`Racer ${racerIndex + 1} in roster ${rosterIndex + 1} needs a name of at most ${racingGameMaxRacerNameLength} characters.`);
      }
      if (!isRacingColor(racer.color)) {
        throw new Error(`Racer ${racerIndex + 1} in roster ${rosterIndex + 1} needs a #rrggbb color.`);
      }
      const power = Number(racer.power);
      if (!Number.isFinite(power) || power < racingGameMinPower || power > racingGameMaxPower) {
        throw new Error(`Racer ${racerIndex + 1} in roster ${rosterIndex + 1} needs a strength from ${racingGameMinPower} to ${racingGameMaxPower}.`);
      }
      return { name, color: racer.color.toLowerCase(), power };
    });
    return { label, species: inferRacingSpecies(roster.species, label), racers: validatedRacers };
  });

  const houseFee = configuration.houseFee === undefined ? 0 : Number(configuration.houseFee);
  if (!Number.isInteger(houseFee) || houseFee < 0 || houseFee > racingGameMaxHouseFeePercent) {
    throw new Error(`Racing game house fee must be an integer from 0 to ${racingGameMaxHouseFeePercent} percent.`);
  }
  const bonusPool = configuration.bonusPool === undefined ? 0 : Number(configuration.bonusPool);
  if (!Number.isInteger(bonusPool) || bonusPool < 0 || bonusPool > racingGameMaxBonusPool) {
    throw new Error(`Racing game bonus pool must be an integer from 0 to ${racingGameMaxBonusPool}.`);
  }
  const rosterMode = configuration.rosterMode === undefined ? "sequential" : configuration.rosterMode;
  if (rosterMode !== "sequential" && rosterMode !== "random" && rosterMode !== "shuffle") {
    throw new Error("Racing game roster mode must be sequential, random, or shuffle.");
  }
  return { rosters: validatedRosters, rosterMode, houseFee, bonusPool };
}

export function selectRacingRoundRosters(config: RacingRosterConfig, rounds: number, random = Math.random): RacingRoster[] {
  const result: RacingRoster[] = [];
  let bag: number[] = [];
  for (let round = 0; round < rounds; round += 1) {
    if (config.rosterMode === "sequential") {
      result.push(config.rosters[round % config.rosters.length]!);
      continue;
    }
    if (config.rosterMode === "random") {
      result.push(config.rosters[Math.floor(random() * config.rosters.length)]!);
      continue;
    }
    if (!bag.length) {
      bag = config.rosters.map((_, index) => index);
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [bag[index], bag[swapIndex]] = [bag[swapIndex]!, bag[index]!];
      }
    }
    result.push(config.rosters[bag.pop()!]!);
  }
  return result;
}

export function racingWinChance(roster: RacingRoster, racerIndex: number): number {
  const strengths = roster.racers.map(racer => racingRacerStrength(racer.power));
  const total = strengths.reduce((sum, strength) => sum + strength, 0);
  if (total <= 0) return 0;
  return (strengths[racerIndex] ?? 0) / total;
}

export function racingWinnerIndex(roster: RacingRoster, random = Math.random): number {
  let draw = random();
  for (let index = 0; index < roster.racers.length; index += 1) {
    draw -= racingWinChance(roster, index);
    if (draw < 0) return index;
  }
  return roster.racers.length - 1;
}

export function racingStakeOnRacer(bets: RacingBet[], racerIndex: number): number {
  return bets.reduce((sum, bet) => sum + (bet.racerIndex === racerIndex ? bet.amount : 0), 0);
}

export function racingTotalStake(bets: RacingBet[]): number {
  return bets.reduce((sum, bet) => sum + bet.amount, 0);
}

// Pool payout mirrors the source simulator: every bet plus the bonus pool is
// redistributed across the winning racers' stakes, minus the house fee. A
// crowded racer therefore pays less, and a long-shot pays more.
export function racingMultiplier(bets: RacingBet[], winnerIndex: number, bonusPool: number, houseFeePercent: number): number {
  const winnerStake = racingStakeOnRacer(bets, winnerIndex);
  if (winnerStake <= 0) return 0;
  const pool = racingTotalStake(bets) + bonusPool;
  return Math.max(0, pool * (1 - houseFeePercent / 100) / winnerStake);
}

// Only bets on the winning racer receive the purse; every other bet loses
// its stake outright.
export function racingBetPayout(bet: RacingBet, winnerIndex: number, bets: RacingBet[], bonusPool: number, houseFeePercent: number): number {
  if (bet.racerIndex !== winnerIndex) return 0;
  return Math.round(bet.amount * racingMultiplier(bets, winnerIndex, bonusPool, houseFeePercent));
}

// Shown to a player before they commit: what a new bet of `extra` would pay.
export function racingPreviewMultiplier(bets: RacingBet[], racerIndex: number, extra: number, bonusPool: number, houseFeePercent: number): number {
  const stake = racingStakeOnRacer(bets, racerIndex) + extra;
  if (stake <= 0) return 0;
  const pool = racingTotalStake(bets) + extra + bonusPool;
  return Math.max(0, pool * (1 - houseFeePercent / 100) / stake);
}
