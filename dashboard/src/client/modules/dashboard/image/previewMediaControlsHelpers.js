function createDashboardImagePreviewMediaControls(input) {
  const getNodes = typeof input?.getNodes === "function" ? input.getNodes : () => ({});
  const mediaState = input?.mediaState || {};
  const drawGifFrame = typeof input?.drawGifFrame === "function" ? input.drawGifFrame : () => {};
  const showPausedGifFrame = typeof input?.showPausedGifFrame === "function" ? input.showPausedGifFrame : () => false;
  const stopGifPlayback = typeof input?.stopGifPlayback === "function" ? input.stopGifPlayback : () => {};
  const resumeGifAnimation = typeof input?.resumeGifAnimation === "function" ? input.resumeGifAnimation : () => {};
  const openFocusViewer = typeof input?.openFocusViewer === "function" ? input.openFocusViewer : () => {};

  function bindVideoScrubber() {
    const preview = document.getElementById("videogen-preview");
    const hint = document.getElementById("videogen-preview-scrub-hint");
    if (!preview || preview.dataset.scrubberBound === "true") return;
    preview.dataset.scrubberBound = "true";
    let dragStartX = 0;
    let dragStartTime = 0;
    let isDragging = false;
    const getDuration = () => Number.isFinite(preview.duration) && preview.duration > 0 ? preview.duration : 0;
    const seekFromPointer = event => {
      const duration = getDuration();
      if (!duration) return;
      const width = Math.max(1, preview.getBoundingClientRect().width || 1);
      const delta = ((event.clientX || 0) - dragStartX) / width;
      preview.currentTime = Math.max(0, Math.min(duration, dragStartTime + (delta * duration)));
    };
    preview.addEventListener("pointerdown", event => {
      if (!preview.src || !getDuration()) return;
      isDragging = true;
      dragStartX = event.clientX || 0;
      dragStartTime = Number.isFinite(preview.currentTime) ? preview.currentTime : 0;
      preview.pause();
      preview.setPointerCapture?.(event.pointerId);
      preview.classList.add("is-scrubbing");
      if (hint) hint.textContent = "Drag left or right to scrub frames.";
    });
    preview.addEventListener("pointermove", event => {
      if (isDragging) seekFromPointer(event);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName => {
      preview.addEventListener(eventName, event => {
        if (!isDragging) return;
        seekFromPointer(event);
        isDragging = false;
        preview.classList.remove("is-scrubbing");
      });
    });
  }

  function bind() {
    const nodes = getNodes();
    const targets = [nodes.video, nodes.canvas, nodes.image].filter(Boolean);
    const overlay = nodes.overlay;
    if (targets.length === 0 || nodes.image?.dataset.mediaControlsBound === "true") return;
    if (nodes.image) nodes.image.dataset.mediaControlsBound = "true";
    let dragStartX = 0;
    let dragStartTime = 0;
    let dragStartFrame = 0;
    let isDragging = false;
    let dragTarget = null;
    let pendingPointerEvent = null;
    let pendingVideoSeekFrame = 0;
    let pendingGifFrame = 0;
    let dragMoved = false;
    let dragUsesQuarterSteps = false;
    let overlayDragStartX = 0;
    let overlayDragMoved = false;
    let overlayPointerId = null;
    let overlayPointerStartEvent = null;
    let overlayHandledPointerClick = false;
    const getDragStepCount = event => {
      const distance = (event?.clientX || 0) - dragStartX;
      return dragUsesQuarterSteps ? Math.trunc(distance / 48) : Math.round(distance / 8);
    };
    const stepGifFromPointer = event => {
      const frames = mediaState.gifFrames;
      if (frames.length === 0) return;
      const stepCount = getDragStepCount(event);
      const frameStep = dragUsesQuarterSteps ? Math.max(1, Math.round(frames.length / 4)) : 1;
      drawGifFrame(dragStartFrame + (stepCount * frameStep));
    };
    const getVideoFrameDuration = () => 1 / Math.max(1, Math.min(120, Number.parseInt(String(mediaState.videoFps || 30), 10) || 30));
    const seekVideoFromPointer = (event, options) => {
      const video = nodes.video;
      const duration = Number.isFinite(video?.duration) && video.duration > 0 ? video.duration : 0;
      if (!video) return;
      if (!duration) {
        const clientX = event?.clientX || dragStartX;
        if (video.readyState < 1) {
          video.addEventListener("loadedmetadata", () => seekVideoFromPointer({ clientX }, { force: true }), { once: true });
          video.load();
        }
        return;
      }
      const stepCount = getDragStepCount(event);
      const timeStep = dragUsesQuarterSteps ? duration / 4 : getVideoFrameDuration();
      const nextTime = Math.max(0, Math.min(duration, dragStartTime + (stepCount * timeStep)));
      const force = options?.force === true;
      if (force || Math.abs((Number.isFinite(video.currentTime) ? video.currentTime : 0) - nextTime) >= getVideoFrameDuration() * 0.45) video.currentTime = nextTime;
    };
    const queueVideoSeek = event => {
      pendingPointerEvent = event;
      if (pendingVideoSeekFrame) return;
      pendingVideoSeekFrame = window.requestAnimationFrame(() => {
        pendingVideoSeekFrame = 0;
        if (isDragging && pendingPointerEvent) seekVideoFromPointer(pendingPointerEvent);
      });
    };
    const queueGifStep = event => {
      pendingPointerEvent = event;
      if (pendingGifFrame) return;
      pendingGifFrame = window.requestAnimationFrame(() => {
        pendingGifFrame = 0;
        if (isDragging && pendingPointerEvent) stepGifFromPointer(pendingPointerEvent);
      });
    };
    const beginDrag = event => {
      if (!event || (mediaState.kind !== "video" && mediaState.kind !== "gif")) return;
      if (mediaState.kind === "gif" && !showPausedGifFrame()) return;
      isDragging = true;
      dragMoved = false;
      dragTarget = event.currentTarget || null;
      dragStartX = event.clientX || 0;
      dragStartFrame = mediaState.gifFrameIndex || 0;
      dragStartTime = Number.isFinite(nodes.video?.currentTime) ? nodes.video.currentTime : 0;
      dragUsesQuarterSteps = event.ctrlKey === true;
      stopGifPlayback();
      if (mediaState.kind === "video" && nodes.video) {
        if (nodes.video.readyState < 1) nodes.video.load();
        nodes.video.pause();
      }
      dragTarget?.setPointerCapture?.(event.pointerId);
      dragTarget?.classList.add("is-scrubbing");
      document.addEventListener("pointermove", moveDrag);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
      event.preventDefault?.();
    };
    const moveDrag = event => {
      if (!isDragging) return;
      event.preventDefault?.();
      if (Math.abs((event.clientX || 0) - dragStartX) > 3) dragMoved = true;
      if (mediaState.kind === "gif") queueGifStep(event);
      if (mediaState.kind === "video") queueVideoSeek(event);
    };
    const endDrag = event => {
      if (!isDragging) return;
      if (mediaState.kind === "gif" && dragMoved) stepGifFromPointer(event);
      if (mediaState.kind === "video") {
        const finalEvent = typeof event?.clientX === "number" ? event : pendingPointerEvent;
        if (finalEvent) seekVideoFromPointer(finalEvent, { force: true });
      }
      if (pendingVideoSeekFrame) window.cancelAnimationFrame(pendingVideoSeekFrame);
      if (pendingGifFrame) window.cancelAnimationFrame(pendingGifFrame);
      pendingVideoSeekFrame = 0;
      pendingGifFrame = 0;
      isDragging = false;
      dragMoved = false;
      dragUsesQuarterSteps = false;
      pendingPointerEvent = null;
      document.removeEventListener("pointermove", moveDrag);
      document.removeEventListener("pointerup", endDrag);
      document.removeEventListener("pointercancel", endDrag);
      dragTarget?.classList.remove("is-scrubbing");
      dragTarget = null;
    };
    const toggleOverlayPreviewPlayback = () => {
      if (mediaState.kind === "video" && nodes.video) {
        if (nodes.video.paused) void nodes.video.play().catch(() => {});
        else nodes.video.pause();
        return;
      }
      if (mediaState.kind !== "gif") return;
      if (mediaState.gifPlaying === true) {
        stopGifPlayback();
        return;
      }
      const pausedCanvasVisible = nodes.canvas && !nodes.canvas.classList.contains("hidden") && nodes.image?.classList.contains("hidden");
      if (pausedCanvasVisible) resumeGifAnimation();
      else showPausedGifFrame();
    };
    targets.concat(overlay ? [overlay] : []).forEach(target => {
      if (target === overlay) {
        overlay.addEventListener("pointerdown", event => {
          if (overlayPointerId !== null) return;
          overlayPointerId = event.pointerId;
          overlayPointerStartEvent = event;
          overlayDragStartX = event.clientX || 0;
          overlayDragMoved = false;
          overlayHandledPointerClick = false;
          event.preventDefault();
          overlay.setPointerCapture?.(event.pointerId);
          document.addEventListener("pointerup", endOverlayDrag);
          document.addEventListener("pointercancel", endOverlayDrag);
          document.addEventListener("lostpointercapture", endOverlayDrag);
        });
        overlay.addEventListener("pointermove", event => {
          if (event.pointerId !== overlayPointerId || Math.abs((event.clientX || 0) - overlayDragStartX) <= 3) return;
          overlayDragMoved = true;
          if (!isDragging) beginDrag(overlayPointerStartEvent || event);
          moveDrag(event);
        });
        return;
      }
      target.addEventListener("pointerdown", beginDrag);
      target.addEventListener("pointermove", moveDrag);
      target.addEventListener("pointerup", endDrag);
      target.addEventListener("pointercancel", endDrag);
      target.addEventListener("lostpointercapture", endDrag);
    });
    targets.forEach(target => target.addEventListener("dblclick", event => {
      event.preventDefault();
      openFocusViewer();
    }));
    function endOverlayDrag(event) {
      if (event.pointerId !== overlayPointerId) return;
      overlayPointerId = null;
      overlayPointerStartEvent = null;
      overlay?.releasePointerCapture?.(event.pointerId);
      document.removeEventListener("pointerup", endOverlayDrag);
      document.removeEventListener("pointercancel", endOverlayDrag);
      document.removeEventListener("lostpointercapture", endOverlayDrag);
      if (event.type === "pointerup" && !overlayDragMoved) {
        overlayHandledPointerClick = true;
        toggleOverlayPreviewPlayback();
      }
      overlayDragMoved = false;
    }
    overlay?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (overlayHandledPointerClick) {
        overlayHandledPointerClick = false;
        return;
      }
      toggleOverlayPreviewPlayback();
    });
  }

  return { bind, bindVideoScrubber };
}
