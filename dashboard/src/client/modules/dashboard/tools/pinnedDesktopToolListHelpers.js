function createDashboardPinnedDesktopToolListHelpers(input) {
  const createElement = typeof input.createElement === "function"
    ? input.createElement
    : tagName => document.createElement(tagName);
  const getList = typeof input.getList === "function"
    ? input.getList
    : () => document.querySelector("[data-desktop-tool-pinned-list]");

  function pin(toolPath) {
    input.store.pin(toolPath);
    render();
    input.setStatus("Desktop tool pinned.", "ok");
  }

  async function launch(toolPath) {
    const toolName = input.getToolName(toolPath);
    input.setStatus("Launching " + toolName + "...", "busy");
    await input.api.post("/api/desktop-tools/launch", {toolPath});
    input.setStatus("Launched " + toolName + ".", "ok");
  }

  function remove(toolId) {
    input.store.remove(toolId);
    render();
    input.setStatus("Desktop tool removed.", "ok");
  }

  function createCard(tool) {
    const card = createElement("article");
    card.className = "desktop-tool-card";
    const iconContainer = createElement("div");
    iconContainer.className = "desktop-tool-card-icon";
    const extension = input.getFileExtension(tool.path);

    if (extension && ["exe", "lnk"].includes(extension)) {
      try {
        const image = createElement("img");
        image.className = "desktop-tool-card-real-icon";
        image.alt = tool.title || input.getToolName(tool.path);
        image.src = "/api/desktop-tools/icon?path=" + encodeURIComponent(tool.path);
        image.addEventListener("error", () => {
          iconContainer.innerHTML = input.renderFileIcon(extension);
        });
        iconContainer.appendChild(image);
      } catch {
        iconContainer.innerHTML = input.renderFileIcon(extension);
      }
    } else if (extension) {
      iconContainer.innerHTML = input.renderFileIcon(extension);
    } else {
      iconContainer.textContent = (tool.title || "D").charAt(0).toUpperCase();
    }

    const copy = createElement("div");
    copy.className = "desktop-tool-card-copy";
    const title = createElement("h4");
    title.textContent = tool.title || input.getToolName(tool.path);
    const path = createElement("p");
    path.textContent = tool.path;
    copy.append(title, path);

    const actions = createElement("div");
    actions.className = "desktop-tool-card-actions";
    const launchButton = createElement("button");
    launchButton.className = "secondary";
    launchButton.type = "button";
    launchButton.textContent = "Launch";
    launchButton.addEventListener("click", () => {
      void launch(tool.path).catch(error => input.setStatus(error.message, "error"));
    });
    const removeButton = createElement("button");
    removeButton.className = "ghost";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => remove(tool.id));
    actions.append(launchButton, removeButton);
    card.append(iconContainer, copy, actions);
    return card;
  }

  function render() {
    const list = getList();
    if (!list) return false;
    list.innerHTML = "";
    const tools = input.store.read();
    if (tools.length === 0) {
      const empty = createElement("div");
      empty.className = "tools-workspace-empty desktop-tool-empty";
      empty.textContent = "No desktop tools pinned yet.";
      list.appendChild(empty);
      return true;
    }
    tools.forEach(tool => list.appendChild(createCard(tool)));
    return true;
  }

  return {pin, render};
}
