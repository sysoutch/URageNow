import { realpathSync, statSync } from "node:fs";
import path from "node:path";

/** Resolve a regular, non-dotfile under a static root, including symlink targets. */
export function resolveContainedStaticFilePath(baseRoot: string, requestPath: string): string | null {
  const relativePath = requestPath.replace(/^[\\/]+/, "");
  if (relativePath.split(/[\\/]+/).some(segment => segment.startsWith("."))) {
    return null;
  }
  try {
    const root = realpathSync(baseRoot);
    const candidate = realpathSync(path.resolve(root, relativePath));
    const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    if (candidate !== root && !candidate.startsWith(normalizedRoot)) {
      return null;
    }
    return statSync(candidate).isFile() ? candidate : null;
  } catch {
    return null;
  }
}
