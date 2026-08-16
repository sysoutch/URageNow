import type { Guild, GuildMember, Message } from "discord.js";

type GuildFactQuestionInput = {
  guild: Guild;
  content: string;
  authorId: string;
  messageMentions?: Message["mentions"];
};

type CachedGuildFactRecord = {
  checkedAt: string;
  value: string;
};

type GuildFactAnswerServiceDependencies = {
  shouldRefreshGuildFactQuery: (question: string) => boolean;
  matchesOwnerFactQuery: (question: string) => boolean;
  matchesRolesFactQuery: (question: string) => boolean;
  matchesAuthorityFactQuery: (question: string) => boolean;
  matchesChannelFactQuery: (question: string) => boolean;
  matchesMemberCountFactQuery: (question: string) => boolean;
  matchesInviteFactQuery: (question: string) => boolean;
  getCachedGuildFact: (guildId: string, key: string) => Promise<CachedGuildFactRecord | null>;
  upsertCachedGuildFact: (input: { guildId: string; key: string; value: string; checkedAt: string; }) => Promise<unknown>;
  listChannels: (guildId: string) => Promise<Array<{ name: string; parentName: string | null; isVoice: boolean }>>;
  listGuildInvitesForGuild: (guildId: string) => Promise<Array<{ code: string; channelName: string | null }>>;
  buildAuthorityLabelsForMember: (member: GuildMember) => string[];
  formatCheckedAt: (value: string) => string;
};

type GuildFactAnswerService = {
  tryAnswerCachedGuildFactQuestion: (input: GuildFactQuestionInput) => Promise<string | null>;
};

export function createGuildFactAnswerService(dependencies: GuildFactAnswerServiceDependencies): GuildFactAnswerService {
  async function resolveTargetGuildMemberFromContent(input: GuildFactQuestionInput): Promise<GuildMember | null> {
    if (/\b(me|my|i)\b/i.test(input.content)) {
      return input.guild.members.cache.get(input.authorId) ?? await input.guild.members.fetch(input.authorId).catch(() => null);
    }
    if (input.messageMentions?.members?.size) {
      const nonBotMention = input.messageMentions.members.find(member => !member.user.bot);
      return nonBotMention ?? input.messageMentions.members.first() ?? null;
    }
    const mentionMatch = input.content.match(/<@!?(\d{16,20})>/);
    if (mentionMatch?.[1]) {
      return input.guild.members.cache.get(mentionMatch[1]) ?? await input.guild.members.fetch(mentionMatch[1]).catch(() => null);
    }
    return null;
  }

  async function getCachedReply(guildId: string, key: string, refresh: boolean): Promise<string | null> {
    if (refresh) {
      return null;
    }
    const cached = await dependencies.getCachedGuildFact(guildId, key);
    if (!cached) {
      return null;
    }
    return `Last time I checked (${dependencies.formatCheckedAt(cached.checkedAt)}), ${cached.value}. If you want, ask me to check again.`;
  }

  async function cacheFactAndReply(guildId: string, key: string, value: string): Promise<string> {
    await dependencies.upsertCachedGuildFact({ guildId, key, value, checkedAt: new Date().toISOString() });
    return `I checked just now: ${value}.`;
  }

  async function tryAnswerCachedGuildFactQuestion(input: GuildFactQuestionInput): Promise<string | null> {
    const question = input.content.trim();
    if (!question) {
      return null;
    }
    const refresh = dependencies.shouldRefreshGuildFactQuery(question);
    if (dependencies.matchesOwnerFactQuery(question)) {
      const cacheKey = "guild-owner";
      const cachedReply = await getCachedReply(input.guild.id, cacheKey, refresh);
      if (cachedReply) {
        return cachedReply;
      }
      const ownerId = input.guild.ownerId;
      const ownerMember = input.guild.members.cache.get(ownerId) ?? await input.guild.members.fetch(ownerId).catch(() => null);
      const ownerLabel = ownerMember ? `<@${ownerMember.id}> (${ownerMember.user.tag})` : `<@${ownerId}>`;
      return cacheFactAndReply(input.guild.id, cacheKey, `the server owner/founder is ${ownerLabel}`);
    }
    if (dependencies.matchesRolesFactQuery(question) || dependencies.matchesAuthorityFactQuery(question)) {
      const targetMember = await resolveTargetGuildMemberFromContent(input);
      if (!targetMember) {
        return null;
      }
      if (dependencies.matchesRolesFactQuery(question)) {
        const cacheKey = `member-roles:${targetMember.id}`;
        const cachedReply = await getCachedReply(input.guild.id, cacheKey, refresh);
        if (cachedReply) {
          return cachedReply;
        }
        const roleNames = [...targetMember.roles.cache.values()].filter(role => role.id !== targetMember.guild.id).sort((left, right) => right.position - left.position).map(role => role.name);
        const value = roleNames.length > 0 ? `<@${targetMember.id}> has these roles: ${roleNames.join(", ")}` : `<@${targetMember.id}> currently has no extra roles`;
        return cacheFactAndReply(input.guild.id, cacheKey, value);
      }
      if (dependencies.matchesAuthorityFactQuery(question)) {
        const cacheKey = `member-authority:${targetMember.id}`;
        const cachedReply = await getCachedReply(input.guild.id, cacheKey, refresh);
        if (cachedReply) {
          return cachedReply;
        }
        const authorityLabels = dependencies.buildAuthorityLabelsForMember(targetMember);
        const value = authorityLabels.length > 0 ? `<@${targetMember.id}> has these server capabilities: ${authorityLabels.join(", ")}` : `<@${targetMember.id}> does not currently look like admin or moderation staff`;
        return cacheFactAndReply(input.guild.id, cacheKey, value);
      }
    }
    if (dependencies.matchesChannelFactQuery(question)) {
      const cacheKey = "guild-channels-overview";
      const cachedReply = await getCachedReply(input.guild.id, cacheKey, refresh);
      if (cachedReply) {
        return cachedReply;
      }
      const channels = await dependencies.listChannels(input.guild.id);
      const categories = [...new Set(channels.map(channel => channel.parentName).filter((entry): entry is string => Boolean(entry)))].slice(0, 10);
      const channelBits = channels.filter(channel => !channel.isVoice).slice(0, 12).map(channel => `#${channel.name}`);
      const voiceBits = channels.filter(channel => channel.isVoice).slice(0, 6).map(channel => channel.name);
      const segments = [
        categories.length > 0 ? `categories include ${categories.join(", ")}` : null,
        channelBits.length > 0 ? `channels include ${channelBits.join(", ")}` : null,
        voiceBits.length > 0 ? `voice channels include ${voiceBits.join(", ")}` : null
      ].filter(Boolean);
      const value = segments.length > 0 ? segments.join("; ") : "I could not find any accessible channels just now";
      return cacheFactAndReply(input.guild.id, cacheKey, value);
    }
    if (dependencies.matchesMemberCountFactQuery(question)) {
      const cacheKey = "guild-member-count";
      const cachedReply = await getCachedReply(input.guild.id, cacheKey, refresh);
      if (cachedReply) {
        return cachedReply;
      }
      return cacheFactAndReply(input.guild.id, cacheKey, `${input.guild.name} currently has ${input.guild.memberCount} members`);
    }
    if (dependencies.matchesInviteFactQuery(question)) {
      const cacheKey = "guild-invites";
      const cachedReply = await getCachedReply(input.guild.id, cacheKey, refresh);
      if (cachedReply) {
        return cachedReply;
      }
      const invites = await dependencies.listGuildInvitesForGuild(input.guild.id);
      const value = invites.length === 0 ? "there are no active invites right now" : `active invites include ${invites.slice(0, 6).map(invite => `${invite.code}${invite.channelName ? ` (${invite.channelName})` : ""}`).join(", ")}`;
      return cacheFactAndReply(input.guild.id, cacheKey, value);
    }
    return null;
  }

  return {
    tryAnswerCachedGuildFactQuestion
  };
}
