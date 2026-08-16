import { chromium } from "playwright";

const UNITY_PUBLISHER_SALE_URL = "https://assetstore.unity.com/publisher-sale";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export interface PublisherGiftResult {
  available: boolean;
  url?: string;
  couponCode?: string | null;
  reason?: string;
}

export async function fetchPublisherGift(): Promise<PublisherGiftResult> {
  // Launch a headless browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT
  });
  const page = await context.newPage();

  try {
    // 1. Navigate and wait for the network to settle
    await page.goto(UNITY_PUBLISHER_SALE_URL, { waitUntil: "networkidle" });

    // 2. Wait for either the page heading or a matching gift CTA.
    const giftButtonTextPattern = /get your (free )?gift/i;
    try {
      await Promise.race([
        page.waitForSelector('text=/Publisher of the week/i', { timeout: 10000 }),
        page.waitForSelector('text=/Get your (free )?gift/i', { timeout: 10000 })
      ]);
    } catch (e) {
      return { available: false, reason: "Gift page did not finish loading within 10 seconds." };
    }

    // 3. Extract the gift CTA link. Unity changes the wording between
    // "Get your gift" and "Get your free gift", so match both.
    const giftLinkElement = page.locator("a", { hasText: giftButtonTextPattern }).first();
    const href = await giftLinkElement.count() > 0 ? await giftLinkElement.getAttribute("href") : null;

    // 4. Extract the coupon code from the current promo copy.
    const bodyText = await page.innerText("body");
    const couponMatch = bodyText.match(/(?:enter\s+the\s+)?coupon code[:\s]+([A-Z0-9-]{5,})/i);

    if (!href && !couponMatch) {
      return { available: false, reason: "Page loaded but gift details are missing." };
    }

    return {
      available: true,
      url: href ? new URL(href, UNITY_PUBLISHER_SALE_URL).toString() : undefined,
      couponCode: couponMatch ? couponMatch[1] : null,
    };

  } catch (error) {
    return {
      available: false,
      reason: `Playwright error: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  } finally {
    await browser.close();
  }
}
