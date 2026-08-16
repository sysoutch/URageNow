type RemoteBrowserLoginPageOptions = {
  invalidToken: boolean;
  releaseLabel: string;
  androidCompanionGithubReleasesUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderRemoteBrowserLoginPage(options: RemoteBrowserLoginPageOptions): string {
  const warning = options.invalidToken
    ? '<p class="error">That access token was not accepted. Generate or copy a token from Settings &gt; Network on the dashboard PC.</p>'
    : "";
  const releaseLabel = escapeHtml(options.releaseLabel);
  const githubUrl = escapeHtml(options.androidCompanionGithubReleasesUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Connect to URage NOW</title>
  <style>
    :root{color-scheme:dark;font-family:system-ui,sans-serif;background:#090b12;color:#f7efff}
    body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;box-sizing:border-box}
    main{width:min(500px,100%);padding:28px;border:1px solid #75419b;border-radius:16px;background:#151927;box-shadow:0 24px 70px #0008}
    h1{margin:0 0 8px;font-size:1.55rem}p{color:#cfc3dc;line-height:1.5}.error{color:#ffb4c0}
    label{display:grid;gap:8px;margin-top:22px;font-weight:700}
    input,button{box-sizing:border-box;width:100%;min-height:46px;border-radius:8px;font:inherit}
    input{border:1px solid #5e516b;background:#090b12;color:#fff;padding:10px 12px}
    button{margin-top:12px;border:1px solid #bd68ed;background:#6d278f;color:#fff;font-weight:800;cursor:pointer}
    button.secondary{background:#202536;border-color:#665773}
    button:disabled{cursor:not-allowed;opacity:.55}
    small{display:block;margin-top:16px;color:#a99db5;line-height:1.45}
    .scanner{margin-top:12px;padding:12px;border:1px solid #4e405a;border-radius:10px;background:#0d101a}
    .scanner[hidden],video[hidden]{display:none}
    video{display:block;width:100%;max-height:320px;border-radius:8px;background:#05060a;object-fit:cover}
    .scanner-actions{display:flex;gap:8px}.scanner-actions button{width:auto;flex:1}
    .scanner-status{min-height:1.45em;margin:10px 0 0;color:#cfc3dc;font-size:.9rem}
    .camera-note{margin-top:9px}
    .alternatives{display:grid;grid-template-columns:88px 1fr;gap:8px 14px;align-items:center;margin-top:20px;padding-top:18px;border-top:1px solid #3d3347}
    .alternatives img{grid-row:1/4;width:88px;height:88px;background:#fff;border-radius:8px}
    .alternatives a{color:#e2a7ff}.version{color:#bdb0c8;font-size:.82rem}
    @media(max-width:420px){body{padding:12px}main{padding:20px}.alternatives{grid-template-columns:72px 1fr}.alternatives img{width:72px;height:72px}}
  </style>
</head>
<body><main>
  <h1>Connect to URage NOW</h1>
  <p>This dashboard accepts trusted LAN clients, but this browser has not authenticated yet.</p>
  ${warning}
  <form id="dashboard-login-form" action="/dashboard-login" method="post">
    <label>Dashboard access token<input id="dashboard-access-token" name="accessToken" type="password" autocomplete="current-password" required autofocus></label>
    <button type="submit">Connect</button>
    <button class="secondary" id="scan-token-qr-button" type="button">Scan Token QR With Camera</button>
  </form>
  <section class="scanner" id="token-qr-scanner" aria-label="Dashboard token QR scanner" hidden>
    <video id="token-qr-camera" playsinline muted hidden></video>
    <div class="scanner-actions"><button class="secondary" id="stop-token-qr-scan-button" type="button">Stop Camera</button></div>
    <p class="scanner-status" id="token-qr-scan-status" aria-live="polite"></p>
  </section>
  <small class="camera-note">Camera scanning requires HTTPS or localhost and a browser with native QR detection. You can always enter or paste the token manually.</small>
  <small>On the dashboard PC, open Settings &gt; Network &gt; Connection and choose Show Token QR. Treat that QR like a password.</small>
  <div class="alternatives">
    <img src="/android-companion/qr.svg" alt="QR code for the Android app download">
    <strong>Using Android instead?</strong>
    <a href="/android-companion">Download the Android app from this dashboard</a><span class="version">${releaseLabel}</span>
    <a href="${githubUrl}" target="_blank" rel="noopener noreferrer">Open GitHub releases fallback</a>
  </div>
  <script>
    (() => {
      const form = document.getElementById("dashboard-login-form");
      const tokenInput = document.getElementById("dashboard-access-token");
      const startButton = document.getElementById("scan-token-qr-button");
      const stopButton = document.getElementById("stop-token-qr-scan-button");
      const scanner = document.getElementById("token-qr-scanner");
      const video = document.getElementById("token-qr-camera");
      const status = document.getElementById("token-qr-scan-status");
      let stream = null;
      let animationFrame = 0;
      let scanning = false;

      const setStatus = message => {
        status.textContent = message;
        scanner.hidden = false;
      };
      const stopCamera = () => {
        scanning = false;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        if (stream) stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        video.hidden = true;
        startButton.disabled = false;
      };
      const describeCameraError = error => {
        if (error && error.name === "NotAllowedError") return "Camera permission was denied. Allow camera access in the browser or paste the token manually.";
        if (error && error.name === "NotFoundError") return "No camera was found on this device.";
        return error && error.message ? error.message : "The camera could not be started.";
      };
      const scanFrame = async detector => {
        if (!scanning) return;
        try {
          const results = await detector.detect(video);
          const token = String(results[0] && results[0].rawValue || "").trim();
          if (token) {
            tokenInput.value = token;
            stopCamera();
            setStatus("Token scanned. Connecting...");
            window.setTimeout(() => form.requestSubmit(), 180);
            return;
          }
        } catch {
          // A video frame can be unavailable while the camera is warming up.
        }
        animationFrame = requestAnimationFrame(() => void scanFrame(detector));
      };
      startButton.addEventListener("click", async () => {
        if (!window.isSecureContext) {
          setStatus("Camera access is blocked on ordinary LAN HTTP. Enable HTTPS for the dashboard or paste the token manually.");
          return;
        }
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
          setStatus("This browser does not expose camera access.");
          return;
        }
        if (typeof window.BarcodeDetector !== "function") {
          setStatus("This browser cannot detect QR codes natively. Use a current Chrome or Edge browser, or paste the token manually.");
          return;
        }
        startButton.disabled = true;
        setStatus("Requesting camera access...");
        try {
          const formats = typeof window.BarcodeDetector.getSupportedFormats === "function"
            ? await window.BarcodeDetector.getSupportedFormats()
            : ["qr_code"];
          if (!formats.includes("qr_code")) throw new Error("This browser camera does not support QR detection.");
          const detector = new window.BarcodeDetector({formats: ["qr_code"]});
          stream = await navigator.mediaDevices.getUserMedia({
            video: {facingMode: {ideal: "environment"}},
            audio: false
          });
          video.srcObject = stream;
          video.hidden = false;
          await video.play();
          scanning = true;
          setStatus("Point the camera at the Dashboard Access Token QR.");
          void scanFrame(detector);
        } catch (error) {
          stopCamera();
          setStatus(describeCameraError(error));
        }
      });
      stopButton.addEventListener("click", () => {
        stopCamera();
        setStatus("Camera stopped. You can restart scanning or enter the token manually.");
      });
      window.addEventListener("pagehide", stopCamera);
    })();
  </script>
</main></body></html>`;
}
