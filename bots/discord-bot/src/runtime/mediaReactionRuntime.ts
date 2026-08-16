import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type Message } from "discord.js";

type MediaReactionRuntimeInput = {
  getGuildSettings: (guildId: string) => Promise<any>;
  recordAction: (type: string, summary: string) => void;
};

const MEDIA_ACTION_LABELS: Record<string, string> = {
  "generate-3d-model": "Generate 3D Model",
  "create-pixel-art": "Create Pixel Art",
  "remove-background": "Remove Background",
  "delight-image": "Delight Image",
  "generate-lowpoly": "Generate Lowpoly",
  "generate-highpoly": "Generate Highpoly",
  "auto-rig": "Auto Rig",
  "generate-preview-gif": "Preview GIF"
};

export function createMediaReactionRuntime(input: MediaReactionRuntimeInput) {
  function getMessageMediaKind(message: Message): "image" | "model" | "" {
    const attachments = [...message.attachments.values()];
    if (attachments.some(attachment => {
      const name = attachment.name ?? "";
      return attachment.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(name);
    })) return "image";
    if (attachments.some(attachment => /\.(glb|gltf|fbx|obj|stl|ply|usdz)$/i.test(attachment.name ?? ""))) return "model";
    return "";
  }

  async function maybeOfferMediaReactionActions(message: Message): Promise<boolean> {
    if (!message.guild || !message.member || message.author.bot) return false;
    const mediaKind = getMessageMediaKind(message);
    if (!mediaKind) return false;
    const settings = await input.getGuildSettings(message.guild.id);
    const rules = Array.isArray(settings.mediaReactionRules) ? settings.mediaReactionRules : [];
    const rule = rules.find((entry: any) => {
      if (!entry.enabled || entry.sourceChannelId !== message.channelId || !entry.resultChannelId) return false;
      const roleAllowed = entry.allowedRoleIds.length === 0 || entry.allowedRoleIds.some((roleId: string) => message.member?.roles.cache.has(roleId));
      const userAllowed = entry.allowedUserIds.length === 0 || entry.allowedUserIds.includes(message.author.id);
      return roleAllowed && userAllowed;
    });
    if (!rule) return false;
    const actions = mediaKind === "image" ? rule.imageActions : rule.modelActions;
    if (!actions.length) return false;
    const row = new ActionRowBuilder<ButtonBuilder>();
    actions.slice(0, 5).forEach((action: string) => {
      row.addComponents(new ButtonBuilder()
        .setCustomId(`media-rule:${action}:${message.id}:${rule.resultChannelId}`)
        .setLabel(MEDIA_ACTION_LABELS[action] || action)
        .setStyle(ButtonStyle.Secondary));
    });
    await message.reply({
      content: mediaKind === "image"
        ? "Choose what to do with this image. Results will be posted in <#" + rule.resultChannelId + ">."
        : "Choose what to do with this 3D model. Results will be posted in <#" + rule.resultChannelId + ">.",
      components: [row]
    });
    input.recordAction("media-rule:offer", `${mediaKind} actions offered for ${message.id} -> ${rule.resultChannelId}`);
    return true;
  }

  return {
    maybeOfferMediaReactionActions
  };
}
