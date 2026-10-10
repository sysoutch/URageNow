import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// =========================================================
// PUBLIC REPLY RECORDER
// =========================================================
type ReplyRecord = { method: string; content: string; components: unknown[] };
const replies: ReplyRecord[] = [];
const modalPayloads: unknown[] = [];

// Hole cards only travel by direct message, so every private payload is
// captured here and later cross-checked against the public replies.
const directMessages: { userId: string; content: string }[] = [];

function recordReply(method: string, options: unknown): null {
  const record = typeof options === "object" ? options as Record<string, unknown> : {};
  replies.push({
    method,
    content: typeof record.content === "string" ? record.content : "",
    components: Array.isArray(record.components) ? record.components : [],
  });
  return null;
}

function toJson(value: unknown): unknown {
  if (typeof value !== "object") return value;
  const toJSON = (value as Record<string, unknown>).toJSON;
  return typeof toJSON === "function" ? (value as { toJSON: () => unknown }).toJSON() : value;
}

function childComponents(component: unknown): unknown[] {
  if (typeof component !== "object") return [];
  const components = (component as Record<string, unknown>).components;
  return Array.isArray(components) ? components : [];
}

function customIds(components: unknown[]): string[] {
  return components.flatMap((row) => childComponents(toJson(row)).map((component) => {
    const customId = (component as Record<string, unknown>).custom_id;
    return typeof customId === "string" ? customId : "";
  }).filter(Boolean));
}

// Discord rejects a modal whose text input has no label, so the shipped payload
// is inspected rather than the builder call.
function unlabeledModalInputs(modal: unknown): string[] {
  const missing: string[] = [];
  for (const row of childComponents(toJson(modal))) {
    for (const input of childComponents(row)) {
      if (typeof input !== "object") continue;
      const record = input as Record<string, unknown>;
      if (record.type !== 4) continue;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      if (!label) missing.push(componentCustomId(input) || "text input");
    }
  }
  return missing;
}

function componentCustomId(component: unknown): string {
  if (typeof component !== "object") return "";
  const customId = (component as Record<string, unknown>).custom_id;
  return typeof customId === "string" ? customId : "";
}

const interactionResponses: Record<string, unknown> = {
  reply: async (options: unknown) => recordReply("reply", options),
  followUp: async (options: unknown) => recordReply("followUp", options),
  update: async (options: unknown) => recordReply("update", options),
  showModal: async (modal: unknown) => {
    modalPayloads.push(toJson(modal));
  },
};


// A player's DM channel is mocked with the discord.js shape so the adapter's
// private delivery path runs exactly as it does against a live server.
function makeUser(userId: string): unknown {
  return {
    id: userId,
    username: `player-${userId}`,
    createDM: async () => ({
      id: `dm-${userId}`,
      send: async (options: unknown) => {
        const record = typeof options === "object" ? options as Record<string, unknown> : {};
        directMessages.push({
          userId,
          content: typeof record.content === "string" ? record.content : "",
        });
        return null;
      },
    }),
  };
}

function makeButton(customId: string, userId = "user-1"): unknown {
  return {
    customId,
    id: "interaction-button",
    isButton: () => true,
    isModalSubmit: () => false,
    isStringSelectMenu: () => false,
    guildId: "guild-1",
    channelId: "channel-1",
    channel: { id: "channel-1", name: "game-night" },
    user: makeUser(userId),
    replied: false,
    deferred: false,
    ...interactionResponses,
  };
}

function makeSelectMenu(customId: string, values: string[], userId = "user-1"): unknown {
  return {
    customId,
    id: "interaction-select",
    values,
    isStringSelectMenu: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    guildId: "guild-1",
    channelId: "channel-1",
    channel: { id: "channel-1", name: "game-night" },
    user: makeUser(userId),
    replied: false,
    deferred: false,
    ...interactionResponses,
  };
}

function makeModalSubmit(customId: string, answers: Record<string, string>, userId = "user-1"): unknown {
  return {
    customId,
    id: "interaction-modal",
    isModalSubmit: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    fields: { getTextInputValue: (field: string) => answers[field] ?? "" },
    guildId: "guild-1",
    channelId: "channel-1",
    channel: { id: "channel-1", name: "game-night" },
    user: makeUser(userId),
    replied: false,
    deferred: false,
    ...interactionResponses,
  };
}

const gameId = "ultimate-texas-holdem";
const scratch = await mkdtemp(path.join(tmpdir(), "urage-uth-"));
try {
  process.env.DASHBOARD_DATA_DIR = scratch;
  const { validateGamePackageDocument, importGamePackage, setGameRuntimeEnabled, getInstalledGamePackage } =
    await import("../server/src/services/games/gamePackageStore.js");
  const engine = await import("../bots/discord-bot/src/runtime/games/ultimateTexasHoldemEngine.js");

  const { buildDeck, evaluateFive, bestHandScore, handCategoryLabel, dealerQualifies, resolveHand, tripsBonusMultiplier } = engine;

  function cardOf(notation: string): { rank: number; suit: number } {
    const rankCode = notation.slice(0, -1);
    const suitCode = notation.slice(-1);
    const ranks = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
    const suits = ["C", "D", "H", "S"];
    const rank = ranks.indexOf(rankCode);
    const suit = suits.indexOf(suitCode);
    if (rank < 2 || suit < 0) throw new Error(`Unknown card ${notation}`);
    return { rank, suit };
  }

  // =========================================================
  // ENGINE CONTRACTS
  // =========================================================
  const royal = ["TC", "JC", "QC", "KC", "AC"].map(cardOf);
  const kingStraightFlush = ["9D", "TD", "JD", "QD", "KD"].map(cardOf);
  const quads = ["2H", "2S", "2D", "2C", "9S"].map(cardOf);
  const fullHouse = ["7H", "7S", "7D", "4C", "4H"].map(cardOf);
  const flush = ["2H", "5H", "8H", "9H", "KH"].map(cardOf);
  const sixHighStraight = ["2C", "3D", "4H", "5S", "6C"].map(cardOf);
  const wheel = ["AC", "2D", "3H", "4S", "5C"].map(cardOf);
  const trips = ["TH", "TS", "TD", "2C", "7H"].map(cardOf);
  const twoPair = ["9H", "9S", "5D", "5C", "2H"].map(cardOf);
  const pair = ["KH", "KS", "2D", "5C", "7H"].map(cardOf);
  const highCard = ["2C", "5D", "7H", "9S", "JC"].map(cardOf);

  const ladder = [royal, kingStraightFlush, quads, fullHouse, flush, sixHighStraight, trips, twoPair, pair, highCard];
  for (let index = 0; index + 1 < ladder.length; index += 1) {
    assert(
      evaluateFive(ladder[index]) > evaluateFive(ladder[index + 1]),
      `The evaluator ranked ${handCategoryLabel(evaluateFive(ladder[index]))} at or below ${handCategoryLabel(evaluateFive(ladder[index + 1]))}.`
    );
  }
  assert(handCategoryLabel(evaluateFive(royal)) === "Straight Flush", "The royal flush lost its category.");
  assert(evaluateFive(royal) > evaluateFive(kingStraightFlush), "A royal flush must beat a king-high straight flush.");
  assert(evaluateFive(sixHighStraight) > evaluateFive(wheel), "The Ace-low wheel must be the lowest straight, not the highest.");
  assert(bestHandScore([...royal, ...highCard]) === evaluateFive(royal), "A wider card set must still find the royal flush.");

  const deck = buildDeck();
  assert(deck.length === 52 && new Set(deck.map((card) => `${card.rank}${card.suit}`)).size === 52, "The deck must be 52 unique cards.");

  // =========================================================
  // DEALER QUALIFICATION + PAYOUTS
  // =========================================================
  const ante = 10;
  const paytable = { royalFlush: 100, straightFlush: 20, quads: 2, trips: 1 };
  const kingHigh = ["KH", "QD", "JC", "TD", "9S", "8C"].map(cardOf);
  const queenHigh = ["QH", "JD", "TC", "9C", "8S", "7C"].map(cardOf);
  assert(dealerQualifies(kingHigh), "A King high dealer hand must qualify.");
  assert(!dealerQualifies(queenHigh), "A Queen high dealer hand must not qualify.");

  const playerWin = resolveHand([...royal, ...queenHigh], [...kingHigh], ante, 3, 2, ante, 0, paytable);
  assert(playerWin.kind === "win" && playerWin.net === 60, "Play plus Bet plus Blind must pay even money on a win.");
  const playerLoss = resolveHand([...highCard], [...kingHigh], ante, 3, 2, ante, 0, paytable);
  assert(playerLoss.kind === "lose" && playerLoss.net === -60, "A losing Play and Blind must be lost outright.");
  const push = resolveHand([...royal, ...queenHigh], [...royal], ante, 3, 2, ante, 0, paytable);
  assert(push.kind === "push" && push.net === 0, "A tied hand must push every bet.");
  const folded = resolveHand([...royal, ...queenHigh], [...kingHigh], ante, 0, 0, ante, 0, paytable);
  assert(folded.kind === "fold" && folded.net === -20, "A fold must lose the ante and the blind.");
  const nonQualified = resolveHand([...sixHighStraight, ...queenHigh], [...queenHigh], ante, 3, 2, ante, 0, paytable);
  assert(
    nonQualified.kind === "dealer-fails" && nonQualified.net === 60,
    "A non-qualifying dealer must lose Play, Bet, and Blind even money while the ante pushes."
  );

  assert(tripsBonusMultiplier(evaluateFive(trips), paytable) === 1, "Trips pays the trips bet even money.");
  assert(tripsBonusMultiplier(evaluateFive(quads), paytable) === 2, "Quads pay double the trips bet.");
  assert(tripsBonusMultiplier(evaluateFive(kingStraightFlush), paytable) === 20, "A non-royal straight flush pays 20x.");
  assert(tripsBonusMultiplier(evaluateFive(royal), paytable) === 100, "A royal flush pays 100x.");
  assert(tripsBonusMultiplier(evaluateFive(twoPair), paytable) === 0, "Two pair must not pay the trips bonus.");


  // =========================================================
  // PACKAGE + ADAPTER FLOW
  // =========================================================
  const bundledPath = path.join(root, "bots", "discord-bot", "game-packs", `${gameId}.uragegame.json`);
  const bundled = JSON.parse(await readFile(bundledPath, "utf8"));
  const document = validateGamePackageDocument(bundled);
  assert(document.manifest.gameType === gameId, "The bundled package must declare the poker game type.");
  assert(document.manifest.runtimes.includes("discord"), "The poker package must offer the Discord runtime.");

  await importGamePackage(gameId);
  await setGameRuntimeEnabled(gameId, "discord", true);
  const installedPackage = await getInstalledGamePackage(gameId);
  assert(installedPackage !== null, "The poker package must load back from the runtime catalog.");

  const createAdapter = (await import("../bots/discord-bot/src/runtime/games/ultimateTexasHoldemGameAdapter.js")).createUltimateTexasHoldemGameAdapter;
  const createRacingAdapter = (await import("../bots/discord-bot/src/runtime/games/racingGameAdapter.js")).createRacingGameAdapter;
  const adapter = createAdapter();

  // Adapters are routed by game type, so a foreign adapter must stay silent.
  assert.strictEqual(
    await createRacingAdapter().handleInteraction(makeButton(`urage-game:${gameId}:join`)),
    false,
    "The racing adapter claimed a poker button."
  );
  assert.strictEqual(replies.length, 0, "A foreign adapter replied on behalf of the poker table.");

  function lastReply(): ReplyRecord {
    const reply = replies.at(-1);
    if (!reply) throw new Error("The adapter produced no reply.");
    return reply;
  }

  function offeredActions(): string[] {
    return customIds(lastReply().components).map((customId) => customId.split(":").at(-1) ?? "");
  }

  // A private message is only ever addressed to the player who acted, so the
  // hole cards of one seat can never be read from another player's delivery.
  function cardsIn(content: string): string[] {
    return content.match(/[2-9TJQKA][♣♦♥♠]/g) ?? [];
  }

  await adapter.openSettings(makeButton(`urage-game:${gameId}:open`), installedPackage);
  assert(customIds(lastReply().components).includes(`urage-game:${gameId}:ante`), "The table must offer an ante picker.");

  await adapter.handleInteraction(makeSelectMenu(`urage-game:${gameId}:ante`, ["100"]));
  assert(customIds(lastReply().components).includes(`urage-game:${gameId}:blind`), "Choosing an ante must offer the blind.");

  await adapter.handleInteraction(makeSelectMenu(`urage-game:${gameId}:blind`, ["blind"]));
  assert(modalPayloads.length === 1, "Choosing a blind must open exactly one start modal.");
  assert(unlabeledModalInputs(modalPayloads[0]).length === 0, "Every start modal input needs a label or Discord rejects it.");

  await adapter.handleInteraction(makeModalSubmit(`urage-game:${gameId}:start`, { hands: "3" }));
  assert(lastReply().method === "reply", "Starting the table must answer the modal submit.");
  assert(directMessages.length === 0, "Opening the table must not deal any cards yet.");
  assert(offeredActions().includes("join"), "The table must invite players to sit down.");

  // Only the replies published while that hand was live are in scope, because a
  // later hand reshuffles and may legitimately show the same card publicly.
  function assertNoHoleCardLeak(from: number, upTo: number, cards: string[], label: string): void {
    for (const reply of replies.slice(from, upTo)) {
      for (const card of cards) {
        assert(!reply.content.includes(card), `${label}: a hole card leaked into a public reply: ${card}`);
      }
    }
  }

  await adapter.handleInteraction(makeButton(`urage-game:${gameId}:join`, "user-1"));
  assert(directMessages.length === 1, "Sitting down must send exactly one private message.");
  const holeCards = cardsIn(directMessages[0].content);
  assert(holeCards.length === 2, "A seat must receive exactly two hole cards privately.");
  assert(offeredActions().includes("play"), "A seated player must be offered Play.");

  await adapter.handleInteraction(makeButton(`urage-game:${gameId}:play`));
  assert(offeredActions().includes("bet"), "Playing must open the postflop Bet decision.");
  assert(cardsIn(lastReply().content).length === 5, "Playing must reveal the full board before the Bet decision.");

  await adapter.handleInteraction(makeButton(`urage-game:${gameId}:bet`));
  assert(directMessages.length === 2, "Showdown must send the result privately.");
  const showdown = lastReply();
  assert(showdown.content.includes("Community"), "Showdown must reveal the community board publicly.");
  assert(!showdown.content.includes("face down"), "Showdown must turn the dealer's hand face up.");
  assert(cardsIn(showdown.content).length === 7, "Showdown must publish all five community cards and the dealer's hand.");
  assertNoHoleCardLeak(0, replies.length, holeCards, "Hand one");

  const handTwoStart = replies.length;
  await adapter.handleInteraction(makeButton(`urage-game:${gameId}:next`));
  assert(showdown.content !== lastReply().content, "Advancing must publish a fresh board.");

  await adapter.handleInteraction(makeButton(`urage-game:${gameId}:join`, "user-1"));
  assert(directMessages.length === 3, "The next hand must deal a fresh private hand.");
  const secondHole = cardsIn(directMessages[2].content);
  assert(secondHole.length === 2, "The next hand must also deal two cards privately.");
  await adapter.handleInteraction(makeButton(`urage-game:${gameId}:call`));
  await adapter.handleInteraction(makeButton(`urage-game:${gameId}:check`));
  assertNoHoleCardLeak(handTwoStart, replies.length, secondHole, "Hand two");

  const messagesBeforeEnd = directMessages.length;
  await adapter.handleInteraction(makeButton(`urage-game:${gameId}:end-game`));
  assert(lastReply().content.includes("final standings"), "Ending the table must publish the standings.");
  assert(directMessages.length === messagesBeforeEnd, "Ending the table must not deal more cards.");

  console.log("Discord Ultimate Texas Hold'em validation passed.");
} finally {
  await rm(scratch, { recursive: true, force: true });
}

