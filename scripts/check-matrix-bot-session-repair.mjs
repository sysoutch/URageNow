import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [repairPs1, repairCmd, showPs1, showCmd] = await Promise.all([
  readFile(new URL("./repair-matrix-bot-session.ps1", import.meta.url), "utf8"),
  readFile(new URL("./repair-matrix-bot-session.cmd", import.meta.url), "utf8"),
  readFile(new URL("./show-matrix-bot-token.ps1", import.meta.url), "utf8"),
  readFile(new URL("./show-matrix-bot-token.cmd", import.meta.url), "utf8")
]);

assert.match(repairPs1, /Read-Host \$Prompt -AsSecureString/);
assert.match(repairPs1, /RandomNumberGenerator\]::Create\(\)/);
assert.doesNotMatch(repairPs1, /RandomNumberGenerator\]::Fill/);
assert.match(repairPs1, /reset_password/);
assert.match(repairPs1, /logout_devices = \$true/);
assert.match(repairPs1, /_matrix\/client\/v3\/login/);
assert.match(repairPs1, /MATRIX_ACCESS_TOKEN" ""/);
assert.match(repairPs1, /MATRIX_STATE_DIRECTORY/);
assert.match(repairPs1, /matrix\.default\.access-token/);
assert.match(repairPs1, /run-matrix-runtime\.ps1/);
assert.match(repairPs1, /& \$runtimeControlPath -Action start/);
assert.match(repairCmd, /repair-matrix-bot-session\.ps1/);
assert.match(showPs1, /Type PRINT to display the Matrix bot token/);
assert.match(showPs1, /matrix\.default\.access-token/);
assert.match(showCmd, /show-matrix-bot-token\.ps1/);

console.log("Matrix bot session repair scripts validation passed.");
