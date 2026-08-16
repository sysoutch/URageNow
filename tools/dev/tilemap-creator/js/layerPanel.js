function closestFromEvent(event, selector) {
  return event && event.target && event.target.closest ? event.target.closest(selector) : null;
}

function stopControlEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

function bindButton(row, action, handler) {
  const button = row.querySelector("[data-act='" + action + "']");
  if (!button) return;
  button.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    event.stopPropagation();
  });
  button.addEventListener("pointerup", event => {
    if (event.button !== 0) return;
    button.dataset.pointerHandled = "1";
    stopControlEvent(event);
    if (button.disabled) return;
    handler(event);
  });
  button.addEventListener("click", event => {
    if (button.dataset.pointerHandled === "1") {
      delete button.dataset.pointerHandled;
      stopControlEvent(event);
      return;
    }
    stopControlEvent(event);
    if (button.disabled) return;
    handler(event);
  });
}

function layerPaintedCount(layer) {
  return layer.reduce((sum, row) => sum + row.filter(tile => tile >= 0).length, 0);
}

export function createLayerRow(options) {
  const { index, layer, meta, active, canMoveUp, canMoveDown, onSelect, onToggleVisible, onClear, onMoveUp, onMoveDown, onOpacityInput, onOpacityCommit, onStartReorder } = options;
  const painted = layerPaintedCount(layer);
  const row = document.createElement("div");
  row.className = "layer-row" + (active ? " active" : "");
  row.dataset.layerIndex = String(index);
  row.innerHTML = "<div class='layer-info'><button class='layer-drag-handle' type='button' data-act='grab' title='Drag to reorder'>☰</button><strong>Layer " + (index + 1) + "</strong><span>" + painted + " tiles</span></div><div class='layer-actions'><button type='button' data-act='select'>Select</button><button type='button' data-act='visible'>" + (meta.visible ? "Hide" : "Show") + "</button><button type='button' data-act='clear'>Erase</button><button type='button' data-act='up' title='Move layer toward front/top'" + (!canMoveUp ? " disabled" : "") + ">↑</button><button type='button' data-act='down' title='Move layer toward back/bottom'" + (!canMoveDown ? " disabled" : "") + ">↓</button><input data-act='opacity' type='range' min='0' max='1' step='0.05' value='" + meta.opacity + "' title='Opacity'></div>";

  row.addEventListener("click", event => {
    if (closestFromEvent(event, "button,input")) return;
    onSelect(index);
  });
  bindButton(row, "select", () => onSelect(index));
  bindButton(row, "visible", () => onToggleVisible(index));
  bindButton(row, "clear", () => onClear(index));
  bindButton(row, "up", () => onMoveUp(index));
  bindButton(row, "down", () => onMoveDown(index));

  const opacity = row.querySelector("input[data-act='opacity']");
  if (opacity) {
    opacity.addEventListener("input", event => {
      event.stopPropagation();
      onOpacityInput(index, Number(opacity.value));
    });
    opacity.addEventListener("change", event => {
      event.stopPropagation();
      onOpacityCommit(index, Number(opacity.value));
    });
  }

  const handle = row.querySelector(".layer-drag-handle");
  if (handle) handle.addEventListener("pointerdown", event => onStartReorder(event, index));
  return row;
}

export function renderLayerPanel(layerList, options) {
  if (!layerList) return;
  layerList.innerHTML = "";
  const displayOrder = options.layers.map((_, index) => index).reverse();
  displayOrder.forEach(index => {
    layerList.appendChild(createLayerRow({
      index,
      layer: options.layers[index],
      meta: options.layerMeta[index],
      active: index === options.currentLayer,
      canMoveUp: index < options.layers.length - 1,
      canMoveDown: index > 0,
      onSelect: options.onSelect,
      onToggleVisible: options.onToggleVisible,
      onClear: options.onClear,
      onMoveUp: options.onMoveUp,
      onMoveDown: options.onMoveDown,
      onOpacityInput: options.onOpacityInput,
      onOpacityCommit: options.onOpacityCommit,
      onStartReorder: options.onStartReorder
    }));
  });
}
