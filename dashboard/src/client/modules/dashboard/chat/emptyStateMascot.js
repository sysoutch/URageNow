function createDashboardChatEmptyState() {
  const empty = document.createElement("section");
  empty.className = "ask-chat-empty";
  empty.setAttribute("aria-label", "Empty conversation");
  empty.innerHTML = `
    <div class="ask-chat-empty-badge" aria-hidden="true">
      <svg class="ask-chat-empty-mascot" viewBox="0 0 160 160" focusable="false">
        <path fill="currentColor" d="M45 58V35l22 16a53 53 0 0 1 26 0l22-16v23a47 47 0 1 1-70 0Z"/>
        <circle cx="63" cy="82" r="6" fill="var(--ask-empty-eye, #d9dade)"/>
        <circle cx="97" cy="82" r="6" fill="var(--ask-empty-eye, #d9dade)"/>
        <path d="M72 100c5 7 11 7 16 0m-8-7v10" fill="none" stroke="var(--ask-empty-eye, #d9dade)" stroke-linecap="round" stroke-width="6"/>
      </svg>
    </div>
    <p>Wow, such empty!</p>
  `;
  return empty;
}
