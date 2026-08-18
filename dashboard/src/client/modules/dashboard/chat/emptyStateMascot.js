function createDashboardChatEmptyState() {
  const empty = document.createElement("section");
  empty.className = "ask-chat-empty";
  empty.setAttribute("aria-label", "Empty conversation");
  empty.innerHTML = `
    <div class="ask-chat-empty-badge" aria-hidden="true">
      <i class="bi bi-emoji-smile-fill ask-chat-empty-mascot"></i>
    </div>
    <p>Wow, such empty!</p>
  `;
  return empty;
}
