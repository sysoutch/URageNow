export function registerEventModule(app) {
    const { els, state, pageWidth, pageHeight, margin } = app;

    async function addUploadedFiles(fileList, options) {
        const files = Array.from(fileList || []).filter(file => {
            const type = String(file.type || '').toLowerCase();
            return type.startsWith('image/') || type.startsWith('video/');
        });
        if (files.length === 0) return app.setStatus('Choose an image, GIF, or video file first.');
        const nextPages = files.map(file => {
            const objectUrl = URL.createObjectURL(file);
            state.objectUrls.add(objectUrl);
            return app.createDynamicPage({
                id: crypto.randomUUID(),
                image: objectUrl,
                name: file.name || 'Uploaded Page',
                sourceKind: app.inferMediaKind({ type: file.type, name: file.name }) === 'video' ? 'video-upload' : 'upload',
                type: file.type
            });
        });
        let insertAt = null;
        if (options?.insertAction?.type === 'before') {
            insertAt = state.dynamicPages.findIndex(page => page.id === options.insertAction.pageId);
        } else if (options?.insertAction?.type === 'after') {
            const pageIndex = state.dynamicPages.findIndex(page => page.id === options.insertAction.pageId);
            insertAt = pageIndex >= 0 ? pageIndex + 1 : null;
        } else if (options?.insertAction?.type === 'index') {
            insertAt = Number.isInteger(options.insertAction.insertAt) ? options.insertAction.insertAt : null;
        }
        app.addDynamicPages(nextPages, Number.isInteger(insertAt) ? { insertAt } : undefined);
        app.setStatus(`Added ${nextPages.length} uploaded image page${nextPages.length === 1 ? '' : 's'} to the book.`);
    }

    function updateClosedBookHover(event) {
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        const isClosedBookVisible = (app.isClosedStart() || app.isClosedEnd(pagesData)) && !state.isAnimating && !state.isPreparingFlip && !state.isDragging;
        let nextHovered = false;
        if (isClosedBookVisible && event) {
            const { x, y } = app.getCanvasPoint(event);
            const frameX = app.getClosedCoverCenterX() - 4;
            const frameY = margin;
            const frameWidth = pageWidth + 8;
            const frameHeight = pageHeight;
            nextHovered = x >= frameX && x <= frameX + frameWidth && y >= frameY && y <= frameY + frameHeight;
        }
        app.setClosedBookHovered(nextHovered);
    }

    function bindEvents() {
        els.addBookButton?.addEventListener('click', app.addBook);
        els.bookTitleInput?.addEventListener('input', () => {
            app.syncActiveBookFromState();
            app.renderBookTabs();
            app.scheduleBookStateSave();
            app.scheduleInitBook(180);
        });
        els.bookDescriptionInput?.addEventListener('input', () => {
            app.syncActiveBookFromState();
            app.scheduleBookStateSave();
            app.scheduleInitBook(180);
        });
        els.bookStyleSelect?.addEventListener('change', event => {
            app.applyBookStyle(event.target?.value || 'inferno');
            app.requestBookRender();
            app.setStatus(`Switched book look to ${els.bookStyleSelect.options[els.bookStyleSelect.selectedIndex]?.text || 'new style'}.`);
        });
        els.fileUpload?.addEventListener('change', event => {
            void addUploadedFiles(event.target.files);
            event.target.value = '';
        });
        els.contextFileUpload?.addEventListener('change', event => {
            void addUploadedFiles(event.target.files, { insertAction: state.pendingUploadAction });
            state.pendingUploadAction = null;
            event.target.value = '';
        });
        els.resetBookButton?.addEventListener('click', () => {
            state.currentPage = 0;
            state.progress = 0;
            state.isAnimating = false;
            state.isPreparingFlip = false;
            state.preparingFlipDirection = 0;
            state.queuedPageFlips = [];
            app.render();
            app.setStatus('Book view reset to the beginning.');
        });
        els.clearAddedPagesButton?.addEventListener('click', () => {
            state.dynamicPages.forEach(page => {
                if (state.objectUrls.has(page.image)) {
                    URL.revokeObjectURL(page.image);
                    state.objectUrls.delete(page.image);
                }
            });
            state.dynamicPages = [];
            app.getActiveBook().dynamicPages = state.dynamicPages;
            state.currentPage = 0;
            void app.initBook();
            app.scheduleBookStateSave();
            app.setStatus('Cleared all custom image pages from the book.');
        });
        els.openMediaTrayButton?.addEventListener('click', () => app.setMediaTrayOpen(true));
        els.mediaTrayTabs.forEach(button => {
            button.addEventListener('click', () => app.setMediaTrayTab(button.getAttribute('data-media-tray-tab') || 'pools'));
        });
        els.closeMediaTrayButton?.addEventListener('click', () => app.setMediaTrayOpen(false));
        els.mediaTray?.querySelector('.tray-head')?.addEventListener('pointerdown', app.startMediaTrayDrag);
        els.sealBookButton?.addEventListener('click', app.sealBook);
        els.refreshDashboardMediaButton?.addEventListener('click', () => {
            void app.refreshDashboardMedia();
        });
        els.insertPositionSelect?.addEventListener('change', event => {
            app.setInsertPosition(event.target?.value || 'end', { render: false });
            app.setStatus('Insert target updated.');
        });
        els.imagePoolSelect?.addEventListener('change', () => {
            state.selectedPoolImageIds.clear();
            app.renderDashboardMedia();
        });
        els.addSelectedPoolImagesButton?.addEventListener('click', app.addSelectedPoolImages);
        els.addSelectedRecentImagesButton?.addEventListener('click', app.addSelectedRecentImages);
        els.addAllPoolImagesButton?.addEventListener('click', app.addAllPoolImages);
        els.addAllRecentImagesButton?.addEventListener('click', app.addAllRecentImages);
        els.animationSpeedSelect?.addEventListener('change', event => {
            const val = parseInt(event.target.value, 10);
            if (!Number.isFinite(val)) return;
            state.animationDuration = Math.max(200, val);
            state.slideDuration = Math.max(120, Math.floor(val * 0.48));
            state.animationDurationSlow = Math.max(state.animationDuration, val + 500);
            state.animationDurationFast = Math.max(200, Math.floor(val * 0.45));
            app.scheduleBookStateSave();
            app.setStatus(`Animation speed set to ${(val / 1000).toFixed(2)}s.`);
        });
        els.pageFontSizeSelect?.addEventListener('change', event => {
            const val = parseInt(event.target.value, 10);
            if (!Number.isFinite(val)) return;
            state.fontSize = val;
            state.dynamicPages.forEach(page => {
                page.fontSize = val;
            });
            state.pageRenderCache.clear();
            state.prerenderedPages = [];
            state.prerenderedPageKeys = [];
            app.scheduleBookStateSave();
            app.setStatus(`Page text size set to ${val}px.`);
            app.scheduleInitBook(50);
        });
        els.pageBgColorSelect?.addEventListener('change', event => {
            const val = String(event.target.value || '').trim();
            if (!val) return;
            state.bgColor = val;
            state.dynamicPages.forEach(page => {
                page.bg = val;
            });
            state.pageRenderCache.clear();
            state.prerenderedPages = [];
            state.prerenderedPageKeys = [];
            app.scheduleBookStateSave();
            app.setStatus(`Page background set to ${val}.`);
            app.scheduleInitBook(50);
        });
        els.zoomInButton?.addEventListener('click', () => app.adjustZoom(0.15));
        els.zoomOutButton?.addEventListener('click', () => app.adjustZoom(-0.15));
        els.zoomResetButton?.addEventListener('click', app.resetZoom);
        els.fullscreenButton?.addEventListener('click', app.toggleFullscreen);
        els.exportBookButton?.addEventListener('click', app.exportBookAsImage);
        els.inspectBookButton?.addEventListener('click', () => app.toggleInspectMode());
        els.magnifierButton?.addEventListener('click', () => app.toggleMagnifierEnabled());
        els.pageContextMenu?.addEventListener('click', event => {
            const button = event.target.closest('button[data-action]');
            if (button) app.runPageContextAction(button.dataset.action || '');
        });
        els.mediaContextMenu?.addEventListener('click', event => {
            const button = event.target.closest('button[data-action]');
            if (button) app.runMediaContextAction(button.dataset.action || '');
        });

        const closeContextMenusOnOutsideClick = event => {
            if ((event.type === 'pointerdown' || event.type === 'mousedown') && event.button !== 0) return;
            const target = event.target;
            const path = event.composedPath ? event.composedPath() : (event.path || []);
            const clickedInsidePageMenu = els.pageContextMenu && (path.includes(els.pageContextMenu) || (target instanceof Node && els.pageContextMenu.contains(target)));
            const clickedInsideMediaMenu = els.mediaContextMenu && (path.includes(els.mediaContextMenu) || (target instanceof Node && els.mediaContextMenu.contains(target)));
            if (els.pageContextMenu && !els.pageContextMenu.hidden && !clickedInsidePageMenu) app.closePageContextMenu();
            if (els.mediaContextMenu && !els.mediaContextMenu.hidden && !clickedInsideMediaMenu) app.closeMediaContextMenu();
        };

        document.addEventListener('pointerdown', closeContextMenusOnOutsideClick, true);
        document.addEventListener('mousedown', closeContextMenusOnOutsideClick, true);
        document.addEventListener('click', closeContextMenusOnOutsideClick, true);
        document.addEventListener('contextmenu', event => {
            const target = event.target;
            if (target === els.canvas) return;
            if (target instanceof Element && (target.closest('.page-card') || target.closest('.media-card'))) return;
            app.closeContextMenus();
        }, true);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                app.closeContextMenus();
                app.setMediaTrayOpen(false);
                return;
            }
            const tag = event.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;
            const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
            switch (event.key.toLowerCase()) {
                case 'arrowleft':
                    void app.beginPageFlip(-1);
                    break;
                case 'arrowright':
                    void app.beginPageFlip(1);
                    break;
                case 'home':
                    event.preventDefault();
                    app.goToFirstPage();
                    break;
                case 'end':
                    event.preventDefault();
                    app.goToLastPage();
                    break;
                case ' ':
                    event.preventDefault();
                    void app.beginPageFlip(1);
                    break;
                case 'z':
                    app.adjustZoom(event.shiftKey ? -0.15 : 0.15);
                    break;
                case 'f':
                    app.toggleFullscreen();
                    break;
                case 'e':
                    app.exportBookAsImage();
                    break;
                case 's':
                    event.preventDefault();
                    app.saveBookState();
                    break;
                case 't':
                    if (!state.isCanvasHovered) break;
                    event.preventDefault();
                    app.toggleInspectMode();
                    break;
                default:
                    break;
            }
        });

        const dragThreshold = 40;
        els.canvas.addEventListener('pointerenter', event => {
            app.setCanvasHovered(true);
            updateClosedBookHover(event);
            if (state.magnifierEnabled) {
                app.setMagnifierPointer(app.getCanvasPoint(event));
                app.setMagnifierVisible(true);
            }
        });
        els.canvas.addEventListener('pointermove', event => {
            updateClosedBookHover(event);
            if (state.inspectMode) app.setInspectTargetsFromPoint(app.getCanvasPoint(event));
            if (state.magnifierEnabled) app.setMagnifierPointer(app.getCanvasPoint(event));
        });
        els.canvas.addEventListener('pointerleave', () => {
            app.setCanvasHovered(false);
            app.setClosedBookHovered(false);
            app.setMagnifierVisible(false);
        });
        els.canvas.addEventListener('wheel', event => {
            if (state.sealed) {
                event.preventDefault();
                app.setStatus('The seal blocks page actions. Left-click the chains to break them.');
                return;
            }
            const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
            if (Math.abs(dominantDelta) < 4) return;
            event.preventDefault();
            app.queuePageFlip(dominantDelta > 0 ? 1 : -1);
        }, { passive: false });
        els.canvas.addEventListener('pointerdown', event => {
            if (event.button === 2) {
                const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
                if (app.isClosedBookVisible(pagesData) && !state.isAnimating && !state.isPreparingFlip && !state.sealed) {
                    event.preventDefault();
                    app.startClosedBookSideFlip();
                }
                return;
            }
            if (event.button !== 0) return;
            els.canvas.setPointerCapture(event.pointerId);
            event.preventDefault();
            if (state.sealed) {
                app.strikeSeal();
                return;
            }
            const pagesData = app.buildPagesData();
            if (state.isAnimating || state.isPreparingFlip) {
                state.flipSpeed = 'fast';
                state.mouseHoldStartTime = performance.now();
                return;
            }
            if (app.isClosedStart() || app.isClosedEnd(pagesData)) {
                state.mouseHoldStartTime = performance.now();
                return;
            }
            state.dragStartX = event.clientX;
            state.dragStartY = event.clientY;
            state.isDragging = false;
            state.dragDirection = 0;
            state.dragProgress = 0;
            state.dragPreparedDirection = 0;
            state.animationPageCanvases.clear();
            state.mouseHoldStartTime = performance.now();
        });

        els.canvas.addEventListener('pointermove', event => {
            if (!state.mouseHoldStartTime || state.isAnimating) return;
            const pagesData = app.buildPagesData();
            if (app.isClosedStart() || app.isClosedEnd(pagesData)) return;
            event.preventDefault();
            const dx = event.clientX - state.dragStartX;
            const dy = event.clientY - state.dragStartY;
            const totalMovement = Math.sqrt((dx * dx) + (dy * dy));
            if (!state.isDragging && totalMovement >= dragThreshold) {
                state.isDragging = true;
                const canvasRect = els.canvas.getBoundingClientRect();
                const canvasCenterX = canvasRect.left + (canvasRect.width / 2);
                if (state.dragStartX < canvasCenterX) state.dragDirection = dx > 0 ? -1 : 0;
                else state.dragDirection = dx < 0 ? 1 : 0;
            }
            if (state.isDragging && state.dragDirection !== 0 && !state.dragPreparedDirection) {
                state.dragPreparedDirection = state.dragDirection;
                app.prepareDragFlipCanvases(state.dragDirection, pagesData);
            }
            if (state.isDragging && state.dragDirection !== 0) {
                const canvasRect = els.canvas.getBoundingClientRect();
                const centerX = app.margin + pageWidth + state.viewOffsetX;
                const canvasScaleX = canvasRect.width / els.canvas.width;
                const centerClientX = canvasRect.left + (centerX * canvasScaleX);
                const pageWidthClient = pageWidth * canvasScaleX;
                const targetClientX = state.dragDirection === 1 ? centerClientX - (pageWidthClient * 0.5) : centerClientX + (pageWidthClient * 0.5);
                const dragDistance = state.dragDirection === 1 ? state.dragStartX - event.clientX : event.clientX - state.dragStartX;
                const dragRange = state.dragDirection === 1 ? Math.max(120, state.dragStartX - targetClientX) : Math.max(120, targetClientX - state.dragStartX);
                const rawProgress = Math.min(1, Math.max(0, dragDistance / dragRange));
                state.dragProgress = rawProgress;
                if (rawProgress >= 0.995) {
                    const committedDirection = state.dragDirection;
                    state.isDragging = false;
                    state.dragDirection = 0;
                    state.dragProgress = 0;
                    state.dragPreparedDirection = 0;
                    state.mouseHoldStartTime = 0;
                    app.commitDragPageFlip(committedDirection);
                    return;
                }
                app.renderDragFrame(app.buildPagesData(), centerX, state.dragDirection, app.easeFlipProgress(rawProgress), centerX);
            }
        });

        els.canvas.addEventListener('pointerup', event => {
            if (event.button !== 0) return;
            try {
                els.canvas.releasePointerCapture(event.pointerId);
            } catch {}
            const wasDragging = state.isDragging;
            const releaseDirection = state.dragDirection || 0;
            const releaseProgress = state.dragProgress || 0;
            state.isDragging = false;
            state.dragDirection = 0;
            state.dragProgress = 0;
            state.dragPreparedDirection = 0;
            if (wasDragging && !state.isAnimating) {
                if (releaseDirection !== 0 && releaseProgress >= 0.22) {
                    app.startDragReleaseFlip(releaseDirection, releaseProgress);
                } else {
                    app.requestBookRender();
                    app.setStatus('Drag cancelled.');
                }
            } else if (!wasDragging && !state.isAnimating && !state.isPreparingFlip && state.mouseHoldStartTime) {
                const pagesData = app.buildPagesData();
                const { x } = app.getCanvasPoint(event);
                let dir = 0;
                if (app.isClosedEnd(pagesData) && state.currentPage > 0) dir = -1;
                else if ((x > els.canvas.width / 2 || state.currentPage === 0) && state.currentPage < pagesData.length - 2) dir = 1;
                else if (x < els.canvas.width / 2 && state.currentPage > 0) dir = -1;
                state.flipSpeed = 'normal';
                if (dir !== 0) void app.beginPageFlip(dir);
            }
            state.mouseHoldStartTime = 0;
        });

        els.canvas.addEventListener('pointercancel', () => {
            state.isDragging = false;
            state.dragDirection = 0;
            state.dragPreparedDirection = 0;
            state.animationPageCanvases.clear();
            if (!state.isAnimating && !state.isPreparingFlip) state.flipSpeed = 'normal';
            state.mouseHoldStartTime = 0;
        });
        els.canvas.addEventListener('contextmenu', event => {
            const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
            if (app.isClosedBookVisible(pagesData) && !state.isAnimating && !state.isPreparingFlip && !state.sealed) {
                event.preventDefault();
                return;
            }
            event.preventDefault();
            if (state.isAnimating) return;
            if (state.sealed) {
                app.setStatus('The seal blocks page actions. Left-click the chains to break them.');
                return;
            }
            app.openPageContextMenu(app.getCanvasPageContextTarget(event), event.clientX, event.clientY);
        });

        window.addEventListener('message', event => {
            const message = event?.data || null;
            if (!message || message.source !== 'urage-dashboard') return;
            if (message.type === 'tool:theme') app.applyDashboardTheme(message.payload?.theme);
            if (message.type === 'tool:image-pools') app.applyDashboardMediaPayload({ pools: message.payload?.pools });
            if (message.type === 'interactive-book:media-tray') {
                app.applyDashboardMediaPayload(message.payload || {});
                app.setMediaTrayOpen(message.payload?.open !== false, message.payload?.tab || 'pools');
            }
        });

        window.addEventListener('beforeunload', () => {
            try {
                app.saveBookState({ silent: true });
            } catch {}
            state.objectUrls.forEach(url => URL.revokeObjectURL(url));
            state.objectUrls.clear();
        });
    }

    async function init() {
        window.registerDashboardThemeSync?.(theme => app.applyDashboardTheme(theme));
        app.applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
        const restored = app.restoreBookState();
        if (!restored) {
            state.books = [app.createBook({ title: 'My Journal' })];
            state.activeBookId = state.books[0].id;
            app.applyBookStyle(els.bookStyleSelect?.value || 'inferno');
        } else {
            app.applyBookStyle(state.bookStyle);
        }
        app.applyActiveBookToState();
        if (els.pageFontSizeSelect) els.pageFontSizeSelect.value = String(state.fontSize || 22);
        if (els.pageBgColorSelect) els.pageBgColorSelect.value = String(state.bgColor || '#fdfbf0');
        if (els.animationSpeedSelect) els.animationSpeedSelect.value = String(state.animationDuration || 760);
        app.populateInsertPositionSelect();
        app.updateSealButton();
        bindEvents();
        app.requestBookRender();
        await app.initBook();
        await app.refreshDashboardMedia();
    }

    Object.assign(app, {
        addUploadedFiles,
        bindEvents,
        init
    });
}
