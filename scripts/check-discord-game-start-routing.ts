import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type ReplyRecord = { method: string; content: string; componentCount: number; embedCount: number; fileCount: number; components: unknown[] };
const replies: ReplyRecord[] = [];
// Modal payloads are captured because Discord validates the posted JSON on the
// server; an invalid component never reaches the adapter's own error handling.
const modalPayloads: unknown[] = [];

function recordReply(method: string, options: unknown): null {
  const record = typeof options === "object" ? options as Record<string, unknown> : {};
  replies.push({
    method,
    content: typeof record.content === "string" ? record.content : "",
    componentCount: Array.isArray(record.components) ? record.components.length : 0,
    embedCount: Array.isArray(record.embeds) ? record.embeds.length : 0,
    fileCount: Array.isArray(record.files) ? record.files.length : 0,
    components: Array.isArray(record.components) ? record.components : []
  });
  return null;
}

// Builders keep their payload behind toJSON(), which is exactly the JSON the REST
// layer posts, so the assertions below run on the shipped shape.
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

function componentCustomId(component: unknown): string {
  if (typeof component !== "object") return "";
  const customId = (component as Record<string, unknown>).custom_id;
  return typeof customId === "string" ? customId : "";
}

function customIds(components: unknown[]): string[] {
  return components.flatMap(row => childComponents(toJson(row)).map(componentCustomId).filter(Boolean));
}

// Discord requires a label on every modal text input (component type 4); without
// one the modal POST is rejected with 50035 `...label[BASE_TYPE_REQUIRED]`.
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

// Every mocked interaction answers through the same handlers; the adapters choose
// their path from the interaction predicates, so the mocks only differ in those.
const interactionResponses: Record<string, unknown> = {
  reply: async (options: unknown) => recordReply("reply", options),
  followUp: async (options: unknown) => recordReply("followUp", options),
  editReply: async (options: unknown) => recordReply("editReply", options),
  deferReply: async (_options?: unknown) => null,
  deferUpdate: async (_options?: unknown) => null,
  showModal: async (modal: unknown) => {
    modalPayloads.push(toJson(modal));
  }
};

// A modal submit carries its answers in `fields`; mocking the discord.js shape
// keeps the routing contract testable without a live server or channel.
function makeModalSubmit(customId: string, answers: Record<string, string>): unknown {
  return {
    customId,
    id: "interaction-1",
    isModalSubmit: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    fields: { getTextInputValue: (field: string) => answers[field] ?? "" },
    guildId: "guild-1",
    channelId: "channel-1",
    channel: { id: "channel-1", name: "game-night" },
    user: { id: "user-1", username: "tester" },
    replied: false,
    deferred: false,
    ...interactionResponses
  };
}

function makeButton(customId: string): unknown {
  return {
    customId,
    id: "interaction-2",
    isButton: () => true,
    isModalSubmit: () => false,
    isStringSelectMenu: () => false,
    guildId: "guild-1",
    channelId: "channel-1",
    channel: { id: "channel-1", name: "game-night" },
    user: { id: "user-1", username: "tester" },
    replied: false,
    deferred: false,
    ...interactionResponses
  };
}

function makeSelectMenu(customId: string, values: string[]): unknown {
  return {
    customId,
    id: "interaction-3",
    values,
    isStringSelectMenu: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    guildId: "guild-1",
    channelId: "channel-1",
    channel: { id: "channel-1", name: "game-night" },
    user: { id: "user-1", username: "tester" },
    replied: false,
    deferred: false,
    ...interactionResponses
  };
}

const scratch = await mkdtemp(path.join(tmpdir(), "urage-game-routing-"));
try {
  process.env.DASHBOARD_DATA_DIR = scratch;
  const { getInstalledGamePackage, importGamePackage, setGameRuntimeEnabled } =
    await import("../server/src/services/games/gamePackageStore.js");
  const { createDiscordGameRuntime } =
    await import("../bots/discord-bot/src/runtime/discordGameRuntime.js");
  const { createRacingGameAdapter } =
    await import("../bots/discord-bot/src/runtime/games/racingGameAdapter.js");
  const { createTypingSpeedGameAdapter } =
    await import("../bots/discord-bot/src/runtime/games/typingSpeedGameAdapter.js");

  await importGamePackage("derby-lab");
  await importGamePackage("token-typing");
  await setGameRuntimeEnabled("derby-lab", "discord", true);
  await setGameRuntimeEnabled("token-typing", "discord", true);

  // Each adapter must refuse a start modal owned by the other game type, or it
  // would answer for that game and validate a foreign configuration.
  assert.strictEqual(
    await createTypingSpeedGameAdapter().handleInteraction(makeModalSubmit("urage-game:derby-lab:start", { rounds: "3" })),
    false,
    "The typing adapter claimed the Derby Lab start modal."
  );
  assert.strictEqual(
    await createRacingGameAdapter().handleInteraction(makeModalSubmit("urage-game:token-typing:start", { rounds: "3" })),
    false,
    "The racing adapter claimed the Token Typing start modal."
  );
  assert.strictEqual(replies.length, 0, "A foreign adapter replied to a start modal.");

  // The racing adapter owns the Derby Lab modal and replies with a playable
  // session: text plus the bet buttons and the odds embed.
  const racingAdapter = createRacingGameAdapter(async () => Buffer.from("GIF89a"), async () => undefined);
  const derbyGame = await getInstalledGamePackage("derby-lab");
  assert.ok(derbyGame);
  replies.length = 0;
  await racingAdapter.openSettings(makeButton("urage-game:derby-lab:open"), derbyGame);
  const speciesMenuIds = customIds(replies.at(-1)?.components ?? []).filter(id => id === "urage-game:derby-lab:species");
  assert.deepEqual(speciesMenuIds, ["urage-game:derby-lab:species"], "Derby settings must ask the host for a species.");
  modalPayloads.length = 0;
  assert.strictEqual(await racingAdapter.handleInteraction(makeSelectMenu(speciesMenuIds[0], ["penguin"])), true);
  assert.match(componentCustomId(modalPayloads[0]), /^urage-game:derby-lab:start:penguin$/, "The selected species was not carried into the start modal.");
  replies.length = 0;
  assert.strictEqual(await racingAdapter.handleInteraction(makeModalSubmit("urage-game:derby-lab:start", { rounds: "3" })), true);
  const directReply = replies[replies.length - 1];
  assert.match(directReply.content, /^\*\*Derby Lab · Round 1\/3 · Horses\*\*/, "The derby start reply is not a round one horse session.");
  assert.ok(directReply.componentCount > 0, "The derby start reply has no bet buttons.");
  assert.ok(directReply.embedCount > 0, "The derby start reply has no odds embed.");

  // The composed runtime must route each modal to the adapter for the game type
  // its package declares, not to whichever adapter was installed first.
  const runtime = createDiscordGameRuntime();
  replies.length = 0;
  assert.strictEqual(await runtime.handleInteraction(makeModalSubmit("urage-game:derby-lab:start", { rounds: "2" })), true);
  const routedReply = replies[replies.length - 1];
  assert.match(routedReply.content, /^\*\*Derby Lab · Round 1\/2 · Horses\*\*/, "The router answered the derby start with another game's reply.");
  assert.ok(routedReply.componentCount > 0 && routedReply.embedCount > 0, "The routed derby start reply is not playable.");

  // The bet flow must reach the modal Discord validates: the start reply's
  // bet button opens a racer menu, and picking one opens the amount modal.
  const betButtonIds = customIds(routedReply.components).filter(id => id.startsWith("urage-game:derby-lab:bet:"));
  assert.strictEqual(betButtonIds.length, 1, "The routed derby start reply must offer exactly one bet button.");
  assert.strictEqual(await racingAdapter.handleInteraction(makeButton(betButtonIds[0])), true);
  const pickMenuIds = customIds(replies[replies.length - 1].components).filter(id => id.startsWith("urage-game:derby-lab:bet-pick:"));
  assert.strictEqual(pickMenuIds.length, 1, "The bet button must offer exactly one racer menu.");
  modalPayloads.length = 0;
  assert.strictEqual(await racingAdapter.handleInteraction(makeSelectMenu(pickMenuIds[0], ["1"])), true);
  assert.strictEqual(modalPayloads.length, 1, "Picking a racer must open exactly one bet modal.");
  assert.deepStrictEqual(unlabeledModalInputs(modalPayloads[0]), [], "The bet modal has a text input without a label, so Discord rejects it.");
  assert.match(componentCustomId(modalPayloads[0]), /^urage-game:derby-lab:bet-amount:/, "Picking a racer opened the wrong modal.");

  // One player can hold one bet per racer. Repeating a racer updates that
  // specific bet; choosing a different racer adds another bet.
  const firstBetModalId = componentCustomId(modalPayloads[0]);
  assert.strictEqual(await racingAdapter.handleInteraction(makeModalSubmit(firstBetModalId, { amount: "100" })), true);
  assert.strictEqual(await racingAdapter.handleInteraction(makeButton(betButtonIds[0])), true);
  const secondPickMenuId = customIds(replies.at(-1)?.components ?? []).find(id => id.startsWith("urage-game:derby-lab:bet-pick:"));
  assert.ok(secondPickMenuId);
  modalPayloads.length = 0;
  assert.strictEqual(await racingAdapter.handleInteraction(makeSelectMenu(secondPickMenuId, ["2"])), true);
  assert.strictEqual(await racingAdapter.handleInteraction(makeModalSubmit(componentCustomId(modalPayloads[0]), { amount: "75" })), true);
  const boardButtonId = customIds(routedReply.components).find(id => id.startsWith("urage-game:derby-lab:board:"));
  assert.ok(boardButtonId);
  assert.strictEqual(await racingAdapter.handleInteraction(makeButton(boardButtonId)), true);
  assert.match(replies.at(-1)?.content ?? "", /Night Rider.*100 credits.*Red Comet.*75 credits/, "The private board did not retain both racer bets.");

  // Starting the race removes stale buttons from the source message and posts
  // the replay plus next-round controls as a new follow-up message.
  const raceButtonId = customIds(routedReply.components).find(id => id.startsWith("urage-game:derby-lab:race:"));
  assert.ok(raceButtonId);
  replies.length = 0;
  assert.strictEqual(await racingAdapter.handleInteraction(makeButton(raceButtonId)), true);
  assert.ok(replies.some(reply => reply.method === "editReply" && reply.componentCount === 0), "The old race controls were not retired.");
  const replayIndex = replies.findIndex(reply => reply.method === "followUp" && reply.fileCount === 1);
  const resultIndex = replies.findIndex(reply => reply.method === "followUp" && reply.componentCount > 0);
  assert.ok(replayIndex >= 0, "The replay was not posted as a new message.");
  assert.ok(resultIndex > replayIndex, "The next-round result was posted before the replay completed its first pass.");

  // The typing modal must reach the typing adapter; a missing FFmpeg only costs
  // the animated preview, so the check asserts the reply exists, not its media.
  replies.length = 0;
  assert.strictEqual(await runtime.handleInteraction(makeModalSubmit("urage-game:token-typing:start", { rounds: "2" })), true);
  const typingContents = replies.map(reply => reply.content).join("\n");
  assert.ok(replies.length > 0, "The router never reached the typing adapter.");
  assert.doesNotMatch(typingContents, /Place my bet/, "The router answered the typing start with a derby reply.");

  console.log("Discord game start routing validation passed.");
} finally {
  const resolvedScratch = path.resolve(scratch);
  if (!resolvedScratch.startsWith(`${path.resolve(tmpdir())}${path.sep}`)) throw new Error("Unsafe test cleanup path.");
  await rm(resolvedScratch, { recursive: true, force: true });
}
