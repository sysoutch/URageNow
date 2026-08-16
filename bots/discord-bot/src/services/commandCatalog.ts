import { SlashCommandBuilder } from "discord.js";

type JsonCapableCommandBuilder = {
  toJSON: () => ReturnType<SlashCommandBuilder["toJSON"]>;
};

export interface CommandCatalogEntry {
  name: string;
  description: string;
  adminOnly: boolean;
  build: () => JsonCapableCommandBuilder;
}

export const commandCatalog: CommandCatalogEntry[] = [
  {
    name: "help",
    description: "Show Discrod status and basic help",
    adminOnly: false,
    build: () => new SlashCommandBuilder()
      .setName("help")
      .setDescription("Show Discrod status and basic help")
  },
  {
    name: "ping",
    description: "Check whether the bot is responding",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Check whether the bot is responding")
  },
  {
    name: "ask",
    description: "Send a prompt to LazyDev",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("ask")
      .setDescription("Send a prompt to LazyDev")
      .addStringOption(option =>
        option
          .setName("prompt")
          .setDescription("The prompt to send to the configured LazyDev model")
          .setRequired(true)
      )
  },
  {
    name: "say",
    description: "Send a bot message into a selected channel",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("say")
      .setDescription("Send a bot message into a selected channel")
      .addChannelOption(option =>
        option
          .setName("channel")
          .setDescription("The channel that should receive the message")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("message")
          .setDescription("The message content to send")
          .setRequired(true)
      )
  },
  {
    name: "dm",
    description: "Send a direct message through the bot",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("dm")
      .setDescription("Send a direct message through the bot")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The member who should receive the DM")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("message")
          .setDescription("The message content to send")
          .setRequired(true)
      )
  },
  {
    name: "gift",
    description: "Check the Unity Publisher of the Week gift",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("gift")
      .setDescription("Check the Unity Publisher of the Week gift")
  },
  {
    name: "humble",
    description: "Post the current Humble software bundles",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("humble")
      .setDescription("Post the current Humble software bundles")
  },
  {
    name: "model",
    description: "Generate a 3D model (GLB) from an image",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("model")
      .setDescription("Generate a 3D model (GLB) from an image")
      .addAttachmentOption(option =>
        option
          .setName("image")
          .setDescription("Source image used for 3D generation")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("prompt")
          .setDescription("Optional style prompt for 3D generation")
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option
          .setName("auto_prompt")
          .setDescription("Let the bot create a prompt automatically")
          .setRequired(false)
      )
  },
  {
    name: "lowpoly",
    description: "Create a low poly version from an uploaded 3D model file",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("lowpoly")
      .setDescription("Create a low poly version from an uploaded 3D model file")
      .addAttachmentOption(option =>
        option
          .setName("model")
          .setDescription("Source 3D model file (glb, gltf, fbx, obj, stl...)")
          .setRequired(true)
      )
      .addBooleanOption(option =>
        option
          .setName("llm_target_faces")
          .setDescription("Let LazyDev choose target face count")
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName("target_faces")
          .setDescription("Manual target face count (used when llm_target_faces is false)")
          .setMinValue(1)
          .setMaxValue(2000000)
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option
          .setName("rename")
          .setDescription("Let LazyDev suggest and apply a low poly file name")
          .setRequired(false)
      )
  },
  {
    name: "image",
    description: "Generate an image from a prompt",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("image")
      .setDescription("Generate an image from a prompt")
      .addStringOption(option =>
        option
          .setName("prompt")
          .setDescription("Text prompt for image generation")
          .setRequired(false)
      )
      .addAttachmentOption(option =>
        option
          .setName("base_image")
          .setDescription("Optional image used to derive a similar prompt")
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option
          .setName("auto_prompt")
          .setDescription("Let the bot create a prompt automatically")
          .setRequired(false)
      )
  },
  {
    name: "video",
    description: "Generate a video with the configured ComfyUI workflow",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("video")
      .setDescription("Generate a video with the configured ComfyUI workflow")
      .addStringOption(option =>
        option
          .setName("prompt")
          .setDescription("Text prompt for video generation")
          .setRequired(true)
      )
      .addAttachmentOption(option =>
        option
          .setName("start_image")
          .setDescription("Optional image for image-to-video workflows")
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName("negative_prompt")
          .setDescription("Optional negative prompt")
          .setRequired(false)
      )
      .addNumberOption(option =>
        option
          .setName("seconds")
          .setDescription("Optional duration in seconds")
          .setMinValue(1)
          .setMaxValue(300)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName("frames")
          .setDescription("Optional frame count override")
          .setMinValue(1)
          .setMaxValue(512)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName("fps")
          .setDescription("Optional frames per second")
          .setMinValue(1)
          .setMaxValue(60)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName("width")
          .setDescription("Optional output width")
          .setMinValue(64)
          .setMaxValue(4096)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName("height")
          .setDescription("Optional output height")
          .setMinValue(64)
          .setMaxValue(4096)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName("steps")
          .setDescription("Optional sampler step count")
          .setMinValue(1)
          .setMaxValue(250)
          .setRequired(false)
      )
  },
  {
    name: "describe",
    description: "Describe an uploaded image with the vision model",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("describe")
      .setDescription("Describe an uploaded image with the vision model")
      .addAttachmentOption(option =>
        option
          .setName("image")
          .setDescription("Image attachment to describe")
          .setRequired(true)
      )
  },
  {
    name: "imagepooladd",
    description: "Add an image source to an existing image pool",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("imagepooladd")
      .setDescription("Add an image source to an existing image pool")
      .addStringOption(option =>
        option
          .setName("pool")
          .setDescription("Pool name or pool ID")
          .setRequired(true)
      )
      .addAttachmentOption(option =>
        option
          .setName("image")
          .setDescription("Image attachment to add to the pool")
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName("image_url")
          .setDescription("Direct image URL to add to the pool")
          .setRequired(false)
      )
  },
  {
    name: "audio",
    description: "Generate audio from a text prompt",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("audio")
      .setDescription("Generate audio from a text prompt")
      .addStringOption(option =>
        option
          .setName("prompt")
          .setDescription("Text prompt for audio generation")
          .setRequired(true)
      )
      .addNumberOption(option =>
        option
          .setName("seconds")
          .setDescription("Optional output length in seconds")
          .setMinValue(1)
          .setMaxValue(120)
          .setRequired(false)
      )
  },
  {
    name: "music",
    description: "Generate music with optional tags and lyrics",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("music")
      .setDescription("Generate music with optional tags and lyrics")
      .addNumberOption(option =>
        option
          .setName("seconds")
          .setDescription("Length of the generated track")
          .setMinValue(1)
          .setMaxValue(120)
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("tags")
          .setDescription("Style tags for the generated music")
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName("lyrics")
          .setDescription("Optional lyrics for the generated music")
          .setRequired(false)
      )
  },
  {
    name: "invite",
    description: "Get an invite link for adding Discrod to another server",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("invite")
      .setDescription("Get an invite link for adding Discrod to another server")
  },
  {
    name: "task",
    description: "Ask LazyDev to plan safe bot actions from natural language",
    adminOnly: true,
    build: () => new SlashCommandBuilder()
      .setName("task")
      .setDescription("Ask LazyDev to plan safe bot actions from natural language")
      .addStringOption(option =>
        option
          .setName("prompt")
          .setDescription("What Discrod should do in this server")
          .setRequired(true)
      )
  }
];

export function getAllCommandNames(): string[] {
  return commandCatalog.map(entry => entry.name);
}

export function getCommandCatalogEntry(name: string): CommandCatalogEntry | null {
  return commandCatalog.find(entry => entry.name === name) ?? null;
}

export function buildCommandJsonByNames(names: string[]): ReturnType<SlashCommandBuilder["toJSON"]>[] {
  const enabled = new Set(names);
  return commandCatalog
    .filter(entry => enabled.has(entry.name))
    .map(entry => entry.build().toJSON());
}
