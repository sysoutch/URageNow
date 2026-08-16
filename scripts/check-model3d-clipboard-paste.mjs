import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const [uiSource, bindingSource, pageSource] = await Promise.all([
  readFile(new URL("../dashboard/src/client/modules/dashboard/image/uiHelpers.js", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/client/modules/studioBootstrapBindingHelpers.js", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/pageSections/aiView.ts", import.meta.url), "utf8")
]);

assert.match(pageSource, /id="model3d-image-paste-button"[\s\S]*?<span>Paste<\/span>/);
assert.match(bindingSource, /wireModelImagePicker\([\s\S]*?"model3d-image-paste-button"\)/);
assert.match(uiSource, /navigator\.clipboard\.read\(\)/);

class TestFile {
  constructor(parts, name, options) {
    this.parts = parts;
    this.name = name;
    this.type = options.type;
  }
}
const imageBlob = {size: 42, type: "image/png"};
const context = vm.createContext({
  navigator: {
    clipboard: {
      read: async () => [{
        types: ["text/plain", "image/png"],
        getType: async type => type === "image/png" ? imageBlob : null
      }]
    }
  },
  File: TestFile
});
vm.runInContext(`${uiSource}\nthis.readClipboardImageFilesForTest = readClipboardImageFiles;`, context);
const files = await context.readClipboardImageFilesForTest();
assert.equal(files.length, 1);
assert.equal(files[0].name, "clipboard-model-source.png");
assert.equal(files[0].type, "image/png");

console.log("Model 3D clipboard paste validation passed.");
