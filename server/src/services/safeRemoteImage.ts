import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REMOTE_IMAGE_BYTES = 20 * 1024 * 1024;
const REMOTE_IMAGE_TIMEOUT_MS = 30_000;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/avif", "image/bmp", "image/gif", "image/jpeg", "image/png", "image/tiff", "image/webp"
]);

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a = 0, b = 0] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19));
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0] || "";
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff")) return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1] || "") : false;
}

async function assertPublicDestination(url: URL): Promise<void> {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Private or local image destinations are not allowed.");
  }
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(entry => entry.family === 4 ? isPrivateIpv4(entry.address) : isPrivateIpv6(entry.address))) {
    throw new Error("Private or local image destinations are not allowed.");
  }
}

export async function fetchRemoteImage(urlValue: string): Promise<{ bytes: Buffer; mimeType: string }> {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error("Image URL is invalid.");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    throw new Error("Only credential-free HTTP(S) image URLs are allowed.");
  }
  await assertPublicDestination(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error(`Image fetch failed with status ${response.status}`);
    const mimeType = (response.headers.get("content-type") || "").split(";", 1)[0]?.trim().toLowerCase() || "";
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error("Remote source did not return a supported image content type.");
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error("Remote image exceeds the 20 MiB download limit.");
    }
    if (!response.body) throw new Error("Remote image response had no body.");
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of response.body) {
      if (controller.signal.aborted) throw new Error("Remote image download timed out.");
      const bytes = Buffer.from(chunk);
      totalBytes += bytes.length;
      if (totalBytes > MAX_REMOTE_IMAGE_BYTES) {
        controller.abort();
        throw new Error("Remote image exceeds the 20 MiB download limit.");
      }
      chunks.push(bytes);
    }
    if (controller.signal.aborted) throw new Error("Remote image download timed out.");
    return { bytes: Buffer.concat(chunks, totalBytes), mimeType };
  } catch (error) {
    if (controller.signal.aborted && !(error instanceof Error && error.message.includes("limit"))) {
      throw new Error("Remote image download timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
