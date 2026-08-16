export type CompanionMediaPage = {
  items: Record<string, unknown>[];
  total: number;
  limit: number;
  nextCursor: string | null;
};

type MediaCursor = {createdAt: string; id: string; source: string};

function itemKey(item: Record<string, unknown>): MediaCursor {
  return {
    createdAt: String(item.createdAt || ""),
    id: String(item.id || ""),
    source: String(item.source || "")
  };
}

function compareKeys(left: MediaCursor, right: MediaCursor): number {
  return right.createdAt.localeCompare(left.createdAt)
    || right.id.localeCompare(left.id)
    || right.source.localeCompare(left.source);
}

function encodeCursor(item: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(itemKey(item)), "utf8").toString("base64url");
}

function decodeCursor(value: string | null): MediaCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<MediaCursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string" || typeof parsed.source !== "string") return null;
    return parsed as MediaCursor;
  } catch {
    return null;
  }
}

export function sortCompanionMedia(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...items].sort((left, right) => compareKeys(itemKey(left), itemKey(right)));
}

export function paginateCompanionMedia(items: Record<string, unknown>[], url: URL): CompanionMediaPage {
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "24", 10);
  const limit = Math.min(48, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 24));
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const sorted = sortCompanionMedia(items);
  const candidates = cursor ? sorted.filter(item => compareKeys(itemKey(item), cursor) > 0) : sorted;
  const page = candidates.slice(0, limit);
  return {
    items: page,
    total: sorted.length,
    limit,
    nextCursor: page.length === limit && candidates.length > page.length ? encodeCursor(page[page.length - 1]!) : null
  };
}
