export function registerAnimationModule(app) {
    const { state, pageWidth } = app;

    function isClosedStart() {
        return state.currentPage === 0 && !state.isAnimating;
    }

    function isClosedEnd(pagesData) {
        return state.currentPage >= pagesData.length - 1 && !state.isAnimating;
    }

    function getTargetPageIndex(pagesData) {
        if (!state.isAnimating) return state.currentPage;
        return Math.max(0, Math.min(pagesData.length - 1, state.currentPage + (state.dir * 2)));
    }

    function getRenderSpreadStart(pagesData) {
        if (state.isAnimating && ((state.dir > 0 && state.currentPage <= 0) || (state.dir < 0 && getTargetPageIndex(pagesData) <= 0))) {
            return Math.min(2, Math.max(0, pagesData.length - 2));
        }
        if (state.isAnimating && state.dir < 0 && state.currentPage >= pagesData.length - 1) return Math.max(0, pagesData.length - 3);
        if (state.isAnimating && state.dir > 0 && getTargetPageIndex(pagesData) >= pagesData.length - 1) return Math.max(0, pagesData.length - 3);
        return Math.max(0, Math.min(state.currentPage, pagesData.length - 2));
    }

    function clampPageIndex(index, pagesData) {
        return Math.max(0, Math.min(index, pagesData.length - 1));
    }

    function getAnimationSpreadIndexes(pagesData) {
        const plan = state.animationPlan || getFlipPlan(state.dir || 1, pagesData);
        if (!state.isAnimating || plan.isFrontCoverTurn || plan.isBackCoverTurn) {
            const spreadStart = getRenderSpreadStart(pagesData);
            return { left: clampPageIndex(spreadStart, pagesData), right: clampPageIndex(spreadStart + 1, pagesData) };
        }
        if (state.dir > 0) {
            return { left: clampPageIndex(plan.leftPage, pagesData), right: clampPageIndex(plan.targetSpreadStart + 1, pagesData) };
        }
        return { left: clampPageIndex(plan.targetSpreadStart, pagesData), right: clampPageIndex(plan.rightPage, pagesData) };
    }

    function getFlipImageIndexes(pagesData) {
        const plan = state.animationPlan || getFlipPlan(state.dir || 1, pagesData);
        if (state.dir < 0 && plan.isFrontCoverTurn) {
            return { front: clampPageIndex(plan.leftPage, pagesData), back: clampPageIndex(Math.min(1, pagesData.length - 1), pagesData) };
        }
        if (state.dir > 0 && plan.isBackCoverTurn) {
            return { front: clampPageIndex(plan.rightPage, pagesData), back: clampPageIndex(pagesData.length - 1, pagesData) };
        }
        return {
            front: clampPageIndex(plan.flipPage, pagesData),
            back: clampPageIndex(state.dir > 0 ? plan.targetSpreadStart : plan.targetSpreadStart + 1, pagesData)
        };
    }

    function getFlipPlan(direction, pagesData) {
        const lastIndex = pagesData.length - 1;
        const currentPage = Math.max(0, Math.min(state.currentPage, lastIndex));
        const targetPage = Math.max(0, Math.min(lastIndex, currentPage + (direction * 2)));
        const isFrontCoverTurn = (direction > 0 && currentPage <= 0) || (direction < 0 && targetPage <= 0);
        const isBackCoverTurn = (direction < 0 && currentPage >= lastIndex) || (direction > 0 && targetPage >= lastIndex);
        const spreadStart = direction > 0 && currentPage <= 0
            ? Math.min(2, Math.max(0, lastIndex - 1))
            : direction < 0 && targetPage <= 0
                ? Math.min(2, Math.max(0, lastIndex - 1))
                : direction < 0 && currentPage >= lastIndex
                    ? Math.max(0, lastIndex - 2)
                    : Math.max(0, Math.min(currentPage, lastIndex - 1));
        const leftPage = Math.max(0, Math.min(spreadStart, lastIndex));
        const rightPage = Math.max(0, Math.min(spreadStart + 1, lastIndex));
        const targetSpreadStart = Math.max(0, Math.min(targetPage, lastIndex - 1));
        const flipPage = (direction > 0 && currentPage <= 0) || (direction < 0 && targetPage <= 0)
            ? Math.min(1, lastIndex)
            : (direction > 0 && targetPage >= lastIndex) || (direction < 0 && currentPage >= lastIndex)
                ? lastIndex
                : direction > 0 ? rightPage : leftPage;
        return { targetPage, spreadStart, leftPage, rightPage, targetSpreadStart, flipPage, isFrontCoverTurn, isBackCoverTurn };
    }

    function getCoverSide(plan) {
        return plan?.isBackCoverTurn ? 'back' : 'front';
    }

    function getCoverPageIndex(plan, pagesData) {
        return getCoverSide(plan) === 'back' ? pagesData.length - 1 : Math.min(1, pagesData.length - 1);
    }

    function getClosedCoverCenterX() {
        return app.margin + (pageWidth / 2);
    }

    function getOpenCoverSideX(plan) {
        return getCoverSide(plan) === 'back' ? app.margin : app.margin + pageWidth;
    }

    function getSlidingCoverX(plan) {
        const centerX = getClosedCoverCenterX();
        const sideX = getOpenCoverSideX(plan);
        const progress = state.animationPhase === 'slide-close' ? 1 - state.progress : state.progress;
        return centerX + ((sideX - centerX) * progress);
    }

    function isSlidingCoverPhase() {
        return state.animationPhase === 'slide-open' || state.animationPhase === 'slide-close';
    }

    function isPopCoverPhase() {
        return state.animationPhase === 'pop-open';
    }

    function isClosedSpinPhase() {
        return state.animationPhase === 'closed-spin';
    }

    function getFlipDrawSpec(leftX) {
        return { startX: leftX + pageWidth, direction: state.dir > 0 ? 1 : -1 };
    }

    function getClosedCoverTargetOffset(direction) {
        return direction * (pageWidth / 2);
    }

    function getViewOffsetForPageIndex(pageIndex, pagesData) {
        if (pageIndex <= 0) return getClosedCoverTargetOffset(1);
        if (pageIndex >= pagesData.length - 1) return getClosedCoverTargetOffset(-1);
        return 0;
    }

    function getTargetViewOffset(pagesData) {
        return getViewOffsetForPageIndex(getTargetPageIndex(pagesData), pagesData);
    }

    function isViewOffsetSettled(pagesData) {
        return Math.abs(getTargetViewOffset(pagesData) - state.viewOffsetX) < 0.05;
    }

    function updateViewOffset(pagesData) {
        if (state.isAnimating) {
            if (state.animationPhase === 'flip-open' || state.animationPhase === 'flip-close') {
                state.viewOffsetX = 0;
                return;
            }
            state.viewOffsetX = state.animationStartOffset + ((state.animationTargetOffset - state.animationStartOffset) * state.progress);
            return;
        }
        const targetOffset = getTargetViewOffset(pagesData);
        state.viewOffsetX += (targetOffset - state.viewOffsetX) * 0.12;
        if (Math.abs(targetOffset - state.viewOffsetX) < 0.05) state.viewOffsetX = targetOffset;
    }

    function easeFlipProgress(progress) {
        return progress < 0.5 ? 2 * progress * progress : 1 - (Math.pow(-2 * progress + 2, 2) / 2);
    }

    function getInitialAnimationPhase(direction, plan) {
        if (plan.isFrontCoverTurn || plan.isBackCoverTurn) {
            const isOpening = (plan.isFrontCoverTurn && direction > 0) || (plan.isBackCoverTurn && direction < 0);
            return isOpening ? 'slide-open' : 'flip-close';
        }
        return 'flip';
    }

    function getAnimationDuration() {
        if (isClosedSpinPhase()) return state.closedSpinDuration || 520;
        if (isPopCoverPhase()) return state.popDuration || 150;
        if (isSlidingCoverPhase()) return state.slideDuration;
        if (state.flipSpeed === 'fast') return state.animationDurationFast || 350;
        if (state.flipSpeed === 'slow') return state.animationDurationSlow || 1200;
        return state.animationDuration;
    }

    function goToFirstPage() {
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        if (state.currentPage === 0) return;
        state.currentPage = 0;
        state.viewOffsetX = getClosedCoverTargetOffset(1);
        state.animationStartOffset = state.viewOffsetX;
        state.animationTargetOffset = state.viewOffsetX;
        app.renderVisiblePagesSoon();
        app.requestBookRender();
        app.setStatus('Jumped to first page.');
    }

    function goToLastPage() {
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        if (state.currentPage >= pagesData.length - 1) return;
        state.currentPage = pagesData.length - 1;
        state.viewOffsetX = getClosedCoverTargetOffset(-1);
        state.animationStartOffset = state.viewOffsetX;
        state.animationTargetOffset = state.viewOffsetX;
        app.renderVisiblePagesSoon();
        app.requestBookRender();
        app.setStatus('Jumped to last page.');
    }

    function resetAnimationClock(startRawProgress = 0) {
        state.animationStartProgressRaw = Math.max(0, Math.min(0.98, Number(startRawProgress) || 0));
        state.progress = easeFlipProgress(state.animationStartProgressRaw);
        state.animationStartTime = 0;
    }

    function startAnimationPhase(phase, startRawProgress = 0) {
        state.animationPhase = phase;
        resetAnimationClock(startRawProgress);
        requestAnimationFrame(animate);
    }

    function getQueuedTargetPage(pagesData) {
        const activeTarget = state.isAnimating || state.isPreparingFlip
            ? state.currentPage + (((state.isPreparingFlip ? state.preparingFlipDirection : state.dir) || 0) * 2)
            : state.currentPage;
        return (state.queuedPageFlips || []).reduce((page, direction) => {
            return clampPageIndex(page + (direction * 2), pagesData);
        }, clampPageIndex(activeTarget, pagesData));
    }

    function canTurnFromPage(pageIndex, direction, pagesData) {
        return clampPageIndex(pageIndex + (direction * 2), pagesData) !== clampPageIndex(pageIndex, pagesData);
    }

    function queuePageFlip(direction) {
        if (state.sealed) {
            app.setStatus('The seal blocks page actions. Left-click the chains to break them.');
            return false;
        }
        const nextDirection = direction > 0 ? 1 : -1;
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        const projectedPage = getQueuedTargetPage(pagesData);
        if (!canTurnFromPage(projectedPage, nextDirection, pagesData)) return false;
        state.queuedPageFlips = Array.isArray(state.queuedPageFlips) ? state.queuedPageFlips : [];
        if (state.queuedPageFlips.length >= 10) state.queuedPageFlips.shift();
        state.queuedPageFlips.push(nextDirection);
        state.flipSpeed = 'fast';
        app.setStatus(`Queued ${state.queuedPageFlips.length} page turn${state.queuedPageFlips.length === 1 ? '' : 's'}.`);
        drainQueuedPageFlips();
        return true;
    }

    function drainQueuedPageFlips() {
        if (state.isAnimating || state.isPreparingFlip) return;
        state.queuedPageFlips = Array.isArray(state.queuedPageFlips) ? state.queuedPageFlips : [];
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        while (state.queuedPageFlips.length > 0) {
            const direction = state.queuedPageFlips.shift();
            if (!canTurnFromPage(state.currentPage, direction, pagesData)) continue;
            state.flipSpeed = 'fast';
            void beginPageFlip(direction);
            return;
        }
        state.flipSpeed = 'normal';
    }

    function startClosedBookSideFlip() {
        if (state.isAnimating || state.isPreparingFlip || state.sealed) return;
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        const isClosedFront = app.isClosedStart();
        const isClosedBack = app.isClosedEnd(pagesData);
        if (!isClosedFront && !isClosedBack) return;
        state.closedSpinFromSide = isClosedFront ? 'front' : 'back';
        state.closedSpinToSide = isClosedFront ? 'back' : 'front';
        state.isAnimating = true;
        state.isPreparingFlip = false;
        state.progress = 0;
        state.dir = 0;
        state.flipSpeed = 'normal';
        state.animationPlan = null;
        state.animationPageCanvases.clear();
        state.animationStartOffset = state.viewOffsetX;
        state.animationTargetOffset = state.viewOffsetX;
        app.setClosedBookHovered(false);
        app.setInspectMode(false, { reset: true });
        startAnimationPhase('closed-spin');
    }

    async function beginPageFlip(direction) {
        if (state.isAnimating || state.isPreparingFlip) return;
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        state.pagesData = pagesData;
        const token = state.activeRenderToken;
        const plan = getFlipPlan(direction, pagesData);
        const backPage = direction > 0 ? plan.targetSpreadStart : plan.targetSpreadStart + 1;
        const renderIndexes = new Set([plan.leftPage, plan.rightPage, plan.targetSpreadStart, plan.targetSpreadStart + 1, plan.flipPage, backPage, plan.targetPage]);
        const targetPage = Math.max(0, Math.min(pagesData.length - 1, state.currentPage + (direction * 2)));
        for (let i = -6; i <= 8; i += 1) renderIndexes.add(targetPage + i);
        for (let i = Math.max(0, targetPage - 8); i <= Math.min(pagesData.length - 1, targetPage + 8); i += 1) {
            const pageData = pagesData[i];
            if (pageData && app.hasLiveMedia(pageData) && !state.mediaElements.has(pageData.id)) {
                void app.loadMediaElement(pageData).catch(() => {});
            }
        }
        state.isPreparingFlip = true;
        state.preparingFlipDirection = direction;
        try {
            await app.ensurePageIndexesRendered(Array.from(renderIndexes), token);
        } finally {
            if (token === state.activeRenderToken) {
                state.isPreparingFlip = false;
                state.preparingFlipDirection = 0;
            }
        }
        if (token !== state.activeRenderToken || state.isAnimating) return;
        state.dir = direction;
        state.animationPlan = plan;
        state.animationPageCanvases = new Map();
        renderIndexes.forEach(index => {
            const canvas = app.getRenderedPageCanvas(index, pagesData);
            if (canvas) state.animationPageCanvases.set(index, canvas);
        });
        const initialPhase = getInitialAnimationPhase(direction, plan);
        state.animationStartOffset = state.viewOffsetX;
        state.animationTargetOffset = getViewOffsetForPageIndex(plan.targetPage, pagesData);
        if (initialPhase === 'pop-open') state.animationTargetOffset = state.viewOffsetX;
        state.isAnimating = true;
        startAnimationPhase(initialPhase);
    }

    function startDragReleaseFlip(direction, releaseRawProgress) {
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        const plan = getFlipPlan(direction, pagesData);
        const backPage = direction > 0 ? plan.targetSpreadStart : plan.targetSpreadStart + 1;
        const indexes = Array.from(new Set([plan.leftPage, plan.rightPage, plan.targetSpreadStart, plan.targetSpreadStart + 1, plan.flipPage, backPage, plan.targetPage])).filter(index => index >= 0 && index < pagesData.length);
        state.dir = direction;
        state.animationPlan = plan;
        state.animationPageCanvases = state.animationPageCanvases || new Map();
        indexes.forEach(index => {
            const canvas = app.getPageCanvasForDrag(index, pagesData);
            if (canvas) state.animationPageCanvases.set(index, canvas);
        });
        state.isPreparingFlip = false;
        state.preparingFlipDirection = 0;
        state.isAnimating = true;
        state.animationStartOffset = state.viewOffsetX;
        state.flipSpeed = 'normal';
        const phase = getInitialAnimationPhase(direction, plan);
        state.animationTargetOffset = getViewOffsetForPageIndex(plan.targetPage, pagesData);
        if (phase === 'pop-open') state.animationTargetOffset = state.viewOffsetX;
        const canResumeFold = phase === 'flip' || phase === 'flip-close' || phase === 'flip-open';
        startAnimationPhase(phase, canResumeFold ? releaseRawProgress : 0);
    }

    function commitDragPageFlip(direction) {
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        const plan = getFlipPlan(direction, pagesData);
        const targetOffset = getViewOffsetForPageIndex(plan.targetPage, pagesData);
        state.currentPage = plan.targetPage;
        state.isAnimating = false;
        state.isPreparingFlip = false;
        state.preparingFlipDirection = 0;
        state.progress = 0;
        state.animationStartTime = 0;
        state.animationStartProgressRaw = 0;
        state.animationPhase = 'idle';
        state.animationPlan = null;
        state.dir = 0;
        state.animationPageCanvases.clear();
        state.viewOffsetX = targetOffset;
        state.animationStartOffset = targetOffset;
        state.animationTargetOffset = targetOffset;
        app.renderVisiblePagesSoon();
        app.requestBookRender();
        app.setStatus(direction > 0 ? 'Turned to next page.' : 'Turned to previous page.');
    }

    function finishPageFlip(pagesData) {
        const targetPage = getTargetPageIndex(pagesData);
        const targetOffset = getViewOffsetForPageIndex(targetPage, pagesData);
        state.currentPage = targetPage;
        state.isAnimating = false;
        state.progress = 0;
        state.animationStartTime = 0;
        state.animationStartProgressRaw = 0;
        state.animationPhase = 'idle';
        state.animationPlan = null;
        state.animationPageCanvases.clear();
        state.viewOffsetX = targetOffset;
        state.animationStartOffset = targetOffset;
        state.animationTargetOffset = targetOffset;
        app.renderVisiblePagesSoon();
        app.requestBookRender();
        drainQueuedPageFlips();
    }

    function continueAnimation(pagesData) {
        if (state.animationPhase === 'closed-spin') {
            const targetPage = state.closedSpinToSide === 'back' ? pagesData.length - 1 : 0;
            const targetOffset = getViewOffsetForPageIndex(targetPage, pagesData);
            state.currentPage = targetPage;
            state.isAnimating = false;
            state.progress = 0;
            state.animationStartTime = 0;
            state.animationStartProgressRaw = 0;
            state.animationPhase = 'idle';
            state.animationPlan = null;
            state.animationPageCanvases.clear();
            state.viewOffsetX = targetOffset;
            state.animationStartOffset = targetOffset;
            state.animationTargetOffset = targetOffset;
            app.renderVisiblePagesSoon();
            app.requestBookRender();
            drainQueuedPageFlips();
            return true;
        }
        if (state.animationPhase === 'pop-open') {
            state.animationStartOffset = state.viewOffsetX;
            state.animationTargetOffset = 0;
            startAnimationPhase('slide-open');
            return true;
        }
        if (state.animationPhase === 'slide-open') {
            state.viewOffsetX = 0;
            state.animationStartOffset = 0;
            state.animationTargetOffset = 0;
            startAnimationPhase('flip-open');
            return true;
        }
        if (state.animationPhase === 'flip-open') {
            finishPageFlip(pagesData);
            return true;
        }
        if (state.animationPhase === 'flip-close') {
            const plan = state.animationPlan;
            const targetOffset = getViewOffsetForPageIndex(plan.targetPage, pagesData);
            state.viewOffsetX = 0;
            state.animationStartOffset = 0;
            state.animationTargetOffset = targetOffset;
            startAnimationPhase('slide-close');
            return true;
        }
        if (state.animationPhase === 'slide-close') {
            finishPageFlip(pagesData);
            return true;
        }
        finishPageFlip(pagesData);
        return false;
    }

    function animate(timestamp) {
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        if (!state.animationStartTime) state.animationStartTime = timestamp || performance.now();
        const elapsed = (timestamp || performance.now()) - state.animationStartTime;
        const startRaw = Math.max(0, Math.min(0.98, state.animationStartProgressRaw || 0));
        const rawProgress = Math.min(1, startRaw + ((elapsed / getAnimationDuration()) * (1 - startRaw)));
        state.progress = easeFlipProgress(rawProgress);
        app.render(timestamp);
        if (rawProgress >= 1) {
            continueAnimation(pagesData);
            return;
        }
        requestAnimationFrame(animate);
    }

    Object.assign(app, {
        isClosedStart,
        isClosedEnd,
        getTargetPageIndex,
        getRenderSpreadStart,
        clampPageIndex,
        getAnimationSpreadIndexes,
        getFlipImageIndexes,
        getFlipPlan,
        getCoverSide,
        getCoverPageIndex,
        getClosedCoverCenterX,
        getOpenCoverSideX,
        getSlidingCoverX,
        isSlidingCoverPhase,
        isPopCoverPhase,
        isClosedSpinPhase,
        getFlipDrawSpec,
        getClosedCoverTargetOffset,
        getViewOffsetForPageIndex,
        getTargetViewOffset,
        isViewOffsetSettled,
        updateViewOffset,
        easeFlipProgress,
        getInitialAnimationPhase,
        getAnimationDuration,
        goToFirstPage,
        goToLastPage,
        resetAnimationClock,
        startAnimationPhase,
        startClosedBookSideFlip,
        beginPageFlip,
        queuePageFlip,
        drainQueuedPageFlips,
        startDragReleaseFlip,
        commitDragPageFlip,
        finishPageFlip,
        continueAnimation,
        animate
    });
}
