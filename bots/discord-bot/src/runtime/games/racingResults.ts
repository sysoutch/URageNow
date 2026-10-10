import { EmbedBuilder } from "discord.js";

export type RacingRoundLedger = {
  round: number;
  racerIndex: number;
  racerName: string;
  amount: number;
  payout: number;
  net: number;
};
export type PlayerLedger = { userId: string; rounds: RacingRoundLedger[] };

const MAX_FIELDS_PER_EMBED = 20;
const MAX_EMBED_TEXT = 5_500;

function formatCredits(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function buildRacingResultsEmbeds(roundSummaries: string[], players: PlayerLedger[]): EmbedBuilder[] {
  const ranked = players.map(player => ({
    ...player,
    net: player.rounds.reduce((sum, entry) => sum + entry.net, 0)
  })).sort((left, right) => right.net - left.net || left.userId.localeCompare(right.userId));
  const title = "🏆 Derby Lab · Final Ledger";
  const description = "💰 **Leaderboard** · net credits across every raced round";
  const summaryName = "🏁 Race results";
  const summaries = roundSummaries.join("\n") || "No races were started.";
  const newPage = () => new EmbedBuilder().setColor(0xf5c65b).setTitle(title).setDescription(description)
    .addFields({ name: summaryName, value: summaries });
  const baseLength = title.length + description.length + summaryName.length + summaries.length + 100;
  const pages: EmbedBuilder[] = [];
  let page = newPage();
  let fieldCount = 1;
  let textLength = baseLength;

  if (!ranked.length) page.addFields({ name: "No bets", value: "No player placed a bet this game." });
  for (const [index, player] of ranked.entries()) {
    const medal = ["🥇", "🥈", "🥉"][index] || "🏅";
    const roundCount = new Set(player.rounds.map(entry => entry.round)).size;
    const name = `${medal} ${index + 1}. ${formatCredits(player.net)} net credits · ${player.rounds.length} bet(s) across ${roundCount} round(s)`;
    const value = [
      `<@${player.userId}>`,
      ...player.rounds.map(entry =>
        `R${entry.round} · ${entry.racerName} **${formatCredits(entry.amount)} cr** · won **${formatCredits(entry.payout)} cr** · **${entry.net >= 0 ? "+" : "-"}${formatCredits(Math.abs(entry.net))} cr**`
      )
    ].join("\n");
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
  pages.forEach((embed, index) => embed.setFooter({ text: `Replays preserved · game buttons inactive · Page ${index + 1}/${pages.length}` }));
  return pages;
}
