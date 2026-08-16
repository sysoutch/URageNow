import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  buildBambuStudioLaunchSpec,
  getModel3dPrintApplications,
  isBambuStudioSupportedModelPath
} from "../dashboard/src/server/resourceHub/model3dPrintApplicationManager.js";

const routeSource = await readFile(
  new URL("../dashboard/src/server/routes/resourceHubRoutes.ts", import.meta.url),
  "utf8"
);
const applicationManagerSource = await readFile(
  new URL("../dashboard/src/server/resourceHub/model3dPrintApplicationManager.ts", import.meta.url),
  "utf8"
);
assert.equal(routeSource.includes("readString(body.executablePath)"), false);
assert.match(applicationManagerSource, /workingDirectory:\s*launchSpec\.workingDirectory/);
assert.match(applicationManagerSource, /detached:\s*true/);
assert.match(applicationManagerSource, /stdio:\s*"ignore"/);
assert.match(applicationManagerSource, /getNativeApplicationPort/);
assert.equal(isBambuStudioSupportedModelPath("C:\\Models\\character.fbx"), true);
assert.equal(isBambuStudioSupportedModelPath("/home/dev/Models/character.FBX"), true);
assert.equal(isBambuStudioSupportedModelPath("/home/dev/Models/source.blend"), false);

const windowsApplications = getModel3dPrintApplications({
  platform: "win32",
  configuredBambuStudioPath: "C:\\Program Files\\Bambu Studio\\bambu-studio.exe",
  fileExists: candidate => candidate.endsWith("bambu-studio.exe")
});
assert.equal(windowsApplications[0]?.id, "bambu-studio");
assert.equal(windowsApplications[0]?.executableDetected, true);
assert.equal(
  windowsApplications[0]?.executablePath,
  "C:\\Program Files\\Bambu Studio\\bambu-studio.exe"
);

assert.deepEqual(
  buildBambuStudioLaunchSpec(
    "win32",
    "C:\\Program Files\\Bambu Studio\\bambu-studio.exe",
    "C:\\Models\\ashtray.stl"
  ),
  {
    command: "C:\\Program Files\\Bambu Studio\\bambu-studio.exe",
    args: ["C:\\Models\\ashtray.stl"],
    workingDirectory: "C:\\Program Files\\Bambu Studio"
  }
);
assert.deepEqual(
  buildBambuStudioLaunchSpec(
    "darwin",
    "/Applications/BambuStudio.app",
    "/Users/dev/Models/ashtray.stl"
  ),
  {
    command: "open",
    args: ["-a", "/Applications/BambuStudio.app", "/Users/dev/Models/ashtray.stl"],
    workingDirectory: "/Applications"
  }
);
assert.deepEqual(
  buildBambuStudioLaunchSpec(
    "linux",
    "/usr/bin/flatpak",
    "/home/dev/Models/ashtray.stl"
  ),
  {
    command: "/usr/bin/flatpak",
    args: ["run", "com.bambulab.BambuStudio", "/home/dev/Models/ashtray.stl"],
    workingDirectory: "/usr/bin"
  }
);
assert.deepEqual(
  buildBambuStudioLaunchSpec(
    "linux",
    "/opt/Bambu_Studio.AppImage",
    "/home/dev/Models/ashtray.stl"
  ),
  {
    command: "/opt/Bambu_Studio.AppImage",
    args: ["/home/dev/Models/ashtray.stl"],
    workingDirectory: "/opt"
  }
);

console.log("Model 3D print application validation passed.");
