import { load } from "cheerio";

const HUMBLE_SOFTWARE_URL = "https://www.humblebundle.com/software";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export interface HumbleSoftwareBundle {
  title: string;
  url: string;
  description: string;
  highlights: string[];
  bundlesSold: number | null;
  endTimestamp: number | null;
}

function decodeHtmlFragment(input: string): string {
  const $ = load(`<div id="root">${input}</div>`);
  return $("#root").text().replace(/\s+/g, " ").trim();
}

function extractBalancedJson(source: string, marker: string): string | null {
  const start = source.indexOf(marker);
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

export async function fetchCurrentHumbleSoftwareBundles(): Promise<HumbleSoftwareBundle[]> {
  const response = await fetch(HUMBLE_SOFTWARE_URL, {
    headers: {
      "user-agent": USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Humble software page: ${response.status}`);
  }

  const html = await response.text();
  const jsonPayload = extractBalancedJson(html, "{\"userOptions\"");
  if (!jsonPayload) {
    throw new Error("Could not find embedded Humble software bundle data.");
  }

  const parsed = JSON.parse(jsonPayload) as {
    data?: {
      software?: {
        mosaic?: Array<{
          products?: Array<Record<string, unknown>>;
        }>;
      };
    };
  };

  const products = parsed.data?.software?.mosaic?.[0]?.products ?? [];
  return products.map(product => {
    const rawTitle = typeof product["tile_name"] === "string" ? product["tile_name"] : "Unknown bundle";
    const rawProductUrl = typeof product["product_url"] === "string" ? product["product_url"] : "";
    const rawDescription = typeof product["marketing_blurb"] === "string" ? product["marketing_blurb"] : "No description available.";
    const rawHighlights = Array.isArray(product["hover_highlights"]) ? product["hover_highlights"] : [];
    const rawSold = typeof product["bundles_sold|decimal"] === "number" ? product["bundles_sold|decimal"] : null;
    const rawEndDate = typeof product["end_date|datetime"] === "string" ? product["end_date|datetime"] : null;

    return {
      title: decodeHtmlFragment(rawTitle),
      url: new URL(rawProductUrl, HUMBLE_SOFTWARE_URL).toString(),
      description: decodeHtmlFragment(rawDescription),
      highlights: rawHighlights
        .filter((value): value is string => typeof value === "string")
        .map(value => decodeHtmlFragment(value)),
      bundlesSold: rawSold,
      endTimestamp: rawEndDate ? Math.floor(new Date(`${rawEndDate}Z`).getTime() / 1000) : null
    };
  });
}
