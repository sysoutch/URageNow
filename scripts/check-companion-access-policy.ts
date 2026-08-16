import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "urage-companion-policy-"));
process.env.DASHBOARD_DATA_DIR = temporaryRoot;

try {
  const moduleUrl = pathToFileURL(path.resolve("dashboard/src/server/companion/companionAccessService.ts")).href;
  const access = await import(`${moduleUrl}?policy-test=${Date.now()}`);
  const pairing = access.getCompanionPairingPayload();
  assert.match(pairing.deepLink, /^urage:\/\/pair\?/);
  const credentials = await access.pairCompanionDevice(pairing.token, "Policy Test Device");
  let device = await access.authorizeCompanionToken(credentials.token);
  assert.ok(device);

  const initial = await access.getCompanionAccessPolicy();
  assert.equal(initial.defaults["media.list"], true);
  assert.equal(initial.defaults["media.delete"], false);
  assert.equal(initial.defaults["tools.browse"], false);
  assert.equal(initial.defaults["workflow.chat"], false);
  assert.equal(initial.defaults["workflow.image.generate"], false);
  assert.equal(initial.defaults["workflow.audio.generate"], false);
  assert.equal(initial.defaults["workflow.music.generate"], false);
  assert.equal(initial.defaults["workflow.video.generate"], false);
  assert.equal(initial.defaults["workflow.model3d.generate"], false);
  assert.equal(await access.companionDeviceCan(device, "media.delete"), false);

  await access.updateCompanionDefaultPermissions({...initial.defaults, "media.delete": true});
  assert.equal(await access.companionDeviceCan(device, "media.delete"), true);

  await access.updateCompanionDevicePermissions(device.id, {...initial.defaults, "media.delete": false});
  device = await access.authorizeCompanionToken(credentials.token);
  assert.ok(device);
  assert.equal(await access.companionDeviceCan(device, "media.delete"), false);

  await access.updateCompanionDevicePermissions(device.id, null);
  device = await access.authorizeCompanionToken(credentials.token);
  assert.ok(device);
  assert.equal(await access.companionDeviceCan(device, "media.delete"), true);
  const exported = await access.exportCompanionAccessPolicy();
  assert.equal(exported.schema, "urage-companion-access-policy");
  const imported = await access.importCompanionAccessPolicy({
    ...exported,
    defaults: {...initial.defaults, "media.delete": false}
  });
  assert.equal(imported.updatedDevices, 1);
  assert.equal((await access.getCompanionAccessPolicy()).defaults["media.delete"], false);
  assert.equal(await access.revokeCompanionDevice(device.id), true);
} finally {
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  if (!resolvedTemporaryRoot.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
    throw new Error("Refusing to remove a companion policy test directory outside the OS temp directory.");
  }
  await rm(resolvedTemporaryRoot, {recursive: true, force: true});
}

console.log("Companion access policy validation passed.");
