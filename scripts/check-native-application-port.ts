import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  assertAllowlistedNativeApplicationRequest,
  isAllowlistedNativeApplicationExecutable
} from "../shared/src/runtime/nativeApplicationPort.js";

assert.equal(
  isAllowlistedNativeApplicationExecutable("bambu-studio", "C:\\Program Files\\Bambu Studio\\bambu-studio.exe", "win32"),
  true
);
assert.equal(
  isAllowlistedNativeApplicationExecutable("bambu-studio", "/opt/Bambu_Studio.AppImage", "linux"),
  true
);
assert.equal(
  isAllowlistedNativeApplicationExecutable("blender", "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe", "win32"),
  true
);
assert.equal(isAllowlistedNativeApplicationExecutable("blender", "powershell.exe", "win32"), false);
assert.throws(() => assertAllowlistedNativeApplicationRequest({
  applicationId: "bambu-studio",
  executablePath: "cmd.exe",
  args: ["/c", "anything"]
}, "win32"), /not allowlisted/);

const [blenderService, printManager, runtimeSource, typeScriptAdapter, rustAdapter, tauriSource, packagerSource] = await Promise.all([
  readFile(new URL("../shared/src/runtime/blenderOpenService.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/server/resourceHub/model3dPrintApplicationManager.ts", import.meta.url), "utf8"),
  readFile(new URL("../shared/src/runtime/nativeApplicationRuntime.ts", import.meta.url), "utf8"),
  readFile(new URL("../shared/src/runtime/typeScriptNativeApplicationAdapter.ts", import.meta.url), "utf8"),
  readFile(new URL("../shared/src/runtime/rustNativeApplicationAdapter.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8"),
  readFile(new URL("./prepare-tauri-runtime.mjs", import.meta.url), "utf8")
]);
assert.match(blenderService, /nativeApplicationPort\.launch/);
assert.doesNotMatch(blenderService, /spawn\(/);
assert.match(printManager, /getNativeApplicationPort\(\)\)\.launch/);
assert.doesNotMatch(printManager, /spawn\(/);
assert.match(runtimeSource, /process\.env\.URAGE_NATIVE_APPLICATION_BROKER_PATH/);
assert.doesNotMatch(runtimeSource, /target.*(?:debug|release)/s);
assert.match(typeScriptAdapter, /child\.once\("spawn"/);
assert.match(typeScriptAdapter, /shell:\s*false/);
assert.match(rustAdapter, /--application-id/);
assert.match(tauriSource, /URAGE_NATIVE_APPLICATION_BROKER_PATH/);
assert.match(packagerSource, /cargo[\s\S]*native-application-broker/);

console.log("Native application port validation passed.");
