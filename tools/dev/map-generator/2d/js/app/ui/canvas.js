var canvasPreviewZoom = 1;

    function setCanvasStyleSize(width, height) {
      canvas.dataset.baseWidth = width;
      canvas.dataset.baseHeight = height;
      canvas.style.width = Math.max(1, Math.round(width * canvasPreviewZoom)) + "px";
      canvas.style.height = Math.max(1, Math.round(height * canvasPreviewZoom)) + "px";
    }

    function applyCanvasPreviewZoom(newZoom, focusX, focusY) {
      var wrap = document.getElementById("canvasScrollWrap");
      var oldZoom = canvasPreviewZoom;
      canvasPreviewZoom = Math.min(4, Math.max(0.25, newZoom));

      var baseWidth = Number(canvas.dataset.baseWidth || canvas.width || canvasBaseWidth);
      var baseHeight = Number(canvas.dataset.baseHeight || canvas.height || canvasBaseHeight);

      if (wrap && focusX !== undefined && focusY !== undefined) {
        var rect = wrap.getBoundingClientRect();
        var beforeX = (wrap.scrollLeft + focusX - rect.left) / oldZoom;
        var beforeY = (wrap.scrollTop + focusY - rect.top) / oldZoom;
        setCanvasStyleSize(baseWidth, baseHeight);
        wrap.scrollLeft = beforeX * canvasPreviewZoom - (focusX - rect.left);
        wrap.scrollTop = beforeY * canvasPreviewZoom - (focusY - rect.top);
        return;
      }

      setCanvasStyleSize(baseWidth, baseHeight);
    }

    function setCanvasScale() {
      if (ctx) {
        ctx.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
      }
    }

    function resizeCanvasForMap(cols, rows, startX, startY, stepX, stepY, endX, endY) {
      var width = Math.ceil((Math.max(0, startX) + cols * stepX + (typeof endX === "number" ? endX : canvasPadding)) * canvasScale);
      var height = Math.ceil((Math.max(0, startY) + rows * stepY + (typeof endY === "number" ? endY : canvasPadding)) * canvasScale);
      width = Math.max(1, width);
      height = Math.max(1, height);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      setCanvasStyleSize(width, height);
      setCanvasScale();
    }

    function resetCanvasSize() {
      if (canvas.width !== canvasBaseWidth || canvas.height !== canvasBaseHeight) {
        canvas.width = canvasBaseWidth;
        canvas.height = canvasBaseHeight;
      }
      setCanvasStyleSize(canvasBaseWidth, canvasBaseHeight);
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
      var startY = 0;
      var startScrollLeft = 0;
      var startScrollTop = 0;
      var moved = false;

      wrap.addEventListener("pointerdown", function(e) {
        if (e.button !== undefined && e.button !== 0) {
          return;
        }

        isDown = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        startScrollLeft = wrap.scrollLeft;
        startScrollTop = wrap.scrollTop;
        wrap.classList.add("is-dragging");
        wrap.setPointerCapture(e.pointerId);
      });

      wrap.addEventListener("pointermove", function(e) {
        if (!isDown) {
          return;
        }

        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          moved = true;
        }

        wrap.scrollLeft = startScrollLeft - dx;
        wrap.scrollTop = startScrollTop - dy;
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
        if (e.ctrlKey || e.metaKey) {
          var zoomStep = e.deltaY < 0 ? 1.1 : 1 / 1.1;
          applyCanvasPreviewZoom(canvasPreviewZoom * zoomStep, e.clientX, e.clientY);
          e.preventDefault();
          return;
        }

        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          wrap.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }, { passive: false });
    }
