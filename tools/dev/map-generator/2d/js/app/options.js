function getDrawWidth(img) {
  return autoScaleSprites ? defaultSpriteWidth : img.width;
}

function getDrawHeight(img) {
  return autoScaleSprites ? defaultSpriteHeight : img.height;
}

function setDefaultSpriteSize() {
  defaultSpriteWidth = readNumber("defaultSpriteWidth", 64, 1);
  defaultSpriteHeight = readNumber("defaultSpriteHeight", 64, 1);
  generateMapIfReady();
}

function setAutoScaleSprites() {
  var input = document.getElementById("autoScaleSprites");
  autoScaleSprites = !input || input.checked;
  generateMapIfReady();
}

function applyPlatformSpriteSize() {
  var img = getSpriteImage(getSpriteType("platform"));
  if (!img || !img.width || !img.height) {
    return;
  }
  document.getElementById("defaultSpriteWidth").value = img.width;
  document.getElementById("defaultSpriteHeight").value = img.height;
  setDefaultSpriteSize();
}

function replaceBackgroundFromDisk(file, mode) {
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    setModeBackgroundSource(mode || getActiveBackgroundMode(), e.target.result, generateMapIfReady);
  };
  reader.readAsDataURL(file);
}

function replaceBackgroundFromUrl(url, mode) {
  if (!url) {
    return;
  }
  setModeBackgroundSource(mode || getActiveBackgroundMode(), url, generateMapIfReady);
}
window.replaceBackgroundFromUrl = replaceBackgroundFromUrl;
