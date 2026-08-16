const dashboardClientBootstrapIconNames = {
  tools: "tools",
  expand: "arrows-fullscreen"
};

function renderDashboardClientSvgIcon(iconKey) {
  const key = String(iconKey || "").trim();
  const iconName = dashboardClientBootstrapIconNames[key] || dashboardClientBootstrapIconNames.tools;
  return '<i class="bi bi-' + iconName + '" aria-hidden="true"></i>';
}

function renderDashboardClientButtonIcon(iconKey) {
  return '<span class="button-icon" aria-hidden="true">' + renderDashboardClientSvgIcon(iconKey) + '</span>';
}

function setDashboardClientSvgIcon(node, iconKey) {
  if (!node) {
    return;
  }
  node.innerHTML = renderDashboardClientSvgIcon(iconKey);
}
