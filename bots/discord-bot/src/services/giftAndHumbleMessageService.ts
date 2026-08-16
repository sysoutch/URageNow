import type { HumbleSoftwareBundle } from "./humbleSoftware.js";
import type { PublisherGiftResult } from "./unityPublisherGift.js";

type GiftAndHumbleMessageServiceDependencies = {
  humbleRoleId: string | null | undefined;
  fetchPublisherGift: () => Promise<PublisherGiftResult>;
  fetchCurrentHumbleSoftwareBundles: () => Promise<HumbleSoftwareBundle[]>;
};

export type GiftAndHumbleMessageService = {
  buildGiftMessage: () => Promise<string>;
  buildGiftMessageIfAvailable: () => Promise<string | null>;
  buildHumbleMessages: () => Promise<string[]>;
};

function formatGiftMessage(input: { url?: string; couponCode?: string | null; }): string {
  const url = String(input.url || "https://assetstore.unity.com/publisher-sale").trim() || "https://assetstore.unity.com/publisher-sale";
  const couponLine = input.couponCode ? `### Use coupon code: ${input.couponCode}` : "### No coupon code was detected on the page.";
  return [
    `## [Publisher of the Week Gift](${url})`,
    `@everyone A new Publisher of the Week gift is available!`,
    couponLine,
    `Get it here: ${url}`
  ].join("\n");
}

function formatBundleMessage(bundle: HumbleSoftwareBundle): string {
  const highlights = bundle.highlights.length > 0 ? bundle.highlights.join(" | ") : "Bundle details available on Humble Bundle";
  const sold = bundle.bundlesSold !== null ? `${bundle.bundlesSold.toLocaleString()} sold` : "Sales count unavailable";
  const ends = bundle.endTimestamp !== null ? `Ends <t:${bundle.endTimestamp}:R>` : "End time unavailable";
  return [
    `## [${bundle.title}](${bundle.url})`,
    `### ${bundle.description}`,
    `*${highlights} | ${sold} | ${ends}*`,
    `-> [Go to this bundle](${bundle.url})`
  ].join("\n");
}

export function createGiftAndHumbleMessageService(dependencies: GiftAndHumbleMessageServiceDependencies): GiftAndHumbleMessageService {
  async function buildGiftMessage(): Promise<string> {
    const gift = await dependencies.fetchPublisherGift();
    if (!gift.available) {
      return gift.reason ?? "No Publisher of the Week gift available right now.";
    }
    return formatGiftMessage(gift);
  }

  async function buildGiftMessageIfAvailable(): Promise<string | null> {
    const gift = await dependencies.fetchPublisherGift();
    if (!gift.available) {
      return null;
    }
    return formatGiftMessage(gift);
  }

  async function buildHumbleMessages(): Promise<string[]> {
    const bundles = await dependencies.fetchCurrentHumbleSoftwareBundles();
    const introLines = ["# [Software Bundles](https://www.humblebundle.com/software)"];
    if (dependencies.humbleRoleId) {
      introLines.push(`<@&${dependencies.humbleRoleId}>`);
    }
    const messages = [introLines.join("\n")];
    if (bundles.length === 0) {
      messages.push("No Humble software bundles were found.");
      return messages;
    }
    for (const bundle of bundles) {
      messages.push(formatBundleMessage(bundle));
    }
    messages.push("Alright, that's all so far. Come back later to see more.");
    return messages;
  }

  return {
    buildGiftMessage,
    buildGiftMessageIfAvailable,
    buildHumbleMessages
  };
}
