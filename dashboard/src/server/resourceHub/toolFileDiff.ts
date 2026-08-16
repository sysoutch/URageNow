export type ToolFileDiffLine = {
  type: "add" | "remove";
  lineNumber: number;
  text: string;
};

export type ToolFileDiff = {
  fileName: string;
  added: number;
  removed: number;
  lines: ToolFileDiffLine[];
};

export function buildToolFileDiff(fileName: string, before: string, after: string, maxLines = 500): ToolFileDiff {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const lines: ToolFileDiffLine[] = [];
  let added = 0;
  let removed = 0;
  const length = Math.max(beforeLines.length, afterLines.length);
  for (let index = 0; index < length; index += 1) {
    const prior = beforeLines[index];
    const next = afterLines[index];
    if (prior === next) continue;
    if (prior !== undefined) {
      removed += 1;
      if (lines.length < maxLines) lines.push({type: "remove", lineNumber: index + 1, text: prior});
    }
    if (next !== undefined) {
      added += 1;
      if (lines.length < maxLines) lines.push({type: "add", lineNumber: index + 1, text: next});
    }
  }
  return {fileName, added, removed, lines};
}
