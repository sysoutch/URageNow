import type { ManifestActionContext } from "./serverToolActionDispatcher.js";
import { ToolInvocationError } from "./toolInvocationError.js";
import { saveToolArtifact } from "./toolArtifactStore.js";

type JuiceProfile = readonly [type: string, particles: number, shakeMs: number, shake: string, easing: string, sound: string, animation: string];

const profiles: Readonly<Record<string, JuiceProfile>> = {
  jump: ["lift", 8, 70, "0.004 / 70ms", "easeOutBack → easeInQuad", "whoosh 0ms, land -35ms", "squash 70ms, stretch 90ms, settle 120ms"],
  hit: ["impact", 18, 120, "0.013 / 120ms", "easeOutExpo → easeInOutCubic", "thwack 0ms, low 18ms", "freeze 55ms, recoil 110ms, recover 160ms"],
  explosion: ["blast", 58, 380, "0.028 / 380ms", "easeOutCirc → easeOutQuart", "boom 0ms, debris 90ms, tail 180ms", "flash 45ms, expand 220ms, smoke 600ms"],
  pickup: ["reward", 22, 55, "0.003 / 55ms", "easeOutBack → easeInSine", "chime 0ms, sparkle 80ms", "pop 80ms, float 180ms, vanish 140ms"],
  dash: ["speed", 28, 90, "0.006 / 90ms", "easeOutQuint → easeOutSine", "swipe 0ms, tick 45ms", "compress 40ms, smear 130ms, settle 90ms"],
  land: ["weight", 20, 110, "0.011 / 110ms", "easeOutBounce → easeOutQuad", "thud 0ms, gravel 40ms", "squash 80ms, rebound 110ms, idle 100ms"],
  coin: ["reward", 16, 45, "0.003 / 45ms", "easeOutBack → easeOutCubic", "ping 0ms, UI tick 100ms", "scale 65ms, rotate 130ms, fade 120ms"],
  powerup: ["charge", 36, 220, "0.007 / 220ms", "easeInOutSine → easeOutElastic", "rise -120ms, activate 0ms", "charge 280ms, flash 80ms, glow 500ms"]
};

function actionsFromInput(input: Record<string, unknown>): string[] {
  const value = typeof input.actions === "string" ? input.actions : "";
  if (!value.trim()) throw new ToolInvocationError(400, "actions is required.");
  if (Buffer.byteLength(value, "utf8") > 32 * 1024) throw new ToolInvocationError(413, "actions exceeds the 32 KiB server-action limit.");
  const actions = value.split(/\r?\n|,/).map(action => action.trim().toLowerCase()).filter(Boolean);
  if (!actions.length || actions.length > 64) throw new ToolInvocationError(400, "Provide between 1 and 64 actions.");
  return [...new Set(actions)];
}

function spriteFor(type: string): string {
  if (type === "lift" || type === "weight") return "dust_puff_01";
  if (type === "blast" || type === "impact") return "shard_tri_01";
  if (type === "reward" || type === "charge") return "spark_star_01";
  return "ring_arc_01";
}

function presetFor(action: string): Record<string, unknown> {
  const profile = profiles[action] ?? profiles[action.replace(/^boss\s+/, "")] ?? ["custom", 18, 100, "0.007 / 100ms", "easeOutBack → easeOutCubic", `${action} 0ms, sweetener 70ms`, "anticipate 60ms, action 120ms, settle 140ms"] as JuiceProfile;
  return { action, type: profile[0], particles: profile[1], shakeMs: profile[2], shake: profile[3], easing: profile[4], sound: profile[5], animation: profile[6], sprite: spriteFor(profile[0]) };
}

export async function createGameJuicePresets({ manifest, input, dependencies }: ManifestActionContext): Promise<unknown> {
  const framework = input.framework === undefined ? "phaser" : String(input.framework);
  if (!["phaser", "pixijs", "babylon", "unity"].includes(framework)) throw new ToolInvocationError(400, "framework must be phaser, pixijs, babylon, or unity.");
  const presets = actionsFromInput(input).map(presetFor);
  const output = { version: 1, framework, presets, spriteFiles: [...new Set(presets.map(preset => `${preset.sprite}.png`))] };
  const artifact = await saveToolArtifact({
    sourceToolId: manifest.id,
    fileName: "game-juice-presets.json",
    mimeType: "application/json",
    data: JSON.stringify(output, null, 2),
    metadata: { framework, presetCount: presets.length }
  });
  dependencies.runtimeState.recordAction("dashboard:gamejuice-generator", `Generated ${presets.length} game-juice presets for ${framework}.`);
  return { ...output, artifact };
}
