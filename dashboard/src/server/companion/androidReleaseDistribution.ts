import {createHash} from "node:crypto";
import {readFile, stat} from "node:fs/promises";
import path from "node:path";
import {appConfig} from "@urage/server/config/appConfig";

export type AndroidCompanionRelease = {
  versionName: string;
  versionCode: number;
  fileName: string;
  size: number;
  sha256: string;
  builtAt: string;
  filePath: string;
  artifacts: AndroidCompanionReleaseArtifact[];
};

export type AndroidCompanionReleaseArtifact = {
  type: "apk" | "aab";
  abi: string;
  fileName: string;
  size: number;
  sha256: string;
  filePath: string;
};

const releasesRoot = path.resolve(appConfig.dataDirectory, "android-releases");
const manifestPath = path.join(releasesRoot, "latest.json");
// The companion is released independently from the dashboard runtime.
export const androidCompanionGithubReleasesUrl = "https://github.com/sysoutch/urage-now-android-companion/releases/latest";

export async function readLatestAndroidCompanionRelease(): Promise<AndroidCompanionRelease | null> {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    const fileName = String(manifest.fileName || "");
    if (!/^urage-companion-v[0-9a-z.+-]+\.apk$/i.test(fileName)) return null;
    const filePath = path.resolve(releasesRoot, fileName);
    if (!filePath.startsWith(releasesRoot + path.sep)) return null;
    const details = await stat(filePath);
    const payload = await readFile(filePath);
    const actualSha256 = createHash("sha256").update(payload).digest("hex");
    if (actualSha256 !== String(manifest.sha256 || "").toLowerCase()) return null;
    const artifacts: AndroidCompanionReleaseArtifact[] = [];
    const manifestArtifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
    for (const rawArtifact of manifestArtifacts) {
      if (!rawArtifact || typeof rawArtifact !== "object") continue;
      const value = rawArtifact as Record<string, unknown>;
      const artifactName = String(value.fileName || "");
      const artifactType = value.type === "aab" ? "aab" : "apk";
      if (!/^urage-companion-v[0-9a-z.+-]+(?:-(?:universal|arm64-v8a|armeabi-v7a|x86_64))?\.(?:apk|aab)$/i.test(artifactName)) continue;
      const artifactPath = path.resolve(releasesRoot, artifactName);
      if (!artifactPath.startsWith(releasesRoot + path.sep)) continue;
      const artifactPayload = await readFile(artifactPath);
      const artifactSha256 = createHash("sha256").update(artifactPayload).digest("hex");
      if (artifactSha256 !== String(value.sha256 || "").toLowerCase()) continue;
      artifacts.push({
        type: artifactType,
        abi: String(value.abi || ""),
        fileName: artifactName,
        size: artifactPayload.length,
        sha256: artifactSha256,
        filePath: artifactPath
      });
    }
    const fallbackArtifact: AndroidCompanionReleaseArtifact = {
      type: "apk", abi: "universal", fileName, size: details.size,
      sha256: actualSha256, filePath
    };
    return {
      versionName: String(manifest.versionName || ""),
      versionCode: Number(manifest.versionCode || 0),
      fileName,
      size: details.size,
      sha256: String(manifest.sha256 || ""),
      builtAt: String(manifest.builtAt || ""),
      filePath,
      artifacts: artifacts.length > 0 ? artifacts : [fallbackArtifact]
    };
  } catch {
    return null;
  }
}

export function selectAndroidCompanionArtifact(
  release: AndroidCompanionRelease,
  requestedAbi: string
): AndroidCompanionReleaseArtifact {
  const normalized = String(requestedAbi || "").trim().toLowerCase();
  return release.artifacts.find(artifact => artifact.type === "apk" && artifact.abi.toLowerCase() === normalized)
    || release.artifacts.find(artifact => artifact.type === "apk" && artifact.abi === "universal")
    || release.artifacts.find(artifact => artifact.type === "apk")
    || {
      type: "apk", abi: "universal", fileName: release.fileName, size: release.size,
      sha256: release.sha256, filePath: release.filePath
    };
}

function escapeHtml(value: unknown): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderAndroidCompanionDownloadPage(release: AndroidCompanionRelease | null): string {
  const artifactMarkup = release
    ? release.artifacts.map(artifact => {
        const label = artifact.type === "aab"
          ? "Google Play bundle (AAB)"
          : artifact.abi === "arm64-v8a"
            ? "Modern Android phones (ARM64)"
            : artifact.abi === "armeabi-v7a"
              ? "Older 32-bit Android phones"
              : artifact.abi === "x86_64"
                ? "x86_64 emulators"
                : "Universal compatibility APK";
        const href = artifact.type === "aab"
          ? "/downloads/android-companion?abi=bundle"
          : `/downloads/android-companion?abi=${encodeURIComponent(artifact.abi)}`;
        return `<a class="artifact" href="${href}"><strong>${escapeHtml(label)}</strong><span>${(artifact.size / 1024 / 1024).toFixed(1)} MiB · ${escapeHtml(artifact.fileName)}</span></a>`;
      }).join("")
    : "";
  const releaseMarkup = release
    ? `<div class="release">
        <div><span>Version</span><strong>${escapeHtml(release.versionName)} (${release.versionCode})</strong></div>
        <div><span>Size</span><strong>${(release.size / 1024).toFixed(1)} KiB</strong></div>
        <div class="hash"><span>SHA-256</span><code>${escapeHtml(release.sha256)}</code></div>
      </div>
      <a class="download" href="/downloads/android-companion?abi=arm64-v8a">Download ARM64 APK (recommended)</a>
      <div class="artifacts">${artifactMarkup}</div>`
    : `<div class="notice">No signed dashboard release is available yet. Use the GitHub releases fallback below or run <code>npm run build:android-release</code> on the dashboard host.</div>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>URage Companion for Android</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top,#28153d,#090b12 58%);color:#f8efff;font:16px/1.5 system-ui,sans-serif}
    main{width:min(680px,100%);padding:28px;border:1px solid #71408f;border-radius:18px;background:#141824;box-shadow:0 28px 80px #0009}h1{margin:.2rem 0;font-size:clamp(2rem,7vw,3.3rem)}p{color:#cbbbd5}.kicker{color:#df8cff;font-weight:800;text-transform:uppercase;letter-spacing:.12em}
    .release{display:grid;gap:10px;margin:24px 0}.release>div{display:grid;gap:3px;padding:12px;border:1px solid #3e3150;border-radius:10px;background:#0d1018}.release span{color:#a99bb2;font-size:.8rem;text-transform:uppercase}.hash code{overflow-wrap:anywhere}
    .download{display:block;padding:14px 18px;border-radius:10px;background:#b853e8;color:white;text-align:center;text-decoration:none;font-weight:900}.artifacts{display:grid;gap:8px;margin-top:12px}.artifact{display:grid;padding:10px 12px;border:1px solid #3e3150;border-radius:9px;color:#f3dfff;text-decoration:none}.artifact span{color:#a99bb2;font-size:.82rem}.secondary{display:block;margin-top:10px;padding:11px;text-align:center;color:#e7b6ff}.qr{display:grid;grid-template-columns:112px 1fr;gap:16px;align-items:center;margin:20px 0;padding:14px;border:1px solid #3e3150;border-radius:12px;background:#fff;color:#25162f}.qr img{width:112px;height:112px}.qr strong{display:block}.qr span{font-size:.9rem}.notice{margin-top:22px;padding:14px;border:1px solid #805d32;border-radius:10px;background:#2b2115}.warning{margin-top:18px;font-size:.88rem;color:#d3c3dc}code{color:#f0b6ff}
  </style>
</head>
<body><main>
  <div class="kicker">URage NOW</div>
  <h1>Android Companion</h1>
  <p>Discover trusted LAN dashboards, pair a revocable device, and transfer images, audio, video, and 3D media.</p>
  ${releaseMarkup}
  <div class="qr"><img src="/android-companion/qr.svg" alt="QR code for this Android download page"><div><strong>Open on your phone</strong><span>Scan this code with the Android camera to download directly from this dashboard.</span></div></div>
  <a class="secondary" href="${escapeHtml(androidCompanionGithubReleasesUrl)}" target="_blank" rel="noopener noreferrer">Open GitHub releases fallback</a>
  <p class="warning">Install only on Android 10 or newer. Android may require permission to install apps from this browser. Verify the SHA-256 value after transferring the APK.</p>
  <a href="/">Return to dashboard</a>
</main></body></html>`;
}
