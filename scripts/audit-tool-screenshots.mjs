import {mkdir, readdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {chromium} from "playwright";

const baseUrl = String(process.argv[2] || "http://127.0.0.1:4782").replace(/\/+$/, "");
const reportRoot = path.resolve(process.argv[3] || "artifacts/tool-visual-qa", new Date().toISOString().replace(/[:.]/g, "-"));
const toolsRoot = path.resolve("tools");
const viewports = [
  {name: "phone", width: 390, height: 844, mobile: true},
  {name: "desktop", width: 1440, height: 960, mobile: false}
];

async function findTools() {
  const tools = [];
  for (const category of await readdir(toolsRoot, {withFileTypes: true})) {
    if (!category.isDirectory() || category.name === "shared" || category.name.startsWith(".")) continue;
    const categoryPath = path.join(toolsRoot, category.name);
    for (const entry of await readdir(categoryPath, {withFileTypes: true})) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const indexPath = path.join(categoryPath, entry.name, "index.html");
      try {
        const handle = await import("node:fs/promises");
        await handle.stat(indexPath);
        tools.push({category: category.name, slug: entry.name});
      } catch {}
    }
  }
  return tools.sort((left, right) => `${left.category}/${left.slug}`.localeCompare(`${right.category}/${right.slug}`));
}

const browser = await chromium.launch({headless: true});
const results = [];
await mkdir(reportRoot, {recursive: true});

try {
  for (const tool of await findTools()) {
    for (const viewport of viewports) {
      const page = await browser.newPage({viewport: {width: viewport.width, height: viewport.height}, isMobile: viewport.mobile, hasTouch: viewport.mobile});
      const consoleErrors = [];
      page.on("console", message => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      const label = `${tool.category}/${tool.slug}`;
      const screenshotPath = path.join(reportRoot, viewport.name, tool.category, `${tool.slug}.png`);
      const result = {tool: label, viewport: viewport.name, screenshot: path.relative(process.cwd(), screenshotPath), overflow: false, consoleErrors, error: ""};
      try {
        const toolUrl = `${baseUrl}/tools/${encodeURIComponent(tool.category)}/${encodeURIComponent(tool.slug)}/index.html`;
        let navigationError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            await page.goto(toolUrl, {waitUntil: "domcontentloaded", timeout: 20_000});
            navigationError = null;
            break;
          } catch (error) {
            navigationError = error;
            if (attempt === 0) await page.waitForTimeout(300);
          }
        }
        if (navigationError) throw navigationError;
        await page.waitForTimeout(450);
        result.overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        await mkdir(path.dirname(screenshotPath), {recursive: true});
        await page.screenshot({path: screenshotPath, fullPage: true});
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
      } finally {
        await page.close();
      }
      results.push(result);
      process.stdout.write(`${viewport.name} ${label}${result.error ? " FAILED" : result.overflow ? " OVERFLOW" : ""}\n`);
    }
  }
} finally {
  await browser.close();
}

const summary = {
  baseUrl,
  totalScreenshots: results.filter(result => !result.error).length,
  failures: results.filter(result => result.error),
  horizontalOverflow: results.filter(result => result.overflow),
  consoleErrors: results.filter(result => result.consoleErrors.length > 0),
  results
};
await writeFile(path.join(reportRoot, "report.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`Saved ${summary.totalScreenshots} screenshots to ${reportRoot}`);
console.log(`Failures: ${summary.failures.length}; overflow: ${summary.horizontalOverflow.length}; console errors: ${summary.consoleErrors.length}`);
if (summary.failures.length || summary.horizontalOverflow.length) process.exitCode = 1;
