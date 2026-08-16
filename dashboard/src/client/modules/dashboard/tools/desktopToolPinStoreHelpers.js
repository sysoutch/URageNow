function createDashboardDesktopToolPinStoreHelpers(input) {
  const storage = input.storage;
  const storageKey = input.storageKey;
  const maximumTools = Number.isFinite(input.maximumTools) ? input.maximumTools : 80;
  const createId = typeof input.createId === "function"
    ? input.createId
    : () => String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  const getTimestamp = typeof input.getTimestamp === "function"
    ? input.getTimestamp
    : () => new Date().toISOString();

  function read() {
    try {
      const parsed = JSON.parse(storage.getItem(storageKey) || "[]");
      return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.path === "string") : [];
    } catch {
      return [];
    }
  }

  function write(tools) {
    storage.setItem(storageKey, JSON.stringify(Array.isArray(tools) ? tools : []));
  }

  function pin(toolPath) {
    const normalizedPath = String(toolPath || "").trim();
    if (!normalizedPath) throw new Error("Choose or paste a desktop tool path first.");
    if (!input.isAbsolutePath(normalizedPath)) throw new Error("Paste the absolute path before pinning this desktop tool.");
    if (!input.isSupportedPath(normalizedPath)) throw new Error("That file type is not supported for desktop tools.");
    const tools = read();
    if (!tools.some(tool => String(tool.path || "").toLowerCase() === normalizedPath.toLowerCase())) {
      tools.unshift({
        id: createId(),
        title: input.getToolName(normalizedPath),
        path: normalizedPath,
        pinnedAt: getTimestamp()
      });
    }
    const pinnedTools = tools.slice(0, maximumTools);
    write(pinnedTools);
    return pinnedTools;
  }

  function remove(toolId) {
    const remainingTools = read().filter(tool => tool.id !== toolId);
    write(remainingTools);
    return remainingTools;
  }

  return {pin, read, remove};
}
