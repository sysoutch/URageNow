export type IdentifiedImageObjectPrompt = {name: string; prompt: string};

function normalizeIdentifiedImageObjectText(value: unknown, maxLength: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function findBalancedJsonEnd(value: string, start: number): number {
  const opening = value[start];
  if (opening !== "{" && opening !== "[") {
    return -1;
  }
  const stack = [opening === "{" ? "}" : "]"];
  let inString = false;
  let escaped = false;
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }
    if (character === "\"") {
      inString = true;
      continue;
    }
    if (character === "{" || character === "[") {
      stack.push(character === "{" ? "}" : "]");
      continue;
    }
    if (character !== "}" && character !== "]") {
      continue;
    }
    if (stack[stack.length - 1] !== character) {
      return -1;
    }
    stack.pop();
    if (stack.length === 0) {
      return index;
    }
  }
  return -1;
}

function extractJsonCandidates(value: string): unknown[] {
  const source = String(value || "").trim();
  const candidates: unknown[] = [];
  for (let start = 0; start < source.length; start += 1) {
    if (source[start] !== "{" && source[start] !== "[") {
      continue;
    }
    const end = findBalancedJsonEnd(source, start);
    if (end === -1) {
      continue;
    }
    try {
      candidates.push(JSON.parse(source.slice(start, end + 1)));
    } catch {
      // A later nested object may still be valid, so keep scanning.
    }
  }
  return candidates;
}

function collectRawEntries(candidate: unknown): unknown[] {
  if (Array.isArray(candidate)) {
    return candidate;
  }
  if (!candidate || typeof candidate !== "object") {
    return [];
  }
  const record = candidate as {objects?: unknown[]; name?: unknown; prompt?: unknown};
  if (Array.isArray(record.objects)) {
    return record.objects;
  }
  return "name" in record || "prompt" in record ? [record] : [];
}

export function parseIdentifiedImageObjects(value: string, maxObjects: number): IdentifiedImageObjectPrompt[] {
  const entries: IdentifiedImageObjectPrompt[] = [];
  const seen = new Set<string>();
  for (const candidate of extractJsonCandidates(value)) {
    for (const rawEntry of collectRawEntries(candidate)) {
      if (!rawEntry || typeof rawEntry !== "object") {
        continue;
      }
      const entry = rawEntry as {name?: unknown; prompt?: unknown};
      const name = normalizeIdentifiedImageObjectText(entry.name, 96);
      const prompt = normalizeIdentifiedImageObjectText(entry.prompt, 800) || name;
      if (!prompt) {
        continue;
      }
      const normalizedName = name || prompt.slice(0, 96);
      const key = `${normalizedName}\n${prompt}`.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      entries.push({name: normalizedName, prompt});
      if (entries.length >= maxObjects) {
        return entries;
      }
    }
  }
  return entries;
}
