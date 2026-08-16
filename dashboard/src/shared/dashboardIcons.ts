export type DashboardWorkflowIconKey = "chat" | "image" | "model3d" | "audio" | "music" | "video";
export type ButtonIconKey = "plus" | "send" | "history" | "upload" | "trash" | "image" | "camera" | "box" | "sparkle" | "refresh" | "download" | "copy" | "expand" | "settings" | "tags" | "wand" | "folder" | "save" | "undo" | "file" | "cube" | "hand" | "video" | "audio" | "close" | "pin" | "float" | "collapseLeft";

const workflowBootstrapIconNames: Record<DashboardWorkflowIconKey, string> = {
  chat: "chat-dots",
  image: "image",
  model3d: "box",
  audio: "soundwave",
  music: "music-note-beamed",
  video: "camera-video"
};

const buttonBootstrapIconNames: Record<ButtonIconKey, string> = {
  plus: "plus-lg",
  send: "send",
  history: "clock-history",
  upload: "upload",
  trash: "trash3",
  image: "image",
  camera: "camera",
  box: "box",
  sparkle: "stars",
  refresh: "arrow-clockwise",
  download: "download",
  copy: "copy",
  expand: "arrows-fullscreen",
  settings: "gear",
  tags: "tags",
  wand: "magic",
  folder: "folder2-open",
  save: "floppy",
  undo: "arrow-counterclockwise",
  file: "file-earmark",
  cube: "box",
  hand: "hand-index-thumb",
  video: "camera-video",
  audio: "soundwave",
  close: "x-lg",
  pin: "pin-angle",
  float: "window-stack",
  collapseLeft: "layout-sidebar-inset"
};

const toolsBootstrapIconNames = {
  tools: "tools",
  art: "palette",
  audio: "soundwave",
  dev: "code-slash",
  game: "controller",
  image: "image",
  plan: "list-task",
  video: "camera-video",
  search: "search"
};

const blenderIconPaths = {
  blender: '<path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"/><path d="M9.5 9.5a2.5 2.5 0 1 1-5-.001A2.5 2.5 0 0 1 9.5 9.5Z"/><path d="M19.5 9.5a2.5 2.5 0 1 1-5-.001A2.5 2.5 0 0 1 19.5 9.5Z"/><path d="M12 7a5 5 0 0 1 5 5v.5a2.5 2.5 0 0 1-5 0V12a3 3 0 0 0-3-3H9a2.5 2.5 0 0 1 0-5h.5Z"/>'
};

const dashboardBootstrapIconNames = {
  about: "question-circle",
  resources: "folder2-open",
  skills: "file-earmark-text",
  console: "terminal"
};

const dashboardIconPaths = {
  discord: '<path d="M8 7.5h8a4.5 4.5 0 0 1 4.5 4.5v1a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 13v-1A4.5 4.5 0 0 1 8 7.5Z"/><circle cx="9.5" cy="12.6" r="1.05"/><circle cx="14.5" cy="12.6" r="1.05"/>',
  telegram: '<path d="M3 11.8L20.6 4.2c.7-.3 1.4.3 1.3 1l-3 13.8c-.1.6-.8.8-1.3.5L12.2 15l-2.7 2.7c-.4.4-1 .2-1.1-.3L7.6 13l-4-1c-.8-.2-.8-1.2-.2-1.6Z"/>',
  matrix: '<path d="M4 4h3v2H6v12h1v2H4V4Zm16 0v16h-3v-2h1V6h-1V4h3Zm-11 4h2l1 2 1-2h2v8h-2v-4l-1 2-1-2v4H9V8Z"/>',
  whatsapp: '<path d="M12.1 4A7.9 7.9 0 0 0 5.2 15.8L4 20l4.3-1.1a7.9 7.9 0 1 0 3.8-14.9Zm0 13.8c-1.2 0-2.4-.3-3.4-1l-.2-.1-2.5.7.7-2.4-.1-.2a5.9 5.9 0 1 1 5.5 3Z"/><path d="M15.6 13.8c-.2-.1-1.2-.6-1.3-.6-.2-.1-.3-.1-.4.1l-.5.6c-.1.1-.2.2-.4.1-.2-.1-.8-.3-1.5-.9-.6-.6-1-1.3-1.1-1.5-.1-.2 0-.3.1-.4l.3-.3.1-.2c.1-.1.1-.2.2-.3.1-.1 0-.3 0-.4l-.6-1.4c-.2-.4-.4-.3-.5-.3h-.4c-.1 0-.3.1-.5.3-.2.2-.7.7-.7 1.7s.7 2 1.1 2.6c.1.1 1.4 2.2 3.3 3 .5.2.9.3 1.2.4.5.2.9.1 1.3.1.4-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1 0-.1-.2-.1-.4-.2Z"/>',
  about: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.2a2.35 2.35 0 0 1 4.45 1.05c0 1.7-1.74 2.12-2.18 3.28"/><path d="M12 17.2h.01"/>',
  resources: '<path d="M4.5 7.2h5.4l1.7 2h7.9v8.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V9.2a2 2 0 0 1 2-2Z"/><path d="M5.1 7.2V5.4a1.7 1.7 0 0 1 1.7-1.7h4.1l1.7 2h4.6a1.7 1.7 0 0 1 1.7 1.7v1.8"/>',
  skills: '<path d="M6.4 4.6h8.1l3.1 3.1v11.7H6.4Z"/><path d="M14.5 4.6v3.1h3.1"/><path d="M8.6 10.6h6.8"/><path d="M8.6 13.5h6.8"/><path d="M8.6 16.4h4.4"/>',
  console: '<path d="M4.6 5.2h14.8v13.6H4.6Z"/><path d="M7.2 9.2 10 12l-2.8 2.8"/><path d="M11.4 15h5.1"/>'
};

function renderIconSvg(paths: string, ariaHidden = true): string {
  return `<svg viewBox="0 0 24 24" focusable="false"${ariaHidden ? ' aria-hidden="true"' : ""}>${paths}</svg>`;
}

export function renderBootstrapIcon(iconName: string, className = ""): string {
  const normalizedName = /^[a-z0-9-]+$/.test(iconName) ? iconName : "question-circle";
  const normalizedClassName = className.split(/\s+/).filter(name => /^[a-z0-9_-]+$/i.test(name)).join(" ");
  return `<i class="bi bi-${normalizedName}${normalizedClassName ? ` ${normalizedClassName}` : ""}" aria-hidden="true"></i>`;
}

export function renderDashboardNavigationIcon(iconKey: keyof typeof dashboardIconPaths | keyof typeof dashboardBootstrapIconNames): string {
  const bootstrapIconName = dashboardBootstrapIconNames[iconKey as keyof typeof dashboardBootstrapIconNames];
  return bootstrapIconName
    ? renderBootstrapIcon(bootstrapIconName)
    : renderIconSvg(dashboardIconPaths[iconKey as keyof typeof dashboardIconPaths], false);
}

export function renderWorkflowIcon(iconKey: DashboardWorkflowIconKey): string {
  return renderBootstrapIcon(workflowBootstrapIconNames[iconKey]);
}

export function renderButtonIcon(iconKey: ButtonIconKey): string {
  return `<span class="button-icon" aria-hidden="true"><i class="bi bi-${buttonBootstrapIconNames[iconKey]}"></i></span>`;
}

export function renderToolsIcon(): string {
  return renderBootstrapIcon(toolsBootstrapIconNames.tools);
}

export function renderBlenderIconSvg(): string {
  return renderIconSvg(blenderIconPaths.blender);
}

export function renderAssetsIcon(): string {
  return renderBootstrapIcon("collection");
}

export function renderToolsCategoryIcon(categoryId: string): string {
  const normalized = String(categoryId || "").trim().toLowerCase() as keyof typeof toolsBootstrapIconNames;
  return renderBootstrapIcon(toolsBootstrapIconNames[normalized] || toolsBootstrapIconNames.tools);
}

export function renderToolsSearchIcon(): string {
  return renderBootstrapIcon(toolsBootstrapIconNames.search);
}
