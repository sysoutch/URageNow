import assert from "node:assert/strict";
import type { DashboardDependencies } from "@urage/shared/dashboard/types";
import { RuntimeState } from "@urage/server/runtime/runtimeState";
import { matchesDashboardClientAddress, startDashboardServer } from "@urage/dashboard/server";

assert.equal(matchesDashboardClientAddress("192.168.1.21", ["192.168.1.21"]), true);
assert.equal(matchesDashboardClientAddress("192.168.1.22", ["192.168.1.21"]), false);
assert.equal(matchesDashboardClientAddress("192.168.1.22", ["192.168.1.0/24"]), true);
assert.equal(matchesDashboardClientAddress("192.168.2.22", ["192.168.1.0/24"]), false);

const runtimeState = new RuntimeState();
const botSnapshot = {
  id: null,
  tag: null,
  avatarUrl: null,
  guildCount: 0,
  startedAt: new Date().toISOString(),
  dashboardPort: 0
};
const dependencies = {
  port: 0,
  host: "127.0.0.1",
  runtimeState,
  saveDashboardSettings: async () => {},
  setLlmConnectionSettings: () => {},
  getMessengerRuntimeSnapshot: () => ({runtimes: [], events: []}),
  controlMessengerRuntime: async () => {
    throw new Error("Messenger runtime control is unavailable in the dashboard smoke test.");
  },
  getBotSnapshot: () => botSnapshot
} as unknown as DashboardDependencies;
const server = startDashboardServer(dependencies);

try {
  await server.ready;
  const address = server.address();
  assert.ok(address);
  assert.ok(address.port > 0);
  const baseUrl = `http://${address.address}:${address.port}`;

  const rootResponse = await fetch(`${baseUrl}/`);
  assert.equal(rootResponse.status, 200);
  assert.match(rootResponse.headers.get("content-type") || "", /^text\/html/);
  assert.match(await rootResponse.text(), /URage NOW/);

  const androidPageResponse = await fetch(`${baseUrl}/android-companion`, {redirect: "manual"});
  assert.ok(androidPageResponse.status === 200 || androidPageResponse.status === 302);
  if (androidPageResponse.status === 200) {
    assert.match(androidPageResponse.headers.get("content-type") || "", /^text\/html/);
    const androidPage = await androidPageResponse.text();
    assert.match(androidPage, /Android Companion/);
    assert.match(androidPage, /Open GitHub releases fallback/);
    assert.match(androidPage, /https:\/\/github\.com\/sysoutch\/urage-now-android-companion\/releases\/latest/);
  } else {
    assert.equal(androidPageResponse.headers.get("location"), "https://github.com/sysoutch/urage-now-android-companion/releases/latest");
  }
  const androidQrResponse = await fetch(`${baseUrl}/android-companion/qr.svg`);
  assert.equal(androidQrResponse.status, 200);
  assert.match(androidQrResponse.headers.get("content-type") || "", /^image\/svg\+xml/);
  assert.match(await androidQrResponse.text(), /<svg/);

  const networkSettingsResponse = await fetch(`${baseUrl}/api/settings/network`);
  assert.equal(networkSettingsResponse.status, 200);
  const networkSettings = await networkSettingsResponse.json() as {
    mode?: string;
    checks?: Array<{id?: string; passed?: boolean}>;
    firewallCommands?: string[];
  };
  assert.ok(networkSettings.mode === "local" || networkSettings.mode === "lan");
  assert.ok(networkSettings.checks?.some(check => check.id === "listener"));
  assert.ok(networkSettings.firewallCommands?.some(command => command.includes("UDP localport=47820")));
  const accessTokenResponse = await fetch(`${baseUrl}/api/settings/network/access-token`, {method: "POST"});
  assert.ok(accessTokenResponse.status === 200 || accessTokenResponse.status === 404);
  if (accessTokenResponse.status === 200) {
    const tokenPayload = await accessTokenResponse.json() as {accessToken?: string};
    assert.ok((tokenPayload.accessToken || "").length >= 24);
  }
  const accessPolicyResponse = await fetch(`${baseUrl}/api/companion/access-policy`);
  assert.equal(accessPolicyResponse.status, 200);
  const accessPolicy = await accessPolicyResponse.json() as {defaults?: Record<string, boolean>; devices?: unknown[]};
  assert.equal(typeof accessPolicy.defaults?.["media.list"], "boolean");
  assert.equal(typeof accessPolicy.defaults?.["media.delete"], "boolean");
  assert.ok(Array.isArray(accessPolicy.devices));
  const pairingPayloadResponse = await fetch(`${baseUrl}/api/companion/pairing-payload`);
  assert.equal(pairingPayloadResponse.status, 200);
  const pairingPayload = await pairingPayloadResponse.json() as {deepLink?: string; token?: string};
  assert.match(pairingPayload.deepLink || "", /^urage:\/\/pair\?/);
  assert.ok((pairingPayload.token || "").length >= 32);
  const pairingQrResponse = await fetch(`${baseUrl}/api/companion/pairing-qr.svg`);
  assert.equal(pairingQrResponse.status, 200);
  assert.match(await pairingQrResponse.text(), /<svg/);
  const policyExportResponse = await fetch(`${baseUrl}/api/companion/access-policy/export`);
  assert.equal(policyExportResponse.status, 200);
  assert.equal((await policyExportResponse.json() as {schema?: string}).schema, "urage-companion-access-policy");
  const accessAuditResponse = await fetch(`${baseUrl}/api/companion/access-audit`);
  assert.equal(accessAuditResponse.status, 200);
  assert.ok(Array.isArray((await accessAuditResponse.json() as {entries?: unknown[]}).entries));

  const androidReleaseResponse = await fetch(`${baseUrl}/api/companion/android-release`);
  assert.ok(androidReleaseResponse.status === 200 || androidReleaseResponse.status === 404);
  if (androidReleaseResponse.status === 200) {
    const androidRelease = await androidReleaseResponse.json() as {versionName?: string; downloadUrl?: string};
    assert.match(androidRelease.versionName || "", /^\d+\.\d+\.\d+/);
    assert.equal(androidRelease.downloadUrl, "/downloads/android-companion");
    const androidDownloadResponse = await fetch(`${baseUrl}${androidRelease.downloadUrl}`);
    assert.equal(androidDownloadResponse.status, 200);
    assert.equal(androidDownloadResponse.headers.get("content-type"), "application/vnd.android.package-archive");
    assert.ok((await androidDownloadResponse.arrayBuffer()).byteLength > 0);
  }

  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {ok: true, service: "dashboard"});

  const readyResponse = await fetch(`${baseUrl}/ready`);
  assert.equal(readyResponse.status, 200);
  const readyPayload = await readyResponse.json() as {ok?: boolean; service?: string; degraded?: boolean; unavailableCapabilities?: string[]; checks?: {discord?: string; remoteWorker?: string; llm?: string; llmModel?: string; comfyUi?: string}};
  assert.equal(readyPayload.ok, true);
  assert.equal(readyPayload.service, "dashboard");
  assert.equal(typeof readyPayload.degraded, "boolean");
  assert.ok(Array.isArray(readyPayload.unavailableCapabilities));
  assert.ok(readyPayload.checks?.discord);
  assert.ok(readyPayload.checks?.remoteWorker);
  assert.ok(readyPayload.checks?.llm);
  assert.ok(readyPayload.checks?.llmModel);
  assert.ok(readyPayload.checks?.comfyUi);

  const generationJobsResponse = await fetch(`${baseUrl}/api/generation-jobs?limit=5`);
  assert.equal(generationJobsResponse.status, 200);
  assert.equal(Array.isArray(await generationJobsResponse.json()), true);

  const printApplicationsResponse = await fetch(`${baseUrl}/api/model3d/print-applications`);
  assert.equal(printApplicationsResponse.status, 200);
  const printApplicationsPayload = await printApplicationsResponse.json() as {
    platform?: string;
    applications?: Array<{id?: string; executablePath?: string}>;
  };
  assert.ok(printApplicationsPayload.platform);
  assert.equal(printApplicationsPayload.applications?.[0]?.id, "bambu-studio");
  assert.ok(printApplicationsPayload.applications?.[0]?.executablePath);

  const dashboardPageResponse = await fetch(baseUrl);
  assert.equal(dashboardPageResponse.status, 200);
  const dashboardPage = await dashboardPageResponse.text();
  assert.match(dashboardPage, /"three": "\/vendor\/three\/build\/three\.module\.js"/);
  assert.doesNotMatch(dashboardPage, /unpkg\.com\/three/);
  assert.match(dashboardPage, /\/assets\/vendor\/bootstrap-icons\/bootstrap-icons\.min\.css/);

  const threeModuleResponse = await fetch(`${baseUrl}/vendor/three/build/three.module.js`);
  assert.equal(threeModuleResponse.status, 200);
  assert.match(threeModuleResponse.headers.get("content-type") || "", /^application\/javascript/);
  assert.match(await threeModuleResponse.text(), /const REVISION = '170'/);

  const orbitControlsResponse = await fetch(`${baseUrl}/vendor/three/examples/jsm/controls/OrbitControls.js`);
  assert.equal(orbitControlsResponse.status, 200);
  assert.match(await orbitControlsResponse.text(), /from 'three'/);

  const bootstrapIconsResponse = await fetch(`${baseUrl}/assets/vendor/bootstrap-icons/bootstrap-icons.min.css`);
  assert.equal(bootstrapIconsResponse.status, 200);
  assert.match(bootstrapIconsResponse.headers.get("content-type") || "", /^text\/css/);
  assert.match(await bootstrapIconsResponse.text(), /bootstrap-icons\.woff2/);

  const bootstrapIconsFontResponse = await fetch(`${baseUrl}/assets/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2`);
  assert.equal(bootstrapIconsFontResponse.status, 200);
  assert.equal(bootstrapIconsFontResponse.headers.get("content-type"), "font/woff2");

  const stateResponse = await fetch(`${baseUrl}/api/state`);
  assert.equal(stateResponse.status, 200);
  const statePayload = await stateResponse.json() as {bot?: {guildCount?: number}};
  assert.equal(statePayload.bot?.guildCount, 0);

  const invalidRuntimeControlResponse = await fetch(`${baseUrl}/api/messenger-runtimes/control`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({messenger: "discord", action: "start", credentialSource: "manual", discordToken: ""})
  });
  assert.equal(invalidRuntimeControlResponse.status, 400);
  const invalidRuntimeControlPayload = await invalidRuntimeControlResponse.json() as {error?: string};
  assert.match(invalidRuntimeControlPayload.error || "", /Discord bot token is required/);

  const missingResponse = await fetch(`${baseUrl}/api/not-a-real-route`);
  assert.equal(missingResponse.status, 404);
} finally {
  await server.close();
}

console.log("Dashboard server route smoke validation passed.");
