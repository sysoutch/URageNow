import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8765/tools/game/ultimate-texas-holdem/dist/';
const screenshotPath = process.argv[3];
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.saloon-menu').waitFor();
  assert.equal(await page.locator('.saloon-stop').count(), 5);

  await page.locator('[data-saloon-id="dusty-spur"][data-saloon-bet="10"]').click();
  await page.locator('#btn-deal').click();
  await page.locator('#player-cards .card--face-up').first().waitFor();

  const cardTheme = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'card card--face-up card--hearts';
    probe.style.position = 'fixed';
    probe.style.left = '-1000px';
    document.querySelector('.table-stage')?.appendChild(probe);
    const style = getComputedStyle(probe);
    const result = {
      color: style.color,
      width: style.width,
      height: style.height,
      backgroundImage: style.backgroundImage,
    };
    probe.remove();
    return result;
  });

  assert.equal(cardTheme.color, 'rgb(193, 38, 54)');
  assert.equal(cardTheme.width, '76px');
  assert.equal(cardTheme.height, '108px');
  assert.match(cardTheme.backgroundImage, /linear-gradient/);

  if (screenshotPath) {
    await mkdir(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  await page.locator('#btn-settings').click();
  const preflopMode = page.locator('select[name="preflopRaiseMode"]');
  await preflopMode.selectOption('THREE_ONLY');
  await page.locator('#hand-warning-settings-form').evaluate(form => form.requestSubmit());
  const renderedState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  assert.equal(renderedState.preflopRaiseMode, 'THREE_ONLY');
  assert.equal(await page.locator('#play-amount').getAttribute('max'), '30');
  assert.equal(await page.locator('#btn-play-plus').isDisabled(), true);

  await page.locator('#btn-settings').click();
  const dealerDisqualifiedAnteMode = page.locator('select[name="dealerDisqualifiedAnteMode"]');
  assert.equal(await dealerDisqualifiedAnteMode.inputValue(), 'PUSH');
  await dealerDisqualifiedAnteMode.selectOption('PAY_ON_PLAYER_WIN');
  await page.locator('#hand-warning-settings-form').evaluate(form => form.requestSubmit());
  const updatedState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  assert.equal(updatedState.dealerDisqualifiedAnteMode, 'PAY_ON_PLAYER_WIN');

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobileErrors = [];
  mobilePage.on('console', message => {
    if (message.type() === 'error') mobileErrors.push(message.text());
  });
  await mobilePage.goto(url, { waitUntil: 'networkidle' });
  await mobilePage.locator('[data-saloon-id="dusty-spur"][data-saloon-bet="10"]').click();
  await mobilePage.locator('#btn-deal').waitFor();
  const mobileLayout = await mobilePage.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    deal: document.getElementById('btn-deal')?.getBoundingClientRect(),
    settings: document.getElementById('btn-settings')?.getBoundingClientRect(),
    betZones: Array.from(document.querySelectorAll('.bet-zone')).map(node => node.getBoundingClientRect()),
  }));
  assert.ok(mobileLayout.documentWidth <= mobileLayout.viewportWidth, 'Mobile table must not scroll horizontally.');
  assert.ok(mobileLayout.deal.width >= 48 && mobileLayout.deal.height >= 48, 'Deal must remain touch sized.');
  assert.ok(mobileLayout.settings.width >= 48 && mobileLayout.settings.height >= 40, 'Settings must remain touch sized.');
  assert.equal(mobileLayout.betZones.length, 4);
  assert.ok(mobileLayout.betZones.every(zone => zone.left >= 0 && zone.right <= mobileLayout.viewportWidth));
  if (screenshotPath) {
    await mobilePage.screenshot({ path: screenshotPath.replace(/(\.[^.]+)$/, '-mobile$1'), fullPage: true });
  }
  await mobilePage.locator('#btn-settings').click();
  const mobileAnteMode = mobilePage.locator('select[name="dealerDisqualifiedAnteMode"]');
  await mobileAnteMode.waitFor();
  assert.equal(await mobileAnteMode.inputValue(), 'PUSH');
  if (screenshotPath) {
    await mobilePage.screenshot({ path: screenshotPath.replace(/(\.[^.]+)$/, '-mobile-settings$1'), fullPage: true });
  }
  await mobilePage.locator('[data-settings-cancel]').click();
  await mobilePage.locator('#btn-deal').click();
  await mobilePage.locator('#player-cards .card--face-up').first().waitFor();
  const dealtLayout = await mobilePage.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    playerCards: Array.from(document.querySelectorAll('#player-cards .card')).map(node => node.getBoundingClientRect()),
    communitySlots: Array.from(document.querySelectorAll('#community-cards .card-slot')).map(node => node.getBoundingClientRect()),
  }));
  assert.ok(dealtLayout.documentWidth <= dealtLayout.viewportWidth);
  assert.ok(dealtLayout.playerCards.every(card => card.left >= 0 && card.right <= dealtLayout.viewportWidth));
  assert.ok(dealtLayout.communitySlots.every(card => card.left >= 0 && card.right <= dealtLayout.viewportWidth));
  if (screenshotPath) {
    await mobilePage.screenshot({ path: screenshotPath.replace(/(\.[^.]+)$/, '-mobile-dealt$1'), fullPage: true });
  }
  assert.deepEqual(mobileErrors, []);
  await mobilePage.close();

  assert.deepEqual(consoleErrors, []);
  console.log("Ultimate Texas Hold'em UI validation passed.");
} finally {
  await browser.close();
}
