function setCanvasScale() {
  if (ctx) {
    ctx.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
  }
}

function resizeCanvasForMap(cols, rows, startX, startY, stepX, stepY) {
  var width = Math.ceil((Math.max(0, startX) + cols * stepX + canvasPadding) * canvasScale);
  var height = Math.ceil((Math.max(0, startY) + rows * stepY + canvasPadding) * canvasScale);
  width = Math.max(canvasBaseWidth, width);
  height = Math.max(canvasBaseHeight, height);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  setCanvasScale();
}

function resetCanvasSize() {
  if (canvas.width !== canvasBaseWidth || canvas.height !== canvasBaseHeight) {
    canvas.width = canvasBaseWidth;
    canvas.height = canvasBaseHeight;
  }
  canvas.style.width = canvasBaseWidth + "px";
  canvas.style.height = canvasBaseHeight + "px";
  setCanvasScale();
}

function scrollCanvasPreview(direction) {
  var wrap = document.getElementById("canvasScrollWrap");
  if (!wrap) {
    return;
  }
  wrap.scrollBy({ left: direction * Math.max(280, wrap.clientWidth * 0.8), behavior: "smooth" });
}

function centerCanvasPreview() {
  var wrap = document.getElementById("canvasScrollWrap");
  if (!wrap) {
    return;
  }
  wrap.scrollTo({ left: Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2), behavior: "smooth" });
}

function setupCanvasDragPan() {
  var wrap = document.getElementById("canvasScrollWrap");
  if (!wrap || wrap.dataset.dragPanReady === "true") {
    return;
  }

  wrap.dataset.dragPanReady = "true";
  var isDown = false;
  var startX = 0;
  var startScrollLeft = 0;
  var moved = false;

  wrap.addEventListener("pointerdown", function(e) {
    if (e.button !== undefined && e.button !== 0) {
      return;
    }

    isDown = true;
    moved = false;
    startX = e.clientX;
    startScrollLeft = wrap.scrollLeft;
    wrap.classList.add("is-dragging");
    wrap.setPointerCapture(e.pointerId);
  });

  wrap.addEventListener("pointermove", function(e) {
    if (!isDown) {
      return;
    }

    var dx = e.clientX - startX;
    if (Math.abs(dx) > 3) {
      moved = true;
    }

    wrap.scrollLeft = startScrollLeft - dx;
    e.preventDefault();
  });

  function stopDrag(e) {
    if (!isDown) {
      return;
    }

    isDown = false;
    wrap.classList.remove("is-dragging");
    if (e && e.pointerId !== undefined && wrap.hasPointerCapture(e.pointerId)) {
      wrap.releasePointerCapture(e.pointerId);
    }
  }

  wrap.addEventListener("pointerup", stopDrag);
  wrap.addEventListener("pointercancel", stopDrag);
  wrap.addEventListener("pointerleave", stopDrag);
  wrap.addEventListener("click", function(e) {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  wrap.addEventListener("wheel", function(e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      wrap.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
}
