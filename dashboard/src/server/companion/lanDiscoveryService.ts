import dgram from "node:dgram";

const discoveryPort = 47820;
const probe = "URAGE_STUDIO_DISCOVER_V1";

export type LanDiscoveryHandle = { close: () => Promise<void> };

export type CompanionDiscoveryAdvertisement = {
  baseUrl: string;
  certificateSha256?: string;
  name?: string;
};

function resolveAdvertisedBaseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
      return "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export async function startLanDiscoveryService(httpPort: number, advertisement?: CompanionDiscoveryAdvertisement): Promise<LanDiscoveryHandle> {
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  socket.on("message", (message, remote) => {
    if (message.toString("utf8").trim() !== probe) return;
    const baseUrl = resolveAdvertisedBaseUrl(String(advertisement?.baseUrl || ""));
    const response = Buffer.from(JSON.stringify({
      protocol: 3,
      name: advertisement?.name || "URage NOW",
      port: httpPort,
      baseUrl: baseUrl || undefined,
      secure: baseUrl.startsWith("https://"),
      certificateSha256: String(advertisement?.certificateSha256 || "").trim() || undefined
    }), "utf8");
    socket.send(response, remote.port, remote.address);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("error", reject);
    socket.bind(discoveryPort, "0.0.0.0", () => {
      socket.off("error", reject);
      socket.setBroadcast(true);
      resolve();
    });
  });
  return {
    close: () => new Promise(resolve => socket.close(() => resolve()))
  };
}

export const companionDiscoveryPort = discoveryPort;
export const companionDiscoveryProbe = probe;
