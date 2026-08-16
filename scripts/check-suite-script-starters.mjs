import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suites = [
  {directory: "maya-scripts", suite: "maya", extensions: [".py"]},
  {directory: "3dsmax-scripts", suite: "3dsmax", extensions: [".ms"]},
  {directory: "houdini-scripts", suite: "houdini", extensions: [".py"]},
  {directory: "cinema4d-scripts", suite: "cinema4d", extensions: [".py"]}
];

for (const expected of suites) {
  const directory = path.join(root, expected.directory);
  assert.ok(existsSync(path.join(directory, "README.md")), `${expected.directory} needs a README.`);
  const catalog = JSON.parse(readFileSync(path.join(directory, "catalog.json"), "utf8"));
  assert.equal(catalog.suite, expected.suite);
  assert.equal(catalog.scripts.length, 3, `${expected.directory} needs three focused starter scripts.`);
  for (const entry of catalog.scripts) {
    assert.ok(expected.extensions.some(extension => entry.path.endsWith(extension)), `${entry.path} has the wrong native extension.`);
    assert.ok(existsSync(path.join(directory, entry.path)), `${entry.path} is missing.`);
  }
}

console.log("3D suite starter script catalog validation passed.");
