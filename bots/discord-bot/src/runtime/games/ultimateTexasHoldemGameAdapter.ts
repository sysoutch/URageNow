import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Interaction,
} from "discord.js";
import {
  resolveUltimateTexasHoldemConfig,
  validateUltimateTexasHoldemAnte,
  validateUltimateTexasHoldemHands,
  ultimateTexasHoldemMaxPlayers,
  ultimateTexasHoldemMaxHands,
  ultimateTexasHoldemPlayMultiplier,
  ultimateTexasHoldemBetMultiplier,
} from "@urage/server/services/games/ultimateTexasHoldemConfig";
import type { UltimateTexasHoldemPaytable } from "@urage/server/services/games/ultimateTexasHoldemConfig";
import {
  buildDeck,
  shuffleDeck,
  cardLabel,
  cardId,
  resolveHand,
} from "./ultimateTexasHoldemEngine.js";
import type { PlayingCard, UltimateTexasHoldemOutcome } from "./ultimateTexasHoldemEngine.js";

// =========================================================
// SESSION MODEL
// =========================================================
// Every player at the table plays their own hand against the dealer, so each
// seat tracks its own betting stage. Hole cards stay on this object and only
// ever leave it through a private message; the public board never renders them.
type PlayerSeat = {
  hole: PlayingCard[];
  blind: number;
  trips: number;
  playMultiplier: number;
  betMultiplier: number;
  stage: "waiting" | "preflop" | "postflop" | "resolved";
  outcome: UltimateTexasHoldemOutcome | null;
};

class UltimateTexasHoldemSession {
  #gameId: string;
  #tableName: string;
  #ante: number;
  #blind: number;
  #totalHands: number;
  #paytable: UltimateTexasHoldemPaytable;
  #handNumber = 1;
  #deck: PlayingCard[] = [];
  #community: PlayingCard[] = [];
  #dealerCards: PlayingCard[] = [];
  #seats = new Map<string, PlayerSeat>();
  #totals = new Map<string, number>();
  #finished = false;

  constructor(gameId: string, tableName: string, ante: number, blind: number, totalHands: number, paytable: UltimateTexasHoldemPaytable) {
    this.#gameId = gameId;
    this.#tableName = tableName;
    this.#ante = ante;
    this.#blind = blind;
    this.#totalHands = totalHands;
    this.#paytable = paytable;
  }

  public gameId(): string {
    return this.#gameId;
  }
  public tableName(): string {
    return this.#tableName;
  }
  public ante(): number {
    return this.#ante;
  }
  public blind(): number {
    return this.#blind;
  }
  public handNumber(): number {
    return this.#handNumber;
  }
  public totalHands(): number {
    return this.#totalHands;
  }
  public finished(): boolean {
    return this.#finished;
  }
  public seatCount(): number {
    return this.#seats.size;
  }
  public community(): PlayingCard[] {
    return this.#community;
  }
  public dealerCards(): PlayingCard[] {
    return this.#dealerCards;
  }
  public leaderboard(): { userId: string; total: number }[] {
    return [...this.#totals.entries()]
      .map((entry) => ({ userId: entry[0], total: entry[1] }))
      .sort((left, right) => right.total - left.total);
  }
  public total(userId: string): number {
    return this.#totals.get(userId) ?? 0;
  }
  public forEachSeat(visit: (userId: string, seat: PlayerSeat) => void): void {
    for (const entry of this.#seats.entries()) visit(entry[0], entry[1]);
  }

  // Deal the shared cards once per hand so every seat sees the same board.
  dealTableCards(): void {
    if (this.#community.length) return;
    this.#deck = shuffleDeck(buildDeck());
    this.#dealerCards = this.#deck.splice(0, 2);
    this.#community = this.#deck.splice(0, 5);
  }

  // Seat a player and give them two private cards for the current hand.
  public addPlayer(userId: string, blindPlaced: boolean): boolean {
    if (this.#finished) return false;
    if (this.#seats.has(userId)) {
      const seat = this.#seats.get(userId);
      if (!seat || seat.stage !== "waiting") return false;
    } else if (this.#seats.size >= ultimateTexasHoldemMaxPlayers) {
      return false;
    }
    this.dealTableCards();
    if (this.#deck.length < 2) return false;
    this.#seats.set(userId, {
      hole: this.#deck.splice(0, 2),
      blind: blindPlaced ? this.#ante : 0,
      trips: 0,
      playMultiplier: 0,
      betMultiplier: 0,
      stage: "preflop",
      outcome: null,
    });
    if (!this.#totals.has(userId)) this.#totals.set(userId, 0);
    return true;
  }

  public removePlayer(userId: string): boolean {
    if (!this.#seats.has(userId)) return false;
    this.#seats.delete(userId);
    return true;
  }

  public stage(userId: string): string {
    const seat = this.#seats.get(userId);
    return seat ? seat.stage : "absent";
  }

  public hole(userId: string): PlayingCard[] {
    const seat = this.#seats.get(userId);
    return seat ? seat.hole : [];
  }

  public outcome(userId: string): UltimateTexasHoldemOutcome | null {
    const seat = this.#seats.get(userId);
    return seat ? seat.outcome : null;
  }

  // Community cards become public in two steps: the flop appears once a seat has
  // made its preflop decision, and the turn and river join it once every seat has
  // acted preflop, so a Bet/Check decision always sees the full board. The
  // dealer's hand only turns face up after every seat at the table is settled.
  public revealedCommunity(): PlayingCard[] {
    const seats = [...this.#seats.values()];
    const actedPreflop = (seat: PlayerSeat) => seat.stage === "postflop" || seat.stage === "resolved";
    if (!seats.some(actedPreflop)) return [];
    if (seats.some((seat) => !actedPreflop(seat))) return this.#community.slice(0, 3);
    return this.#community;
  }

  public revealedDealerCards(): PlayingCard[] {
    if ([...this.#seats.values()].every((seat) => seat.stage === "resolved")) return this.#dealerCards;
    return [];
  }

  public setPlay(userId: string, multiplier: number): boolean {
    const seat = this.#seats.get(userId);
    if (!seat || seat.stage !== "preflop") return false;
    seat.playMultiplier = multiplier;
    seat.stage = "postflop";
    return true;
  }

  public fold(userId: string): boolean {
    const seat = this.#seats.get(userId);
    if (!seat || seat.stage !== "preflop") return false;
    seat.playMultiplier = 0;
    seat.stage = "resolved";
    seat.outcome = resolveHand(
      [...seat.hole, ...this.#community],
      [...this.#dealerCards, ...this.#community],
      this.#ante,
      0,
      0,
      seat.blind,
      seat.trips,
      this.#paytable,
    );
    this.#totals.set(userId, (this.#totals.get(userId) ?? 0) + seat.outcome.net + seat.outcome.tripsNet);
    return true;
  }

  public setBet(userId: string, multiplier: number): boolean {
    const seat = this.#seats.get(userId);
    if (!seat || seat.stage !== "postflop") return false;
    seat.betMultiplier = multiplier;
    seat.stage = "resolved";
    seat.outcome = resolveHand(
      [...seat.hole, ...this.#community],
      [...this.#dealerCards, ...this.#community],
      this.#ante,
      seat.playMultiplier,
      multiplier,
      seat.blind,
      seat.trips,
      this.#paytable,
    );
    this.#totals.set(userId, (this.#totals.get(userId) ?? 0) + seat.outcome.net + seat.outcome.tripsNet);
    return true;
  }

  // Move to the next hand. Seats are kept, but each player must ask for their
  // next set of cards so the deal can still travel through a private message.
  public advance(): boolean {
    if (this.#finished) return false;
    if (this.#handNumber >= this.#totalHands) {
      this.#finished = true;
      return true;
    }
    this.#handNumber += 1;
    this.#community = [];
    this.#dealerCards = [];
    this.#deck = [];
    for (const seat of this.#seats.values()) {
      seat.hole = [];
      seat.stage = "waiting";
      seat.outcome = null;
    }
    return true;
  }

  public finish(): boolean {
    if (this.#finished) return false;
    this.#finished = true;
    return true;
  }
}


// =========================================================
// RENDERING HELPERS
// =========================================================
function formatAmount(value: number): string {
  return value.toLocaleString("en-US");
}

function renderCards(cards: PlayingCard[]): string {
  return cards.map((card) => cardLabel(card)).join(" ");
}

function renderSeatStatus(seat: PlayerSeat): string {
  if (seat.stage === "waiting") return "waiting for cards";
  if (seat.stage === "preflop") return "deciding Play / Call / Fold";
  if (seat.stage === "postflop") return `played ${seat.playMultiplier === 3 ? "Play" : "Call"} · deciding Bet / Check`;
  const outcome = seat.outcome;
  if (!outcome) return "settled";
  const signed = outcome.net + outcome.tripsNet >= 0 ? `+${formatAmount(outcome.net + outcome.tripsNet)}` : formatAmount(outcome.net + outcome.tripsNet);
  return `${outcomeKindLabel(outcome.kind)} · ${signed}`;
}

function outcomeKindLabel(kind: string): string {
  if (kind === "win") return "Won";
  if (kind === "lose") return "Lost";
  if (kind === "push") return "Pushed";
  if (kind === "dealer-fails") return "Dealer failed to qualify";
  return "Folded";
}

// =========================================================
// DISCORD ADAPTER
// =========================================================
// Pending settings live beside the session because Discord validates each
// select menu on its own, so the adapter has to remember what it offered.
type TableSettings = {
  name: string;
  anteOptions: number[];
  defaultAnte: number;
  minBet: number;
  hands: number;
  paytable: UltimateTexasHoldemPaytable;
};

const pendingSettings = new Map<string, TableSettings>();
const pendingTable = new Map<string, { ante: number; blind: number }>();

export function createUltimateTexasHoldemGameAdapter(cardImageLoader: ((cardId: string) => Promise<Buffer | null>) | null = null) {
  let activeSession: UltimateTexasHoldemSession | null = null;

  // Hole cards only ever travel through a direct message, so the public board
  // can show the betting state without exposing anyone's cards.
  async function deliverPrivately(interaction: Interaction, content: string, hole: PlayingCard[]): Promise<boolean> {
    try {
      const user = interaction.user;
      if (!user || typeof user.createDM !== "function") return false;
      const channel = await user.createDM();
      if (!channel || typeof channel.send !== "function") return false;
      const files: AttachmentBuilder[] = [];
      if (cardImageLoader) {
        for (const card of hole) {
          const image = await cardImageLoader(cardId(card));
          if (image) files.push(new AttachmentBuilder(image, { name: `${cardId(card)}.png` }));
        }
      }
      await channel.send({ content, files });
      return true;
    } catch {
      return false;
    }
  }

  async function replyEphemeral(interaction: any, content: string): Promise<void> {
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch {
      // The reply channel is unavailable; the ephemeral notice is best effort.
    }
  }

  function renderBoard(session: UltimateTexasHoldemSession): string {
    const community = session.revealedCommunity();
    const dealer = session.revealedDealerCards();
    const lines = [
      `**${session.tableName()} · Hand ${session.handNumber()}/${session.totalHands()} · Ante ${formatAmount(session.ante())}**`,
      `Community: ${community.length ? renderCards(community) : "not dealt yet"} · Dealer: ${dealer.length ? renderCards(dealer) : "face down"}`,
    ];
    return lines.join("\n");
  }

  function renderSeats(session: UltimateTexasHoldemSession): string {
    const seats: string[] = [];
    session.forEachSeat((userId, seat) => {
      seats.push(`<@${userId}> · ${renderSeatStatus(seat)} · total ${formatAmount(session.total(userId))}`);
    });
    return seats.length ? seats.join("\n") : "No players seated yet.";
  }

  async function openSettings(interaction: any, game: { packageInfo: { id: string; name: string }; configuration: Record<string, unknown> }): Promise<void> {
    const config = resolveUltimateTexasHoldemConfig(game.configuration);
    pendingSettings.set(game.packageInfo.id, {
      name: game.packageInfo.name,
      anteOptions: config.anteOptions,
      defaultAnte: config.defaultAnte,
      minBet: config.minBet,
      hands: config.hands,
      paytable: config.tripsPaytable,
    });
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`urage-game:${game.packageInfo.id}:ante`)
      .setPlaceholder("Choose the table ante")
      .addOptions(config.anteOptions.map((ante) => ({
        label: `Ante ${formatAmount(ante)}`,
        description: `Play costs ${formatAmount(ante * 3)}, a Bet costs ${formatAmount(ante * 2)}`,
        value: String(ante),
      })));
    await interaction.update({
      content: `**${game.packageInfo.name}**\nChoose the ante. Your hole cards are dealt to you privately, so nobody at the table can see them.`,
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  }


  // =========================================================
  // TABLE SETUP STEPS
  // =========================================================
  const buttonLabels: Record<string, string> = {
    join: "Sit down",
    "join-blind": "Sit + Blind",
    play: "Play (3x ante)",
    call: "Call (1x ante)",
    fold: "Fold",
    bet: "Bet (2x ante)",
    check: "Check",
    leave: "Leave table",
    next: "Next hand",
    "end-game": "End game",
  };

  function buttonRow(gameId: string, actions: string[]): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const action of actions) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`urage-game:${gameId}:${action}`)
          .setLabel(buttonLabels[action] ?? action)
          .setStyle(ButtonStyle.Primary)
      );
    }
    return row;
  }

  function signedAmount(value: number): string {
    return value >= 0 ? `+${formatAmount(value)}` : formatAmount(value);
  }

  function privateDealMessage(session: UltimateTexasHoldemSession, hole: PlayingCard[]): string {
    return [
      `**${session.tableName()} · Hand ${session.handNumber()}/${session.totalHands()} · Ante ${formatAmount(session.ante())}**`,
      `Your hole cards: ${renderCards(hole)}`,
      session.blind() > 0 ? `Blind at risk: ${formatAmount(session.blind())}` : "No blind at this table.",
      "Decide Play (3x ante), Call (1x ante), or Fold. The flop follows once you act.",
    ].join("\n");
  }

  function privateResultMessage(session: UltimateTexasHoldemSession, outcome: UltimateTexasHoldemOutcome): string {
    return [
      `**${session.tableName()} · Hand ${session.handNumber()} result**`,
      `Your hand: ${outcome.playerLabel} · Dealer: ${outcome.dealerLabel}`,
      `Dealer qualified: ${outcome.qualified ? "yes (Ace or King high)" : "no"}`,
      `Net chips: ${signedAmount(outcome.net + outcome.tripsNet)}`,
    ].join("\n");
  }

  async function start(interaction: any, game: { packageInfo: { id: string; name: string }; configuration: Record<string, unknown> }): Promise<void> {
    // The games menu only offers the settings flow, but a direct start still
    // needs to open a table so the adapter satisfies the runtime's contract.
    await openSettings(interaction, game);
  }

  async function handleAnte(interaction: Interaction, gameId: string): Promise<boolean> {
    if (!interaction.isStringSelectMenu()) return true;
    const settings = pendingSettings.get(gameId);
    if (!settings) {
      await replyEphemeral(interaction, "Reopen the table and choose the ante again.");
      return true;
    }
    const ante = Number(interaction.values[0] ?? "");
    if (!validateUltimateTexasHoldemAnte(ante, settings.anteOptions)) {
      await replyEphemeral(interaction, `That ante is not on the table. Choose one of: ${settings.anteOptions.map((value) => formatAmount(value)).join(", ")}.`);
      return true;
    }
    pendingTable.set(gameId, { ante, blind: 0 });
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`urage-game:${gameId}:blind`)
      .setPlaceholder("Place a Blind?")
      .addOptions([
        { label: "No blind", description: "Only the ante is at risk", value: "none" },
        { label: "Place a blind", description: `Adds ${formatAmount(ante)} at risk every hand`, value: "blind" },
      ]);
    await interaction.update({
      content: `**Ante ${formatAmount(ante)}**\nDecide whether to place a Blind before the cards are dealt.`,
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
    });
    return true;
  }

  async function handleBlind(interaction: any, gameId: string): Promise<boolean> {
    const settings = pendingSettings.get(gameId);
    const table = pendingTable.get(gameId);
    if (!settings || !table) {
      await replyEphemeral(interaction, "Reopen the table and choose the ante again.");
      return true;
    }
    const choice = interaction.isStringSelectMenu() ? interaction.values[0] ?? "" : "";
    if (choice !== "none" && choice !== "blind") {
      await replyEphemeral(interaction, "Choose whether to place a blind.");
      return true;
    }
    pendingTable.set(gameId, { ante: table.ante, blind: choice === "blind" ? table.ante : 0 });
    const handsField = new TextInputBuilder()
      .setCustomId("hands")
      .setLabel(`Hands to play (1-${ultimateTexasHoldemMaxHands})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2)
      .setValue(String(settings.hands));
    const modal = new ModalBuilder()
      .setCustomId(`urage-game:${gameId}:start`)
      .setTitle(`${settings.name} · Ante ${formatAmount(table.ante)}`)
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(handsField));
    await interaction.showModal(modal);
    return true;
  }


  async function handleStart(interaction: Interaction, gameId: string): Promise<boolean> {
    if (!interaction.isModalSubmit()) return true;
    const settings = pendingSettings.get(gameId);
    if (!settings) {
      await replyEphemeral(interaction, "Reopen the table and set it up again.");
      return true;
    }
    const rawHands = interaction.fields.getTextInputValue("hands");
    if (!validateUltimateTexasHoldemHands(rawHands)) {
      await replyEphemeral(interaction, `Play between 1 and ${ultimateTexasHoldemMaxHands} hands.`);
      return true;
    }
    const table = pendingTable.get(gameId) ?? { ante: settings.defaultAnte, blind: 0 };
    activeSession = new UltimateTexasHoldemSession(gameId, settings.name, table.ante, table.blind, Number(rawHands), settings.paytable);
    pendingSettings.delete(gameId);
    pendingTable.delete(gameId);
    await interaction.reply({
      content: `${renderBoard(activeSession)}\nSit down to receive your hole cards in a private message.\n${renderSeats(activeSession)}`,
      components: [buttonRow(gameId, ["join", "join-blind", "end-game"])],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  async function handleJoin(interaction: Interaction, gameId: string): Promise<boolean> {
    if (!interaction.isButton()) return true;
    const session = activeSession;
    if (!session || session.gameId() !== gameId) {
      await replyEphemeral(interaction, "That table is closed. Reopen it from the games menu.");
      return true;
    }
    if (session.finished()) {
      await replyEphemeral(interaction, "That table already finished. Reopen it from the games menu.");
      return true;
    }
    const userId = interaction.user.id;
    const wantsBlind = String(interaction.customId).endsWith(":join-blind");
    if (session.stage(userId) !== "absent" && session.stage(userId) !== "waiting") {
      await replyEphemeral(interaction, "You are already in this hand.");
      return true;
    }
    if (!session.addPlayer(userId, wantsBlind)) {
      await replyEphemeral(interaction, "The table is full, so your seat is not open.");
      return true;
    }
    const hole = session.hole(userId);
    const delivered = await deliverPrivately(interaction, privateDealMessage(session, hole), hole);
    if (!delivered) {
      // Cards that never reached a player must not stay on the table, because
      // a seat with unseen cards would still be scored at showdown.
      session.removePlayer(userId);
      await interaction.followUp({
        content: `${renderBoard(session)}\nYour cards could not be delivered privately, so your seat was released.\n${renderSeats(session)}`,
        components: [buttonRow(gameId, ["join", "join-blind", "next", "end-game"])],
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    await interaction.followUp({
      content: `${renderBoard(session)}\nYour ${hole.length} hole cards went to a private message, so nobody at the table can see them.\n${renderSeats(session)}`,
      components: [buttonRow(gameId, ["play", "call", "fold", "leave"])],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  async function handleDecision(interaction: Interaction, gameId: string): Promise<boolean> {
    if (!interaction.isButton()) return true;
    const session = activeSession;
    if (!session || session.gameId() !== gameId) {
      await replyEphemeral(interaction, "That table is closed. Reopen it from the games menu.");
      return true;
    }
    const userId = interaction.user.id;
    const action = String(interaction.customId).split(":").at(-1) ?? "";
    const multiplier = action === "play" ? ultimateTexasHoldemPlayMultiplier : 1;
    const accepted = action === "fold" ? session.fold(userId) : session.setPlay(userId, multiplier);
    if (!accepted) {
      await replyEphemeral(interaction, "That preflop action is not yours to take right now.");
      return true;
    }
    const stage = session.stage(userId);
    await interaction.followUp({
      content: `${renderBoard(session)}\n${renderSeats(session)}`,
      components: [buttonRow(gameId, stage === "postflop" ? ["bet", "check"] : ["next", "join", "join-blind"])],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }


  async function handleResolve(interaction: Interaction, gameId: string): Promise<boolean> {
    if (!interaction.isButton()) return true;
    const session = activeSession;
    if (!session || session.gameId() !== gameId) {
      await replyEphemeral(interaction, "That table is closed. Reopen it from the games menu.");
      return true;
    }
    const userId = interaction.user.id;
    const action = String(interaction.customId).split(":").at(-1) ?? "";
    const multiplier = action === "bet" ? ultimateTexasHoldemBetMultiplier : 0;
    if (!session.setBet(userId, multiplier)) {
      await replyEphemeral(interaction, "You are not waiting on a Bet right now.");
      return true;
    }
    const outcome = session.outcome(userId);
    if (!outcome) return true;
    // The board and dealer become public at showdown, but the player's own
    // cards stay private, so the full breakdown travels by direct message.
    await deliverPrivately(interaction, privateResultMessage(session, outcome), []);
    await interaction.followUp({
      content: `${renderBoard(session)}\n${renderSeats(session)}`,
      components: [buttonRow(gameId, ["next", "join", "join-blind", "end-game"])],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  async function handleTableControl(interaction: Interaction, gameId: string): Promise<boolean> {
    if (!interaction.isButton()) return true;
    const session = activeSession;
    if (!session || session.gameId() !== gameId) {
      await replyEphemeral(interaction, "That table is closed. Reopen it from the games menu.");
      return true;
    }
    const action = String(interaction.customId).split(":").at(-1) ?? "";

    if (action === "leave") {
      session.removePlayer(interaction.user.id);
      await interaction.followUp({
        content: `${renderBoard(session)}\n${renderSeats(session)}`,
        components: [buttonRow(gameId, ["join", "join-blind", "next", "end-game"])],
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (action === "next") {
      session.advance();
      if (!session.finished()) {
        await interaction.followUp({
          content: `${renderBoard(session)}\nSit down again for your next private hand.\n${renderSeats(session)}`,
          components: [buttonRow(gameId, ["join", "join-blind", "next", "end-game"])],
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }
      const standings = session.leaderboard().map((entry, index) => `${index + 1}. <@${entry.userId}> · ${signedAmount(entry.total)}`);
      await interaction.followUp({
        content: `**${session.tableName()} final standings**\n${standings.join("\n") || "Nobody kept a seat to the end."}`,
        flags: MessageFlags.Ephemeral,
      });
      activeSession = null;
      return true;
    }

    session.finish();
    const standings = session.leaderboard().map((entry, index) => `${index + 1}. <@${entry.userId}> · ${signedAmount(entry.total)}`);
    await interaction.followUp({
      content: `**${session.tableName()} final standings**\n${standings.join("\n") || "Nobody kept a seat to the end."}`,
      flags: MessageFlags.Ephemeral,
    });
    activeSession = null;
    return true;
  }

  async function handleInteraction(interaction: Interaction): Promise<boolean> {
    const customId = "customId" in interaction ? String(interaction.customId || "") : "";
    if (!customId.startsWith("urage-game:")) return false;
    const [, gameId, action] = customId.split(":");
    if (!gameId || !action) return false;

    // Only act on this adapter's package so another game's buttons are never
    // answered on its behalf.
    const ownsSetup = pendingSettings.has(gameId);
    const ownsSession = activeSession !== null && activeSession.gameId() === gameId;
    if (!ownsSetup && !ownsSession) return false;

    if (action === "ante") return await handleAnte(interaction, gameId);
    if (action === "blind") return await handleBlind(interaction, gameId);
    if (action === "start") return await handleStart(interaction, gameId);
    if (action === "join" || action === "join-blind") return await handleJoin(interaction, gameId);
    if (action === "play" || action === "call" || action === "fold") return await handleDecision(interaction, gameId);
    if (action === "bet" || action === "check") return await handleResolve(interaction, gameId);
    if (action === "leave" || action === "next" || action === "end-game") return await handleTableControl(interaction, gameId);
    return true;
  }

  async function handleUpdate(interaction: any, game: { packageInfo: { id: string; name: string }; configuration: Record<string, unknown> }): Promise<void> {
    // Reopening a table retires the session that owned the previous buttons.
    const gameId = game.packageInfo.id;
    if (activeSession && activeSession.gameId() === gameId) activeSession = null;
    pendingTable.delete(gameId);
    await openSettings(interaction, game);
  }

  return { openSettings, start, handleInteraction, handleUpdate };
}

