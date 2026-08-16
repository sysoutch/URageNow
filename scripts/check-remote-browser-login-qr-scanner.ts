import assert from "node:assert/strict";
import {chromium} from "playwright";
import {renderRemoteBrowserLoginPage} from "@urage/dashboard/server/remoteBrowserLoginPage";

const html = renderRemoteBrowserLoginPage({
  invalidToken: false,
  releaseLabel: "Version 0.5.0 (6)",
  androidCompanionGithubReleasesUrl: "https://example.test/releases"
});
const browser = await chromium.launch({headless: true});

try {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.locator("#scan-token-qr-button").click();
  await assert.doesNotReject(async () => {
    await page.locator("#token-qr-scan-status").getByText(/Camera access is blocked/).waitFor();
  });

  await page.setContent(html);
  await page.addScriptTag({content: `
    Object.defineProperty(window, "isSecureContext", {value: true, configurable: true});
    Object.defineProperty(navigator, "mediaDevices", {
      value: {getUserMedia: async function () { return new MediaStream(); }},
      configurable: true
    });
    function MockBarcodeDetector() {}
    MockBarcodeDetector.getSupportedFormats = async function () { return ["qr_code"]; };
    MockBarcodeDetector.prototype.detect = async function () {
      return [{rawValue: "browser-camera-scanned-token"}];
    };
    Object.defineProperty(window, "BarcodeDetector", {value: MockBarcodeDetector, configurable: true});
    HTMLMediaElement.prototype.play = async function () {};
    document.querySelector("#dashboard-login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      document.body.dataset.submittedToken = document.querySelector("#dashboard-access-token").value;
    });
  `});
  await page.locator("#scan-token-qr-button").click();
  await page.waitForFunction(() => document.body.dataset.submittedToken === "browser-camera-scanned-token");
  assert.equal(await page.locator("#dashboard-access-token").inputValue(), "browser-camera-scanned-token");
  assert.match(await page.locator("#token-qr-scan-status").textContent() || "", /Token scanned/);
} finally {
  await browser.close();
}

console.log("Remote browser login QR scanner validation passed.");
