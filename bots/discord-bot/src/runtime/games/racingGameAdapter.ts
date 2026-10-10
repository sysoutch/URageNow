import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Interaction
} from "discord.js";
import sharp from "sharp";
import { appConfig } from "@urage/server/config/appConfig";
import {
  getInstalledGamePackage,
  type InstalledGamePackage
} from "@urage/server/services/games/gamePackageStore";
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
  selectRacingRoundRosters,
  type RacingRoster,
  type RacingRosterConfig,
  type RacingSpecies,
  type RacingBet
} from "@urage/server/services/games/racingRosterConfig";
import {
  buildRacingResultsEmbeds,
  type PlayerLedger,
  type RacingRoundLedger
} from "./racingResults.js";

type GamePackage = { packageInfo: InstalledGamePackage; configuration: Record<string, unknown> };
type RacingSession = {
  id: string;
  gameId: string;
  gameName: string;
  hostId: string;
  guildId: string;
  channelId: string;
  rounds: number;
  round: number;
  rosters: RacingRoster[];
  roster: RacingRoster;
  species: RacingSpecies;
  houseFee: number;
  bonusPool: number;
  bets: Map<string, Map<number, RacingBet>>;
  ledgers: Map<string, RacingRoundLedger[]>;
  roundSummaries: string[];
  createdAt: number;
  racing: boolean;
  ended: boolean;
};

const sessions = new Map<string, RacingSession>();
const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_SESSIONS = 100;
const MAX_GIF_BYTES = 7 * 1024 * 1024;
const gameTempRoot = path.resolve(appConfig.dataDirectory, "games", "racing-temp");
export const racingReplayDurationMs = 12_125;

// Repository escaping rule: every special character becomes its HTML entity,
// and ampersands are escaped first so entities are never double-encoded.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCredits(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function clampPosition(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Ease-out curve so runners accelerate out of the gate and stretch home.
function smoothStep(value: number): number {
  const x = clampPosition(value);
  return x * x * (3 - 2 * x);
}


// Frames reuse the source simulator's lane layout: every runner shares the
// start, and each reaches the finish at a predetermined ranked time.
function racingRunnerPosition(finishRank: number, offset: number, t: number): number {
  const targetTime = 0.84 + finishRank * 0.027;
  const motion = clampPosition(t / targetTime);
  const base = motion * (0.94 + 0.06 * smoothStep(motion));
  const wave = Math.sin(t * 20 + offset) * 0.008 * Math.sin(Math.PI * motion);
  return clampPosition(base + wave);
}

function horseArtSvg(color: string, step: number, x: number, y: number): string {
  const leg = Math.sin(step) * 7;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(0.82)">
    <ellipse cx="0" cy="22" rx="26" ry="5" fill="rgba(0,0,0,0.25)"/>
    <path d="M-14 8 L-21 19 L-29 ${22 + leg}" stroke="#14242a" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M14 8 L21 19 L29 ${22 - leg}" stroke="#14242a" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M-22 -6 Q-33 -24 -40 -14" stroke="${color}" stroke-width="5" fill="none"/>
    <ellipse cx="0" cy="-2" rx="24" ry="12" fill="${color}"/>
    <path d="M15 -10 L22 -26 L28 -12" fill="${color}"/>
    <circle cx="22" cy="-16" r="8" fill="${color}"/>
    <path d="M20 -22 L22 -34 L27 -23" fill="${color}"/>
    <circle cx="25" cy="-17" r="2.4" fill="#ffffff"/>
    <circle cx="26" cy="-17" r="1.2" fill="#28313d"/>
  </g>`;
}

function penguinArtSvg(color: string, step: number, x: number, y: number): string {
  const waddle = Math.sin(step) * 5;
  return `<g transform="translate(${x.toFixed(1)} ${(y + waddle * 0.2).toFixed(1)}) scale(0.78)">
    <ellipse cx="0" cy="24" rx="22" ry="5" fill="rgba(0,0,0,0.25)"/>
    <path d="M-8 16 L-19 ${25 + waddle} M8 16 L19 ${25 - waddle}" stroke="#f7a943" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="0" cy="-1" rx="19" ry="28" fill="#18262f"/>
    <ellipse cx="0" cy="4" rx="12" ry="19" fill="#f6f4e8"/>
    <path d="M-15 -7 L-31 ${7 + waddle} M15 -7 L31 ${7 - waddle}" stroke="#18262f" stroke-width="8" stroke-linecap="round"/>
    <rect x="-19" y="-5" width="38" height="9" rx="4" fill="${color}"/>
    <circle cx="-6" cy="-18" r="2.5" fill="#fff"/><circle cx="6" cy="-18" r="2.5" fill="#fff"/>
    <path d="M-5 -13 L7 -13 L1 -7 Z" fill="#f7a943"/>
  </g>`;
}

function emuArtSvg(color: string, step: number, x: number, y: number): string {
  const stride = Math.sin(step) * 9;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(0.76)">
    <ellipse cx="0" cy="25" rx="27" ry="5" fill="rgba(0,0,0,0.25)"/>
    <path d="M-7 8 L-10 24 L${-18 - stride} 31 M8 8 L12 24 L${20 + stride} 31" stroke="#d8b48a" stroke-width="4" stroke-linecap="round" fill="none"/>
    <ellipse cx="-2" cy="-3" rx="27" ry="18" fill="${color}"/>
    <path d="M17 -10 Q22 -35 28 -43" stroke="#d8b48a" stroke-width="8" fill="none"/>
    <circle cx="29" cy="-47" r="9" fill="#493b35"/>
    <path d="M36 -48 L50 -44 L36 -40 Z" fill="#d5a45b"/>
    <circle cx="31" cy="-50" r="2" fill="#fff"/>
    <path d="M-24 -9 Q-35 -18 -40 -8" stroke="#493b35" stroke-width="6" fill="none"/>
  </g>`;
}

function racerArtSvg(species: RacingSpecies, color: string, step: number, x: number, y: number): string {
  if (species === "penguin") return penguinArtSvg(color, step, x, y);
  if (species === "emu") return emuArtSvg(color, step, x, y);
  return horseArtSvg(color, step, x, y);
}

function buildRacingFrameSvg(roster: RacingRoster, positions: number[], phase: "ready" | "countdown" | "racing" | "complete", round: number, roundCount: number, winnerIndex: number, overlayText = ""): string {
  const laneCount = roster.racers.length;
  const laneTop = 78;
  const laneHeight = Math.min(48, Math.floor(252 / laneCount));
  const lanes = roster.racers.map((_, index) => {
    const y = laneTop + index * laneHeight;
    const stripe = index % 2 ? "#2c6444" : "#285e42";
    return `<rect x="24" y="${y}" width="592" height="${laneHeight}" fill="${stripe}"/>
    <text x="40" y="${y + laneHeight / 2 + 5}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#cce8cd">${index + 1}</text>`;
  }).join("");
  const checkers = roster.racers.map((_, index) => {
    const y = laneTop + index * laneHeight;
    return `<rect x="556" y="${y}" width="8" height="${laneHeight / 2}" fill="#ecf0e7"/>
    <rect x="564" y="${y + laneHeight / 2}" width="8" height="${laneHeight / 2}" fill="#ecf0e7"/>`;
  }).join("");
  const racers = roster.racers.map((racer, index) => {
    const position = positions[index] ?? 0;
    const step = position * 42;
    const x = 70 + clampPosition(position) * 470;
    const y = laneTop + index * laneHeight + laneHeight / 2 + 4;
    const label = `<text x="${(x + 34).toFixed(1)}" y="${(y - laneHeight / 2 + 12).toFixed(1)}" font-family="sans-serif" font-size="11" font-weight="850" fill="#f9fff3">${escapeXml(racer.name)}</text>`;
    return `${racerArtSvg(roster.species, racer.color, step, x, y)}${label}`;
  }).join("");
  const leaderPosition = positions[winnerIndex] ?? 0;
  const winnerName = (roster.racers[winnerIndex] ?? roster.racers[0]!).name;
  const status = phase === "ready" || phase === "countdown"
    ? "AWAITING START"
    : phase === "racing"
      ? `RACING · ${Math.round(clampPosition(leaderPosition) * 100)}%`
      : `WINNER: ${escapeXml(winnerName.toUpperCase())}`;
  const progressWidth = Math.round(592 * clampPosition(leaderPosition));
  const phaseLabel = phase === "ready" ? "AT THE POSTS" : phase === "countdown" ? "COUNTDOWN" : phase === "racing" ? "RACING" : "PHOTO FINISH";
  const overlay = phase === "countdown"
    ? `<rect width="640" height="360" rx="17" fill="rgba(7,18,23,0.62)"/><circle cx="320" cy="190" r="70" fill="#172b33" stroke="#f5c65b" stroke-width="5"/><text x="320" y="215" text-anchor="middle" font-family="sans-serif" font-size="72" font-weight="900" fill="#fff6d7">${escapeXml(overlayText)}</text>`
    : phase === "complete"
      ? `<rect width="640" height="360" rx="17" fill="rgba(7,18,23,0.82)"/><text x="320" y="105" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="900" fill="#f5c65b">🏁 PHOTO FINISH 🏁</text><text x="320" y="180" text-anchor="middle" font-family="sans-serif" font-size="54" font-weight="900" fill="#ffffff">🏆</text><text x="320" y="230" text-anchor="middle" font-family="sans-serif" font-size="32" font-weight="900" fill="#ffffff">${escapeXml(winnerName)}</text><text x="320" y="260" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="700" fill="#cce8cd">WINS ROUND ${round}</text>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#163c35"/>
    <rect x="1" y="1" width="638" height="358" rx="17" fill="none" stroke="#495762"/>
    <circle cx="35" cy="35" r="6" fill="#f5c65b"/>
    <text x="52" y="41" font-family="sans-serif" font-size="17" font-weight="700" fill="#f2f4f2">DERBY LAB</text>
    <rect x="499" y="17" width="117" height="35" rx="9" fill="#26343d"/>
    <text x="557" y="40" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#e7eee9">ROUND ${round} / ${roundCount}</text>
    <rect x="24" y="62" width="592" height="264" rx="13" fill="#1b463c" stroke="#465761"/>
    ${lanes}
    ${checkers}
    <text x="584" y="${laneTop - 8}" text-anchor="end" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1" fill="#dff5dd">FINISH</text>
    <text x="595" y="${laneTop - 8}" text-anchor="end" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1" fill="#ffad85">${phaseLabel}</text>
    <text x="44" y="${laneTop - 22}" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1.5" fill="#a6b4bc">${escapeXml(roster.label.toUpperCase())} GRAND PRIX</text>
    ${racers}
    <rect x="24" y="334" width="592" height="5" rx="2.5" fill="#35434b"/>
    <rect x="24" y="334" width="${progressWidth}" height="5" rx="2.5" fill="#f5c65b"/>
    <text x="24" y="352" font-family="sans-serif" font-size="12" fill="#b8c5c9">${escapeXml(status)}</text>
    ${overlay}
  </svg>`;
}

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(appConfig.ffmpegExecutablePath || "ffmpeg", args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => child.kill(), 45_000);
    child.stderr?.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-4000); });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("close", code => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `FFmpeg exited with code ${code ?? "unknown"}.`));
    });
  });
}

export function racingFinishRanks(laneCount: number, winnerIndex: number, random = Math.random): number[] {
  if (!Number.isInteger(laneCount) || laneCount < 1 || !Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= laneCount) {
    throw new Error("A racing finish needs a valid winning lane.");
  }
  const otherLanes = Array.from({ length: laneCount }, (_, index) => index).filter(index => index !== winnerIndex);
  for (let index = otherLanes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [otherLanes[index], otherLanes[swapIndex]] = [otherLanes[swapIndex]!, otherLanes[index]!];
  }
  return Array.from({ length: laneCount }, (_, lane) => lane === winnerIndex ? 0 : otherLanes.indexOf(lane) + 1);
}

export async function renderRacingGif(roster: RacingRoster, winnerIndex: number, round: number, roundCount: number): Promise<Buffer> {
  const laneCount = roster.racers.length;
  if (laneCount < 3 || laneCount > 8) throw new Error("Racing rosters must hold 3-8 racers.");
  const finishRank = racingFinishRanks(laneCount, winnerIndex);
  const offsets = roster.racers.map(() => Math.random() * 6.283);
  const duration = 5.5;
  const frameRate = 8;
  const readyFrames = 4;
  const countdownFramesPerStep = 6;
  const countdownLabels = ["3", "2", "1", "START!"];
  const countdownFrames = countdownFramesPerStep * countdownLabels.length;
  const racingFrames = Math.ceil(duration * frameRate) + 1;
  const completeFrames = frameRate * 3;
  const frameCount = readyFrames + countdownFrames + racingFrames + completeFrames;
  const jobDir = path.join(gameTempRoot, `${Date.now()}-${randomBytes(6).toString("hex")}`);
  await mkdir(jobDir, { recursive: true });
  try {
    for (let index = 0; index < frameCount; index += 1) {
      const phase = index < readyFrames
        ? "ready"
        : index < readyFrames + countdownFrames
          ? "countdown"
          : index < readyFrames + countdownFrames + racingFrames ? "racing" : "complete";
      const elapsed = Math.max(0, index - readyFrames - countdownFrames) / frameRate;
      const t = phase === "ready" || phase === "countdown" ? 0 : phase === "complete" ? 1 : Math.min(1, elapsed / duration);
      const positions = roster.racers.map((_, lane) =>
        phase === "complete" ? 1 : racingRunnerPosition(finishRank[lane]!, offsets[lane]!, t)
      );
      const countdownIndex = Math.floor((index - readyFrames) / countdownFramesPerStep);
      const overlayText = phase === "countdown" ? countdownLabels[countdownIndex] ?? "START!" : "";
      const svg = buildRacingFrameSvg(roster, positions, phase, round, roundCount, winnerIndex, overlayText);
      await sharp(Buffer.from(svg)).png().toFile(path.join(jobDir, `frame-${String(index).padStart(4, "0")}.png`));
    }
    const outputPath = path.join(jobDir, "derby.gif");
    await runFfmpeg([
      "-y", "-framerate", String(frameRate), "-i", path.join(jobDir, "frame-%04d.png"),
      "-filter_complex", "[0:v]split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=none",
      "-loop", "0", outputPath
    ]);
    const outputStat = await stat(outputPath);
    if (outputStat.size > MAX_GIF_BYTES) throw new Error("The animated replay exceeded Discord's 7 MiB game limit.");
    const result = await readFile(outputPath);
    if (result.toString("ascii", 0, 6) !== "GIF89a" && result.toString("ascii", 0, 6) !== "GIF87a") {
      throw new Error("FFmpeg produced an invalid GIF replay.");
    }
    return result;
  } finally {
    await rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function getRoundCount(configuration: Record<string, unknown>): number {
  const rounds = Number(configuration.rounds);
  return Number.isInteger(rounds) ? Math.max(1, Math.min(10, rounds)) : 3;
}

function expireOldSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) if (session.ended || now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  while (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value as string | undefined;
    if (!oldest) break;
    sessions.delete(oldest);
  }
}

function makeSessionId(): string {
  return randomBytes(6).toString("hex");
}

function allBets(session: RacingSession): RacingBet[] {
  return [...session.bets.values()].flatMap(playerBets => [...playerBets.values()]);
}

function playerBets(session: RacingSession, userId: string): RacingBet[] {
  return [...(session.bets.get(userId)?.values() ?? [])];
}

function speciesLabel(species: RacingSpecies): string {
  return species === "horse" ? "Horses" : species === "penguin" ? "Penguins" : "Emus";
}

async function replyEphemeral(interaction: any, content: string): Promise<void> {
  if (interaction.deferred || interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

// =========================================================
// SESSION PRESENTATION
// =========================================================

function boardEmbeds(session: RacingSession): EmbedBuilder[] {
  const fields = session.roster.racers.map((racer, index) => ({
    name: `${index + 1}. ${racer.name}`,
    value: `${Math.round(racingWinChance(session.roster, index) * 100)}% chance · strength ${racer.power}`
  }));
  return [new EmbedBuilder().setColor(0xf5c65b)
    .setTitle(`🏁 ${session.gameName} · Round ${session.round}/${session.rounds}`)
    .setDescription(`${speciesLabel(session.species)} · ${session.roster.label} roster · place secret bets on one or more racers, then the host starts the race`)
    .addFields(...fields, {
      name: "Purse rules",
      value: `${session.houseFee}% house fee · ${formatCredits(session.bonusPool)} bonus credits · bets up to ${formatCredits(racingGameMaxBet)} credits`
    })];
}

function sessionContent(session: RacingSession): string {
  return `**${session.gameName} · Round ${session.round}/${session.rounds} · ${speciesLabel(session.species)}**\nTap "Place my bet", pick a racer, then confirm the amount. You may bet on multiple racers; choosing the same racer again updates only that bet. Only the host can start the race, and the purse pays every bet plus ${formatCredits(session.bonusPool)} bonus credits minus a ${session.houseFee}% house fee, split across the stakes on the winner.`;
}

function sessionComponents(session: RacingSession): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = [
    new ButtonBuilder().setCustomId(`urage-game:${session.gameId}:bet:${session.id}:${session.round}`)
      .setLabel("Place my bet").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`urage-game:${session.gameId}:board:${session.id}:${session.round}`)
      .setLabel("Show board").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`urage-game:${session.gameId}:race:${session.id}:${session.round}`)
      .setLabel(session.round < session.rounds ? "Start race (host)" : "Final race (host)").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`urage-game:${session.gameId}:cancel:${session.id}:${session.round}`)
      .setLabel("Cancel game (host)").setStyle(ButtonStyle.Danger)
  ];
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)];
}

function betSelectMenu(session: RacingSession): StringSelectMenuBuilder {
  const options = session.roster.racers.map((racer, index) => ({
    label: `${index + 1}. ${racer.name}`,
    description: `${Math.round(racingWinChance(session.roster, index) * 100)}% chance · strength ${racer.power}`,
    value: String(index)
  }));
  return new StringSelectMenuBuilder()
    .setCustomId(`urage-game:${session.gameId}:bet-pick:${session.id}:${session.round}`)
    .setPlaceholder("Choose a racer to add or update")
    .addOptions(options);
}

function speciesSelectMenu(game: GamePackage): StringSelectMenuBuilder {
  const config = resolveRacingRosterConfig(game.configuration);
  const species = (["horse", "penguin", "emu"] as RacingSpecies[]).filter(value =>
    config.rosters.some(roster => roster.species === value)
  );
  return new StringSelectMenuBuilder()
    .setCustomId(`urage-game:${game.packageInfo.id}:species`)
    .setPlaceholder("Choose racers for this game")
    .addOptions(species.map(value => ({
      label: speciesLabel(value),
      value,
      description: `Race the configured ${speciesLabel(value).toLowerCase()} rosters`
    })));
}

function betModal(session: RacingSession, racerIndex: number): ModalBuilder {
  const amount = new TextInputBuilder().setCustomId("amount").setLabel("Bet amount (credits)")
    .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(9)
    .setPlaceholder(`Whole credits from 1 to ${formatCredits(racingGameMaxBet)}`);
  return new ModalBuilder()
    .setCustomId(`urage-game:${session.gameId}:bet-amount:${session.id}:${session.round}:${racerIndex}`)
    .setTitle(`Round ${session.round} bet · ${session.roster.label}`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amount));
}


// =========================================================
// DISCORD ADAPTER
// =========================================================

export function createRacingGameAdapter(
  renderReplay: typeof renderRacingGif = renderRacingGif,
  waitForReplay: (durationMs: number) => Promise<void> = durationMs => new Promise(resolve => setTimeout(resolve, durationMs))
) {
  async function openSettings(interaction: any, game: GamePackage): Promise<void> {
    try {
      await interaction.reply({
        content: `**${game.packageInfo.name}** · choose the racer species for this game.`,
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(speciesSelectMenu(game))],
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The roster configuration is invalid.";
      await replyEphemeral(interaction, `This derby cannot be started: ${detail}`);
    }
  }

  async function openRoundSettings(interaction: any, game: GamePackage, species: RacingSpecies): Promise<void> {
    const rounds = new TextInputBuilder().setCustomId("rounds").setLabel("Rounds (1-10)")
      .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(2)
      .setValue(String(getRoundCount(game.configuration)));
    const modal = new ModalBuilder().setCustomId(`urage-game:${game.packageInfo.id}:start:${species}`)
      .setTitle(`${game.packageInfo.name} · ${speciesLabel(species)}`)
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(rounds));
    await interaction.showModal(modal);
  }

  async function start(interaction: any, game: GamePackage, requestedSpecies?: string): Promise<void> {
    const roundsValue = Number(interaction.fields.getTextInputValue("rounds"));
    const rounds = Math.max(1, Math.min(10, Math.round(roundsValue)));
    if (!Number.isInteger(roundsValue) || roundsValue < 1 || roundsValue > 10) {
      await replyEphemeral(interaction, "Enter a round count from 1 to 10.");
      return;
    }
    if (!interaction.guildId || !interaction.channel) {
      await replyEphemeral(interaction, "Start this derby in a Discord server text channel.");
      return;
    }
    let config: RacingRosterConfig;
    let rosters: RacingRoster[];
    let species: RacingSpecies;
    try {
      config = resolveRacingRosterConfig(game.configuration);
      species = requestedSpecies === "penguin" || requestedSpecies === "emu" || requestedSpecies === "horse"
        ? requestedSpecies
        : config.rosters[0]!.species;
      const matchingRosters = config.rosters.filter(roster => roster.species === species);
      if (!matchingRosters.length) throw new Error(`No ${speciesLabel(species).toLowerCase()} roster is configured.`);
      rosters = selectRacingRoundRosters({ ...config, rosters: matchingRosters }, rounds);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The roster configuration is invalid.";
      await replyEphemeral(interaction, `This derby cannot be started: ${detail} Fix the roster configuration in the dashboard's Games view.`);
      return;
    }
    expireOldSessions();
    const session: RacingSession = {
      id: makeSessionId(), gameId: game.packageInfo.id, gameName: game.packageInfo.name,
      hostId: interaction.user.id, guildId: interaction.guildId, channelId: interaction.channelId,
      rounds, round: 1, rosters, roster: rosters[0]!, houseFee: config.houseFee, bonusPool: config.bonusPool,
      species,
      bets: new Map(), ledgers: new Map(), roundSummaries: [], createdAt: Date.now(), racing: false, ended: false
    };
    sessions.set(session.id, session);
    await interaction.reply({
      content: sessionContent(session),
      embeds: boardEmbeds(session),
      components: sessionComponents(session),
      allowedMentions: { parse: [] }
    });
  }

  function boardText(session: RacingSession, userId: string): string {
    const bets = allBets(session);
    const mine = playerBets(session, userId);
    const lanes = session.roster.racers.map((racer, index) => {
      const staked = racingStakeOnRacer(bets, index);
      const odds = staked > 0 ? ` · ${racingMultiplier(bets, index, session.bonusPool, session.houseFee).toFixed(2)}× now` : " · no bets yet";
      return `• ${racer.name} · ${formatCredits(staked)} staked${odds}`;
    });
    const mineText = mine.length
      ? `Your bets: ${mine.map(bet => `**${session.roster.racers[bet.racerIndex]!.name}** · **${formatCredits(bet.amount)} credits**`).join(" · ")}`
      : "You have not beted yet. Tap \"Place my bet\" to join this round.";
    const totalStake = racingTotalStake(bets);
    return [
      `**Derby board** · round ${session.round}/${session.rounds} · ${session.roster.label} roster · ${bets.length} bet(s) by ${session.bets.size} player(s)`,
      mineText,
      ...lanes,
      `Total staked: ${formatCredits(totalStake)} credits · purse ${formatCredits(totalStake + session.bonusPool)} credits · ${session.houseFee}% house fee`
    ].join("\n");
  }

  async function handleInteraction(interaction: Interaction): Promise<boolean> {
    if (!("customId" in interaction)) return false;
    const customId = String(interaction.customId || "");
    if (!customId.startsWith("urage-game:derby-lab:")) return false;
    expireOldSessions();
    const parts = customId.split(":");
    const [, gameId, action, sessionId, roundText] = parts;
    if (!gameId || !action) return false;
    if (action === "species" && interaction.isStringSelectMenu()) {
      const game = await getInstalledGamePackage(gameId);
      if (!game || !game.packageInfo.enabledRuntimes.includes("discord")) {
        await replyEphemeral(interaction, "That game has been removed or disabled.");
        return true;
      }
      if (game.packageInfo.gameType !== "animal-racing") return false;
      const species = interaction.values[0];
      if (species !== "horse" && species !== "penguin" && species !== "emu") {
        await replyEphemeral(interaction, "Choose a supported racer species.");
        return true;
      }
      await openRoundSettings(interaction, game, species);
      return true;
    }
    if (action === "start" && interaction.isModalSubmit()) {
      const game = await getInstalledGamePackage(gameId);
      if (!game || !game.packageInfo.enabledRuntimes.includes("discord")) {
        await replyEphemeral(interaction, "That game has been removed or disabled.");
        return true;
      }
      // A modal for another game type belongs to that game's adapter.
      if (game.packageInfo.gameType !== "animal-racing") return false;
      await start(interaction, game, sessionId);
      return true;
    }
    if (!sessionId) return false;
    const session = sessions.get(sessionId);
    if (!session || session.gameId !== gameId || session.guildId !== interaction.guildId || session.channelId !== interaction.channelId || session.ended || Date.now() - session.createdAt > SESSION_TTL_MS) {
      await replyEphemeral(interaction, "This derby session has ended or expired.");
      return true;
    }
    const installedGame = await getInstalledGamePackage(gameId);
    if (!installedGame || !installedGame.packageInfo.enabledRuntimes.includes("discord")) {
      sessions.delete(sessionId);
      await replyEphemeral(interaction, "This game has been disabled or removed by an administrator.");
      return true;
    }
    const requestedRound = Number(roundText);
    if (session.racing) {
      await replyEphemeral(interaction, "That replay is still playing. Wait for the result before the next action.");
      return true;
    }
    if (action === "bet" && interaction.isButton()) {
      if (requestedRound !== session.round) {
        await replyEphemeral(interaction, "That round has already ended.");
        return true;
      }
      await interaction.reply({
        content: `**Round ${session.round} bet** · pick a racer from the ${session.roster.label} roster below, then confirm your bet in the modal that follows. Your pick stays private to you.`,
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(betSelectMenu(session))],
        flags: MessageFlags.Ephemeral
      });
      return true;
    }
    if (action === "bet-pick" && interaction.isStringSelectMenu()) {
      if (requestedRound !== session.round) {
        await replyEphemeral(interaction, "That round has already ended.");
        return true;
      }
      const pickedRacerIndex = Number(interaction.values[0] ?? "");
      if (!Number.isInteger(pickedRacerIndex) || pickedRacerIndex < 0 || pickedRacerIndex >= session.roster.racers.length) {
        await replyEphemeral(interaction, "That racer is not in this round.");
        return true;
      }
      await interaction.showModal(betModal(session, pickedRacerIndex));
      return true;
    }
    if (action === "bet-amount" && interaction.isModalSubmit()) {
      if (requestedRound !== session.round) {
        await replyEphemeral(interaction, "That round has already ended.");
        return true;
      }
      const racerIndex = Number(parts[5] ?? "");
      const amountText = interaction.fields.getTextInputValue("amount").trim();
      const amount = Number(amountText);
      if (!Number.isInteger(racerIndex) || racerIndex < 0 || racerIndex >= session.roster.racers.length) {
        await replyEphemeral(interaction, "That racer is not in this round.");
        return true;
      }
      if (!/^\d{1,9}$/.test(amountText) || !Number.isInteger(amount) || amount < 1 || amount > racingGameMaxBet) {
        await replyEphemeral(interaction, `Bets must be whole credits from 1 to ${formatCredits(racingGameMaxBet)}.`);
        return true;
      }
      const userBets = session.bets.get(interaction.user.id) ?? new Map<number, RacingBet>();
      const previous = userBets.get(racerIndex);
      const others = allBets(session).filter(bet => bet !== previous);
      const preview = racingPreviewMultiplier(others, racerIndex, amount, session.bonusPool, session.houseFee);
      userBets.set(racerIndex, { racerIndex, amount });
      session.bets.set(interaction.user.id, userBets);
      const racer = session.roster.racers[racerIndex]!;
      await interaction.reply({
        content: `<@${interaction.user.id}> locked in a bet for round ${session.round}. ${allBets(session).length} bet(s) from ${session.bets.size} player(s) are in.`,
        allowedMentions: { parse: [] }
      });
      await interaction.followUp({
        content: `Your round ${session.round} bet on **${racer.name}**: **${formatCredits(amount)} credits** · pays about **${preview.toFixed(2)}×** if it wins. Add another racer, or choose this racer again to update its amount.`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }
    if (action === "board" && interaction.isButton()) {
      if (requestedRound !== session.round) {
        await replyEphemeral(interaction, "That round has already ended.");
        return true;
      }
      await interaction.reply({ content: boardText(session, interaction.user.id), flags: MessageFlags.Ephemeral });
      return true;
    }
    if (action === "cancel" && interaction.isButton()) {
      if (interaction.user.id !== session.hostId) {
        await replyEphemeral(interaction, "Only the player who started this derby can cancel it.");
        return true;
      }
      sessions.delete(session.id);
      await replyEphemeral(interaction, "Derby Lab cancelled.");
      return true;
    }

    if (action === "race" && interaction.isButton()) {
      if (interaction.user.id !== session.hostId) {
        await replyEphemeral(interaction, "Only the player who started this derby can start the race.");
        return true;
      }
      if (requestedRound !== session.round) {
        await replyEphemeral(interaction, "That round has already started.");
        return true;
      }
      if (!session.bets.size) {
        await replyEphemeral(interaction, "No bets are placed yet. Ask players to place their bets first.");
        return true;
      }
      session.racing = true;
      await interaction.deferUpdate();
      const roster = session.roster;
      const bets = allBets(session);
      const winnerIndex = racingWinnerIndex(roster);
      const winner = roster.racers[winnerIndex]!;
      const multiplier = racingMultiplier(bets, winnerIndex, session.bonusPool, session.houseFee);
      const totalStake = racingTotalStake(bets);
      const stakeOnWinner = racingStakeOnRacer(bets, winnerIndex);
      let replay: Buffer | null = null;
      try {
        replay = await renderReplay(roster, winnerIndex, session.round, session.rounds);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "GIF rendering failed.";
        console.warn(`Derby Lab replay for ${session.id} round ${session.round} failed: ${detail}`);
      }
      for (const [userId, userBets] of session.bets) {
        for (const bet of userBets.values()) {
          const payout = racingBetPayout(bet, winnerIndex, bets, session.bonusPool, session.houseFee);
          const entry: RacingRoundLedger = {
            round: session.round,
            racerIndex: bet.racerIndex,
            racerName: roster.racers[bet.racerIndex]!.name,
            amount: bet.amount,
            payout,
            net: payout - bet.amount
          };
          session.ledgers.set(userId, [...(session.ledgers.get(userId) ?? []), entry]);
        }
      }
      session.roundSummaries.push(
        `R${session.round} · ${roster.label} · **${winner.name}** won · ${bets.length} bet(s), ${formatCredits(totalStake)} staked · ${formatCredits(stakeOnWinner)} on winner · **${multiplier.toFixed(2)}× payout`
      );
      const roundEmbed = new EmbedBuilder().setColor(0xf5c65b)
        .setTitle(`🏁 Round ${session.round} of ${session.rounds} · ${roster.label}`)
        .setDescription(`**${winner.name}** took the purse at **${multiplier.toFixed(2)}×**`)
        .addFields(
          { name: "Winning odds", value: `${Math.round(racingWinChance(roster, winnerIndex) * 100)}% chance before the start` },
          { name: "Purse", value: `${formatCredits(totalStake + session.bonusPool)} credits · ${session.houseFee}% house fee` },
          { name: "Stakes on winner", value: `${formatCredits(stakeOnWinner)} of ${formatCredits(totalStake)} staked credits` }
        );
      const files = replay ? [new AttachmentBuilder(replay, { name: `derby-lab-round-${session.round}.gif` })] : [];
      const resultText = `Round ${session.round} result: **${winner.name}** won at **${multiplier.toFixed(2)}×** · ${formatCredits(stakeOnWinner)} of ${formatCredits(totalStake)} staked credits were on it.`;
      // Retire only the controls on the message that launched this race. Its
      // GIF/content stay intact, and every replay is posted in a fresh message.
      await interaction.editReply({ components: [] });
      if (replay) {
        await interaction.followUp({ files, allowedMentions: { parse: [] } });
        await waitForReplay(racingReplayDurationMs);
      }
      if (session.round >= session.rounds) {
        session.ended = true;
        await interaction.followUp({
          content: resultText,
          files,
          embeds: [roundEmbed],
          allowedMentions: { parse: [] }
        });
        const players: PlayerLedger[] = [...session.ledgers.entries()].map(([userId, rounds]) => ({ userId, rounds }));
        for (const embed of buildRacingResultsEmbeds(session.roundSummaries, players)) {
          await interaction.followUp({ embeds: [embed], allowedMentions: { parse: [] } });
        }
        sessions.delete(session.id);
        return true;
      }
      session.round += 1;
      session.roster = session.rosters[session.round - 1]!;
      session.bets = new Map();
      session.racing = false;
      await interaction.followUp({
        content: `${resultText}\n\n${sessionContent(session)}`,
        files,
        embeds: [roundEmbed, ...boardEmbeds(session)],
        components: sessionComponents(session),
        allowedMentions: { parse: [] }
      });
      return true;
    }
    return true;
  }

  return { openSettings, start, handleInteraction };
}
