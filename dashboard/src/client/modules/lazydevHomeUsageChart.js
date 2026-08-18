function renderLazydevHomeUsageChart(container, input = {}) {
  if (!container) {
    return;
  }

  const namespace = "http://www.w3.org/2000/svg";
  const width = 760;
  const height = 286;
  const plot = { left: 42, right: 16, top: 20, bottom: 34 };
  const series = Array.isArray(input.series) ? input.series : [];
  const labels = Array.isArray(input.labels) ? input.labels : [];
  const values = series.flatMap(entry => Array.isArray(entry.values) ? entry.values : []);
  const maximum = Math.max(1, ...values.map(value => Number.isFinite(value) ? Math.max(0, value) : 0));
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const createSvgNode = (tagName, attributes = {}) => {
    const node = document.createElementNS(namespace, tagName);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    return node;
  };
  const getX = index => plot.left + (labels.length <= 1 ? 0 : (index / (labels.length - 1)) * plotWidth);
  const getY = value => plot.top + plotHeight - (Math.max(0, value) / maximum) * plotHeight;

  container.textContent = "";
  const legend = document.createElement("div");
  legend.className = "lazydev-home-chart-legend";
  series.forEach(entry => {
    const item = document.createElement("span");
    item.className = "is-" + entry.key;
    const marker = document.createElement("i");
    marker.setAttribute("aria-hidden", "true");
    item.append(marker, document.createTextNode(entry.label));
    legend.appendChild(item);
  });

  const svg = createSvgNode("svg", {
    class: "lazydev-home-activity-chart-svg",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": input.accessibleLabel || "Generation activity for the recent seven days"
  });
  const grid = createSvgNode("g", { class: "lazydev-home-chart-grid" });
  for (let index = 0; index <= 4; index += 1) {
    const y = plot.top + (index / 4) * plotHeight;
    grid.appendChild(createSvgNode("line", { x1: plot.left, x2: width - plot.right, y1: y, y2: y }));
    const valueLabel = createSvgNode("text", { x: plot.left - 8, y: y + 4, "text-anchor": "end" });
    valueLabel.textContent = Math.round(maximum * (1 - index / 4)).toLocaleString();
    grid.appendChild(valueLabel);
  }
  labels.forEach((label, index) => {
    const x = getX(index);
    const dayLabel = createSvgNode("text", { x, y: height - 9, "text-anchor": "middle" });
    dayLabel.textContent = label;
    grid.appendChild(dayLabel);
  });
  svg.appendChild(grid);

  series.forEach(entry => {
    const safeValues = labels.map((_, index) => Number.isFinite(entry.values?.[index]) ? Math.max(0, entry.values[index]) : 0);
    const pathData = safeValues.map((value, index) => `${index === 0 ? "M" : "L"}${getX(index).toFixed(1)} ${getY(value).toFixed(1)}`).join(" ");
    const group = createSvgNode("g", { class: "lazydev-home-chart-series is-" + entry.key });
    group.appendChild(createSvgNode("path", { d: pathData }));
    safeValues.forEach((value, index) => {
      const point = createSvgNode("circle", { cx: getX(index), cy: getY(value), r: 3.2 });
      const title = createSvgNode("title");
      title.textContent = `${entry.label}, ${labels[index]}: ${value}`;
      point.appendChild(title);
      group.appendChild(point);
    });
    svg.appendChild(group);
  });

  if (values.every(value => !value)) {
    const empty = document.createElement("div");
    empty.className = "lazydev-home-chart-empty";
    empty.textContent = "Your generation trend will appear here.";
    container.append(legend, svg, empty);
    return;
  }
  container.append(legend, svg);
}
