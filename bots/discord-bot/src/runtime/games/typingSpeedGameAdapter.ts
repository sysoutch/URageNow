import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
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
  resolveTypingTextConfig,
  selectTypingRoundTexts,
  typingGameMaxWords,
  typingGameMinWords
} from "@urage/server/services/games/typingSpeedTextConfig";
import { buildTypingResultsEmbeds, type PlayerScore } from "./typingSpeedResults.js";

type GamePackage = { packageInfo: InstalledGamePackage; configuration: Record<string, unknown> };
type TypingSession = {
  id: string;
  gameId: string;
  gameName: string;
  hostId: string;
  guildId: string;
  channelId: string;
  rounds: number;
  round: number;
  text: string;
  roundTexts: string[];
  speed: number;
  roundSpeeds: number[];
  scores: Map<string, PlayerScore>;
  guessesThisRound: Set<string>;
  createdAt: number;
  ended: boolean;
};

const sessions = new Map<string, TypingSession>();
const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_SESSIONS = 100;
const MAX_GIF_BYTES = 7 * 1024 * 1024;
const gameTempRoot = path.resolve(appConfig.dataDirectory, "games", "gif-temp");

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrapText(value: string, maxColumns = 40): string[] {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const originalWord of paragraph.split(/\s+/).filter(Boolean)) {
      let word = originalWord;
      while (word.length > maxColumns) {
        if (line) lines.push(line);
        lines.push(word.slice(0, maxColumns));
        word = word.slice(maxColumns);
        line = "";
      }
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxColumns) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.slice(-6);
}

function buildTypingFrameSvg(text: string, revealWords: number, phase: "ready" | "typing" | "complete", round: number, roundCount: number): string {
  const units = text.match(/\s+|\S+/gu) || [];
  const totalWords = units.filter(unit => /\S/u.test(unit)).length;
  let visible = "";
  let visibleWords = 0;
  for (const unit of units) {
    if (/\S/u.test(unit) && visibleWords >= revealWords) break;
    visible += unit;
    if (/\S/u.test(unit)) visibleWords += 1;
  }
  const lines = wrapText(visible.trimEnd());
  const textRows = lines.map((line, index) => `<text x="44" y="${135 + index * 27}">${escapeXml(line)}</text>`).join("");
  const cursorX = Math.min(588, 44 + (lines[lines.length - 1] || "").length * 12.7);
  const cursorY = 116 + Math.max(0, lines.length - 1) * 27;
  const progressWidth = Math.round(592 * revealWords / Math.max(1, totalWords));
  const readyMessage = phase === "ready"
    ? '<text x="44" y="181" font-family="sans-serif" font-size="26" font-weight="700" fill="#f2f4f2">Watch the words appear.</text><text x="44" y="211" font-family="sans-serif" font-size="16" fill="#a6b4bc">Then guess how fast they were typed.</text>'
    : "";
  const cursor = phase === "typing" ? `<rect x="${cursorX}" y="${cursorY}" width="3" height="23" rx="1" fill="#ff8957"/>` : "";
  const phaseLabel = phase === "ready" ? "GET READY" : phase === "typing" ? "TYPING" : "COMPLETE";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#12191e"/>
    <rect x="1" y="1" width="638" height="358" rx="17" fill="none" stroke="#495762"/>
    <circle cx="35" cy="35" r="6" fill="#ff8957"/>
    <text x="52" y="41" font-family="sans-serif" font-size="17" font-weight="700" fill="#f2f4f2">TOKEN TYPING</text>
    <rect x="499" y="17" width="117" height="35" rx="9" fill="#26343d"/>
    <text x="557" y="40" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#e7eee9">ROUND ${round} / ${roundCount}</text>
    <rect x="24" y="68" width="592" height="232" rx="13" fill="#202b32" stroke="#465761"/>
    <text x="44" y="97" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1.5" fill="#a6b4bc">SIMULATED RESPONSE</text>
    <text x="595" y="97" text-anchor="end" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1" fill="#ffad85">${phaseLabel}</text>
    <path d="M44 108h552" stroke="#465761"/>
    ${readyMessage}
    <g font-family="Consolas, DejaVu Sans Mono, monospace" font-size="21" fill="#f2f4f2">${textRows}</g>
    ${cursor}
    <rect x="24" y="313" width="592" height="5" rx="2.5" fill="#35434b"/>
    <rect x="24" y="313" width="${progressWidth}" height="5" rx="2.5" fill="#ff8957"/>
    <text x="24" y="341" font-family="sans-serif" font-size="12" fill="#b8c5c9">Watch the pace, then submit your guess below.</text>
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

export async function renderTypingGif(text: string, speed: number, round: number, rounds: number): Promise<Buffer> {
  const wordCount = (text.match(/\S+/gu) || []).length;
  if (wordCount < typingGameMinWords || wordCount > typingGameMaxWords) {
    throw new Error(`Typing game text must contain ${typingGameMinWords}-${typingGameMaxWords} words.`);
  }
  const duration = wordCount * 1.3 / speed;
  const frameRate = duration < 1 ? 30 : duration < 3 ? 20 : duration < 10 ? 12 : 6;
  const readyFrames = Math.max(1, Math.ceil(frameRate * 0.6));
  const typingFrames = Math.max(2, Math.ceil(duration * frameRate) + 1);
  const completeFrames = Math.max(1, Math.ceil(frameRate * 1.2));
  const frameCount = readyFrames + typingFrames + completeFrames;
  const jobDir = path.join(gameTempRoot, `${Date.now()}-${randomBytes(6).toString("hex")}`);
  await mkdir(jobDir, { recursive: true });
  try {
    for (let index = 0; index < frameCount; index += 1) {
      const phase = index < readyFrames ? "ready" : index < readyFrames + typingFrames ? "typing" : "complete";
      const elapsed = Math.max(0, index - readyFrames) / frameRate;
      const revealedWords = phase === "ready" ? 0 : phase === "complete"
        ? wordCount : Math.min(wordCount, 1 + Math.floor(elapsed * speed / 1.3));
      const svg = buildTypingFrameSvg(text, revealedWords, phase, round, rounds);
      await sharp(Buffer.from(svg)).png().toFile(path.join(jobDir, `frame-${String(index).padStart(4, "0")}.png`));
    }
    const outputPath = path.join(jobDir, "typing.gif");
    await runFfmpeg([
      "-y", "-framerate", String(frameRate), "-i", path.join(jobDir, "frame-%04d.png"),
      "-filter_complex", "[0:v]split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=none",
      "-loop", "0", outputPath
    ]);
    const outputStat = await stat(outputPath);
    if (outputStat.size > MAX_GIF_BYTES) throw new Error("The animated preview exceeded Discord's 7 MiB game limit.");
    const result = await readFile(outputPath);
    if (result.toString("ascii", 0, 6) !== "GIF89a" && result.toString("ascii", 0, 6) !== "GIF87a") throw new Error("FFmpeg produced an invalid GIF preview.");
    return result;
  } finally {
    await rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function getRoundCount(configuration: Record<string, unknown>): number {
  const rounds = Number(configuration.rounds);
  return Number.isInteger(rounds) ? Math.max(1, Math.min(10, rounds)) : 5;
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

function sessionComponents(session: TypingSession) {
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`urage-game:${session.gameId}:guess:${session.id}:${session.round}`).setLabel("Submit my speed guess").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`urage-game:${session.gameId}:next:${session.id}:${session.round}`).setLabel(session.round < session.rounds ? "Next round (host)" : "Finish (host)").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`urage-game:${session.gameId}:end:${session.id}:${session.round}`).setLabel("End game (host)").setStyle(ButtonStyle.Danger)
  )];
}

function sessionContent(session: TypingSession): string {
  return `**${session.gameName} · Round ${session.round}/${session.rounds}**\nWatch the animated preview, then each player may submit one private guess from 5 to 150 tokens/second. Only the host can advance the round. Submitted guesses are acknowledged publicly; values stay private until the game ends.`;
}

function makeSessionId(): string {
  return randomBytes(6).toString("hex");
}

async function replyEphemeral(interaction: any, content: string): Promise<void> {
  if (interaction.deferred || interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

export function createTypingSpeedGameAdapter() {
  async function openSettings(interaction: any, game: GamePackage): Promise<void> {
    const rounds = new TextInputBuilder().setCustomId("rounds").setLabel("Rounds (1-10)").setStyle(TextInputStyle.Short)
      .setRequired(true).setMinLength(1).setMaxLength(2).setValue(String(getRoundCount(game.configuration)));
    const modal = new ModalBuilder().setCustomId(`urage-game:${game.packageInfo.id}:start`).setTitle(`Start ${game.packageInfo.name}`)
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(rounds));
    await interaction.showModal(modal);
  }

  async function start(interaction: any, game: GamePackage): Promise<void> {
    const roundsValue = Number(interaction.fields.getTextInputValue("rounds"));
    const rounds = Math.max(1, Math.min(10, Math.round(roundsValue)));
    if (!Number.isInteger(roundsValue) || roundsValue < 1 || roundsValue > 10) {
      await replyEphemeral(interaction, "Enter a round count from 1 to 10.");
      return;
    }
    if (!interaction.guildId || !interaction.channel) {
      await replyEphemeral(interaction, "Start this game in a Discord server text channel.");
      return;
    }
    const roundTexts = selectTypingRoundTexts(resolveTypingTextConfig(game.configuration), rounds);
    expireOldSessions();
    const session: TypingSession = {
      id: makeSessionId(), gameId: game.packageInfo.id, gameName: game.packageInfo.name,
      hostId: interaction.user.id, guildId: interaction.guildId, channelId: interaction.channelId,
      rounds, round: 1, text: roundTexts[0]!, roundTexts, speed: Math.round((5 + Math.random() * 145) * 10) / 10,
      roundSpeeds: [],
      scores: new Map(), guessesThisRound: new Set(), createdAt: Date.now(), ended: false
    };
    session.roundSpeeds.push(session.speed);
    sessions.set(session.id, session);
    await interaction.deferReply();
    try {
      const gif = await renderTypingGif(session.text, session.speed, session.round, session.rounds);
      await interaction.editReply({ content: sessionContent(session), files: [new AttachmentBuilder(gif, { name: `token-typing-round-${session.round}.gif` })], components: sessionComponents(session) });
    } catch (error) {
      sessions.delete(session.id);
      const detail = error instanceof Error ? error.message : "GIF rendering failed.";
      await interaction.editReply({ content: `Could not create the animated round: ${detail}. Check that FFmpeg is installed and configured.` });
    }
  }

  async function handleInteraction(interaction: Interaction): Promise<boolean> {
    if (!("customId" in interaction)) return false;
    const customId = String(interaction.customId || "");
    if (!customId.startsWith("urage-game:")) return false;
    expireOldSessions();
    const parts = customId.split(":");
    const [, gameId, action, sessionId, roundText] = parts;
    if (!gameId || !action) return false;
    if (action === "start" && interaction.isModalSubmit()) {
      const game = await getInstalledGamePackage(gameId);
      if (!game || !game.packageInfo.enabledRuntimes.includes("discord")) {
        await replyEphemeral(interaction, "That game has been removed or disabled.");
        return true;
      }
      // A modal for another game type belongs to that game's adapter.
      if (game.packageInfo.gameType !== "typing-speed") return false;
      await start(interaction, game);
      return true;
    }
    if (!sessionId) return false;
    const session = sessions.get(sessionId);
    if (!session || session.gameId !== gameId || session.guildId !== interaction.guildId || session.channelId !== interaction.channelId || session.ended || Date.now() - session.createdAt > SESSION_TTL_MS) {
      await replyEphemeral(interaction, "This game session has ended or expired.");
      return true;
    }
    const installedGame = await getInstalledGamePackage(gameId);
    if (!installedGame || !installedGame.packageInfo.enabledRuntimes.includes("discord")) {
      sessions.delete(sessionId);
      await replyEphemeral(interaction, "This game has been disabled or removed by an administrator.");
      return true;
    }
    const requestedRound = Number(roundText);
    if (action === "guess" && interaction.isButton()) {
      if (requestedRound !== session.round) { await replyEphemeral(interaction, "That round has already ended."); return true; }
      if (session.guessesThisRound.has(interaction.user.id)) { await replyEphemeral(interaction, "You already guessed this round."); return true; }
      const input = new TextInputBuilder().setCustomId("speed").setLabel("Your guess (tokens per second)").setStyle(TextInputStyle.Short)
        .setRequired(true).setMinLength(1).setMaxLength(8).setPlaceholder("For example: 42.5");
      const modal = new ModalBuilder().setCustomId(`urage-game:${gameId}:guess-submit:${sessionId}:${session.round}`).setTitle(`Round ${session.round} speed guess`)
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return true;
    }
    if (action === "guess-submit" && interaction.isModalSubmit()) {
      if (requestedRound !== session.round) { await replyEphemeral(interaction, "That round has already ended."); return true; }
      if (session.guessesThisRound.has(interaction.user.id)) { await replyEphemeral(interaction, "You already guessed this round."); return true; }
      const guess = Number(interaction.fields.getTextInputValue("speed").trim());
      if (!Number.isFinite(guess) || guess < 5 || guess > 150) { await replyEphemeral(interaction, "Enter a speed from 5 to 150 tokens/second."); return true; }
      session.guessesThisRound.add(interaction.user.id);
      const errorPercent = Math.abs(guess - session.speed) / session.speed * 100;
      const score = Math.max(0, 100 - errorPercent);
      const player = session.scores.get(interaction.user.id) || { userId: interaction.user.id, guesses: [] };
      player.guesses.push({ round: session.round, guess, score });
      session.scores.set(interaction.user.id, player);
      await interaction.reply({
        content: `<@${interaction.user.id}> locked in a guess for round ${session.round}. ${session.guessesThisRound.size} player(s) have guessed so far.`,
        allowedMentions: { parse: [] }
      });
      await interaction.followUp({ content: `Your round ${session.round} guess: **${guess.toFixed(1)} tokens/s**. The actual speed and score appear when the game ends.`, flags: MessageFlags.Ephemeral });
      return true;
    }
    if ((action === "next" || action === "end") && interaction.isButton()) {
      if (interaction.user.id !== session.hostId) { await replyEphemeral(interaction, "Only the player who started this game can control its rounds."); return true; }
      if (requestedRound !== session.round) { await replyEphemeral(interaction, "That round has already advanced."); return true; }
      await interaction.deferUpdate();
      if (action === "end" || session.round >= session.rounds) {
        session.ended = true;
        for (const embed of buildTypingResultsEmbeds(session.gameName, session.roundSpeeds, [...session.scores.values()])) {
          await interaction.followUp({ embeds: [embed], allowedMentions: { parse: [] } });
        }
        sessions.delete(session.id);
        return true;
      }
      const completedRound = session.round;
      const completedSpeed = session.speed;
      session.round += 1;
      session.text = session.roundTexts[session.round - 1]!;
      session.speed = Math.round((5 + Math.random() * 145) * 10) / 10;
      session.roundSpeeds.push(session.speed);
      session.guessesThisRound.clear();
      try {
        const gif = await renderTypingGif(session.text, session.speed, session.round, session.rounds);
        await interaction.editReply({ content: `Round ${completedRound} actual speed: **${completedSpeed.toFixed(1)} tokens/s**.\n\n${sessionContent(session)}`, attachments: [], files: [new AttachmentBuilder(gif, { name: `token-typing-round-${session.round}.gif` })], components: sessionComponents(session) });
      } catch (error) {
        session.ended = true;
        await interaction.editReply({ content: `The next round could not be rendered: ${error instanceof Error ? error.message : "GIF rendering failed."}. The game has ended.`, attachments: [], components: [] });
        sessions.delete(session.id);
      }
      return true;
    }
    return true;
  }

  return { openSettings, start, handleInteraction };
}
