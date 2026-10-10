import { EmbedBuilder } from "discord.js";

export type RoundGuess = { round: number; guess: number; score: number };
export type PlayerScore = { userId: string; guesses: RoundGuess[] };

const MAX_FIELDS_PER_EMBED = 20;
const MAX_EMBED_TEXT = 5_500;

export function buildTypingResultsEmbeds(gameName: string, roundSpeeds: number[], players: PlayerScore[]): EmbedBuilder[] {
  const ranked = players.map(player => ({
    ...player,
    average: player.guesses.reduce((sum, entry) => sum + entry.score, 0) / player.guesses.length
  })).sort((left, right) => right.average - left.average || left.userId.localeCompare(right.userId));
  const title = `🏁 ${gameName} · Final Results`;
  const description = "🏆 **Leaderboard** · average accuracy across guessed rounds";
  const speedsName = "🎯 Actual speeds";
  const speeds = roundSpeeds.map((speed, index) => `Round ${index + 1}: **${speed.toFixed(1)} tokens/s**`).join("\n") || "No rounds played.";
  const newPage = () => new EmbedBuilder().setColor(0xff8957).setTitle(title).setDescription(description)
    .addFields({ name: speedsName, value: speeds });
  const baseLength = title.length + description.length + speedsName.length + speeds.length + 100;
  const pages: EmbedBuilder[] = [];
  let page = newPage();
  let fieldCount = 1;
  let textLength = baseLength;

  if (!ranked.length) page.addFields({ name: "No guesses", value: "No one submitted a guess this game." });
  for (const [index, player] of ranked.entries()) {
    const medal = ["🥇", "🥈", "🥉"][index] || "🏅";
    const name = `${medal} ${index + 1}. ${player.average.toFixed(1)}% average · ${player.guesses.length} round(s)`;
    const rounds = player.guesses.map(entry =>
      `R${entry.round} · guess **${entry.guess.toFixed(1)}** · actual **${roundSpeeds[entry.round - 1]?.toFixed(1) ?? "?"}** tokens/s · **${entry.score.toFixed(1)}%**`
    );
    const value = [`<@${player.userId}>`, ...rounds].join("\n");
    if (fieldCount >= MAX_FIELDS_PER_EMBED || textLength + name.length + value.length > MAX_EMBED_TEXT) {
      pages.push(page);
      page = newPage();
      fieldCount = 1;
      textLength = baseLength;
    }
    page.addFields({ name, value });
    fieldCount += 1;
    textLength += name.length + value.length;
  }
  pages.push(page);
  pages.forEach((embed, index) => embed.setFooter({ text: `GIF preserved · game buttons inactive · Page ${index + 1}/${pages.length}` }));
  return pages;
}
