import {
  type GuildMember,
  type Message,
  PermissionFlagsBits
} from "discord.js";

interface GuildFactAndSafetyInput {
  getGuildDashboardSettings: (guildId: string) => {
    protectedUserIds: string[];
    protectedRoleIds: string[];
  };
}

export function createGuildFactAndSafetyHelpers(input: GuildFactAndSafetyInput) {
  function buildProtectionReasons(member: GuildMember | null | undefined, userId: string, guildId: string | null | undefined): string[] {
    const reasons: string[] = [];
    const guildSettings = guildId ? input.getGuildDashboardSettings(guildId) : null;
    if (guildSettings?.protectedUserIds.includes(userId)) reasons.push("dashboard protected user");
    if (!member) {
      return reasons;
    }
    if (guildSettings?.protectedRoleIds.some(roleId => member.roles.cache.has(roleId))) reasons.push("dashboard protected role");
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      reasons.push("Discord Administrator permission");
    }
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      reasons.push("Discord Manage Messages permission");
    }
    if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      reasons.push("Discord Moderate Members permission");
    }
    return reasons;
  }

  function isProtectedMember(message: Message): boolean {
    return buildProtectionReasons(message.member, message.author.id, message.guild?.id).length > 0;
  }

  function isProtectedGuildMember(member: GuildMember | null | undefined): boolean {
    if (!member) {
      return false;
    }
    return buildProtectionReasons(member, member.id, member.guild.id).length > 0;
  }

  function getProtectedMemberReasons(message: Message): string[] {
    return buildProtectionReasons(message.member, message.author.id, message.guild?.id);
  }

  function getProtectedGuildMemberReasons(member: GuildMember | null | undefined): string[] {
    if (!member) {
      return [];
    }
    return buildProtectionReasons(member, member.id, member.guild.id);
  }

  function buildMemberPromptContext(member: GuildMember | null | undefined): string | null {
    if (!member) {
      return null;
    }
    return `display name=${member.displayName}`;
  }

  function stripDiscrodReplyFooter(content: string | null | undefined): string | null {
    if (!content) {
      return null;
    }
    const cleaned = content
      .replace(/\n\s*-#\s*(?:Proxy .+ mode|Autonomous mode|Chat mode) reply from Discrod\s*/gi, "")
      .replace(/\n\s*(?:Proxy .+ mode|Autonomous mode|Chat mode) reply from Discrod\s*/gi, "")
      .trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  function shouldRefreshGuildFactQuery(content: string): boolean {
    return /\b(check again|recheck|refresh|check now|look again|verify again)\b/i.test(content);
  }

  function formatCheckedAt(checkedAt: string): string {
    const date = new Date(checkedAt);
    return Number.isNaN(date.getTime()) ? checkedAt : date.toLocaleString();
  }

  function matchesOwnerFactQuery(content: string): boolean {
    return /\b(founder|owner)\b/i.test(content) && /\b(server|guild|this server)\b/i.test(content);
  }

  function matchesRolesFactQuery(content: string): boolean {
    return /\b(role|roles)\b/i.test(content) && /\b(my|me|i have|does .* have|what|which|user)\b/i.test(content);
  }

  function matchesAuthorityFactQuery(content: string): boolean {
    return /\b(admin|administrator|founder|owner|mod|moderator)\b/i.test(content)
      && /\b(am i|are they|is he|is she|is <@|is @|who is|who are|does .* have)\b/i.test(content);
  }

  function matchesChannelFactQuery(content: string): boolean {
    return /\b(channel|channels|category|categories)\b/i.test(content)
      && /\b(list|show|what|which|available|have|there)\b/i.test(content);
  }

  function matchesMemberCountFactQuery(content: string): boolean {
    return /\b(member|members|people|users)\b/i.test(content)
      && /\b(count|how many|number|total)\b/i.test(content);
  }

  function matchesInviteFactQuery(content: string): boolean {
    return /\b(invite|invites)\b/i.test(content)
      && /\b(list|show|what|which|count|how many|active)\b/i.test(content);
  }

  function buildAuthorityLabelsForMember(member: GuildMember): string[] {
    const labels: string[] = [];
    if (member.guild.ownerId === member.id) {
      labels.push("server owner/founder");
    }
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      labels.push("administrator");
    }
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      labels.push("server manager");
    }
    if (member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      labels.push("role manager");
    }
    if (member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      labels.push("channel manager");
    }
    if (member.permissions.has(PermissionFlagsBits.ManageMessages) || member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      labels.push("moderation staff");
    }
    return labels;
  }

  return {
    isProtectedMember,
    isProtectedGuildMember,
    getProtectedMemberReasons,
    getProtectedGuildMemberReasons,
    buildMemberPromptContext,
    stripDiscrodReplyFooter,
    shouldRefreshGuildFactQuery,
    formatCheckedAt,
    matchesOwnerFactQuery,
    matchesRolesFactQuery,
    matchesAuthorityFactQuery,
    matchesChannelFactQuery,
    matchesMemberCountFactQuery,
    matchesInviteFactQuery,
    buildAuthorityLabelsForMember
  };
}
