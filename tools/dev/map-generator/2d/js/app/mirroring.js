function setupSpriteUploads() {
  var list = document.getElementById("spriteUploadList");
  list.innerHTML = "";

  spriteTypes.forEach(function(type) {
    var row = document.createElement("div");
    row.className = "sprite-upload-row";

    var label = document.createElement("label");
    label.innerText = type.name;

    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = function() {
      replaceSpriteFromDisk(type.id, input.files[0]);
    };

    row.appendChild(label);
    row.appendChild(input);
    list.appendChild(row);
  });
}

function replaceSpriteFromDisk(typeId, file) {
  if (!file) {
    return;
  }

  var type = getSpriteType(typeId);
  if (!type) {
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    getSpriteImage(type).src = e.target.result;
    setTimeout(generateMap, 100);
  };
  reader.readAsDataURL(file);
}
window.replaceSpriteFromDisk = replaceSpriteFromDisk;

function replaceSpriteFromUrl(typeId, url) {
  if (!url) {
    return;
  }
  var type = getSpriteType(typeId);
  if (!type) {
    return;
  }
  getSpriteImage(type).src = url;
  setTimeout(generateMapIfReady, 50);
}
window.replaceSpriteFromUrl = replaceSpriteFromUrl;

function addSpriteTypeFromDisk() {
  var nameInput = document.getElementById("newSpriteName");
  var fileInput = document.getElementById("newSpriteFile");
  var name = nameInput.value.trim();
  var file = fileInput.files[0];

  if (!name || !file) {
    alert("Enter a sprite type name and choose an image file first.");
    return;
  }

  var id = slugify(name);
  if (!id) {
    alert("Use at least one letter or number in the sprite name.");
    return;
  }

  if (getSpriteType(id)) {
    alert("That sprite type already exists.");
    return;
  }

  var imageId = "sprite-" + id;
  var img = document.createElement("img");
  img.id = imageId;
  img.alt = name;
  img.style.display = "none";
  document.getElementById("hiddenAssets").appendChild(img);

  spriteTypes.push({
    id: id,
    name: name,
    imageId: imageId,
    role: "item",
    minPercent: 0,
    maxPercent: 5,
    confidence: 0.7,
    removable: true,
    placement: "surface",
    placeAboveSupport: true
  });

  replaceSpriteFromDisk(id, file);
  setupSpriteUploads();
  renderSpriteSettings();

  nameInput.value = "";
  fileInput.value = "";
}

function removeSpriteType(typeId) {
  var type = getSpriteType(typeId);
  if (!type || !type.removable) {
    return;
  }

  var img = getSpriteImage(type);
  if (img && img.parentNode) {
    img.parentNode.removeChild(img);
  }

  spriteTypes = spriteTypes.filter(function(item) {
    return item.id !== typeId;
  });

  setupSpriteUploads();
  renderSpriteSettings();
  generateMap();
}

function renderSpriteSettings() {
  var list = document.getElementById("spriteSettingsList");
  list.innerHTML = "";

  spriteTypes.forEach(function(type) {
    if (window.MapSpritePlacement) {
      window.MapSpritePlacement.normalizeType(type);
    }
    var card = document.createElement("div");
    card.className = "tool-card-wrap";
    card.dataset.spriteTypeId = type.id;
    card.innerHTML =
      '<div class="tool-card">' +
        '<div class="tool-card-header">' +
          '<button class="tool-card-toggle" type="button">' +
            '<div class="tool-card-header-left">' +
              '<img src="' + getSpriteImage(type).src + '" alt="">' +
              '<h3>' + type.name + '</h3>' +
            '</div>' +
            '<span class="tool-card-toggle-icon" aria-hidden="true">&#9662;</span>' +
          '</button>' +
          (type.removable ? '<button class="btn btn-sm btn-danger btn-icon" onclick="removeSpriteType(\'' + type.id + '\')"><i class="fas fa-trash"></i></button>' : '<span class="sprite-pill">core</span>') +
        '</div>' +
        '<div class="tool-card-body">' +
          '<div class="field-group">' +
            '<div class="field-label"><span>Amount</span><span><span id="' + type.id + '-min-label">' + type.minPercent + '</span>% - <span id="' + type.id + '-max-label">' + type.maxPercent + '</span>%</span></div>' +
            '<small class="field-help">Minimum and maximum amount this sprite should try to appear.</small>' +
            '<div class="field-row">' +
              '<input type="range" min="0" max="100" step="1" value="' + type.minPercent + '" oninput="setSpriteMin(\'' + type.id + '\', this.value)">' +
              '<span class="mini-value">Min</span>' +
            '</div>' +
            '<div class="field-row">' +
              '<input type="range" min="0" max="100" step="1" value="' + type.maxPercent + '" oninput="setSpriteMax(\'' + type.id + '\', this.value)">' +
              '<span class="mini-value">Max</span>' +
            '</div>' +
          '</div>' +
          '<div class="field-group">' +
            '<div class="field-label"><span>Confidence</span><span id="' + type.id + '-confidence-label">' + Math.round(type.confidence * 100) + '%</span></div>' +
            '<small class="field-help">Higher means the generator is stricter. Lower means it appears more often.</small>' +
            '<div class="field-row">' +
              '<input type="range" min="0" max="100" step="5" value="' + Math.round(type.confidence * 100) + '" oninput="setSpriteConfidence(\'' + type.id + '\', this.value)">' +
              '<span class="mini-value">%</span>' +
            '</div>' +
          '</div>' +
          (window.MapSpritePlacement ? window.MapSpritePlacement.buildPlacementControlsHtml(type) : '') +
        '</div>' +
      '</div>';

    list.appendChild(card);
  });

  initSpriteToolCards();
}

function setSpriteMin(typeId, value) {
  var type = getSpriteType(typeId);
  type.minPercent = Math.min(parseInt(value, 10), type.maxPercent);
  document.getElementById(type.id + "-min-label").innerText = type.minPercent;
  generateMapIfReady();
}

function setSpriteMax(typeId, value) {
  var type = getSpriteType(typeId);
  type.maxPercent = Math.max(parseInt(value, 10), type.minPercent);
  document.getElementById(type.id + "-max-label").innerText = type.maxPercent;
  generateMapIfReady();
}

function setSpriteConfidence(typeId, value) {
  var type = getSpriteType(typeId);
  type.confidence = parseInt(value, 10) / 100;
  document.getElementById(type.id + "-confidence-label").innerText = value + "%";
  generateMapIfReady();
}
