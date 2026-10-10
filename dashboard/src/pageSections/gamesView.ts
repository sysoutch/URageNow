export function renderDashboardGamesView(): string {
  return `
    <section class="view" data-view-panel="games" data-discord-only="true">
      <div class="games-dashboard-shell">
        <article class="panel-card games-dashboard-intro">
          <div>
            <div class="panel-kicker">Discord Runtime</div>
            <h3>Games</h3>
            <p class="panel-subtitle">Import declarative game packages, enable them per runtime, and edit installed game texts or racing rosters here.</p>
          </div>
          <div class="games-import-actions">
            <label class="secondary games-import-file-label" for="games-package-file">Import package JSON</label>
            <input id="games-package-file" type="file" accept=".uragegame.json,application/json,.json" class="hidden">
            <button id="games-import-file-button" type="button">Import selected package</button>
            <button class="secondary" id="games-refresh-button" type="button">Refresh</button>
          </div>
          <div id="games-dashboard-status" class="hint" role="status" aria-live="polite">Loading installed games…</div>
        </article>
        <article class="panel-card games-list-card">
          <div class="messenger-dashboard-card-head"><h3>Installed games</h3><span class="chip" id="games-installed-count">0</span></div>
          <div class="games-package-list" id="games-installed-list"></div>
        </article>
        <article class="panel-card games-list-card">
          <div class="messenger-dashboard-card-head"><h3>Available packages</h3><span class="chip" id="games-available-count">0</span></div>
          <p class="panel-subtitle">Bundled packages available to import into the runtime catalog.</p>
          <div class="games-package-list" id="games-available-list"></div>
        </article>
        <p class="games-package-warning">Packages are declarative JSON data interpreted by reviewed runtime adapters. Imported packages cannot execute JavaScript. A new game mechanic needs a runtime adapter update.</p>
      </div>
    </section>`;
}
