import { chromium } from "playwright";

const URL = "http://127.0.0.1:4782/";

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`Navigating to ${URL} ...`);
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Step 1: Check body classes and current view
  const bodyInfo = await page.evaluate(() => ({
    bodyClasses: document.body.className,
    bodyAttributeClass: document.body.getAttribute("class"),
    dashboardTheme: document.body.getAttribute("data-dashboard-theme"),
    railExpanded: document.body.classList.contains("studio-rail-expanded"),
    activeViewPanel: document.querySelector('[data-view-panel].active')?.getAttribute("data-view-panel") || "none",
  }));

  console.log("\n=== BODY STATE ===");
  console.log("Body class:", bodyInfo.bodyClasses);
  console.log("data-dashboard-theme:", bodyInfo.dashboardTheme);
  console.log("studio-rail-expanded:", bodyInfo.railExpanded);
  console.log("active view-panel:", bodyInfo.activeViewPanel);

  // Step 2: Check rail expand button visibility
  const expandButton = await page.$("#rail-workflow-expand-button");
  if (!expandButton) {
    console.log("\n❌ #rail-workflow-expand-button NOT FOUND in DOM!");
  } else {
    const buttonStyle = await page.evaluate(() => {
      const btn = document.getElementById("rail-workflow-expand-button");
      const cs = window.getComputedStyle(btn);
      return {
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        hidden: btn.hidden,
        parentDisplay: btn.parentElement ? window.getComputedStyle(btn.parentElement).display : "no parent",
      };
    });
    console.log("\n=== EXPAND BUTTON ===");
    console.log("Button style:", JSON.stringify(buttonStyle, null, 2));
  }

  // Step 3: Navigate to tools view and check
  console.log("\n=== SWITCHING TO TOOLS VIEW ===");
  const toolsBtn = await page.$('[data-view-panel="tools"]');
  if (toolsBtn) {
    await toolsBtn.click();
    await page.waitForTimeout(1500);

    const afterTools = await page.evaluate(() => ({
      bodyClasses: document.body.className,
      railExpanded: document.body.classList.contains("studio-rail-expanded"),
      activeViewPanel: document.querySelector('[data-view-panel].active')?.getAttribute("data-view-panel") || "none",
      expandButtonExists: !!document.getElementById("rail-workflow-expand-button"),
    }));
    console.log("After tools click:", JSON.stringify(afterTools, null, 2));

    const btnStyle = await page.evaluate(() => {
      const btn = document.getElementById("rail-workflow-expand-button");
      if (!btn) return "NOT FOUND";
      const cs = window.getComputedStyle(btn);
      return `display=${cs.display}, visibility=${cs.visibility}, opacity=${cs.opacity}`;
    });
    console.log("Expand button style in tools:", btnStyle);
  }

  // Step 4: Try clicking expand to see what happens
  console.log("\n=== TOGGLING EXPAND ===");
  const toggleBtn = await page.$("#rail-workflow-expand-button");
  if (toggleBtn) {
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    const afterToggle = await page.evaluate(() => ({
      bodyClasses: document.body.className,
      railExpanded: document.body.classList.contains("studio-rail-expanded"),
      activeViewPanel: document.querySelector('[data-view-panel].active')?.getAttribute("data-view-panel") || "none",
    }));
    console.log("After toggle:", JSON.stringify(afterToggle, null, 2));

    // Check the span rotation
    const spanStyle = await page.evaluate(() => {
      const btn = document.getElementById("rail-workflow-expand-button");
      if (!btn) return "NOT FOUND";
      const span = btn.querySelector("span");
      if (!span) return "NO SPAN";
      const cs = window.getComputedStyle(span);
      return `transform=${cs.transform}, display=${cs.display}`;
    });
    console.log("Span transform:", spanStyle);

    // Toggle back
    await toggleBtn.click();
    await page.waitForTimeout(500);
  }

  // Step 5: Navigate to resource-hub view (3D Suites / assets)
  console.log("\n=== SWITCHING TO RESOURCE-HUB VIEW ===");
  const rhLink = await page.$('[href="#resource-hub"]');
  if (rhLink) {
    await rhLink.click();
    await page.waitForTimeout(2000);

    const afterRh = await page.evaluate(() => ({
      bodyClasses: document.body.className,
      railExpanded: document.body.classList.contains("studio-rail-expanded"),
      activeViewPanel: document.querySelector('[data-view-panel].active')?.getAttribute("data-view-panel") || "none",
      expandButtonExists: !!document.getElementById("rail-workflow-expand-button"),
    }));
    console.log("After resource-hub:", JSON.stringify(afterRh, null, 2));

    const btnStyle = await page.evaluate(() => {
      const btn = document.getElementById("rail-workflow-expand-button");
      if (!btn) return "NOT FOUND";
      const cs = window.getComputedStyle(btn);
      return `display=${cs.display}, visibility=${cs.visibility}, opacity=${cs.opacity}`;
    });
    console.log("Expand button style in resource-hub:", btnStyle);

    // Check the span rotation
    const spanStyle = await page.evaluate(() => {
      const btn = document.getElementById("rail-workflow-expand-button");
      if (!btn) return "NOT FOUND";
      const span = btn.querySelector("span");
      if (!span) return "NO SPAN";
      const cs = window.getComputedStyle(span);
      return `transform=${cs.transform}, display=${cs.display}`;
    });
    console.log("Span transform in resource-hub:", spanStyle);

    // Toggle expand in this view
    console.log("\n=== TOGGLING EXPAND IN RESOURCE-HUB ===");
    const toggleBtn2 = await page.$("#rail-workflow-expand-button");
    if (toggleBtn2) {
      await toggleBtn2.click();
      await page.waitForTimeout(1000);

      const afterToggleRh = await page.evaluate(() => ({
        bodyClasses: document.body.className,
        railExpanded: document.body.classList.contains("studio-rail-expanded"),
        activeViewPanel: document.querySelector('[data-view-panel].active')?.getAttribute("data-view-panel") || "none",
      }));
      console.log("After toggle in resource-hub:", JSON.stringify(afterToggleRh, null, 2));

      const spanStyle2 = await page.evaluate(() => {
        const btn = document.getElementById("rail-workflow-expand-button");
        if (!btn) return "NOT FOUND";
        const span = btn.querySelector("span");
        if (!span) return "NO SPAN";
        const cs = window.getComputedStyle(span);
        return `transform=${cs.transform}, display=${cs.display}`;
      });
      console.log("Span transform after toggle:", spanStyle2);

      // Toggle back
      await toggleBtn2.click();
      await page.waitForTimeout(500);
    }
  } else {
    console.log("No #resource-hub link found, checking all nav links...");
    const allLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href], button[data-view]')).map(el => ({
        tag: el.tagName,
        href: el.getAttribute("href"),
        id: el.id,
        className: el.className?.substring(0, 60),
      }));
    });
    console.log("Nav links:", JSON.stringify(allLinks.slice(0, 20), null, 2));
  }

  // Step 6: Take screenshots for visual verification
  await page.screenshot({ path: "scripts/screenshots/diagnostic-ai.png", fullPage: false });

  console.log("\n=== SCREENSHOT SAVED ===");

  await browser.close();
  console.log("Done.");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});