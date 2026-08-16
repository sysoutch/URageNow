function normalizeLineEntries(entries: string[]): string[] {
  const normalized = entries
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);

  return [...new Set(normalized)];
}

export function normalizeRuleEntries(entries: string[]): string[] {
  return normalizeLineEntries(entries);
}

export function compileUserRegexPattern(pattern: string): RegExp {
  const trimmed = pattern.trim();
  if (!trimmed) {
    throw new Error("Regex pattern cannot be empty.");
  }

  if (trimmed.startsWith("/") && trimmed.lastIndexOf("/") > 0) {
    const lastSlash = trimmed.lastIndexOf("/");
    const body = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1);
    return new RegExp(body, flags);
  }

  return new RegExp(trimmed, "i");
}

export function validateUserRegexPatterns(patterns: string[]): string[] {
  const normalized = normalizeLineEntries(patterns);
  for (const pattern of normalized) {
    compileUserRegexPattern(pattern);
  }

  return normalized;
}

export function compileWildcardPattern(pattern: string): RegExp {
  const trimmed = pattern.trim();
  if (!trimmed) {
    throw new Error("Wildcard pattern cannot be empty.");
  }

  const escaped = trimmed.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(escaped, "i");
}

export function normalizeWildcardPatterns(patterns: string[]): string[] {
  const normalized = normalizeLineEntries(patterns);
  for (const pattern of normalized) {
    compileWildcardPattern(pattern);
  }

  return normalized;
}
