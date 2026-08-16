import type { GuildMember } from "discord.js";
import type { ImagePool } from "@urage/shared/resourcePools/imagePoolContracts";

type ImagePoolStoreDeps = {
  listImagePools: () => Promise<ImagePool[]>;
  saveImagePool: (pool: { id?: string; name: string; images: string[]; }) => Promise<ImagePool>;
  resolveGeneratedImageApiSourceToFilePath: (source: string) => Promise<string | null>;
};

type ImagePoolPermissionDeps = {
  getGuildSettings: (guildId: string) => Promise<{
    imagePoolVerifiedRoleIds: string[];
    imagePoolVerifiedUserIds: string[];
  }>;
  isProtectedGuildMember: (member: GuildMember) => boolean;
};

export type PendingImagePoolSelection = {
  createdAt: string;
  requesterId: string;
  imageId: string;
  imageSource: string;
};

export function rememberPendingImagePoolSelection(input: {
  selections: Map<string, PendingImagePoolSelection>;
  createRuntimeId: () => string;
  selection: PendingImagePoolSelection;
}): string {
  const selectionId = input.createRuntimeId();
  input.selections.set(selectionId, input.selection);
  if (input.selections.size <= 120) {
    return selectionId;
  }
  const entries = [...input.selections.entries()]
    .sort((left, right) => left[1].createdAt.localeCompare(right[1].createdAt));
  for (const [key] of entries.slice(0, Math.max(0, entries.length - 100))) {
    input.selections.delete(key);
  }
  return selectionId;
}

export async function normalizeImageSourceForPool(rawImageSource: string, deps: ImagePoolStoreDeps): Promise<string> {
  const trimmed = rawImageSource.trim();
  if (!trimmed) {
    throw new Error("Image source is required.");
  }
  const resolvedGeneratedImagePath = await deps.resolveGeneratedImageApiSourceToFilePath(trimmed).catch(() => null);
  return resolvedGeneratedImagePath || trimmed;
}

export async function addImageSourceToPool(input: {
  poolId: string;
  imageSource: string;
}, deps: ImagePoolStoreDeps): Promise<{ pool: ImagePool; added: boolean; }> {
  const poolId = input.poolId.trim();
  const imageSource = await normalizeImageSourceForPool(input.imageSource, deps);
  if (!poolId) {
    throw new Error("Image pool is required.");
  }
  const pools = await deps.listImagePools();
  const pool = pools.find(entry => entry.id === poolId) ?? null;
  if (!pool) {
    throw new Error("Image pool was not found.");
  }
  const alreadyExists = pool.images.some(entry => entry.trim() === imageSource);
  const saved = await deps.saveImagePool({
    id: pool.id,
    name: pool.name,
    images: alreadyExists ? [...pool.images] : [...pool.images, imageSource]
  });
  return {
    pool: saved,
    added: !alreadyExists
  };
}

export function buildUnverifiedImagePoolName(input: {
  userId: string;
  username: string;
  displayName?: string | null;
}): string {
  const label = (input.displayName?.trim() || input.username.trim() || "user").replace(/\s+/g, " ").slice(0, 40);
  return `Unverified Pool - ${label} - ${input.userId}`;
}

export async function addImageSourceToUserUnverifiedPool(input: {
  userId: string;
  username: string;
  displayName?: string | null;
  imageSource: string;
}, deps: ImagePoolStoreDeps): Promise<{ pool: ImagePool; added: boolean; created: boolean; }> {
  const imageSource = await normalizeImageSourceForPool(input.imageSource, deps);
  const poolName = buildUnverifiedImagePoolName(input);
  const existingPool = (await deps.listImagePools()).find(entry => entry.name === poolName) ?? null;
  if (existingPool) {
    const result = await addImageSourceToPool({
      poolId: existingPool.id,
      imageSource
    }, deps);
    return {
      ...result,
      created: false
    };
  }
  const pool = await deps.saveImagePool({
    name: poolName,
    images: [imageSource]
  });
  return {
    pool,
    added: true,
    created: true
  };
}

export async function canUseVerifiedImagePools(member: GuildMember | null | undefined, deps: ImagePoolPermissionDeps): Promise<boolean> {
  if (!member) {
    return false;
  }
  if (deps.isProtectedGuildMember(member)) {
    return true;
  }
  const settings = await deps.getGuildSettings(member.guild.id);
  return settings.imagePoolVerifiedUserIds.includes(member.id)
    || settings.imagePoolVerifiedRoleIds.some(roleId => member.roles.cache.has(roleId));
}
