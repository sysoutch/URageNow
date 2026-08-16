import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [configSource, rustSource, runtimeSource, packagerSource, chromeSource, pageSource, serverSource] = await Promise.all([
  readFile(path.join(repoRoot, "src-tauri", "tauri.conf.json"), "utf8"),
  readFile(path.join(repoRoot, "src-tauri", "src", "lib.rs"), "utf8"),
  readFile(path.join(repoRoot, "runtime", "dashboardRuntime.ts"), "utf8"),
  readFile(path.join(repoRoot, "scripts", "prepare-tauri-runtime.mjs"), "utf8"),
  readFile(path.join(repoRoot, "dashboard", "src", "client", "modules", "desktopWindowChrome.js"), "utf8"),
  readFile(path.join(repoRoot, "dashboard", "src", "page.ts"), "utf8"),
  readFile(path.join(repoRoot, "dashboard", "src", "server.ts"), "utf8")
]);
const config = JSON.parse(configSource);
const [bootstrapIconCss, bootstrapIconWoff2] = await Promise.all([
  readFile(path.join(repoRoot, "dashboard", "assets", "vendor", "bootstrap-icons", "bootstrap-icons.min.css")),
  readFile(path.join(repoRoot, "dashboard", "assets", "vendor", "bootstrap-icons", "fonts", "bootstrap-icons.woff2"))
]);

assert.equal(config.build.devUrl, "http://127.0.0.1:4782");
assert.equal(config.build.frontendDist, "http://127.0.0.1:4782");
assert.equal(config.bundle.windows.webviewInstallMode.type, "downloadBootstrapper");
assert.equal(config.bundle.windows.webviewInstallMode.silent, true);
assert.equal(config.app.windows[0].decorations, false);
assert.deepEqual(config.bundle.externalBin, [
  "binaries/urage-dashboard-runtime",
  "binaries/urage-native-application-broker"
]);
assert.equal(config.bundle.resources["runtime-bundle/"], "runtime-bundle/");

assert.match(rustSource, /thread::spawn\(move \|\| start_dashboard_runtime\(app_handle\)\)/);
assert.match(rustSource, /URAGE_STUDIO_REPO_ROOT/);
assert.match(rustSource, /runtime-bundle/);
assert.match(rustSource, /DASHBOARD_DATA_DIR/);
assert.match(rustSource, /URAGE_NATIVE_APPLICATION_BROKER_PATH/);
assert.match(rustSource, /find_packaged_native_application_broker/);
assert.match(rustSource, /window\s*\.navigate\(dashboard_url\)/);
assert.match(rustSource, /fn show_startup_error/);
assert.match(rustSource, /Command::new\("taskkill"\)/);
assert.match(rustSource, /TrayIconBuilder/);
for (const item of ["Open Dashboard", "Restart Runtime", "View Logs", "Quit"]) {
  assert.match(rustSource, new RegExp(item));
}
for (const command of ["desktop_minimize", "desktop_start_dragging", "desktop_toggle_maximize", "desktop_hide"]) {
  assert.match(rustSource, new RegExp(command));
  assert.match(chromeSource, new RegExp(command));
}
assert.match(chromeSource, /desktop-window-drag-region/);
assert.match(chromeSource, /pointerdown/);
assert.match(chromeSource, /dblclick/);
assert.match(rustSource, /window\.start_dragging\(\)/);
assert.match(pageSource, /\/assets\/vendor\/bootstrap-icons\/bootstrap-icons\.min\.css/);
assert.match(serverSource, /servesDashboardVendorAsset/);
assert.match(serverSource, /font\/woff2/);
assert.ok(bootstrapIconCss.length > 80_000);
assert.ok(bootstrapIconWoff2.length > 100_000);
assert.match(runtimeSource, /DISCORD_RUNTIME_AUTOSTART = "false"/);
assert.match(runtimeSource, /await import\("\.\.\/bots\/discord-bot\/src\/index\.js"\)/);
assert.match(packagerSource, /copyFileIfChanged\(process\.execPath/);
assert.match(packagerSource, /native-application-broker/);
assert.match(packagerSource, /npm\.cmd[\s\S]*ls[\s\S]*--omit=dev/);
assert.match(packagerSource, /dependencyBytes/);
assert.match(packagerSource, /runtime-manifest\.json/);
assert.doesNotMatch(rustSource, /\.setup\(\|app\| \{[\s\S]{0,300}wait_for_dashboard_runtime\(\)/);

console.log("Tauri shell configuration validation passed.");
