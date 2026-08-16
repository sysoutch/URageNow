interface MobileNavItem {
  label: string;
  title: string;
  icon: string;
  targetAttribute: "data-view" | "data-ai-scroll-target";
  target: string;
  discordOnly?: boolean;
}

const mobileNavItems: readonly MobileNavItem[] = [
  {label: "Studio", title: "Studio", icon: "R", targetAttribute: "data-view", target: "ai"},
  {label: "Dash", title: "Dashboard", icon: "&#127968;", targetAttribute: "data-view", target: "dashboard"},
  {label: "Chat", title: "Chat", icon: "&#9993;", targetAttribute: "data-ai-scroll-target", target: "ask-rod-card"},
  {label: "Auto", title: "Automation", icon: "&#9201;", targetAttribute: "data-view", target: "automation"},
  {label: "Guild", title: "Guild", icon: "&#9881;", targetAttribute: "data-view", target: "guild", discordOnly: true},
  {label: "Mod", title: "Moderation", icon: "&#128737;", targetAttribute: "data-view", target: "moderation", discordOnly: true},
  {label: "Profile", title: "Profile", icon: "@", targetAttribute: "data-view", target: "profile"}
];

function renderMobileNavItem(item: MobileNavItem, index: number): string {
  const activeClass = index === 0 ? " active" : "";
  const messengerScope = item.discordOnly ? ' data-discord-only="true"' : "";
  return `
      <button class="nav-link mobile-nav-link${activeClass}" ${item.targetAttribute}="${item.target}"${messengerScope} type="button" title="${item.title}" aria-label="${item.title}">
        <span class="mobile-nav-icon" aria-hidden="true">${item.icon}</span>
        <span class="mobile-nav-label">${item.label}</span>
      </button>`;
}

export function renderDashboardMobileNav(): string {
  return `
    <nav class="mobile-bottom-nav" aria-label="Mobile workspace navigation">
${mobileNavItems.map(renderMobileNavItem).join("")}
    </nav>
`;
}
