export function renderDashboardActivityView(): string {
  return `
      <section class="view" data-view-panel="activity">
        <div class="tabs">
          <button class="ghost active" data-feed="actions">Actions</button>
          <button class="ghost" data-feed="reviews">Reviews</button>
          <button class="ghost" data-feed="drafts">Drafts</button>
        </div>
        <article class="panel-card">
          <div id="feed-actions" class="list tall-list"></div>
          <div id="feed-reviews" class="list tall-list hidden"></div>
          <div id="feed-drafts" class="list tall-list hidden"></div>
        </article>
      </section>
`;
}
