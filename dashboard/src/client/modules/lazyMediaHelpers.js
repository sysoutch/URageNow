function createDashboardLazyMediaHelpers() {
  let viewportObserver = null;
  const rootedObservers = new WeakMap();
  const rootedRegistrations = new WeakMap();
  const mediaObserverMap = new WeakMap();
  const mediaRootMap = new WeakMap();
  function unload(media) {
    if (!media) return;
    if (media.tagName === "VIDEO" && typeof media.pause === "function") {
      media.pause();
    }
    if (media.getAttribute("src")) {
      media.removeAttribute("src");
      if (typeof media.load === "function") media.load();
    }
    if (media.dataset) delete media.dataset.lazyLoaded;
  }
  function load(media) {
    if (!media || !media.dataset) return;
    const source = String(media.dataset.src || "").trim();
    if (!source || media.getAttribute("src") === source) return;
    media.src = source;
    if (typeof media.load === "function") media.load();
  }
  function isMediaVisibleInsideRoot(media, root, margin = 180) {
    if (!(media instanceof Element) || !(root instanceof Element)) {
      return false;
    }
    const mediaRect = media.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return mediaRect.right >= rootRect.left - margin
      && mediaRect.left <= rootRect.right + margin
      && mediaRect.bottom >= rootRect.top - margin
      && mediaRect.top <= rootRect.bottom + margin;
  }
  function destroyRootRegistration(root, registration) {
    if (!(root instanceof Element) || !registration) {
      return;
    }
    root.removeEventListener("scroll", registration.handleRefresh);
    window.removeEventListener("resize", registration.handleRefresh);
    if (registration.rafId) {
      window.cancelAnimationFrame(registration.rafId);
    }
    rootedRegistrations.delete(root);
  }
  function ensureRootRegistration(root) {
    if (!(root instanceof Element)) {
      return null;
    }
    let registration = rootedRegistrations.get(root);
    if (registration) {
      return registration;
    }
    registration = {
      media: new Set(),
      rafId: 0,
      handleRefresh: null,
      refresh() {
        registration.rafId = 0;
        registration.media.forEach(media => {
          if (!media?.isConnected) {
            registration.media.delete(media);
            mediaRootMap.delete(media);
            return;
          }
          if (isMediaVisibleInsideRoot(media, root)) {
            load(media);
            return;
          }
          if (media.dataset?.lazyUnload !== "false") {
            unload(media);
          }
        });
        if (registration.media.size === 0) {
          destroyRootRegistration(root, registration);
        }
      },
      schedule() {
        if (registration.rafId) {
          return;
        }
        registration.rafId = window.requestAnimationFrame(() => registration.refresh());
      }
    };
    registration.handleRefresh = () => registration.schedule();
    root.addEventListener("scroll", registration.handleRefresh, { passive: true });
    window.addEventListener("resize", registration.handleRefresh);
    rootedRegistrations.set(root, registration);
    return registration;
  }
  function createObserver(root) {
    if (typeof IntersectionObserver !== "function") {
      return null;
    }
    return new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const media = entry.target;
        if (!media || !media.dataset) return;
        if (entry.isIntersecting) {
          load(media);
          return;
        }
        if (media.dataset.lazyUnload !== "false") unload(media);
      });
    }, { root, rootMargin: "180px 180px", threshold: 0.01 });
  }
  function getObserver(root) {
    if (!(root instanceof Element)) {
      if (!viewportObserver) {
        viewportObserver = createObserver(null);
      }
      return viewportObserver;
    }
    let observer = rootedObservers.get(root);
    if (!observer) {
      observer = createObserver(root);
      if (observer) {
        rootedObservers.set(root, observer);
      }
    }
    return observer;
  }
  function normalizeAttachOptions(optionsOrEager) {
    if (optionsOrEager && typeof optionsOrEager === "object") {
      return {
        eager: optionsOrEager.eager === true,
        lazyUnload: optionsOrEager.unload !== false,
        root: optionsOrEager.root instanceof Element ? optionsOrEager.root : null
      };
    }
    return { eager: optionsOrEager === true, lazyUnload: true, root: null };
  }
  function attach(media, source, optionsOrEager) {
    const normalizedSource = String(source || "").trim();
    if (!media || !normalizedSource) return;
    const options = normalizeAttachOptions(optionsOrEager);
    detach(media, false);
    media.dataset.src = normalizedSource;
    if (options.lazyUnload === false) {
      media.dataset.lazyUnload = "false";
    } else if (media.dataset) {
      delete media.dataset.lazyUnload;
    }
    if (options.root) {
      const registration = ensureRootRegistration(options.root);
      if (registration) {
        registration.media.add(media);
        mediaRootMap.set(media, options.root);
      }
    }
    const observer = getObserver(options.root);
    if (options.eager === true || !observer) {
      load(media);
    }
    if (observer) {
      observer.observe(media);
      mediaObserverMap.set(media, observer);
    }
    if (options.root) {
      ensureRootRegistration(options.root)?.schedule();
    }
  }
  function detach(target, unloadMedia = true) {
    if (!target) return;
    const mediaNodes = target.matches?.("[data-src]") ? [target] : Array.from(target.querySelectorAll?.("[data-src]") || []);
    mediaNodes.forEach(media => {
      const observer = mediaObserverMap.get(media);
      if (observer) {
        observer.unobserve(media);
        mediaObserverMap.delete(media);
      }
      const root = mediaRootMap.get(media);
      if (root) {
        const registration = rootedRegistrations.get(root);
        if (registration) {
          registration.media.delete(media);
          if (registration.media.size === 0) {
            destroyRootRegistration(root, registration);
          }
        }
        mediaRootMap.delete(media);
      }
      if (unloadMedia) unload(media);
    });
  }
  attach.detach = detach;
  attach.unload = unload;
  return { attach };
}
