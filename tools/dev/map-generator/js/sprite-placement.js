(function() {
  var isoBehaviorOptions = [
    { value: "surface", label: "Fit To Iso Surface" },
    { value: "billboard", label: "Stand Upright" },
    { value: "flat", label: "Flat 2D" },
    { value: "hidden", label: "Hide In Iso" }
  ];

  var placementOptions = [
    { value: "anywhere", label: "Anywhere" },
    { value: "surface", label: "Surface Only" },
    { value: "platform", label: "Only On Platforms" },
    { value: "hole", label: "Only Inside Holes" },
    { value: "empty", label: "Only On Empty Tiles" }
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeHexColor(hex, fallback) {
    hex = String(hex || fallback || "#8fd36a").trim();
    if (hex.charAt(0) !== "#") return fallback || "#8fd36a";
    if (hex.length === 4) return "#" + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2) + hex.charAt(3) + hex.charAt(3);
    return hex.length === 7 ? hex : fallback || "#8fd36a";
  }

  function normalizeType(type) {
    if (!type) return type;
    if (!type.isoBehavior) type.isoBehavior = type.role === "platform" || type.role === "hole" ? "surface" : "billboard";
    if (typeof type.isoSurfaceScale !== "number") type.isoSurfaceScale = type.role === "item" ? 0.72 : 1;
    if (typeof type.isoWidthScale !== "number") type.isoWidthScale = 1;
    if (typeof type.isoHeightScale !== "number") type.isoHeightScale = 1;
    if (typeof type.isoCreateBlock !== "boolean") type.isoCreateBlock = false;
    if (typeof type.isoBlockHeightScale !== "number") type.isoBlockHeightScale = 1;
    if (typeof type.isoSolidSurface !== "boolean") type.isoSolidSurface = type.role !== "item" || type.isoCreateBlock;
    if (typeof type.isoUseCustomColor !== "boolean") type.isoUseCustomColor = false;
    if (typeof type.isoColor !== "string") type.isoColor = "";
    if (type.role !== "item") return type;
    if (!type.placement) type.placement = "surface";
    if (typeof type.placeAboveSupport !== "boolean") type.placeAboveSupport = true;
    return type;
  }

  function buildPlacementControlsHtml(type) {
    if (!type || type.role !== "item") return "";
    var options = placementOptions.map(function(option) {
      return "<option value=\"" + option.value + "\"" + (type.placement === option.value ? " selected" : "") + ">" + option.label + "</option>";
    }).join("");
    return ""
      + "<div class=\"field-group\">"
      + "<div class=\"field-label\"><span>Placement Rule</span><span>" + escapeHtml(readablePlacement(type.placement)) + "</span></div>"
      + "<small class=\"field-help\">Control whether this sprite appears on platform tops, holes, or free empty space.</small>"
      + "<div class=\"settings-grid\">"
      + "<label>Placement<select onchange=\"setSpritePlacementRule('" + escapeHtml(type.id) + "', this.value)\">" + options + "</select></label>"
      + "</div>"
      + "<label class=\"toggle-row\"><input type=\"checkbox\"" + (type.placeAboveSupport !== false ? " checked" : "") + " onchange=\"setSpritePlaceAboveSupport('" + escapeHtml(type.id) + "', this.checked)\"> Require visible support below</label>"
      + "</div>";
  }

  function buildIsoBehaviorControlsHtml(type) {
    if (!type) return "";
    normalizeType(type);
    var options = isoBehaviorOptions.map(function(option) {
      return "<option value=\"" + option.value + "\"" + (type.isoBehavior === option.value ? " selected" : "") + ">" + option.label + "</option>";
    }).join("");
    var color = normalizeHexColor(type.isoColor, "#8fd36a");
    var html = ""
      + "<div class=\"field-group\">"
      + "<div class=\"field-label\"><span>Isometric Render</span><span>" + escapeHtml(readableIsoBehavior(type.isoBehavior)) + "</span></div>"
      + "<small class=\"field-help\">Choose how this sprite is drawn in isometric mode. Solid colors can be sampled from the sprite or set manually.</small>"
      + "<div class=\"settings-grid\">"
      + "<label>Behavior<select onchange=\"setSpriteIsoBehavior('" + escapeHtml(type.id) + "', this.value)\">" + options + "</select></label>"
      + "<label>Surface Size<input type=\"range\" min=\"10\" max=\"140\" value=\"" + Math.round(type.isoSurfaceScale * 100) + "\" oninput=\"setSpriteIsoSurfaceScale('" + escapeHtml(type.id) + "', this.value)\"></label>"
      + "<label>Width Scale<input type=\"range\" min=\"10\" max=\"160\" value=\"" + Math.round(type.isoWidthScale * 100) + "\" oninput=\"setSpriteIsoWidthScale('" + escapeHtml(type.id) + "', this.value)\"></label>"
      + "<label>Height Scale<input type=\"range\" min=\"10\" max=\"160\" value=\"" + Math.round(type.isoHeightScale * 100) + "\" oninput=\"setSpriteIsoHeightScale('" + escapeHtml(type.id) + "', this.value)\"></label>"
      + "</div>"
      + "<label class=\"toggle-row\"><input type=\"checkbox\"" + (type.isoSolidSurface ? " checked" : "") + " onchange=\"setSpriteIsoSolidSurface('" + escapeHtml(type.id) + "', this.checked)\"> Use single-color isometric surface</label>"
      + "<label class=\"toggle-row\"><input type=\"checkbox\"" + (type.isoUseCustomColor ? " checked" : "") + " onchange=\"setSpriteIsoUseCustomColor('" + escapeHtml(type.id) + "', this.checked)\"> Override sampled color</label>"
      + "<div class=\"settings-grid\">"
      + "<label>Iso Color<input type=\"color\" value=\"" + color + "\" onchange=\"setSpriteIsoColor('" + escapeHtml(type.id) + "', this.value)\"></label>"
      + "</div>";
    if (type.role === "item") {
      html += ""
        + "<label class=\"toggle-row\"><input type=\"checkbox\"" + (type.isoCreateBlock ? " checked" : "") + " onchange=\"setSpriteIsoCreateBlock('" + escapeHtml(type.id) + "', this.checked)\"> Create isometric block underneath</label>"
        + "<div class=\"settings-grid\">"
        + "<label>Block Height<input type=\"range\" min=\"5\" max=\"250\" value=\"" + Math.round(type.isoBlockHeightScale * 100) + "\" oninput=\"setSpriteIsoBlockHeightScale('" + escapeHtml(type.id) + "', this.value)\"></label>"
        + "</div>";
    }
    return html + "</div>";
  }

  function readableIsoBehavior(value) {
    for (var i = 0; i < isoBehaviorOptions.length; i++) if (isoBehaviorOptions[i].value === value) return isoBehaviorOptions[i].label;
    return "Stand Upright";
  }

  function readablePlacement(value) {
    for (var i = 0; i < placementOptions.length; i++) if (placementOptions[i].value === value) return placementOptions[i].label;
    return "Anywhere";
  }

  function getCell(grid, row, col) {
    return grid[row] ? grid[row][col] : undefined;
  }

  function isEmptyTile(tileKind, itemId) {
    return (!tileKind || tileKind === "hole") && !itemId;
  }

  function canPlaceSprite(type, context) {
    var placement = type && type.placement || "anywhere";
    var targetTileKind = context.targetTileKind || "";
    var targetItemId = context.targetItemId || "";
    var supportTileKind = context.supportTileKind || "";
    var targetIsAboveSupport = context.aboveRowOffset > 0 ? context.targetRow > context.supportRow : context.targetRow < context.supportRow;
    if (targetItemId) return false;
    if (type && type.placeAboveSupport !== false && context.requiresVisibleSupport && !targetIsAboveSupport) return false;
    if (placement === "anywhere") return true;
    if (placement === "platform") return targetTileKind === "platform" || supportTileKind === "platform";
    if (placement === "hole") return targetTileKind === "hole";
    if (placement === "empty") return isEmptyTile(targetTileKind, targetItemId);
    if (placement === "surface") return supportTileKind === "platform";
    return true;
  }

  function resolveTarget(type, context) {
    var col = context.col;
    var supportRow = context.supportRow;
    var canPlaceAbove = !!context.canPlaceAbove;
    var aboveRowOffset = Number(context.aboveRowOffset) || -1;
    var targetRow = type && type.placeAboveSupport !== false && canPlaceAbove ? supportRow + aboveRowOffset : supportRow;
    return {
      col: col,
      supportRow: supportRow,
      targetRow: targetRow,
      supportTileKind: context.supportTileKindOverride || getCell(context.map, supportRow, col) || "",
      targetTileKind: context.targetTileKindOverride || getCell(context.map, targetRow, col) || "",
      targetItemId: getCell(context.items, targetRow, col) || "",
      requiresVisibleSupport: !!context.requiresVisibleSupport,
      aboveRowOffset: aboveRowOffset
    };
  }

  function pickSpriteForCell(context) {
    var itemTypes = (context.spriteTypes || []).filter(function(type) { return type.role === "item"; });
    for (var i = 0; i < itemTypes.length; i++) {
      var type = normalizeType(itemTypes[i]);
      if (!context.shouldPlace(type)) continue;
      var target = resolveTarget(type, context);
      if (!canPlaceSprite(type, target)) continue;
      return { type: type, targetRow: target.targetRow, targetCol: target.col };
    }
    return null;
  }

  function refreshIsoPreviewOnly() {
    if (typeof window.refreshIsometricPreviewOnly === "function") {
      window.refreshIsometricPreviewOnly();
      return;
    }
    if (typeof window.generateMapIfReady === "function") window.generateMapIfReady();
  }

  function refreshSettings() {
    if (typeof window.renderSpriteSettings === "function") window.renderSpriteSettings();
    refreshIsoPreviewOnly();
  }

  function refreshMapOnly() {
    refreshIsoPreviewOnly();
  }

  function setPlacement(typeId, value) {
    if (typeof window.getSpriteType !== "function") return;
    var type = window.getSpriteType(typeId);
    if (!type) return;
    type.placement = value || "surface";
    if (typeof window.renderSpriteSettings === "function") window.renderSpriteSettings();
    if (typeof window.generateMapIfReady === "function") window.generateMapIfReady();
  }

  function setIsoBehavior(typeId, value) {
    if (typeof window.getSpriteType !== "function") return;
    var type = window.getSpriteType(typeId);
    if (!type) return;
    type.isoBehavior = value || "billboard";
    refreshSettings();
  }

  function setIsoNumber(typeId, prop, value, fallback) {
    if (typeof window.getSpriteType !== "function") return;
    var type = window.getSpriteType(typeId);
    if (!type) return;
    type[prop] = Math.max(0.05, Number(value) / 100 || fallback);
    refreshMapOnly();
  }

  function setIsoCreateBlock(typeId, checked) {
    if (typeof window.getSpriteType !== "function") return;
    var type = window.getSpriteType(typeId);
    if (!type) return;
    type.isoCreateBlock = !!checked;
    if (type.isoCreateBlock) type.isoSolidSurface = true;
    refreshSettings();
  }

  function setIsoSolidSurface(typeId, checked) {
    if (typeof window.getSpriteType !== "function") return;
    var type = window.getSpriteType(typeId);
    if (!type) return;
    type.isoSolidSurface = !!checked;
    refreshSettings();
  }

  function setIsoUseCustomColor(typeId, checked) {
    if (typeof window.getSpriteType !== "function") return;
    var type = window.getSpriteType(typeId);
    if (!type) return;
    type.isoUseCustomColor = !!checked;
    refreshMapOnly();
  }

  function setIsoColor(typeId, value) {
    if (typeof window.getSpriteType !== "function") return;
    var type = window.getSpriteType(typeId);
    if (!type) return;
    type.isoColor = normalizeHexColor(value, "#8fd36a");
    type.isoUseCustomColor = true;
    refreshSettings();
  }

  function setPlaceAboveSupport(typeId, checked) {
    if (typeof window.getSpriteType !== "function") return;
    var type = window.getSpriteType(typeId);
    if (!type) return;
    type.placeAboveSupport = checked !== false;
    if (typeof window.renderSpriteSettings === "function") window.renderSpriteSettings();
    if (typeof window.generateMapIfReady === "function") window.generateMapIfReady();
  }

  window.setSpritePlacementRule = setPlacement;
  window.setSpriteIsoBehavior = setIsoBehavior;
  window.setSpritePlaceAboveSupport = setPlaceAboveSupport;
  window.setSpriteIsoSurfaceScale = function(typeId, value) { setIsoNumber(typeId, "isoSurfaceScale", value, 1); };
  window.setSpriteIsoWidthScale = function(typeId, value) { setIsoNumber(typeId, "isoWidthScale", value, 1); };
  window.setSpriteIsoHeightScale = function(typeId, value) { setIsoNumber(typeId, "isoHeightScale", value, 1); };
  window.setSpriteIsoBlockHeightScale = function(typeId, value) { setIsoNumber(typeId, "isoBlockHeightScale", value, 1); };
  window.setSpriteIsoCreateBlock = setIsoCreateBlock;
  window.setSpriteIsoSolidSurface = setIsoSolidSurface;
  window.setSpriteIsoUseCustomColor = setIsoUseCustomColor;
  window.setSpriteIsoColor = setIsoColor;
  window.MapSpritePlacement = {
    buildPlacementControlsHtml: buildPlacementControlsHtml,
    buildIsoBehaviorControlsHtml: buildIsoBehaviorControlsHtml,
    normalizeType: normalizeType,
    pickSpriteForCell: pickSpriteForCell,
    readablePlacement: readablePlacement,
    readableIsoBehavior: readableIsoBehavior
  };
})();
