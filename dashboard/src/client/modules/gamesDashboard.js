(() => {
  const status = document.getElementById("games-dashboard-status");
  const installedList = document.getElementById("games-installed-list");
  const availableList = document.getElementById("games-available-list");
  if (!status || !installedList || !availableList) return;

  const runtimes = document.body.dataset.dashboardScope === "discord"
    ? ["discord"] : ["discord", "telegram", "matrix", "whatsapp"];
  const runtimeLabels = { discord: "Discord", telegram: "Telegram", matrix: "Matrix", whatsapp: "WhatsApp" };
  const fileInput = document.getElementById("games-package-file");
  const importButton = document.getElementById("games-import-file-button");
  const refreshButton = document.getElementById("games-refresh-button");

  async function api(action, payload) {
    const response = await fetch("/api/games", {
      method: action ? "POST" : "GET",
      headers: action ? { "Content-Type": "application/json" } : undefined,
      body: action ? JSON.stringify({ action, ...payload }) : undefined
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Game request failed (${response.status}).`);
    return result;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, className, onClick) {
    const node = element("button", className, label);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function renderTypingEditor(game, configuration) {
    const editor = element("form", "games-config-editor");
    const title = element("h4", "", `${game.name} texts`);
    const help = element("p", "panel-subtitle", "Each text needs 20–100 words and at most 600 characters. The bot uses one text per round.");
    const modeLabel = element("label", "games-config-field", "Text order");
    const mode = element("select");
    for (const [value, label] of [["sequential", "In order (repeat from start)"], ["random", "Random (repeats possible)"], ["shuffle", "Shuffle (all texts before repeating)"]]) {
      const option = element("option", "", label);
      option.value = value;
      mode.append(option);
    }
    mode.value = configuration.textMode || "sequential";
    modeLabel.append(mode);
    const roundsLabel = element("label", "games-config-field", "Default rounds (1–10)");
    const rounds = element("input");
    rounds.type = "number";
    rounds.min = "1";
    rounds.max = "10";
    rounds.step = "1";
    rounds.value = String(configuration.rounds ?? 5);
    roundsLabel.append(rounds);
    const fields = element("div", "games-text-list");
    const formStatus = element("p", "hint");
    formStatus.setAttribute("role", "status");

    function refreshRows() {
      [...fields.children].forEach((row, index) => {
        row.querySelector("label").textContent = `Text ${index + 1}`;
        row.querySelector("textarea").setAttribute("aria-label", `Typing text ${index + 1}`);
        row.querySelector("button").disabled = fields.children.length === 1;
      });
    }

    function addText(value = "") {
      if (fields.children.length >= 30) {
        formStatus.textContent = "The limit is 30 texts per game.";
        return;
      }
      const row = element("div", "games-text-row");
      const label = element("label", "", "Text");
      const input = element("textarea");
      input.rows = 4;
      input.maxLength = 600;
      input.value = value;
      input.setAttribute("aria-label", `Typing text ${fields.children.length + 1}`);
      const remove = button("Remove", "secondary compact", () => {
        row.remove();
        refreshRows();
      });
      row.append(label, input, remove);
      fields.append(row);
      refreshRows();
      if (!value) input.focus();
    }

    const savedTexts = Array.isArray(configuration.texts) ? configuration.texts : [configuration.text || ""];
    savedTexts.forEach(text => addText(text));
    const actions = element("div", "games-config-actions");
    actions.append(button("Add text", "secondary", () => addText()), button("Save texts", "", () => editor.requestSubmit()));
    editor.append(title, help, modeLabel, roundsLabel, fields, actions, formStatus);
    editor.addEventListener("submit", async event => {
      event.preventDefault();
      const texts = [...fields.querySelectorAll("textarea")].map(input => input.value.trim());
      const invalidIndex = texts.findIndex(text => text.length > 600 || (text.match(/\S+/gu) || []).length < 20 || (text.match(/\S+/gu) || []).length > 100);
      if (invalidIndex >= 0) {
        formStatus.textContent = `Text ${invalidIndex + 1} must contain 20–100 words and at most 600 characters.`;
        return;
      }
      const roundCount = Number(rounds.value);
      if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 10) {
        formStatus.textContent = "Default rounds must be from 1 to 10.";
        return;
      }
      const updated = { ...configuration, rounds: roundCount, texts, textMode: mode.value };
      delete updated.text;
      const save = actions.lastElementChild;
      save.disabled = true;
      formStatus.textContent = "Saving texts…";
      try {
        await api("update-configuration", { gameId: game.id, configuration: updated });
        await load();
        status.textContent = `${game.name} texts saved. New games will use the updated rotation.`;
      } catch (error) {
        formStatus.textContent = error instanceof Error ? error.message : "Could not save game texts.";
        save.disabled = false;
      }
    });
    return editor;
  }

  // Mirror the server limits in server/src/services/games/racingRosterConfig.ts
  // so the dashboard editor rejects the same rows the store would refuse.
  const racingMinRacers = 3;
  const racingMaxRacers = 8;
  const racingMaxRosters = 10;


  function renderRacingEditor(game, configuration) {
    const editor = element("form", "games-config-editor");
    const title = element("h4", "", `${game.name} rosters`);
    const help = element("p", "panel-subtitle", "Each roster needs a species and 3-8 racers with a #rrggbb color and strength 1-10. The host chooses which species to race.");
    const modeLabel = element("label", "games-config-field", "Roster order");
    const mode = element("select");
    for (const [value, label] of [["sequential", "In order (repeat from start)"], ["random", "Random (repeats possible)"], ["shuffle", "Shuffle (all rosters before repeating)"]]) {
      const option = element("option", "", label);
      option.value = value;
      mode.append(option);
    }
    mode.value = ["sequential", "random", "shuffle"].includes(configuration.rosterMode) ? configuration.rosterMode : "sequential";
    modeLabel.append(mode);
    const roundsLabel = element("label", "games-config-field", "Default rounds (1-10)");
    const rounds = element("input");
    rounds.type = "number";
    rounds.min = "1";
    rounds.max = "10";
    rounds.step = "1";
    rounds.value = String(configuration.rounds ?? 3);
    roundsLabel.append(rounds);
    const feeLabel = element("label", "games-config-field", "House fee % (0-30)");
    const fee = element("input");
    fee.type = "number";
    fee.min = "0";
    fee.max = "30";
    fee.step = "1";
    fee.value = String(configuration.houseFee ?? 0);
    feeLabel.append(fee);
    const poolLabel = element("label", "games-config-field", "Bonus pool (0-100000)");
    const pool = element("input");
    pool.type = "number";
    pool.min = "0";
    pool.max = "100000";
    pool.step = "1";
    pool.value = String(configuration.bonusPool ?? 0);
    poolLabel.append(pool);
    const fields = element("div", "games-roster-list");
    const formStatus = element("p", "hint");
    formStatus.setAttribute("role", "status");

    function refreshRosterRows() {
      [...fields.children].forEach((row, index) => {
        row.querySelector("label").textContent = `Roster ${index + 1}`;
        row.querySelector("input").setAttribute("aria-label", `Roster ${index + 1} label`);
        row.lastElementChild.disabled = fields.children.length === 1;
        refreshRacerRows(row.querySelector(".games-roster-racers"));
      });
    }

    function refreshRacerRows(racers) {
      [...racers.children].forEach((row, index) => {
        row.querySelector("label").textContent = `Racer ${index + 1}`;
        [...row.querySelectorAll("input")].forEach((input, field) => {
          input.setAttribute("aria-label", `Racer ${index + 1} ${["name", "color", "strength"][field]}`);
        });
        row.querySelector("button").disabled = racers.children.length === racingMinRacers;
      });
    }

    function addRacer(row, name = "", color = "", power = "") {
      const racers = row.querySelector(".games-roster-racers");
      if (racers.children.length >= racingMaxRacers) {
        formStatus.textContent = "The limit is 8 racers per roster.";
        return;
      }
      const racerRow = element("div", "games-racer-row");
      const label = element("label", "", "Racer");
      const nameInput = element("input", "games-racer-name");
      nameInput.type = "text";
      nameInput.maxLength = 24;
      nameInput.value = name;
      const colorInput = element("input", "games-racer-color");
      colorInput.type = "text";
      colorInput.maxLength = 7;
      colorInput.value = color;
      const powerInput = element("input", "games-racer-power");
      powerInput.type = "number";
      powerInput.min = "1";
      powerInput.max = "10";
      powerInput.step = "0.1";
      powerInput.value = String(power);
      const remove = button("Remove", "secondary compact", () => {
        racerRow.remove();
        refreshRosterRows();
      });
      racerRow.append(label, nameInput, colorInput, powerInput, remove);
      racers.append(racerRow);
      refreshRosterRows();
      if (!name) nameInput.focus();
    }

    function addRoster(label = "", species = "horse") {
      if (fields.children.length >= racingMaxRosters) {
        formStatus.textContent = "The limit is 10 rosters per game.";
        return null;
      }
      const row = element("div", "games-roster-row");
      const name = element("label", "", "Roster");
      const labelInput = element("input", "games-roster-label");
      labelInput.type = "text";
      labelInput.maxLength = 24;
      labelInput.value = label;
      const speciesLabel = element("label", "games-config-field", "Racer species");
      const speciesSelect = element("select", "games-roster-species");
      for (const [value, text] of [["horse", "Horse"], ["penguin", "Penguin"], ["emu", "Emu"]]) {
        const option = element("option", "", text);
        option.value = value;
        speciesSelect.append(option);
      }
      speciesSelect.value = ["horse", "penguin", "emu"].includes(species) ? species : "horse";
      speciesLabel.append(speciesSelect);
      const racers = element("div", "games-roster-racers");
      const addRacerButton = button("Add racer", "secondary compact", () => addRacer(row));
      const remove = button("Remove", "secondary compact", () => {
        row.remove();
        refreshRosterRows();
      });
      row.append(name, labelInput, speciesLabel, racers, addRacerButton, remove);
      fields.append(row);
      refreshRosterRows();
      if (!label) labelInput.focus();
      return row;
    }

    const savedRosters = Array.isArray(configuration.rosters) ? configuration.rosters : [];
    savedRosters.forEach(roster => {
      const inferredSpecies = typeof roster.species === "string"
        ? roster.species
        : /penguin/i.test(roster.label || "") ? "penguin" : /emu/i.test(roster.label || "") ? "emu" : "horse";
      const row = addRoster(typeof roster.label === "string" ? roster.label : "", inferredSpecies);
      if (!row) return;
      const racers = Array.isArray(roster.racers) ? roster.racers : [];
      racers.forEach(racer => addRacer(
        row,
        typeof racer.name === "string" ? racer.name : "",
        typeof racer.color === "string" ? racer.color : "",
        typeof racer.power === "number" ? String(racer.power) : ""
      ));
    });
    if (!fields.children.length) addRoster("Roster 1");

    const actions = element("div", "games-config-actions");
    actions.append(button("Add roster", "secondary", () => addRoster()), button("Save rosters", "", () => editor.requestSubmit()));
    editor.append(title, help, modeLabel, roundsLabel, feeLabel, poolLabel, fields, actions, formStatus);
    editor.addEventListener("submit", async event => {
      event.preventDefault();
      const rosterMode = mode.value;
      if (rosterMode !== "sequential" && rosterMode !== "random" && rosterMode !== "shuffle") {
        formStatus.textContent = "Roster mode must be sequential, random, or shuffle.";
        return;
      }
      const roundCount = Number(rounds.value);
      if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 10) {
        formStatus.textContent = "Default rounds must be from 1 to 10.";
        return;
      }
      const houseFee = Number(fee.value);
      if (!Number.isInteger(houseFee) || houseFee < 0 || houseFee > 30) {
        formStatus.textContent = "House fee must be a whole percent from 0 to 30.";
        return;
      }
      const bonusPool = Number(pool.value);
      if (!Number.isInteger(bonusPool) || bonusPool < 0 || bonusPool > 100000) {
        formStatus.textContent = "Bonus pool must be a whole number of credits from 0 to 100000.";
        return;
      }
      const rosters = [...fields.children].map(row => ({
        label: row.querySelector("input").value.trim(),
        species: row.querySelector(".games-roster-species").value,
        racers: [...row.querySelector(".games-roster-racers").children].map(racerRow => {
          const inputs = [...racerRow.querySelectorAll("input")];
          return { name: inputs[0].value.trim(), color: inputs[1].value.trim(), power: Number(inputs[2].value) };
        })
      }));
      const invalidRoster = rosters.findIndex(roster => !roster.label
        || roster.label.length > 24
        || roster.racers.length < racingMinRacers
        || roster.racers.length > racingMaxRacers);
      if (invalidRoster >= 0) {
        formStatus.textContent = `Roster ${invalidRoster + 1} needs a label and 3-8 racers.`;
        return;
      }
      const invalidRacer = rosters.findIndex(roster => roster.racers.some(racer => !racer.name
        || racer.name.length > 24
        || !/^#[0-9a-f]{6}$/i.test(racer.color)
        || !Number.isFinite(racer.power)
        || racer.power < 1
        || racer.power > 10));
      if (invalidRacer >= 0) {
        formStatus.textContent = `Roster ${invalidRacer + 1} has a racer missing a name, a #rrggbb color, or a strength from 1 to 10.`;
        return;
      }
      const updated = { ...configuration, rounds: roundCount, rosterMode, houseFee, bonusPool, rosters };
      const save = actions.lastElementChild;
      save.disabled = true;
      formStatus.textContent = "Saving rosters...";
      try {
        await api("update-configuration", { gameId: game.id, configuration: updated });
        await load();
        status.textContent = `${game.name} rosters saved. New games will use the updated roster rotation.`;
      } catch (error) {
        formStatus.textContent = error instanceof Error ? error.message : "Could not save game rosters.";
        save.disabled = false;
      }
    });
    return editor;
  }

  function renderPackage(game, imported) {
    const card = element("article", "games-package-card");
    const copy = element("div", "games-package-copy");
    const heading = element("div", "games-package-heading");
    heading.append(element("strong", "", game.name), element("span", "chip", `v${game.version}`));
    copy.append(heading, element("p", "panel-subtitle", game.description || "No description."));
    card.append(copy);
    if (imported) {
      const runtimeControls = element("div", "games-runtime-controls");
      for (const runtime of runtimes) {
        const supported = game.runtimes.includes(runtime);
        const enabled = game.enabledRuntimes.includes(runtime);
        runtimeControls.append(button(
          `${runtimeLabels[runtime]}: ${enabled ? "Enabled" : supported ? "Disabled" : "Unsupported"}`,
          `secondary compact${enabled ? " is-enabled" : ""}`,
          async event => {
            const control = event.currentTarget;
            control.disabled = true;
            try {
              await api(enabled ? "disable" : "enable", { gameId: game.id, runtime });
              await load();
            } catch (error) {
              status.textContent = error instanceof Error ? error.message : "Failed to change game runtime state.";
            } finally {
              control.disabled = false;
            }
          }
        ));
        runtimeControls.lastElementChild.disabled = !supported;
      }
      card.append(runtimeControls);
      const editorRenderer = game.gameType === "typing-speed" ? renderTypingEditor
        : game.gameType === "animal-racing" ? renderRacingEditor : null;
      if (editorRenderer) {
        const editorNoun = game.gameType === "typing-speed" ? "texts" : "rosters";
        let editor;
        card.append(button(`Edit ${editorNoun}`, "secondary", async event => {
          if (editor) {
            editor.remove();
            editor = null;
            return;
          }
          const control = event.currentTarget;
          control.disabled = true;
          try {
            const result = await api("get-configuration", { gameId: game.id });
            editor = editorRenderer(game, result.configuration);
            card.append(editor);
          } catch (error) {
            status.textContent = error instanceof Error ? error.message : `Could not load game ${editorNoun}.`;
          } finally {
            control.disabled = false;
          }
        }));
      }
      card.append(button("Delete", "secondary danger", async event => {
        if (!window.confirm(`Delete ${game.name} from the runtime catalog?`)) return;
        event.currentTarget.disabled = true;
        try {
          await api("delete", { gameId: game.id });
          status.textContent = `${game.name} deleted.`;
          await load();
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : "Failed to delete game.";
          event.currentTarget.disabled = false;
        }
      }));
    } else {
      card.append(button("Import", "secondary", async event => {
        event.currentTarget.disabled = true;
        try {
          await api("import-bundled", { gameId: game.id });
          status.textContent = `${game.name} imported. Enable it for Discord to make it playable.`;
          await load();
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : "Failed to import game package.";
          event.currentTarget.disabled = false;
        }
      }));
    }
    return card;
  }

  async function load() {
    status.textContent = "Loading game packages…";
    try {
      const catalog = await api(null);
      installedList.replaceChildren(...catalog.installed.map(game => renderPackage(game, true)));
      availableList.replaceChildren(...catalog.available.map(game => renderPackage(game, false)));
      document.getElementById("games-installed-count").textContent = String(catalog.installed.length);
      document.getElementById("games-available-count").textContent = String(catalog.available.length);
      if (!catalog.installed.length) installedList.append(element("p", "panel-subtitle", "No games installed. Import a package to get started."));
      if (!catalog.available.length) availableList.append(element("p", "panel-subtitle", "No bundled packages are available."));
      status.textContent = "Game catalog is up to date.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Failed to load game catalog.";
    }
  }

  importButton?.addEventListener("click", async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      status.textContent = "Choose a .uragegame.json package file first.";
      return;
    }
    importButton.disabled = true;
    try {
      const gamePackage = JSON.parse(await file.text());
      await api("import-package", { gamePackage });
      fileInput.value = "";
      status.textContent = "Package imported. Enable it for a compatible runtime to make it playable.";
      await load();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Package import failed.";
    } finally {
      importButton.disabled = false;
    }
  });
  refreshButton?.addEventListener("click", load);
  load();
})();
