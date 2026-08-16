import assert from "node:assert/strict";
import {paginateCompanionMedia} from "../dashboard/src/server/companion/companionMediaPagination.js";

const items = Array.from({length: 53}, (_, index) => ({
  id: String(index).padStart(2, "0"),
  source: "generated",
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()
}));
const first = paginateCompanionMedia(items, new URL("http://localhost/api/companion/media?limit=18"));
assert.equal(first.items.length, 18);
assert.equal(first.total, 53);
assert.ok(first.nextCursor);

const second = paginateCompanionMedia(items, new URL(`http://localhost/api/companion/media?limit=18&cursor=${encodeURIComponent(first.nextCursor!)}`));
assert.equal(second.items.length, 18);
assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 36);

const inserted = [{id: "new", source: "generated", createdAt: "2027-01-01T00:00:00.000Z"}, ...items];
const stableSecond = paginateCompanionMedia(inserted, new URL(`http://localhost/api/companion/media?limit=18&cursor=${encodeURIComponent(first.nextCursor!)}`));
assert.deepEqual(stableSecond.items.map(item => item.id), second.items.map(item => item.id));

const bounded = paginateCompanionMedia(items, new URL("http://localhost/api/companion/media?limit=999"));
assert.equal(bounded.limit, 48);
assert.equal(bounded.items.length, 48);

console.log("Companion media pagination validation passed.");
