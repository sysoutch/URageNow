function getSidebarSectionStorageKey(section) {
      return "mapGenerator.sidebar." + String(section && section.dataset.sidebarSection || "");
    }

    function setSidebarSectionCollapsed(section, collapsed) {
      if (!section) {
        return;
      }
      section.classList.toggle("collapsed", !!collapsed);
      var button = section.querySelector(".sidebar-section-toggle");
      if (button) {
        button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      }
      try {
        localStorage.setItem(getSidebarSectionStorageKey(section), collapsed ? "1" : "0");
      } catch (error) {}
    }

    function initSidebarSections() {
      var sections = Array.from(document.querySelectorAll(".side > .sprite-upload-panel, .mode-panel > .sprite-upload-panel"));
      sections.forEach(function(section, index) {
        var heading = section.querySelector(":scope > h5");
        if (!heading || section.dataset.sidebarEnhanced === "true") {
          return;
        }
        section.dataset.sidebarEnhanced = "true";
        section.dataset.sidebarSection = section.dataset.sidebarSection || ("section-" + index);
        section.classList.add("sidebar-section");

        var body = document.createElement("div");
        body.className = "sidebar-section-body";
        Array.from(section.children).forEach(function(child) {
          if (child !== heading) {
            body.appendChild(child);
          }
        });

        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "sidebar-section-toggle";
        toggle.innerHTML = "<span class='sidebar-section-toggle-text'><h5>" + heading.textContent + "</h5></span><span class='sidebar-section-toggle-icon' aria-hidden='true'>▾</span>";
        toggle.addEventListener("click", function() {
          setSidebarSectionCollapsed(section, !section.classList.contains("collapsed"));
        });

        section.innerHTML = "";
        section.appendChild(toggle);
        section.appendChild(body);

        var collapsed = false;
        try {
          collapsed = localStorage.getItem(getSidebarSectionStorageKey(section)) === "1";
        } catch (error) {}
        setSidebarSectionCollapsed(section, collapsed);
      });
    }

    function getSpriteToolCardStorageKey(typeId) {
      return "mapGenerator.spriteCard." + String(typeId || "");
    }

    function setSpriteToolCardCollapsed(card, collapsed) {
      if (!card) {
        return;
      }
      card.classList.toggle("collapsed", !!collapsed);
      var button = card.querySelector(".tool-card-toggle");
      if (button) {
        button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      }
      try {
        localStorage.setItem(getSpriteToolCardStorageKey(card.dataset.spriteTypeId), collapsed ? "1" : "0");
      } catch (error) {}
    }

    function initSpriteToolCards() {
      var cards = Array.from(document.querySelectorAll(".tool-card-wrap[data-sprite-type-id]"));
      cards.forEach(function(card) {
        var button = card.querySelector(".tool-card-toggle");
        if (!button || button.dataset.bound === "true") {
          return;
        }
        button.dataset.bound = "true";
        button.addEventListener("click", function() {
          setSpriteToolCardCollapsed(card, !card.classList.contains("collapsed"));
        });
        var collapsed = false;
        try {
          collapsed = localStorage.getItem(getSpriteToolCardStorageKey(card.dataset.spriteTypeId)) === "1";
        } catch (error) {}
        setSpriteToolCardCollapsed(card, collapsed);
      });
    }
