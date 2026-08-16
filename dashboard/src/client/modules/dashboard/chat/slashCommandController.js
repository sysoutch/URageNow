function createDashboardChatSlashCommandController(input) {
  const request = typeof input?.request === "function" ? input.request : () => Promise.resolve({skills: []});
  let skills = [];
  let items = [];
  let activeIndex = 0;
  let mode = "commands";

  function getNodes() {
    return {
      prompt: document.getElementById("ask-prompt"),
      palette: document.getElementById("ask-slash-command-palette")
    };
  }

  function readTools() {
    const seen = new Set();
    return Array.from(document.querySelectorAll("[data-tools-tool][data-tools-src]"))
      .map(node => ({
        id: String(node.getAttribute("data-tools-tool") || "").trim(),
        title: String(node.getAttribute("data-tools-title") || "").trim() || "Tool",
        description: String(node.getAttribute("data-tools-description") || "").trim(),
        category: String(node.getAttribute("data-tools-category") || "").trim()
      }))
      .filter(tool => {
        if (!tool.id || seen.has(tool.id)) return false;
        seen.add(tool.id);
        return true;
      })
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  function close() {
    const {prompt, palette} = getNodes();
    palette?.classList.add("hidden");
    palette?.replaceChildren();
    prompt?.removeAttribute("aria-activedescendant");
    items = [];
    activeIndex = 0;
  }

  function commandItems(query) {
    const commands = [{
      key: "tools",
      label: "/tools",
      description: "Choose a local dashboard tool, then ask LazyDev to read and use its integration knowledge.",
      kind: "tools"
    }].concat(skills.map(skill => ({
      key: skill.id,
      label: "/" + skill.id,
      description: skill.description || skill.name || "Run Chat Studio skill.",
      kind: "skill"
    })));
    const normalized = String(query || "").toLowerCase();
    return commands.filter(command => !normalized || command.label.slice(1).includes(normalized)).slice(0, 14);
  }

  function toolItems(query) {
    const normalized = String(query || "").trim().toLowerCase();
    return readTools()
      .filter(tool => !normalized || [tool.title, tool.id, tool.category, tool.description].join(" ").toLowerCase().includes(normalized))
      .map(tool => ({
        key: tool.id,
        label: tool.title,
        description: [tool.category, tool.description].filter(Boolean).join(" · "),
        kind: "tool",
        tool
      }))
      .slice(0, 40);
  }

  function selectItem(item) {
    const {prompt} = getNodes();
    if (!prompt || !item) return;
    if (item.kind === "tools") {
      prompt.value = "/tools ";
      mode = "tools";
      render("");
      return;
    }
    if (item.kind === "tool") {
      prompt.value = `/skill read-tool-readme ${item.tool.title} (${item.tool.id}) `;
    } else {
      prompt.value = `/skill ${item.key} `;
    }
    close();
    prompt.focus();
    prompt.setSelectionRange(prompt.value.length, prompt.value.length);
    prompt.dispatchEvent(new Event("input", {bubbles: true}));
  }

  function render(query) {
    const {prompt, palette} = getNodes();
    if (!prompt || !palette) return;
    items = mode === "tools" ? toolItems(query) : commandItems(query);
    activeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
    palette.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "ask-slash-command-heading";
    heading.textContent = mode === "tools" ? "Choose a dashboard tool" : "Available commands";
    palette.appendChild(heading);
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ask-slash-command-empty";
      empty.textContent = mode === "tools" ? "No tools match this search." : "No commands match.";
      palette.appendChild(empty);
    }
    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.id = "ask-slash-command-option-" + index;
      button.className = "ask-slash-command-option" + (index === activeIndex ? " is-active" : "");
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
      const label = document.createElement("strong");
      label.textContent = item.label;
      const description = document.createElement("span");
      description.textContent = item.description;
      button.append(label, description);
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("click", () => selectItem(item));
      palette.appendChild(button);
    });
    palette.classList.remove("hidden");
    if (items.length > 0) prompt.setAttribute("aria-activedescendant", "ask-slash-command-option-" + activeIndex);
  }

  function syncFromPrompt() {
    const value = String(getNodes().prompt?.value || "");
    const toolMatch = value.match(/^\/tools(?:\s+(.*))?$/i);
    if (toolMatch) {
      mode = "tools";
      render(toolMatch[1] || "");
      return;
    }
    const commandMatch = value.match(/^\/([^\s]*)$/);
    if (commandMatch) {
      mode = "commands";
      render(commandMatch[1] || "");
      return;
    }
    close();
  }

  function moveActive(delta) {
    if (items.length === 0) return;
    activeIndex = (activeIndex + delta + items.length) % items.length;
    const query = mode === "tools"
      ? String(getNodes().prompt?.value || "").replace(/^\/tools\s*/i, "")
      : String(getNodes().prompt?.value || "").replace(/^\//, "");
    render(query);
    document.getElementById("ask-slash-command-option-" + activeIndex)?.scrollIntoView({block: "nearest"});
  }

  function bind() {
    const {prompt, palette} = getNodes();
    if (!prompt || !palette || prompt.dataset.slashCommandsBound === "true") return;
    prompt.dataset.slashCommandsBound = "true";
    prompt.addEventListener("input", syncFromPrompt);
    prompt.addEventListener("keydown", event => {
      if (palette.classList.contains("hidden")) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter" && !event.shiftKey && items[activeIndex]) {
        event.preventDefault();
        event.stopImmediatePropagation();
        selectItem(items[activeIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }, true);
    prompt.addEventListener("blur", () => window.setTimeout(close, 120));
    void request("/api/chat-skills").then(payload => {
      skills = Array.isArray(payload?.skills) ? payload.skills.filter(skill => skill?.id) : [];
      syncFromPrompt();
    }).catch(() => {
      skills = [];
    });
  }

  return {bind, close, readTools, syncFromPrompt};
}
