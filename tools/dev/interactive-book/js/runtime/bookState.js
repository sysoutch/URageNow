export function registerBookStateModule(app) {
    const { els, state, basePages, bookSkins, maxSealIntegrity, pageWidth, pageHeight, margin } = app;
    const storageKey = 'interactive-book-state-v2';

    function getDisplayFileName(value, fallback = 'Book Page') {
        const raw = String(value || '').trim();
        if (!raw) return fallback;
        let candidate;
        try {
            const url = new URL(raw, window.location.href);
            candidate =
                url.searchParams.get('file') ||
                url.searchParams.get('filename') ||
                url.searchParams.get('name') ||
                url.pathname.split('/').filter(Boolean).pop();
        } catch {
            candidate = raw.split(/[\\/]/).pop();
        }
        candidate = String(candidate || '')
            .split(/[?#]/)[0]
            .trim();
        try {
            candidate = decodeURIComponent(candidate);
        } catch {}
        const lastDot = candidate.lastIndexOf('.');
        let name = candidate;
        let ext = '';
        if (lastDot > 0) {
            name = candidate.slice(0, lastDot);
            ext = candidate.slice(lastDot + 1).toUpperCase();
        }
        name = name
            .replace(/[_.-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return ext
            ? `${name} (${ext})`
            : name || fallback;
    }

    function isPersistentMediaSource(source) {
        const value = String(source || '').trim();
        return Boolean(value && !value.startsWith('blob:') && !value.startsWith('data:'));
    }

    function createBook(input) {
        const index = state.books.length + 1;
        return {
            id: String(input?.id || crypto.randomUUID()),
            title: String(input?.title || `Book ${index}`).trim() || `Book ${index}`,
            description: String(input?.description || 'A collection of captured moments.').trim(),
            dynamicPages: Array.isArray(input?.dynamicPages) ? input.dynamicPages : []
        };
    }

    function getActiveBook() {
        let book = state.books.find(entry => entry.id === state.activeBookId) || null;
        if (!book) {
            book = createBook({ title: 'My Journal' });
            state.books.push(book);
            state.activeBookId = book.id;
        }
        book.dynamicPages = Array.isArray(book.dynamicPages) ? book.dynamicPages : [];
        return book;
    }

    function syncActiveBookFromState() {
        const book = getActiveBook();
        book.dynamicPages = state.dynamicPages;
        if (els.bookTitleInput) book.title = String(els.bookTitleInput.value || book.title).trim() || 'Untitled Book';
        if (els.bookDescriptionInput) book.description = String(els.bookDescriptionInput.value || '').trim();
    }

    function applyActiveBookToState() {
        const book = getActiveBook();
        state.dynamicPages = book.dynamicPages;
        if (els.bookTitleInput) els.bookTitleInput.value = book.title;
        if (els.bookDescriptionInput) els.bookDescriptionInput.value = book.description;
        renderBookTabs();
    }

    function renderBookTabs() {
        if (!els.bookTabs) return;
        els.bookTabs.innerHTML = '';
        state.books.forEach(book => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'book-tab' + (book.id === state.activeBookId ? ' active' : '');
            button.textContent = book.title || 'Untitled';
            button.addEventListener('click', () => switchBook(book.id));
            els.bookTabs.appendChild(button);
        });
    }

    function switchBook(bookId) {
        syncActiveBookFromState();
        state.activeBookId = String(bookId || '').trim() || state.activeBookId;
        state.currentPage = 0;
        applyActiveBookToState();
        void app.initBook();
        scheduleBookStateSave();
        setStatus(`Switched to ${getActiveBook().title}.`);
    }

    function addBook() {
        syncActiveBookFromState();
        const book = createBook({});
        state.books.push(book);
        state.activeBookId = book.id;
        state.currentPage = 0;
        applyActiveBookToState();
        void app.initBook();
        scheduleBookStateSave();
        setStatus(`Created ${book.title}.`);
    }

    function scheduleInitBook(delay) {
        if (state.initBookTimer) clearTimeout(state.initBookTimer);
        state.initBookTimer = window.setTimeout(() => {
            state.initBookTimer = 0;
            void app.initBook();
        }, Number.isFinite(delay) ? delay : 140);
    }

    function serializePage(page) {
        if (!isPersistentMediaSource(page?.image)) return null;
        return {
            id: String(page.id || crypto.randomUUID()),
            image: String(page.image || '').trim(),
            name: getDisplayFileName(page.name || page.image, 'Book Page'),
            text: String(page.text || '').trim(),
            sourceKind: String(page.sourceKind || 'dashboard'),
            mediaKind: String(page.mediaKind || inferMediaKind(page)),
            bg: String(page.bg || '#fdfbf0')
        };
    }

    function serializeBook(book) {
        const pages = Array.isArray(book?.dynamicPages) ? book.dynamicPages.map(serializePage).filter(Boolean) : [];
        return {
            id: String(book?.id || crypto.randomUUID()),
            title: String(book?.title || 'Untitled Book').trim() || 'Untitled Book',
            description: String(book?.description || '').trim(),
            dynamicPages: pages
        };
    }

    function saveBookState(options) {
        syncActiveBookFromState();
        const payload = {
            version: 2,
            activeBookId: state.activeBookId,
            bookStyle: state.bookStyle,
            fontSize: state.fontSize,
            bgColor: state.bgColor,
            animationDuration: state.animationDuration,
            books: state.books.map(serializeBook).filter(Boolean)
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        if (!options?.silent) setStatus('Book saved.');
    }

    function scheduleBookStateSave() {
        if (state.bookSaveTimer) window.clearTimeout(state.bookSaveTimer);
        state.bookSaveTimer = window.setTimeout(() => {
            state.bookSaveTimer = 0;
            saveBookState({ silent: true });
        }, 220);
    }

    function restoreBookState() {
        const rawValue = localStorage.getItem(storageKey);
        if (!rawValue) return false;
        let payload = null;
        try {
            payload = JSON.parse(rawValue);
        } catch {
            return false;
        }
        const books = Array.isArray(payload?.books)
            ? payload.books.map(book => createBook({
                id: book.id,
                title: book.title,
                description: book.description,
                dynamicPages: Array.isArray(book.dynamicPages) ? book.dynamicPages.map(createDynamicPage).filter(page => page.image) : []
            })).filter(book => book.id)
            : [];
        if (books.length === 0) return false;
        state.books = books;
        state.activeBookId = books.some(book => book.id === payload.activeBookId) ? payload.activeBookId : books[0].id;
        state.bookStyle = Object.prototype.hasOwnProperty.call(bookSkins, payload?.bookStyle) ? payload.bookStyle : state.bookStyle;
        state.fontSize = Number.isFinite(payload?.fontSize) ? Math.max(12, Math.min(42, payload.fontSize)) : state.fontSize;
        state.bgColor = String(payload?.bgColor || state.bgColor || '#fdfbf0');
        state.animationDuration = Number.isFinite(payload?.animationDuration) ? Math.max(200, payload.animationDuration) : state.animationDuration;
        return true;
    }

    function applyDashboardTheme(theme) {
        const allowed = new Set(['blood', 'fire', 'water', 'love', 'purple', 'crystal', 'nature', 'rock']);
        const nextTheme = allowed.has(String(theme || '').trim()) ? String(theme).trim() : 'fire';
        document.body.setAttribute('data-dashboard-theme', nextTheme);
    }

    function applyBookStyle(styleId) {
        const nextStyle = Object.prototype.hasOwnProperty.call(bookSkins, styleId) ? styleId : 'inferno';
        if (state.bookStyle === nextStyle) {
            document.body.setAttribute('data-book-style', nextStyle);
            if (els.bookStyleSelect && els.bookStyleSelect.value !== nextStyle) {
                els.bookStyleSelect.value = nextStyle;
            }
            return;
        }
        state.bookStyle = nextStyle;
        document.body.setAttribute('data-book-style', nextStyle);
        state.prerenderedPages = [];
        state.prerenderedPageKeys = [];
        state.pageRenderCache.clear();
        if (els.bookStyleSelect && els.bookStyleSelect.value !== nextStyle) {
            els.bookStyleSelect.value = nextStyle;
        }
        scheduleBookStateSave();
    }

    function setStatus(text) {
        if (els.bookStatus) els.bookStatus.textContent = String(text || '').trim() || 'Ready.';
    }

    function updateSealButton() {
        if (!els.sealBookButton) return;
        els.sealBookButton.textContent = state.sealed ? `Chains Holding (${state.sealIntegrity})` : 'Seal Book';
        els.sealBookButton.disabled = state.sealed;
    }

    function sealBook() {
        state.sealed = true;
        state.sealIntegrity = maxSealIntegrity;
        state.sealHitTime = performance.now();
        state.currentPage = 0;
        state.progress = 0;
        state.isAnimating = false;
        state.isPreparingFlip = false;
        state.preparingFlipDirection = 0;
        state.queuedPageFlips = [];
        state.dir = 0;
        state.animationPhase = 'idle';
        state.animationPlan = null;
        state.animationPageCanvases.clear();
        updateSealButton();
        closeContextMenus();
        setStatus('The book is sealed. Click the chained cover repeatedly to break it open.');
        app.requestBookRender();
    }

    function strikeSeal() {
        if (!state.sealed) return false;
        state.sealIntegrity = Math.max(0, state.sealIntegrity - 1);
        state.sealHitTime = performance.now();
        if (state.sealIntegrity <= 0) {
            state.sealed = false;
            updateSealButton();
            setStatus('The chains break. The book can open again.');
            app.requestBookRender();
            return true;
        }
        updateSealButton();
        setStatus(`${state.sealIntegrity} chain break${state.sealIntegrity === 1 ? '' : 's'} left.`);
        app.requestBookRender();
        return true;
    }

    function buildPagesData() {
        const activeBook = getActiveBook();
        const pages = [];
        basePages.forEach(page => {
            if (page.type === 'dynamic-placeholder') {
                state.dynamicPages.forEach(dynamicPage => pages.push(dynamicPage));
                if (state.dynamicPages.length === 0) {
                    pages.push({ image: '', text: 'Add pages from disk,\nimage pools, or recents.', bg: '#fdfbf0', textColor: '#555', fontSize: 22 });
                } else if (state.dynamicPages.length % 2 === 0) {
                    pages.push({ bg: bookSkins[state.bookStyle]?.pageSurface || '#fdfbf0', textColor: '#000', fontSize: 22, text: '' });
                }
                return;
            }
            if (page.text === 'MY\nJOURNAL') {
                pages.push({ ...page, text: String(activeBook.title || 'Untitled Book').replace(/\s+/g, '\n'), fontSize: 42 });
            } else if (page.text === 'A collection of\ncaptured moments.') {
                pages.push({ ...page, text: String(activeBook.description || 'A collection of captured moments.').replace(/\s+/g, ' ') });
            } else {
                pages.push(page);
            }
        });
        return pages;
    }

    function getPageCacheKey(data, index) {
        if (!data) return `empty:${index}`;
        return [
            data.id || `base:${index}`,
            data.image || '',
            data.text || '',
            data.bg || '',
            data.textColor || '',
            data.fontSize || '',
            data.mediaKind || '',
            state.bookStyle,
            state.fontSize || '',
            state.bgColor || ''
        ].join('|');
    }

    function getVisiblePageIndexes(pagesData) {
        const indexes = new Set([1, pagesData.length - 1]);
        const add = index => {
            if (index >= 0 && index < pagesData.length) indexes.add(index);
        };
        if (state.isAnimating || state.isPreparingFlip) {
            const targetPage = Math.max(0, Math.min(pagesData.length - 1, state.currentPage + (state.dir * 2)));
            for (let i = -6; i <= 8; i += 1) add(state.currentPage + i);
            for (let i = -6; i <= 8; i += 1) add(targetPage + i);
        } else {
            const targetPage = Math.max(0, Math.min(pagesData.length - 1, state.currentPage + (state.dir * 2)));
            for (let i = -4; i <= 6; i += 1) add(state.currentPage + i);
            for (let i = -8; i <= 10; i += 1) add(targetPage + i);
        }
        return Array.from(indexes).sort((a, b) => a - b);
    }

    function hasVisibleLiveMedia(pagesData) {
        return getVisiblePageIndexes(pagesData).some(index => {
            const page = pagesData[index];
            return page && page.mediaKind && page.mediaKind !== 'image' && state.mediaElements.has(page.id);
        });
    }

    function hasActiveSeal() {
        return state.sealed || state.sealIntegrity > 0;
    }

    function getClosedBookSide(pagesData) {
        if (app.isClosedStart()) return 'front';
        if (app.isClosedEnd(pagesData)) return 'back';
        return '';
    }

    function isClosedBookVisible(pagesData) {
        return Boolean(getClosedBookSide(pagesData)) && !state.isPreparingFlip;
    }

    function setClosedBookHovered(hovered) {
        const nextHovered = hovered === true;
        if (state.isClosedBookHovered === nextHovered) return;
        state.isClosedBookHovered = nextHovered;
        app.requestBookRender();
    }

    function setCanvasHovered(hovered) {
        state.isCanvasHovered = hovered === true;
        if (!state.isCanvasHovered) state.inspectTargetRotationX = 0;
        if (!state.isCanvasHovered) state.inspectTargetRotationY = 0;
        if (!state.isCanvasHovered && state.inspectMode) app.requestBookRender();
    }

    function setInspectTargetsFromPoint(point) {
        if (!state.inspectMode || !point) return;
        const normalizedX = ((point.x / els.canvas.width) * 2) - 1;
        const normalizedY = ((point.y / els.canvas.height) * 2) - 1;
        state.inspectTargetRotationY = Math.max(-22, Math.min(22, normalizedX * -22));
        state.inspectTargetRotationX = Math.max(-14, Math.min(14, normalizedY * 14));
        app.requestBookRender();
    }

    function applyCanvasPresentationTransform() {
        const zoom = `scale(${state.zoomLevel})`;
        if (state.inspectMode) {
            els.canvas.style.transform = `perspective(1600px) rotateX(${state.inspectRotationX.toFixed(2)}deg) rotateY(${state.inspectRotationY.toFixed(2)}deg) ${zoom}`;
            return;
        }
        els.canvas.style.transform = zoom;
    }

    function updateInspectPresentationMotion() {
        const targetX = state.inspectMode && state.isCanvasHovered ? state.inspectTargetRotationX : 0;
        const targetY = state.inspectMode && state.isCanvasHovered ? state.inspectTargetRotationY : 0;
        state.inspectRotationX += (targetX - state.inspectRotationX) * 0.14;
        state.inspectRotationY += (targetY - state.inspectRotationY) * 0.14;
        if (Math.abs(targetX - state.inspectRotationX) < 0.02) state.inspectRotationX = targetX;
        if (Math.abs(targetY - state.inspectRotationY) < 0.02) state.inspectRotationY = targetY;
        applyCanvasPresentationTransform();
    }

    function isInspectMotionSettled() {
        const targetX = state.inspectMode && state.isCanvasHovered ? state.inspectTargetRotationX : 0;
        const targetY = state.inspectMode && state.isCanvasHovered ? state.inspectTargetRotationY : 0;
        return Math.abs(targetX - state.inspectRotationX) < 0.02 && Math.abs(targetY - state.inspectRotationY) < 0.02;
    }

    function setInspectMode(active, options) {
        const pagesData = state.pagesData?.length ? state.pagesData : buildPagesData();
        const nextActive = active === undefined ? !state.inspectMode : active === true;
        if (nextActive && !isClosedBookVisible(pagesData)) return;
        state.inspectMode = nextActive;
        if (!nextActive || options?.reset !== false) {
            state.inspectTargetRotationX = 0;
            state.inspectTargetRotationY = 0;
        }
        if (!nextActive) {
            state.inspectRotationX = 0;
            state.inspectRotationY = 0;
        }
        syncClosedBookUi();
        applyCanvasPresentationTransform();
        app.requestBookRender();
    }

    function toggleInspectMode() {
        setInspectMode(!state.inspectMode);
        setStatus(state.inspectMode ? 'Inspect mode enabled.' : 'Inspect mode disabled.');
    }

    function setMagnifierEnabled(active) {
        state.magnifierEnabled = active === undefined ? !state.magnifierEnabled : active === true;
        if (!state.magnifierEnabled) state.magnifierVisible = false;
        syncClosedBookUi();
        app.requestBookRender();
    }

    function toggleMagnifierEnabled() {
        setMagnifierEnabled(!state.magnifierEnabled);
        setStatus(state.magnifierEnabled ? 'Magnifier enabled.' : 'Magnifier disabled.');
    }

    function setMagnifierPointer(point) {
        if (!point) return;
        state.magnifierPointerX = Number(point.x) || 0;
        state.magnifierPointerY = Number(point.y) || 0;
        state.magnifierVisible = state.magnifierEnabled && state.isCanvasHovered;
        if (state.magnifierEnabled) app.requestBookRender();
    }

    function setMagnifierVisible(visible) {
        state.magnifierVisible = state.magnifierEnabled && visible === true;
        syncClosedBookUi();
        if (state.magnifierEnabled || !visible) app.requestBookRender();
    }

    function syncClosedBookUi() {
        if (els.inspectBookButton) {
            els.inspectBookButton.classList.toggle('is-active', state.inspectMode);
            els.inspectBookButton.setAttribute('aria-pressed', state.inspectMode ? 'true' : 'false');
        }
        if (els.magnifierButton) {
            els.magnifierButton.classList.toggle('is-active', state.magnifierEnabled);
            els.magnifierButton.setAttribute('aria-pressed', state.magnifierEnabled ? 'true' : 'false');
        }
        if (els.magnifierLens) els.magnifierLens.classList.toggle('hidden', !state.magnifierEnabled || !state.magnifierVisible);
        if (state.magnifierEnabled && state.isCanvasHovered) {
            els.canvas.style.cursor = 'none';
        } else if (state.inspectMode) {
            els.canvas.style.cursor = 'grab';
        } else if (els.inspectBookButton?.classList.contains('is-active')) {
            els.canvas.style.cursor = 'pointer';
        } else {
            els.canvas.style.cursor = 'default';
        }
    }

    function needsPresentationTick() {
        return Math.abs((state.isClosedBookHovered ? 1 : 0) - state.closedBookHoverProgress) > 0.001 || !isInspectMotionSettled();
    }

    function shouldKeepRendering(pagesData) {
        return hasActiveSeal() || hasVisibleLiveMedia(pagesData) || !app.isViewOffsetSettled(pagesData) || needsPresentationTick();
    }

    function createDynamicPage(input) {
        const mediaKind = inferMediaKind(input);
        const fallbackName = mediaKind === 'video' ? 'Video Page' : 'Book Page';
        return {
            id: String(input.id || crypto.randomUUID()),
            image: String(input.image || '').trim(),
            name: getDisplayFileName(input.name || input.image, fallbackName),
            text: String(input.text || '').trim(),
            sourceKind: String(input.sourceKind || 'upload'),
            mediaKind,
            bg: String(input.bg || '#fdfbf0')
        };
    }

    function inferMediaKind(input) {
        const type = String(input?.type || '').toLowerCase();
        const name = String(input?.name || input?.image || '').toLowerCase();
        if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(name)) return 'video';
        if (type === 'image/gif' || /\.gif(\?|#|$)/i.test(name)) return 'gif';
        return 'image';
    }

    function getInsertIndexFromSelection() {
        const rawValue = String(state.insertPosition || 'end').trim();
        if (!rawValue || rawValue === 'end') return state.dynamicPages.length;
        if (rawValue === 'start') return 0;
        if (rawValue === 'after-current') {
            const currentVisibleIndex = Math.max(0, Math.floor(Math.max(0, state.currentPage - 2) / 2));
            return Math.min(state.dynamicPages.length, currentVisibleIndex + 1);
        }
        if (rawValue.startsWith('before:')) {
            const pageId = rawValue.slice('before:'.length);
            const index = state.dynamicPages.findIndex(page => page.id === pageId);
            return index >= 0 ? index : state.dynamicPages.length;
        }
        if (rawValue.startsWith('after:')) {
            const pageId = rawValue.slice('after:'.length);
            const index = state.dynamicPages.findIndex(page => page.id === pageId);
            return index >= 0 ? Math.min(state.dynamicPages.length, index + 1) : state.dynamicPages.length;
        }
        return state.dynamicPages.length;
    }

    function setInsertPosition(value, options) {
        state.insertPosition = String(value || 'end').trim() || 'end';
        if (els.insertPositionSelect && els.insertPositionSelect.value !== state.insertPosition) {
            els.insertPositionSelect.value = state.insertPosition;
        }
        if (!options || options.render !== false) populateInsertPositionSelect();
    }

    function populateInsertPositionSelect() {
        if (!els.insertPositionSelect) return;
        const previous = String(state.insertPosition || els.insertPositionSelect.value || 'end').trim() || 'end';
        els.insertPositionSelect.innerHTML = '';
        const options = [
            { value: 'start', label: 'At beginning of dynamic pages' },
            { value: 'after-current', label: 'After current spread' },
            { value: 'end', label: 'Before ending page' }
        ];
        state.dynamicPages.forEach((page, index) => {
            options.push({ value: `before:${page.id}`, label: `Before page ${index + 1}: ${page.name}` });
            options.push({ value: `after:${page.id}`, label: `After page ${index + 1}: ${page.name}` });
        });
        options.forEach(option => {
            els.insertPositionSelect.appendChild(new Option(option.label, option.value));
        });
        const nextValue = options.some(option => option.value === previous) ? previous : 'end';
        els.insertPositionSelect.value = nextValue;
        state.insertPosition = nextValue;
    }

    function normalizePoolImage(poolId, image, index) {
        if (typeof image === 'string') {
            const url = String(image || '').trim();
            return url ? { id: `${poolId}:${index}`, poolId, name: getDisplayFileName(url, `Pool Image ${index + 1}`), url, detail: getDisplayFileName(url, 'Pool image') } : null;
        }
        const url = String(image?.url || image?.source || '').trim();
        if (!url) return null;
        const fileName = getDisplayFileName(image?.fileName || image?.name || url, `Pool Image ${index + 1}`);
        return { id: `${poolId}:${index}`, poolId, name: fileName, url, detail: getDisplayFileName(image?.source || url, fileName) };
    }

    function getGeneratedImageUrl(image) {
        const explicitUrl = String(image?.url || '').trim();
        if (explicitUrl) return explicitUrl;
        const imageId = String(image?.id || '').trim();
        const fileName = String(image?.imageFileName || image?.fileName || '').trim();
        if (!imageId || !fileName) return '';
        return `/api/generated-image-file?imageId=${encodeURIComponent(imageId)}&file=${encodeURIComponent(fileName)}`;
    }

    function normalizeGeneratedImage(image, index) {
        const url = getGeneratedImageUrl(image);
        if (!url) return null;
        const id = String(image?.id || `recent-${index}`);
        const fileName = getDisplayFileName(image?.imageFileName || image?.fileName || url, `Generated ${index + 1}`);
        const prompt = String(image?.prompt || '').trim();
        return { id, name: fileName, url, detail: prompt || 'Generated image' };
    }

    function applyDashboardMediaPayload(payload) {
        if (Array.isArray(payload?.pools)) {
            state.imagePools = payload.pools.map(pool => ({
                id: String(pool?.id || '').trim(),
                name: String(pool?.name || 'Image Pool').trim() || 'Image Pool',
                images: Array.isArray(pool?.images) ? pool.images : []
            })).filter(pool => pool.id);
            populatePoolSelect();
        }
        if (Array.isArray(payload?.recentImages)) {
            state.recentImages = payload.recentImages.map(normalizeGeneratedImage).filter(Boolean);
            renderDashboardMedia();
        }
    }

    function setMediaTrayTab(tab) {
        state.mediaTrayTab = tab === 'recent' ? 'recent' : 'pools';
        els.mediaTrayTabs.forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-media-tray-tab') === state.mediaTrayTab);
        });
        els.mediaTrayPanels.forEach(panel => {
            panel.classList.toggle('active', panel.getAttribute('data-media-tray-panel') === state.mediaTrayTab);
        });
    }

    function renderSelectableMediaList(container, items, selectedIds, emptyText, sourceType) {
        if (!container) return;
        container.innerHTML = '';
        if (!Array.isArray(items) || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'media-empty';
            empty.textContent = emptyText;
            container.appendChild(empty);
            return;
        }
        items.forEach(item => {
            const mediaKind = inferMediaKind({ name: item.name, image: item.url });
            const card = document.createElement('div');
            card.className = 'media-card' + (selectedIds.has(item.id) ? ' active' : '');
            const thumb = mediaKind === 'video' ? document.createElement('video') : document.createElement('img');
            thumb.className = 'media-thumb';
            thumb.src = item.url;
            if (thumb.tagName === 'IMG') thumb.alt = item.name;
            if (thumb.tagName === 'VIDEO') {
                thumb.muted = true;
                thumb.loop = true;
                thumb.playsInline = true;
            }
            const meta = document.createElement('div');
            meta.className = 'media-meta';
            meta.innerHTML = `<div class="media-name">${app.escapeHtml(item.name)}</div><div class="media-detail">${app.escapeHtml(item.detail || '')}</div>`;

            const actions = document.createElement('div');
            actions.className = 'media-actions';
            const toggleButton = document.createElement('button');
            toggleButton.type = 'button';
            toggleButton.className = 'ghost-button icon-button';
            toggleButton.textContent = selectedIds.has(item.id) ? 'Selected' : 'Select';
            toggleButton.addEventListener('click', () => {
                if (selectedIds.has(item.id)) selectedIds.delete(item.id);
                else selectedIds.add(item.id);
                renderDashboardMedia();
            });
            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.className = 'secondary-button icon-button';
            addButton.textContent = 'Insert';
            addButton.addEventListener('click', () => {
                addDynamicPages([{ id: item.id, image: item.url, name: item.name, text: item.detail || '', sourceKind: 'dashboard', type: mediaKind === 'video' ? 'video/mp4' : '' }]);
            });
            actions.append(toggleButton, addButton);
            card.append(thumb, meta, actions);
            card.addEventListener('contextmenu', event => {
                event.preventDefault();
                openMediaContextMenu({ ...item, sourceType, selectedIds }, event.clientX, event.clientY);
            });
            container.appendChild(card);
        });
    }

    function renderPageQueue() {
        if (!els.pageQueue) return;
        els.pageQueue.innerHTML = '';
        if (state.dynamicPages.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'media-empty';
            empty.textContent = 'No custom image pages added yet.';
            els.pageQueue.appendChild(empty);
            return;
        }
        state.dynamicPages.forEach(page => {
            const card = document.createElement('div');
            card.className = 'page-card';
            card.dataset.pageId = page.id;
            card.draggable = true;
            const previewTag = page.mediaKind === 'video' ? 'video' : 'img';
            card.innerHTML = `
                <${previewTag} class="media-thumb" src="${page.image}" ${page.mediaKind === 'video' ? 'muted playsinline preload="metadata"' : `alt="${app.escapeHtml(page.name)}" loading="lazy"`}></${previewTag}>
                <div class="media-meta">
                    <div class="page-name">${app.escapeHtml(page.name)}</div>
                    <input class="page-title-input" value="${app.escapeHtml(page.name)}" aria-label="Page title">
                    <textarea class="page-text-input" rows="2" placeholder="Page text">${app.escapeHtml(page.text || '')}</textarea>
                    <div class="page-detail">${app.escapeHtml(page.sourceKind)}</div>
                </div>`;
            const titleInput = card.querySelector('.page-title-input');
            const textInput = card.querySelector('.page-text-input');
            titleInput?.addEventListener('input', event => {
                page.name = String(event.target?.value || '').trim() || 'Book Page';
                populateInsertPositionSelect();
                scheduleBookStateSave();
                scheduleInitBook(180);
            });
            textInput?.addEventListener('input', event => {
                page.text = String(event.target?.value || '');
                state.pageRenderCache.clear();
                state.prerenderedPages = [];
                state.prerenderedPageKeys = [];
                scheduleBookStateSave();
                app.requestBookRender();
            });

            const actions = document.createElement('div');
            actions.className = 'page-actions';
            const insertButton = document.createElement('button');
            insertButton.type = 'button';
            insertButton.className = 'secondary-button page-slot-button';
            insertButton.textContent = 'Insert Here';
            insertButton.addEventListener('click', () => {
                setInsertPosition(`before:${page.id}`);
                setStatus(`Insert target set before ${page.name}.`);
            });
            const uploadButton = document.createElement('button');
            uploadButton.type = 'button';
            uploadButton.className = 'ghost-button page-slot-button';
            uploadButton.textContent = 'Upload Here';
            uploadButton.addEventListener('click', () => {
                state.pendingUploadAction = { type: 'before', pageId: page.id };
                els.contextFileUpload?.click();
            });
            const gotoButton = document.createElement('button');
            gotoButton.type = 'button';
            gotoButton.className = 'secondary-button page-slot-button';
            gotoButton.textContent = 'Go To Page';
            gotoButton.addEventListener('click', () => {
                goToPage(page.id);
            });
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'ghost-button icon-button';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
                state.dynamicPages = state.dynamicPages.filter(entry => entry.id !== page.id);
                getActiveBook().dynamicPages = state.dynamicPages;
                state.currentPage = 0;
                scheduleBookStateSave();
                void app.initBook();
            });
            actions.append(insertButton, uploadButton, gotoButton, removeButton);
            card.appendChild(actions);

            card.addEventListener('contextmenu', event => {
                event.preventDefault();
                openPageContextMenu(page.id, event.clientX, event.clientY);
            });
            card.addEventListener('dragstart', event => {
                state.draggingPageId = page.id;
                card.classList.add('dragging');
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', page.id);
                }
            });
            card.addEventListener('dragend', () => {
                state.draggingPageId = '';
                card.classList.remove('dragging');
                els.pageQueue?.querySelectorAll('.page-card').forEach(node => node.classList.remove('drop-target'));
            });
            card.addEventListener('dragover', event => {
                event.preventDefault();
                if (!state.draggingPageId || state.draggingPageId === page.id) return;
                card.classList.add('drop-target');
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
            });
            card.addEventListener('dragleave', () => {
                card.classList.remove('drop-target');
            });
            card.addEventListener('drop', event => {
                event.preventDefault();
                card.classList.remove('drop-target');
                reorderDynamicPage(state.draggingPageId, page.id);
            });
            els.pageQueue.appendChild(card);
        });
        populateInsertPositionSelect();
    }

    function goToPage(pageId) {
        const pagesData = state.pagesData.length > 0 ? state.pagesData : buildPagesData();
        const targetIndex = pagesData.findIndex(page => page?.id === pageId);
        if (targetIndex < 0) return;
        const lastIndex = pagesData.length - 1;
        let nextPage = 0;
        if (targetIndex === lastIndex) nextPage = Math.max(0, targetIndex - 1);
        else if (targetIndex % 2 === 0) nextPage = targetIndex;
        else nextPage = Math.max(0, targetIndex - 1);
        state.currentPage = nextPage;
        app.requestBookRender();
    }

    function renderDashboardMedia() {
        const selectedPoolId = String(els.imagePoolSelect?.value || '').trim();
        const pool = state.imagePools.find(entry => entry.id === selectedPoolId) || null;
        const poolImages = pool ? pool.images.map((image, index) => normalizePoolImage(pool.id, image, index)).filter(Boolean) : [];
        renderSelectableMediaList(els.imagePoolList, poolImages, state.selectedPoolImageIds, 'No pool images available.', 'pool');
        renderSelectableMediaList(els.recentGeneratedList, state.recentImages, state.selectedRecentImageIds, 'No recent generated images loaded yet.', 'recent');
        renderPageQueue();
    }

    function populatePoolSelect() {
        if (!els.imagePoolSelect) return;
        const previous = String(els.imagePoolSelect.value || '').trim();
        els.imagePoolSelect.innerHTML = '';
        if (!Array.isArray(state.imagePools) || state.imagePools.length === 0) {
            els.imagePoolSelect.appendChild(new Option('No image pools loaded', ''));
            renderDashboardMedia();
            return;
        }
        state.imagePools.forEach(pool => {
            els.imagePoolSelect.appendChild(new Option(`${pool.name} (${Array.isArray(pool.images) ? pool.images.length : 0})`, pool.id));
        });
        const nextValue = state.imagePools.some(pool => pool.id === previous) ? previous : state.imagePools[0].id;
        els.imagePoolSelect.value = nextValue;
        renderDashboardMedia();
    }

    async function loadImagePools() {
        const response = await fetch('/api/image-pools');
        if (!response.ok) throw new Error('Failed to load image pools.');
        const payload = await response.json();
        state.imagePools = Array.isArray(payload) ? payload.map(pool => ({
            id: String(pool?.id || '').trim(),
            name: String(pool?.name || 'Image Pool').trim() || 'Image Pool',
            images: Array.isArray(pool?.images) ? pool.images : []
        })).filter(pool => pool.id) : [];
        populatePoolSelect();
    }

    async function loadRecentGeneratedImages() {
        const response = await fetch('/api/image-history');
        if (!response.ok) throw new Error('Failed to load recent generated images.');
        const payload = await response.json();
        state.recentImages = Array.isArray(payload) ? payload.slice(0, 24).map(normalizeGeneratedImage).filter(Boolean) : [];
        renderDashboardMedia();
    }

    async function refreshDashboardMedia() {
        setStatus('Refreshing image pools and recent generated images...');
        try {
            await Promise.all([loadImagePools(), loadRecentGeneratedImages()]);
            setStatus('Dashboard media refreshed.');
        } catch (error) {
            setStatus(`Dashboard media refresh failed: ${error?.message || 'Unknown error'}`);
        }
    }

    function addDynamicPages(entries, options) {
        const nextPages = [];
        entries.forEach(entry => {
            const url = String(entry?.image || '').trim();
            if (!url) return;
            nextPages.push(createDynamicPage(entry));
        });
        if (nextPages.length === 0) return;
        const insertAt = Number.isInteger(options?.insertAt) ? Math.max(0, Math.min(state.dynamicPages.length, options.insertAt)) : getInsertIndexFromSelection();
        state.dynamicPages.splice(insertAt, 0, ...nextPages);
        getActiveBook().dynamicPages = state.dynamicPages;
        scheduleBookStateSave();
        void app.initBook();
    }

    function addSelectedPoolImages() {
        const selectedPoolId = String(els.imagePoolSelect?.value || '').trim();
        const pool = state.imagePools.find(entry => entry.id === selectedPoolId) || null;
        if (!pool) return setStatus('Select an image pool first.');
        const items = pool.images.map((image, index) => normalizePoolImage(pool.id, image, index)).filter(Boolean);
        const selected = items.filter(item => state.selectedPoolImageIds.has(item.id));
        if (selected.length === 0) return setStatus('Select one or more pool images first.');
        addDynamicPages(selected.map(item => ({ id: item.id, image: item.url, name: item.name, text: item.detail || '', sourceKind: `pool:${pool.name}` })));
        state.selectedPoolImageIds.clear();
        renderDashboardMedia();
        setStatus(`Added ${selected.length} pool image page${selected.length === 1 ? '' : 's'} to the book.`);
    }

    function addAllPoolImages() {
        const selectedPoolId = String(els.imagePoolSelect?.value || '').trim();
        const pool = state.imagePools.find(entry => entry.id === selectedPoolId) || null;
        if (!pool) return setStatus('Select an image pool first.');
        const items = pool.images.map((image, index) => normalizePoolImage(pool.id, image, index)).filter(Boolean);
        if (items.length === 0) return setStatus('Selected pool has no images.');
        addDynamicPages(items.map(item => ({ id: item.id, image: item.url, name: item.name, text: item.detail || '', sourceKind: `pool:${pool.name}` })));
        setStatus(`Added all ${items.length} pool image page${items.length === 1 ? '' : 's'} to the book.`);
    }

    function addSelectedRecentImages() {
        const selected = state.recentImages.filter(item => state.selectedRecentImageIds.has(item.id));
        if (selected.length === 0) return setStatus('Select one or more recent generated images first.');
        addDynamicPages(selected.map(item => ({ id: item.id, image: item.url, name: item.name, text: item.detail || '', sourceKind: 'recent-generated' })));
        state.selectedRecentImageIds.clear();
        renderDashboardMedia();
        setStatus(`Added ${selected.length} recent generated image page${selected.length === 1 ? '' : 's'} to the book.`);
    }

    function addAllRecentImages() {
        if (state.recentImages.length === 0) return setStatus('No recent generated images loaded yet.');
        addDynamicPages(state.recentImages.map(item => ({ id: item.id, image: item.url, name: item.name, text: item.detail || '', sourceKind: 'recent-generated' })));
        setStatus(`Added all ${state.recentImages.length} recent generated image pages to the book.`);
    }

    function moveDynamicPage(pageId, delta) {
        const index = state.dynamicPages.findIndex(page => page.id === pageId);
        if (index < 0) return;
        const nextIndex = index + delta;
        if (nextIndex < 0 || nextIndex >= state.dynamicPages.length) return;
        const [page] = state.dynamicPages.splice(index, 1);
        state.dynamicPages.splice(nextIndex, 0, page);
        getActiveBook().dynamicPages = state.dynamicPages;
        scheduleBookStateSave();
        void app.initBook();
    }

    function reorderDynamicPage(pageId, beforePageId) {
        const fromIndex = state.dynamicPages.findIndex(page => page.id === pageId);
        const beforeIndex = state.dynamicPages.findIndex(page => page.id === beforePageId);
        if (fromIndex < 0 || beforeIndex < 0 || fromIndex === beforeIndex) return;
        const [page] = state.dynamicPages.splice(fromIndex, 1);
        const nextIndex = state.dynamicPages.findIndex(entry => entry.id === beforePageId);
        state.dynamicPages.splice(nextIndex < 0 ? state.dynamicPages.length : nextIndex, 0, page);
        getActiveBook().dynamicPages = state.dynamicPages;
        scheduleBookStateSave();
        void app.initBook();
    }

    function removeDynamicPage(pageId) {
        const removed = state.dynamicPages.find(page => page.id === pageId);
        if (removed && state.objectUrls.has(removed.image)) {
            URL.revokeObjectURL(removed.image);
            state.objectUrls.delete(removed.image);
        }
        state.dynamicPages = state.dynamicPages.filter(page => page.id !== pageId);
        getActiveBook().dynamicPages = state.dynamicPages;
        state.currentPage = 0;
        scheduleBookStateSave();
        void app.initBook();
    }

    function openPageContextMenu(target, x, y) {
        if (!els.pageContextMenu) return;
        const pageId = typeof target === 'string' ? target : String(target?.pageId || '');
        state.contextMenuPageId = pageId;
        state.contextMenuInsertIndex = Number.isInteger(target?.insertIndex) ? target.insertIndex : null;
        els.pageContextMenu.hidden = false;
        els.pageContextMenu.style.left = `${Math.max(12, x)}px`;
        els.pageContextMenu.style.top = `${Math.max(12, y)}px`;
    }

    function closePageContextMenu() {
        if (!els.pageContextMenu) return;
        els.pageContextMenu.hidden = true;
        state.contextMenuPageId = '';
        state.contextMenuInsertIndex = null;
    }

    function openMediaContextMenu(item, x, y) {
        if (!els.mediaContextMenu) return;
        state.contextMenuMediaItem = item || null;
        els.mediaContextMenu.hidden = false;
        els.mediaContextMenu.style.left = `${Math.max(12, x)}px`;
        els.mediaContextMenu.style.top = `${Math.max(12, y)}px`;
    }

    function closeMediaContextMenu() {
        if (!els.mediaContextMenu) return;
        els.mediaContextMenu.hidden = true;
        state.contextMenuMediaItem = null;
    }

    function closeContextMenus() {
        closePageContextMenu();
        closeMediaContextMenu();
    }

    function getCanvasPoint(event) {
        const rect = els.canvas.getBoundingClientRect();
        const scaleX = rect.width > 0 ? els.canvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? els.canvas.height / rect.height : 1;
        return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
    }

    function setMediaTrayPosition(left, top) {
        if (!els.mediaTray) return;
        els.mediaTray.style.left = `${left}px`;
        els.mediaTray.style.top = `${top}px`;
        els.mediaTray.style.right = 'auto';
    }

    function resetMediaTrayPosition() {
        if (!els.mediaTray) return;
        els.mediaTray.style.left = 'auto';
        els.mediaTray.style.top = '24px';
        els.mediaTray.style.right = '24px';
    }

    function setTrayPointerCapture(handle, pointerId) {
        try {
            handle?.setPointerCapture?.(pointerId);
        } catch {}
    }

    function releaseTrayPointerCapture(handle, pointerId) {
        try {
            handle?.releasePointerCapture?.(pointerId);
        } catch {}
    }

    function startMediaTrayDrag(event) {
        if (event.button !== 0 || !els.mediaTray) return;
        if (event.target?.closest?.('button,select,input,textarea,a')) return;
        event.preventDefault();
        const rect = els.mediaTray.getBoundingClientRect();
        setTrayPointerCapture(event.currentTarget, event.pointerId);
        state.mediaTrayDrag = {
            active: true,
            startX: event.clientX,
            startY: event.clientY,
            origLeft: rect.left,
            origTop: rect.top,
            pointerId: event.pointerId,
            handle: event.currentTarget || null
        };
        document.addEventListener('pointermove', onMediaTrayDrag);
        document.addEventListener('pointerup', stopMediaTrayDrag, { once: true });
        document.addEventListener('pointercancel', stopMediaTrayDrag, { once: true });
        els.mediaTray.classList.add('dragging');
    }

    function onMediaTrayDrag(event) {
        if (!state.mediaTrayDrag.active || !els.mediaTray) return;
        if (state.mediaTrayDrag.pointerId !== null && event.pointerId !== state.mediaTrayDrag.pointerId) return;
        const dx = event.clientX - state.mediaTrayDrag.startX;
        const dy = event.clientY - state.mediaTrayDrag.startY;
        const width = els.mediaTray.offsetWidth;
        const height = els.mediaTray.offsetHeight;
        const maxLeft = Math.max(12, document.documentElement.clientWidth - width - 12);
        const maxTop = Math.max(12, document.documentElement.clientHeight - height - 12);
        const left = Math.max(12, Math.min(maxLeft, state.mediaTrayDrag.origLeft + dx));
        const top = Math.max(12, Math.min(maxTop, state.mediaTrayDrag.origTop + dy));
        setMediaTrayPosition(left, top);
    }

    function stopMediaTrayDrag() {
        if (!state.mediaTrayDrag.active || !els.mediaTray) return;
        releaseTrayPointerCapture(state.mediaTrayDrag.handle, state.mediaTrayDrag.pointerId);
        state.mediaTrayDrag.active = false;
        state.mediaTrayDrag.pointerId = null;
        state.mediaTrayDrag.handle = null;
        document.removeEventListener('pointermove', onMediaTrayDrag);
        document.removeEventListener('pointercancel', stopMediaTrayDrag);
        els.mediaTray.classList.remove('dragging');
    }

    function setMediaTrayOpen(open, tab) {
        if (!els.mediaTray) return;
        if (tab) setMediaTrayTab(tab);
        els.mediaTray.classList.toggle('hidden', open !== true);
        if (open === true) {
            if (!els.mediaTray.style.left || els.mediaTray.style.left === 'auto') resetMediaTrayPosition();
            void refreshDashboardMedia();
        }
    }

    function runPageContextAction(action) {
        const pageId = state.contextMenuPageId;
        const insertIndex = state.contextMenuInsertIndex;
        if (!pageId && !Number.isInteger(insertIndex)) return;
        if (action === 'set-insert-here') {
            if (pageId) setInsertPosition(`before:${pageId}`);
            else if (insertIndex <= 0) setInsertPosition('start');
            else if (insertIndex >= state.dynamicPages.length) setInsertPosition('end');
            else setInsertPosition(`before:${state.dynamicPages[insertIndex].id}`);
            setStatus('Insert target updated.');
        } else if (action === 'upload-before') {
            state.pendingUploadAction = pageId ? { type: 'before', pageId } : { type: 'index', insertAt: Math.max(0, insertIndex) };
            els.contextFileUpload?.click();
        } else if (action === 'upload-after') {
            state.pendingUploadAction = pageId ? { type: 'after', pageId } : { type: 'index', insertAt: Math.max(0, insertIndex) };
            els.contextFileUpload?.click();
        } else if (action === 'move-up' && pageId) {
            moveDynamicPage(pageId, -1);
        } else if (action === 'move-down' && pageId) {
            moveDynamicPage(pageId, 1);
        } else if (action === 'remove' && pageId) {
            removeDynamicPage(pageId);
        }
        closePageContextMenu();
    }

    function getCanvasPageContextTarget(event) {
        const { x } = getCanvasPoint(event);
        const pageIndex = x < (els.canvas.width / 2) ? state.currentPage : state.currentPage + 1;
        const dynamicIndex = pageIndex - 3;
        if (dynamicIndex >= 0 && dynamicIndex < state.dynamicPages.length) {
            return { pageId: state.dynamicPages[dynamicIndex].id, insertIndex: dynamicIndex };
        }
        return { pageId: '', insertIndex: Math.max(0, Math.min(state.dynamicPages.length, dynamicIndex)) };
    }

    function runMediaContextAction(action) {
        const item = state.contextMenuMediaItem;
        if (!item || !item.url) return;
        const mediaKind = inferMediaKind({ name: item.name, image: item.url });
        const entry = { id: item.id, image: item.url, name: item.name, sourceKind: item.sourceType === 'pool' ? 'pool-context' : 'recent-context', type: mediaKind === 'video' ? 'video/mp4' : '' };
        if (action === 'insert-selected-spot') {
            addDynamicPages([entry]);
        } else if (action === 'insert-after-current') {
            const currentVisibleIndex = Math.max(0, Math.floor(Math.max(0, state.currentPage - 2) / 2));
            addDynamicPages([entry], { insertAt: Math.min(state.dynamicPages.length, currentVisibleIndex + 1) });
        } else if (action === 'insert-at-start') {
            addDynamicPages([entry], { insertAt: 0 });
        } else if (action === 'insert-at-end') {
            addDynamicPages([entry], { insertAt: state.dynamicPages.length });
        } else if (action === 'toggle-select' && item.selectedIds) {
            if (item.selectedIds.has(item.id)) item.selectedIds.delete(item.id);
            else item.selectedIds.add(item.id);
            renderDashboardMedia();
        }
        closeMediaContextMenu();
    }

    function adjustZoom(delta) {
        state.zoomLevel = Math.max(0.25, Math.min(3, state.zoomLevel + delta));
        if (els.zoomLevelDisplay) els.zoomLevelDisplay.textContent = `${Math.round(state.zoomLevel * 100)}%`;
        applyCanvasPresentationTransform();
        setStatus(`Zoom: ${Math.round(state.zoomLevel * 100)}%`);
    }

    function resetZoom() {
        state.zoomLevel = 1;
        if (els.zoomLevelDisplay) els.zoomLevelDisplay.textContent = '100%';
        applyCanvasPresentationTransform();
        setStatus('Zoom reset to 100%.');
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().then(() => {
                setStatus('Entered fullscreen.');
            }).catch(err => {
                setStatus(`Fullscreen failed: ${err?.message || 'unknown'}`);
            });
            return;
        }
        document.exitFullscreen?.().then(() => {
            setStatus('Exited fullscreen.');
        });
    }

    async function exportBookAsImage() {
        const overlay = app.$('export-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        const statusEl = app.$('export-status');
        if (statusEl) statusEl.textContent = 'Rendering book as image...';
        const dlBtn = app.$('download-export-button');
        if (dlBtn) dlBtn.onclick = null;
        const pagesData = state.pagesData?.length ? state.pagesData : buildPagesData();

        const renderAll = async () => {
            for (let i = 0; i < pagesData.length; i += 1) {
                if (statusEl) statusEl.textContent = `Rendering page ${i + 1} of ${pagesData.length}...`;
                await app.ensurePageRendered(i, state.activeRenderToken);
            }
        };

        const createExportImage = async () => {
            const totalHeight = pagesData.length * pageHeight;
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = pageWidth;
            exportCanvas.height = totalHeight;
            const expCtx = exportCanvas.getContext('2d');
            for (let i = 0; i < pagesData.length; i += 1) {
                const pageCanvas = state.prerenderedPages[i];
                if (pageCanvas) {
                    expCtx.drawImage(pageCanvas, 0, i * pageHeight, pageWidth, pageHeight);
                    continue;
                }
                expCtx.fillStyle = '#fdfbf0';
                expCtx.fillRect(0, i * pageHeight, pageWidth, pageHeight);
                expCtx.fillStyle = '#6f6258';
                expCtx.textAlign = 'center';
                expCtx.font = '14px sans-serif';
                expCtx.fillText(`Page ${i + 1}`, pageWidth / 2, i * pageHeight + pageHeight / 2);
            }
            return exportCanvas;
        };

        try {
            await renderAll();
            const expCanvas = await createExportImage();
            if (statusEl) statusEl.textContent = 'Creating download link...';
            expCanvas.toBlob(blob => {
                if (!blob) return setStatus('Export failed: could not create image blob.');
                const url = URL.createObjectURL(blob);
                if (dlBtn) {
                    dlBtn.onclick = () => {
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'book-export.png';
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                    };
                }
                setStatus('Export complete. Click Download Image.');
            }, 'image/png');
        } catch (err) {
            if (statusEl) statusEl.textContent = `Export failed: ${err?.message || 'unknown'}`;
            setStatus(`Export error: ${err?.message || 'unknown'}`);
        }
    }

    async function initBook() {
        const pagesData = buildPagesData();
        state.activeRenderToken += 1;
        state.isAnimating = false;
        state.isPreparingFlip = false;
        state.preparingFlipDirection = 0;
        state.queuedPageFlips = [];
        state.progress = 0;
        state.animationStartTime = 0;
        state.animationStartProgressRaw = 0;
        state.animationPhase = 'idle';
        state.animationPlan = null;
        state.animationPageCanvases.clear();

        const preservedMediaSnapshots = new Map(state.mediaSnapshots);
        const preservedMediaElements = new Map(state.mediaElements);
        state.prerenderedPages = new Array(pagesData.length);
        state.prerenderedPageKeys = new Array(pagesData.length);
        state.pageRenderCache.clear();
        state.mediaSnapshots.clear();
        state.mediaElements.clear();

        const existingIds = new Set(pagesData.map(page => page?.id).filter(Boolean));
        preservedMediaSnapshots.forEach((snap, id) => {
            if (existingIds.has(id)) state.mediaSnapshots.set(id, snap);
        });
        preservedMediaElements.forEach((media, id) => {
            if (existingIds.has(id)) state.mediaElements.set(id, media);
        });

        app.clearMediaOverlays();
        state.animationStartOffset = state.viewOffsetX;
        state.animationTargetOffset = app.getViewOffsetForPageIndex(state.currentPage, pagesData);
        state.pagesData = pagesData;
        syncClosedBookUi(pagesData);
        applyCanvasPresentationTransform();

        const visibleIndexes = getVisiblePageIndexes(pagesData);
        visibleIndexes.forEach(index => {
            const pageData = pagesData[index];
            if (pageData && hasLiveMedia(pageData) && !state.mediaElements.has(pageData.id)) {
                void app.loadMediaElement(pageData).catch(() => {});
            }
        });

        app.renderVisiblePagesSoon();
        app.requestBookRender();
        renderPageQueue();
        setStatus(`Book ready with ${Math.max(0, pagesData.length - 4)} custom pages. Visible pages load as you turn.`);
    }

    function hasLiveMedia(data) {
        return data && data.mediaKind && data.mediaKind !== 'image';
    }

    Object.assign(app, {
        createBook,
        getActiveBook,
        syncActiveBookFromState,
        applyActiveBookToState,
        renderBookTabs,
        switchBook,
        addBook,
        scheduleInitBook,
        saveBookState,
        scheduleBookStateSave,
        restoreBookState,
        applyDashboardTheme,
        applyBookStyle,
        setStatus,
        updateSealButton,
        sealBook,
        strikeSeal,
        buildPagesData,
        getPageCacheKey,
        getVisiblePageIndexes,
        hasVisibleLiveMedia,
        hasActiveSeal,
        getClosedBookSide,
        isClosedBookVisible,
        setClosedBookHovered,
        setCanvasHovered,
        setInspectTargetsFromPoint,
        applyCanvasPresentationTransform,
        updateInspectPresentationMotion,
        isInspectMotionSettled,
        setInspectMode,
        toggleInspectMode,
        setMagnifierEnabled,
        toggleMagnifierEnabled,
        setMagnifierPointer,
        setMagnifierVisible,
        syncClosedBookUi,
        needsPresentationTick,
        shouldKeepRendering,
        createDynamicPage,
        inferMediaKind,
        getInsertIndexFromSelection,
        setInsertPosition,
        populateInsertPositionSelect,
        normalizePoolImage,
        normalizeGeneratedImage,
        applyDashboardMediaPayload,
        setMediaTrayTab,
        renderSelectableMediaList,
        renderPageQueue,
        goToPage,
        renderDashboardMedia,
        populatePoolSelect,
        loadImagePools,
        loadRecentGeneratedImages,
        refreshDashboardMedia,
        addDynamicPages,
        addSelectedPoolImages,
        addAllPoolImages,
        addSelectedRecentImages,
        addAllRecentImages,
        moveDynamicPage,
        reorderDynamicPage,
        removeDynamicPage,
        openPageContextMenu,
        closePageContextMenu,
        openMediaContextMenu,
        closeMediaContextMenu,
        closeContextMenus,
        getCanvasPoint,
        setMediaTrayPosition,
        resetMediaTrayPosition,
        startMediaTrayDrag,
        stopMediaTrayDrag,
        setMediaTrayOpen,
        runPageContextAction,
        getCanvasPageContextTarget,
        runMediaContextAction,
        adjustZoom,
        resetZoom,
        toggleFullscreen,
        exportBookAsImage,
        initBook,
        hasLiveMedia
    });
}
