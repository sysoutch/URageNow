export function registerRenderingModule(app) {
    const { els, state, ctx, pageWidth, pageHeight, margin, bookSkins, maxSealIntegrity } = app;
    const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function loadImageFromSource(source) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Failed to load image source: ${source}`));
            image.src = source;
        });
    }

    async function loadAnimatedImageFromSource(source) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Failed to load animated image source: ${source}`));
            image.src = source;
        });
    }

    function loadVideoFromSource(source) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            let settled = false;
            const cleanup = () => {
                clearTimeout(timer);
                video.removeEventListener('loadedmetadata', finish);
                video.removeEventListener('loadeddata', finish);
                video.removeEventListener('canplay', finish);
                video.removeEventListener('error', fail);
            };
            const finish = () => {
                if (settled) return;
                settled = true;
                cleanup();
                video.play().catch(() => {});
                resolve(video);
            };
            const fail = () => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(new Error(`Failed to load video source: ${source}`));
            };
            const timer = setTimeout(finish, 1400);
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.defaultMuted = true;
            video.loop = true;
            video.playsInline = true;
            video.autoplay = true;
            video.preload = 'auto';
            video.addEventListener('loadedmetadata', finish, { once: true });
            video.addEventListener('loadeddata', finish, { once: true });
            video.addEventListener('canplay', finish, { once: true });
            video.addEventListener('error', fail, { once: true });
            video.src = source;
            video.load();
        });
    }

    async function createMediaSnapshot(mediaElement) {
        if (!mediaElement) return null;
        try {
            const snapCanvas = document.createElement('canvas');
            snapCanvas.width = pageWidth;
            snapCanvas.height = pageHeight;
            const snapCtx = snapCanvas.getContext('2d');
            let sx = 0;
            let sy = 0;
            let sw;
            let sh;
            if (mediaElement.tagName === 'VIDEO') {
                sw = mediaElement.videoWidth || pageWidth;
                sh = mediaElement.videoHeight || pageHeight;
            } else {
                sw = mediaElement.naturalWidth || pageWidth;
                sh = mediaElement.naturalHeight || pageHeight;
            }
            const mediaAspect = sw / sh;
            if (mediaAspect > pageWidth / pageHeight) {
                sw = sh * (pageWidth / pageHeight);
                sx = ((mediaElement.tagName === 'VIDEO' ? mediaElement.videoWidth : mediaElement.naturalWidth) - sw) / 2;
            } else {
                sh = sw * (pageHeight / pageWidth);
                sy = ((mediaElement.tagName === 'VIDEO' ? mediaElement.videoHeight : mediaElement.naturalHeight) - sh) / 2;
            }
            if (mediaElement.tagName === 'VIDEO') {
                snapCtx.drawImage(mediaElement, sx, sy, sw, sh, 0, 0, pageWidth, pageHeight);
            } else {
                const imgAspect = mediaElement.naturalWidth / mediaElement.naturalHeight;
                let ix = 0;
                let iy = 0;
                let iw = mediaElement.naturalWidth;
                let ih = mediaElement.naturalHeight;
                if (imgAspect > pageWidth / pageHeight) {
                    iw = mediaElement.naturalHeight * (pageWidth / pageHeight);
                    ix = (mediaElement.naturalWidth - iw) / 2;
                } else {
                    ih = mediaElement.naturalWidth * (pageHeight / pageWidth);
                    iy = (mediaElement.naturalHeight - ih) / 2;
                }
                snapCtx.drawImage(mediaElement, ix, iy, iw, ih, 0, 0, pageWidth, pageHeight);
            }
            return snapCanvas;
        } catch {
            return null;
        }
    }

    async function loadMediaElement(data) {
        const source = String(data?.image || '').trim();
        if (!source || data?.mediaKind === 'image') return null;
        if (state.mediaElements.has(data.id)) return state.mediaElements.get(data.id);
        if (state.pendingMediaLoads.has(data.id)) return state.pendingMediaLoads.get(data.id);

        const loadPromise = (async () => {
            const media = data.mediaKind === 'video'
                ? await loadVideoFromSource(source)
                : await loadAnimatedImageFromSource(source);
            state.mediaElements.set(data.id, media);
            try {
                const snap = await createMediaSnapshot(media);
                if (snap) state.mediaSnapshots.set(data.id, snap);
            } catch {}
            ensureMediaOverlay(data, -1);
            requestBookRender();
            return media;
        })().finally(() => {
            state.pendingMediaLoads.delete(data.id);
        });

        state.pendingMediaLoads.set(data.id, loadPromise);
        return loadPromise;
    }

    async function renderPageToCanvas(data, index) {
        const cacheKey = app.getPageCacheKey(data, index);
        const cached = state.pageRenderCache.get(cacheKey);
        if (cached) return cached;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = pageWidth;
        pageCanvas.height = pageHeight;
        const pageCtx = pageCanvas.getContext('2d');
        const skin = bookSkins[state.bookStyle] || bookSkins.inferno;
        if (data.isVoid) {
            pageCtx.clearRect(0, 0, pageWidth, pageHeight);
        } else {
            const effectiveBg = data.bg || state.bgColor || skin.pageSurface || '#fff';
            pageCtx.fillStyle = effectiveBg;
            pageCtx.fillRect(0, 0, pageWidth, pageHeight);
            if (data.image && (!data.mediaKind || data.mediaKind === 'image')) {
                try {
                    const image = await loadImageFromSource(data.image);
                    const textAreaHeight = data.text ? 132 : 0;
                    const imageHeight = pageHeight - textAreaHeight;
                    pageCtx.drawImage(image, 0, 0, pageWidth, imageHeight);
                    if (data.text) {
                        pageCtx.fillStyle = 'rgba(253,251,240,0.94)';
                        pageCtx.fillRect(0, imageHeight, pageWidth, textAreaHeight);
                    }
                } catch {}
            } else if (data.image && data.mediaKind !== 'image') {
                const media = state.mediaElements.get(data.id) || null;
                const snap = state.mediaSnapshots.get(data.id) || null;
                let sourceForFrame = snap || media;
                if (!sourceForFrame && data.image) {
                    try {
                        await loadMediaElement(data);
                        sourceForFrame = state.mediaElements.get(data.id) || state.mediaSnapshots.get(data.id) || null;
                    } catch {}
                }
                if (sourceForFrame) {
                    try {
                        let sw;
                        let sh;
                        let sx = 0;
                        let sy = 0;
                        if (snap instanceof HTMLCanvasElement) {
                            pageCtx.drawImage(snap, 0, 0);
                            return pageCanvas;
                        }
                        if (sourceForFrame.tagName === 'VIDEO') {
                            sw = sourceForFrame.videoWidth || pageWidth;
                            sh = sourceForFrame.videoHeight || pageHeight;
                        } else if (sourceForFrame.naturalWidth) {
                            sw = sourceForFrame.naturalWidth || sourceForFrame.width || pageWidth;
                            sh = sourceForFrame.naturalHeight || sourceForFrame.height || pageHeight;
                        } else {
                            sw = pageWidth;
                            sh = pageHeight;
                        }
                        const mediaAspect = sw / sh;
                        if (mediaAspect > pageWidth / pageHeight) {
                            sw = sh * (pageWidth / pageHeight);
                            sx = Math.max(0, ((sourceForFrame.videoWidth || sourceForFrame.naturalWidth) - sw)) / 2;
                        } else {
                            sh = sw * (pageHeight / pageWidth);
                            sy = Math.max(0, ((sourceForFrame.videoHeight || sourceForFrame.naturalHeight) - sh)) / 2;
                        }
                        if (sourceForFrame.tagName === 'VIDEO') {
                            pageCtx.drawImage(sourceForFrame, sx, sy, sw, sh, 0, 0, pageWidth, pageHeight);
                        } else {
                            const imgAspect = sourceForFrame.naturalWidth / sourceForFrame.naturalHeight;
                            let ix = 0;
                            let iy = 0;
                            let iw = sourceForFrame.naturalWidth;
                            let ih = sourceForFrame.naturalHeight;
                            if (imgAspect > pageWidth / pageHeight) {
                                iw = sourceForFrame.naturalHeight * (pageWidth / pageHeight);
                                ix = (sourceForFrame.naturalWidth - iw) / 2;
                            } else {
                                ih = sourceForFrame.naturalWidth * (pageHeight / pageWidth);
                                iy = (sourceForFrame.naturalHeight - ih) / 2;
                            }
                            pageCtx.drawImage(sourceForFrame, ix, iy, iw, ih, 0, 0, pageWidth, pageHeight);
                        }
                    } catch {}
                } else {
                    drawMediaPlaceholder(pageCtx, data);
                }
            }
            if (data.text) drawText(pageCtx, data);
            if (index === 1) drawFrontCoverDecoration(pageCtx, skin, data.text ? String(data.text).replace(/\n+/g, ' ') : 'MY JOURNAL');
            if (index === state.pagesData.length - 1) drawBackCoverDecoration(pageCtx, skin, data.text || 'THE END');
        }
        state.pageRenderCache.set(cacheKey, pageCanvas);
        return pageCanvas;
    }

    async function ensurePageRendered(index, token) {
        const data = state.pagesData[index];
        if (!data || token !== state.activeRenderToken) return null;
        const cacheKey = app.getPageCacheKey(data, index);
        if (state.prerenderedPages[index] && state.prerenderedPageKeys[index] === cacheKey) return state.prerenderedPages[index];
        state.prerenderedPages[index] = null;
        state.prerenderedPageKeys[index] = '';
        const canvas = await renderPageToCanvas(data, index);
        if (token !== state.activeRenderToken) return null;
        state.prerenderedPages[index] = canvas;
        state.prerenderedPageKeys[index] = cacheKey;
        requestBookRender();
        return canvas;
    }

    async function ensurePageIndexesRendered(indexes, token) {
        const uniqueIndexes = Array.from(new Set(indexes)).filter(index => index >= 0 && index < state.pagesData.length);
        await Promise.allSettled(uniqueIndexes.map(index => ensurePageRendered(index, token)));
    }

    function renderVisiblePagesSoon() {
        const token = state.activeRenderToken;
        app.getVisiblePageIndexes(state.pagesData).forEach(index => {
            void ensurePageRendered(index, token);
        });
    }

    function wrapTextLines(pageCtx, text, maxWidth, maxLines) {
        const words = String(text || '').split(/\s+/).filter(Boolean);
        const lines = [];
        let current = '';

        const pushLine = line => {
            if (lines.length < maxLines) lines.push(line);
        };
        const trimLineWithEllipsis = line => {
            let trimmed = String(line || '').trim();
            if (!trimmed) return trimmed;
            if (pageCtx.measureText(trimmed + '...').width <= maxWidth) return `${trimmed}...`;
            while (trimmed.length > 0 && pageCtx.measureText(trimmed + '...').width > maxWidth) {
                trimmed = trimmed.slice(0, -1);
            }
            return `${trimmed}...`;
        };

        for (const word of words) {
            const test = current ? `${current} ${word}` : word;
            if (pageCtx.measureText(test).width <= maxWidth) {
                current = test;
                continue;
            }
            if (current) pushLine(current);
            else {
                pushLine(trimLineWithEllipsis(word));
                break;
            }
            if (lines.length >= maxLines) break;
            current = word;
        }
        if (current && lines.length < maxLines) pushLine(current);
        if (lines.length > maxLines) lines.length = maxLines;
        if (lines.length === maxLines && words.length > 0) {
            lines[lines.length - 1] = trimLineWithEllipsis(lines[lines.length - 1]);
        }
        return lines;
    }

    function drawText(pageCtx, data) {
        pageCtx.save();
        pageCtx.fillStyle = data.textColor || (data.bg === '#2a2a2a' ? '#ffffff' : '#000');
        pageCtx.font = `bold ${data.fontSize || state.fontSize || 24}px Georgia`;
        pageCtx.textAlign = 'center';
        pageCtx.shadowColor = 'rgba(0,0,0,0.35)';
        pageCtx.shadowBlur = 6;
        const maxWidth = pageWidth - 52;
        const textLines = wrapTextLines(pageCtx, String(data.text || ''), maxWidth, data.image ? 4 : 6);
        const lineHeight = data.image ? Math.max(24, (data.fontSize || state.fontSize || 24) * 1.25) : Math.max(38, (data.fontSize || state.fontSize || 24) * 1.6);
        const totalTextHeight = textLines.length * lineHeight;
        const startY = data.image ? pageHeight - 92 : Math.max(170, (pageHeight - totalTextHeight) / 2 + 24);
        textLines.forEach((line, index) => {
            pageCtx.fillText(line, pageWidth / 2, startY + (index * lineHeight));
        });
        pageCtx.restore();
    }

    function drawMediaPlaceholder(pageCtx, data) {
        pageCtx.save();
        pageCtx.fillStyle = '#171019';
        pageCtx.fillRect(0, 0, pageWidth, pageHeight);
        pageCtx.strokeStyle = 'rgba(255,255,255,0.18)';
        pageCtx.lineWidth = 2;
        pageCtx.strokeRect(36, 36, pageWidth - 72, pageHeight - 72);
        pageCtx.fillStyle = '#fff3da';
        pageCtx.textAlign = 'center';
        pageCtx.font = '700 24px Inter, system-ui, sans-serif';
        pageCtx.fillText(data.mediaKind === 'video' ? 'VIDEO PAGE' : 'ANIMATED GIF', pageWidth / 2, pageHeight / 2 - 12);
        pageCtx.font = '500 14px Inter, system-ui, sans-serif';
        pageCtx.fillStyle = 'rgba(255,243,218,0.72)';
        pageCtx.fillText(data.name || 'Animated page', pageWidth / 2, pageHeight / 2 + 22);
        pageCtx.restore();
    }

    function drawCrackedCoverTexture(pageCtx, skin) {
        pageCtx.save();
        pageCtx.globalAlpha = 0.22;
        pageCtx.strokeStyle = skin.coverShadow;
        pageCtx.lineWidth = 2;
        [
            [70, 120, 120, 90, 170, 116, 188, 82],
            [290, 105, 334, 82, 366, 110, 388, 74],
            [102, 230, 146, 208, 180, 244, 210, 222],
            [282, 255, 318, 226, 346, 254, 390, 210],
            [146, 386, 190, 352, 230, 376, 262, 334],
            [280, 416, 326, 372, 362, 408, 392, 368]
        ].forEach(points => {
            pageCtx.beginPath();
            pageCtx.moveTo(points[0], points[1]);
            for (let i = 2; i < points.length; i += 2) pageCtx.lineTo(points[i], points[i + 1]);
            pageCtx.stroke();
        });
        pageCtx.restore();
    }

    function drawMetalCorner(pageCtx, x, y, width, height, skin, mirrorX, mirrorY) {
        pageCtx.save();
        pageCtx.translate(x + (mirrorX ? width : 0), y + (mirrorY ? height : 0));
        pageCtx.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);
        const gradient = pageCtx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, skin.trim);
        gradient.addColorStop(0.45, '#fff1b2');
        gradient.addColorStop(1, skin.trimDark);
        pageCtx.fillStyle = gradient;
        pageCtx.beginPath();
        pageCtx.moveTo(0, 0);
        pageCtx.lineTo(width, 0);
        pageCtx.lineTo(width, 16);
        pageCtx.lineTo(28, 16);
        pageCtx.lineTo(16, height);
        pageCtx.lineTo(0, height);
        pageCtx.closePath();
        pageCtx.fill();
        pageCtx.strokeStyle = 'rgba(40, 20, 0, 0.35)';
        pageCtx.lineWidth = 2;
        pageCtx.stroke();
        pageCtx.beginPath();
        pageCtx.fillStyle = 'rgba(80, 34, 0, 0.22)';
        pageCtx.arc(22, 22, 5, 0, Math.PI * 2);
        pageCtx.fill();
        pageCtx.restore();
    }

    function drawFrontCoverDecoration(pageCtx, skin, titleText) {
        pageCtx.save();
        const coverGrad = pageCtx.createLinearGradient(0, 0, pageWidth, pageHeight);
        coverGrad.addColorStop(0, skin.coverHighlight);
        coverGrad.addColorStop(0.16, skin.coverBase);
        coverGrad.addColorStop(1, skin.coverShadow);
        pageCtx.fillStyle = coverGrad;
        pageCtx.fillRect(0, 0, pageWidth, pageHeight);
        const vignette = pageCtx.createRadialGradient(pageWidth * 0.5, pageHeight * 0.4, 40, pageWidth * 0.5, pageHeight * 0.45, pageWidth * 0.7);
        vignette.addColorStop(0, 'rgba(255,255,255,0.07)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.25)');
        pageCtx.fillStyle = vignette;
        pageCtx.fillRect(0, 0, pageWidth, pageHeight);
        drawCrackedCoverTexture(pageCtx, skin);
        drawMetalCorner(pageCtx, 18, 18, 74, 74, skin, false, false);
        drawMetalCorner(pageCtx, pageWidth - 92, 18, 74, 74, skin, true, false);
        drawMetalCorner(pageCtx, 18, pageHeight - 92, 74, 74, skin, false, true);
        drawMetalCorner(pageCtx, pageWidth - 92, pageHeight - 92, 74, 74, skin, true, true);
        pageCtx.fillStyle = skin.trimDark;
        pageCtx.fillRect(82, 86, pageWidth - 164, 12);
        pageCtx.fillRect(82, pageHeight - 98, pageWidth - 164, 12);
        pageCtx.strokeStyle = skin.trim;
        pageCtx.lineWidth = 8;
        pageCtx.strokeRect(64, 64, pageWidth - 128, pageHeight - 128);
        pageCtx.shadowColor = skin.gemGlow;
        pageCtx.shadowBlur = 28;
        pageCtx.fillStyle = skin.trim;
        pageCtx.beginPath();
        pageCtx.arc(pageWidth / 2, pageHeight / 2 - 26, 72, 0, Math.PI * 2);
        pageCtx.fill();
        pageCtx.shadowBlur = 0;
        const gemGrad = pageCtx.createRadialGradient(pageWidth / 2 - 16, pageHeight / 2 - 48, 10, pageWidth / 2, pageHeight / 2 - 26, 66);
        gemGrad.addColorStop(0, '#fff7d2');
        gemGrad.addColorStop(0.18, skin.gem);
        gemGrad.addColorStop(1, skin.coverShadow);
        pageCtx.fillStyle = gemGrad;
        pageCtx.beginPath();
        pageCtx.arc(pageWidth / 2, pageHeight / 2 - 26, 54, 0, Math.PI * 2);
        pageCtx.fill();
        pageCtx.fillStyle = skin.trim;
        pageCtx.fillRect(116, pageHeight / 2 - 38, 88, 20);
        pageCtx.fillRect(pageWidth - 204, pageHeight / 2 - 38, 88, 20);
        pageCtx.fillStyle = '#fff3da';
        pageCtx.textAlign = 'center';
        pageCtx.font = '700 38px Georgia';
        pageCtx.fillText(titleText || 'MY JOURNAL', pageWidth / 2, pageHeight - 132);
        pageCtx.font = '600 15px Inter, system-ui, sans-serif';
        pageCtx.fillStyle = 'rgba(255,243,218,0.84)';
        pageCtx.fillText('enchanted pages - living stories', pageWidth / 2, pageHeight - 100);
        pageCtx.restore();
    }

    function drawBackCoverDecoration(pageCtx, skin, text) {
        pageCtx.save();
        const grad = pageCtx.createLinearGradient(0, 0, pageWidth, pageHeight);
        grad.addColorStop(0, skin.coverShadow);
        grad.addColorStop(1, skin.coverBase);
        pageCtx.fillStyle = grad;
        pageCtx.fillRect(0, 0, pageWidth, pageHeight);
        pageCtx.strokeStyle = skin.trim;
        pageCtx.lineWidth = 7;
        pageCtx.strokeRect(56, 56, pageWidth - 112, pageHeight - 112);
        drawMetalCorner(pageCtx, 14, 14, 70, 70, skin, false, false);
        drawMetalCorner(pageCtx, pageWidth - 84, 14, 70, 70, skin, true, false);
        drawMetalCorner(pageCtx, 14, pageHeight - 84, 70, 70, skin, false, true);
        drawMetalCorner(pageCtx, pageWidth - 84, pageHeight - 84, 70, 70, skin, true, true);
        pageCtx.fillStyle = 'rgba(255,255,255,0.12)';
        pageCtx.fillRect(96, 114, pageWidth - 192, 2);
        pageCtx.fillRect(96, pageHeight - 116, pageWidth - 192, 2);
        pageCtx.fillStyle = skin.trimDark;
        pageCtx.fillRect(102, 86, pageWidth - 204, 10);
        pageCtx.fillRect(102, pageHeight - 96, pageWidth - 204, 10);
        pageCtx.shadowColor = skin.gemGlow;
        pageCtx.shadowBlur = 22;
        pageCtx.fillStyle = skin.trim;
        pageCtx.beginPath();
        pageCtx.arc(pageWidth / 2, pageHeight / 2 - 72, 34, 0, Math.PI * 2);
        pageCtx.fill();
        pageCtx.shadowBlur = 0;
        pageCtx.fillStyle = skin.coverShadow;
        pageCtx.beginPath();
        pageCtx.arc(pageWidth / 2, pageHeight / 2 - 72, 22, 0, Math.PI * 2);
        pageCtx.fill();
        pageCtx.fillStyle = '#fff3da';
        pageCtx.textAlign = 'center';
        pageCtx.font = '700 32px Georgia';
        pageCtx.fillText(text || 'THE END', pageWidth / 2, pageHeight / 2 + 10);
        pageCtx.font = '600 13px Inter, system-ui, sans-serif';
        pageCtx.fillStyle = 'rgba(255,243,218,0.74)';
        pageCtx.fillText('archive sealed', pageWidth / 2, pageHeight / 2 + 42);
        pageCtx.restore();
    }

    function drawOpenBookBacking(centerX, morphOverride = null) {
        const skin = bookSkins[state.bookStyle] || bookSkins.inferno;
        ctx.save();
        const y = margin - 22;
        const halfWidth = pageWidth + 22;
        const height = pageHeight + 44;
        const totalPages = state.pagesData?.length || 0;
        let leftScale = 1;
        let rightScale = 1;
        const liveProgress = typeof state.dragProgress === 'number' ? Math.max(0, Math.min(1, state.dragProgress)) : Math.max(0, Math.min(1, state.progress));
        const activeCoverPlan = state.isAnimating ? state.animationPlan : null;
        const frontOpening = (state.currentPage <= 0 && state.dragDirection === 1)
            || (activeCoverPlan?.isFrontCoverTurn && state.dir > 0);
        const frontClosing = (state.currentPage <= 2 && state.dragDirection === -1)
            || (activeCoverPlan?.isFrontCoverTurn && state.dir < 0);
        const backClosing = (state.currentPage >= totalPages - 2 && (state.dragDirection === 1 || state.dragDirection === -1))
            || (activeCoverPlan?.isBackCoverTurn && state.dir > 0);
        const backOpening = (state.currentPage >= totalPages - 2 && state.dragDirection === -1)
            || (activeCoverPlan?.isBackCoverTurn && state.dir < 0);
        if (morphOverride) {
            if (typeof morphOverride.leftScale === 'number') leftScale = morphOverride.leftScale;
            if (typeof morphOverride.rightScale === 'number') rightScale = morphOverride.rightScale;
            if (typeof morphOverride.scale === 'number') {
                if (morphOverride.side === 'left') leftScale = morphOverride.scale;
                if (morphOverride.side === 'right') rightScale = morphOverride.scale;
            }
        } else if (frontOpening) {
            leftScale = getCoverLeafScale(liveProgress, true);
        } else if (frontClosing) {
            leftScale = getCoverLeafScale(liveProgress, false);
        } else if (backOpening) {
            rightScale = getCoverLeafScale(liveProgress, true);
        } else if (backClosing) {
            rightScale = getCoverLeafScale(liveProgress, false);
        }
        leftScale = Math.max(0.08, Math.min(1, leftScale));
        rightScale = Math.max(0.08, Math.min(1, rightScale));
        const leftWidth = halfWidth * leftScale;
        const rightWidth = halfWidth * rightScale;
        const leftX = centerX - leftWidth;
        const rightX = centerX;
        const leftGrad = ctx.createLinearGradient(leftX, y, centerX, y);
        leftGrad.addColorStop(0, skin.coverShadow);
        leftGrad.addColorStop(0.18, skin.coverBase);
        leftGrad.addColorStop(1, skin.coverShadow);
        const rightGrad = ctx.createLinearGradient(rightX, y, rightX + rightWidth, y);
        rightGrad.addColorStop(0, skin.coverShadow);
        rightGrad.addColorStop(0.2, skin.coverBase);
        rightGrad.addColorStop(1, skin.coverShadow);
        ctx.shadowColor = 'rgba(0,0,0,0.46)';
        ctx.shadowBlur = 24;
        if (leftWidth > 4) {
            ctx.fillStyle = leftGrad;
            ctx.beginPath();
            ctx.roundRect(leftX, y, leftWidth + 10, height, 18);
            ctx.fill();
        }
        if (rightWidth > 4) {
            ctx.fillStyle = rightGrad;
            ctx.beginPath();
            ctx.roundRect(rightX - 10, y, rightWidth + 10, height, 18);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.strokeStyle = skin.trim;
        ctx.lineWidth = 3;
        if (leftWidth > 8) ctx.strokeRect(leftX + 1, y + 1, leftWidth - 2, height - 2);
        if (rightWidth > 8) ctx.strokeRect(rightX, y + 1, rightWidth - 2, height - 2);
        ctx.restore();
    }

    function drawCoverTurnBacking(centerX, progress, side) {
        const skin = bookSkins[state.bookStyle] || bookSkins.inferno;
        const easedProgress = smoothstep(progress);
        const y = margin - 22;
        const height = pageHeight + 44;
        const compactHalfWidth = 22;
        const openHalfWidth = pageWidth + 22;
        const activeHalfWidth = compactHalfWidth + ((openHalfWidth - compactHalfWidth) * easedProgress);
        const leftWidth = side === 'left' ? activeHalfWidth : openHalfWidth;
        const rightWidth = side === 'right' ? activeHalfWidth : openHalfWidth;
        const leftX = centerX - leftWidth;
        const rightX = centerX;
        const leftGrad = ctx.createLinearGradient(leftX, y, centerX, y);
        leftGrad.addColorStop(0, skin.coverShadow);
        leftGrad.addColorStop(0.18, skin.coverBase);
        leftGrad.addColorStop(1, skin.coverShadow);
        const rightGrad = ctx.createLinearGradient(rightX, y, rightX + rightWidth, y);
        rightGrad.addColorStop(0, skin.coverShadow);
        rightGrad.addColorStop(0.2, skin.coverBase);
        rightGrad.addColorStop(1, skin.coverShadow);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.46)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = leftGrad;
        ctx.beginPath();
        ctx.roundRect(leftX, y, leftWidth + 10, height, 18);
        ctx.fill();
        ctx.fillStyle = rightGrad;
        ctx.beginPath();
        ctx.roundRect(rightX - 10, y, rightWidth + 10, height, 18);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = skin.trim;
        ctx.lineWidth = 3;
        ctx.strokeRect(leftX + 1, y + 1, leftWidth - 2, height - 2);
        ctx.strokeRect(rightX, y + 1, rightWidth - 2, height - 2);
        ctx.restore();
    }

    function drawSpreadWithScales(leftIndex, rightIndex, centerX, leftScale, rightScale, pagesData) {
        const visibleLeftScale = clamp01(leftScale);
        const visibleRightScale = clamp01(rightScale);
        const leftX = centerX - pageWidth;
        const rightX = centerX;
        if (visibleLeftScale > 0.001) {
            const visibleLeftWidth = Math.max(1, pageWidth * visibleLeftScale);
            ctx.save();
            ctx.beginPath();
            ctx.rect(centerX - visibleLeftWidth, margin, visibleLeftWidth, pageHeight);
            ctx.clip();
            drawPrerenderedPage(leftIndex, leftX, margin, pagesData);
            ctx.restore();
        }
        if (visibleRightScale > 0.001) {
            const visibleRightWidth = Math.max(1, pageWidth * visibleRightScale);
            ctx.save();
            ctx.beginPath();
            ctx.rect(centerX, margin, visibleRightWidth, pageHeight);
            ctx.clip();
            drawPrerenderedPage(rightIndex, rightX, margin, pagesData);
            ctx.restore();
        }
    }

    function smoothstep(progress) {
        const normalized = clamp01(progress);
        return normalized * normalized * (3 - (2 * normalized));
    }

    function remapProgress(progress, start, end) {
        if (end <= start) return progress >= end ? 1 : 0;
        return clamp01((clamp01(progress) - start) / (end - start));
    }

    function getCoverLeafScale(progress, isOpening) {
        const projectedWidth = Math.cos(clamp01(progress) * Math.PI);
        return isOpening ? Math.max(0, -projectedWidth) : Math.max(0, projectedWidth);
    }

    function getCoverSpreadScale(progress, isOpening) {
        const delayedProgress = isOpening
            ? remapProgress(progress, 0.62, 0.98)
            : 1 - remapProgress(progress, 0.02, 0.38);
        const easedProgress = smoothstep(delayedProgress);
        return isOpening ? easedProgress : 1 - easedProgress;
    }

    function getCoverShellProgress(progress, isOpening) {
        if (isOpening) return smoothstep(remapProgress(progress, 0.5, 1));
        const beforeSideSwap = smoothstep(remapProgress(progress, 0, 0.5));
        return 1 - beforeSideSwap;
    }

    function getCoverTurnScales(pagesData) {
        const totalPages = pagesData.length;
        const plan = state.isAnimating ? state.animationPlan : null;
        const progress = clamp01(state.progress);
        if (plan?.isFrontCoverTurn && state.dir > 0) return { leftScale: getCoverSpreadScale(progress, true), rightScale: 1 };
        if (plan?.isFrontCoverTurn && state.dir < 0) return { leftScale: getCoverSpreadScale(progress, false), rightScale: 1 };
        if (plan?.isBackCoverTurn && state.dir < 0) return { leftScale: 1, rightScale: getCoverSpreadScale(progress, true) };
        if (plan?.isBackCoverTurn && state.dir > 0) return { leftScale: 1, rightScale: getCoverSpreadScale(progress, false) };
        if (state.currentPage <= 0 && state.dragDirection === 1) return { leftScale: getCoverSpreadScale(clamp01(state.dragProgress), true), rightScale: 1 };
        if (state.currentPage <= 2 && state.dragDirection === -1) return { leftScale: getCoverSpreadScale(clamp01(state.dragProgress), false), rightScale: 1 };
        if (state.currentPage >= totalPages - 2 && state.dragDirection === -1) return { leftScale: 1, rightScale: getCoverSpreadScale(clamp01(state.dragProgress), true) };
        if (state.currentPage >= totalPages - 2 && state.dragDirection === 1) return { leftScale: 1, rightScale: getCoverSpreadScale(clamp01(state.dragProgress), false) };
        return null;
    }

    function isCoverTurnActive(pagesData) {
        const plan = state.isAnimating ? state.animationPlan : null;
        if (plan?.isFrontCoverTurn || plan?.isBackCoverTurn) return true;
        const totalPages = pagesData.length;
        return (state.currentPage <= 2 || state.currentPage >= totalPages - 2) && Boolean(state.dragDirection);
    }

    function getCoverTransitionMetrics(progress, isOpening) {
        const normalized = clamp01(progress);
        const coverFoldProgress = normalized;
        const spreadProgress = isOpening
            ? clamp01((normalized - 0.58) / 0.42)
            : 1 - clamp01(normalized / 0.42);
        const hingeTravelProgress = isOpening
            ? clamp01(normalized / 0.68)
            : 1 - clamp01((normalized - 0.32) / 0.68);
        return { coverFoldProgress, spreadProgress, hingeTravelProgress };
    }

    function renderCoverTransitionFrame(pagesData, plan, centerX, pulse) {
        const isOpening = state.animationPhase === 'slide-open';
        const side = app.getCoverSide(plan);
        const isBackCover = side === 'back';
        const { coverFoldProgress, spreadProgress, hingeTravelProgress } = getCoverTransitionMetrics(state.progress, isOpening);
        const openCenterX = margin + pageWidth;
        const closedBookLeftX = margin + (pageWidth / 2);
        const closedBookRightX = closedBookLeftX + pageWidth;
        const closedHingeX = isBackCover ? closedBookRightX : closedBookLeftX;
        const openHingeX = openCenterX;
        const spreadStart = isOpening ? plan.targetSpreadStart : plan.spreadStart;
        const spreadLeft = app.clampPageIndex(spreadStart, pagesData);
        const spreadRight = app.clampPageIndex(spreadStart + 1, pagesData);
        const coverIndex = app.getCoverPageIndex(plan, pagesData);
        const coverDirection = isOpening
            ? (isBackCover ? -1 : 1)
            : (isBackCover ? 1 : -1);
        const coverHingeX = closedHingeX + ((openHingeX - closedHingeX) * hingeTravelProgress);
        const coverImage = getRenderedPageCanvas(coverIndex, pagesData);
        const delayedSideScale = Math.max(0.12, spreadProgress);
        const leftScale = isBackCover ? 1 : delayedSideScale;
        const rightScale = isBackCover ? delayedSideScale : 1;
        drawOpenBookBacking(openCenterX, {
            leftScale,
            rightScale
        });
        drawSpreadWithScales(spreadLeft, spreadRight, openCenterX, leftScale, rightScale, pagesData);
        if (spreadProgress > 0.22) drawPageEdges(openCenterX);
        if (spreadProgress > 0.18) drawCenterSpineShadow(openCenterX);
        if (coverImage) {
            drawDeformedPage(coverImage, coverHingeX, coverDirection, coverFoldProgress, coverIndex, pagesData);
            const coverMedia = state.mediaElements.get(pagesData[coverIndex]?.id);
            if (coverMedia) {
                try {
                    ctx.save();
                    drawDeformedPageWithMedia(coverMedia, pagesData[coverIndex], coverHingeX, coverDirection, coverFoldProgress, coverIndex, pagesData);
                    ctx.restore();
                } catch {}
            }
        } else {
            const fallbackX = closedBookLeftX;
            drawClosedBookFrame(fallbackX, pulse);
            drawPrerenderedPage(coverIndex, fallbackX, margin, pagesData);
        }
        if (app.hasActiveSeal()) {
            const sealX = closedBookLeftX;
            drawSealChains(sealX, pulse);
        }
    }

    function renderSlidingClosedCoverFrame(pagesData, plan, pulse) {
        const coverX = app.getSlidingCoverX(plan);
        const coverIndex = app.getCoverPageIndex(plan, pagesData);
        const idleScale = getClosedBookIdleScale();
        const startScale = state.animationPhase === 'slide-open' ? idleScale : 1;
        const endScale = state.animationPhase === 'slide-open' ? 1 : idleScale;
        const scale = startScale + ((endScale - startScale) * smoothstep(state.progress));
        renderClosedBookPresentation(pagesData, coverX, coverIndex, pulse, app.getCoverSide(plan), scale);
    }

    function renderPopClosedCoverFrame(pagesData, plan, pulse) {
        const coverX = app.getClosedCoverCenterX();
        const coverIndex = app.getCoverPageIndex(plan, pagesData);
        const scale = getClosedBookIdleScale();
        renderClosedBookPresentation(pagesData, coverX, coverIndex, pulse, app.getCoverSide(plan), scale);
    }

    function updateClosedBookHoverPresentation() {
        const target = state.isClosedBookHovered ? 1 : 0;
        state.closedBookHoverProgress += (target - state.closedBookHoverProgress) * 0.14;
        if (Math.abs(target - state.closedBookHoverProgress) < 0.001) state.closedBookHoverProgress = target;
    }

    function drawPageEdges(centerX) {
        const skin = bookSkins[state.bookStyle] || bookSkins.inferno;
        ctx.save();
        const edgeGrad = ctx.createLinearGradient(centerX - pageWidth + 26, margin + pageHeight - 44, centerX + pageWidth - 26, margin + pageHeight - 8);
        edgeGrad.addColorStop(0, skin.pageShade);
        edgeGrad.addColorStop(0.4, skin.pageEdge);
        edgeGrad.addColorStop(1, skin.pageShade);
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(centerX - pageWidth + 24, margin + pageHeight - 26, (pageWidth * 2) - 48, 16);
        ctx.globalAlpha = 0.28;
        for (let i = 0; i < 18; i += 1) {
            const y = margin + pageHeight - 24 + (i % 3);
            const x = centerX - pageWidth + 32 + (i * ((pageWidth * 2 - 72) / 18));
            ctx.fillStyle = 'rgba(98, 66, 22, 0.35)';
            ctx.fillRect(x, y, 34, 1);
        }
        ctx.restore();
    }

    function drawCenterSpineShadow(centerX) {
        ctx.save();
        const pageTop = margin;
        const pageBottom = margin + pageHeight;
        const spineGrad = ctx.createLinearGradient(centerX - 30, pageTop, centerX + 30, pageTop);
        spineGrad.addColorStop(0, 'rgba(0,0,0,0)');
        spineGrad.addColorStop(0.36, 'rgba(0,0,0,0.34)');
        spineGrad.addColorStop(0.5, 'rgba(0,0,0,0.62)');
        spineGrad.addColorStop(0.64, 'rgba(0,0,0,0.34)');
        spineGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = spineGrad;
        ctx.fillRect(centerX - 30, pageTop, 60, pageBottom - pageTop);
        ctx.globalAlpha = 0.34;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 2, pageTop + 8);
        ctx.lineTo(centerX - 2, pageBottom - 8);
        ctx.stroke();
        ctx.restore();
    }

    function drawClosedBookRail(centerX, side) {
        const skin = bookSkins[state.bookStyle] || bookSkins.inferno;
        const railWidth = 18;
        const railInset = 8;
        const railX = side === 'back' ? centerX + pageWidth - railInset - railWidth : centerX + railInset;
        const railGrad = ctx.createLinearGradient(railX, margin, railX + railWidth, margin);
        railGrad.addColorStop(0, 'rgba(26, 8, 6, 0.78)');
        railGrad.addColorStop(0.28, skin.coverShadow);
        railGrad.addColorStop(0.72, skin.coverBase);
        railGrad.addColorStop(1, 'rgba(255,255,255,0.08)');
        ctx.save();
        ctx.fillStyle = railGrad;
        ctx.fillRect(railX, margin, railWidth, pageHeight);
        ctx.strokeStyle = skin.trim;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const primaryLineX = side === 'back' ? railX + railWidth - 1 : railX + 1;
        const secondaryLineX = side === 'back' ? railX + 4 : railX + railWidth - 5;
        ctx.moveTo(primaryLineX, margin);
        ctx.lineTo(primaryLineX, margin + pageHeight);
        ctx.stroke();
        ctx.globalAlpha = 0.88;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(secondaryLineX, margin);
        ctx.lineTo(secondaryLineX, margin + pageHeight);
        ctx.stroke();
        ctx.restore();
    }

    function drawClosedBookFrame(centerX, pulse, side = 'front') {
        const skin = bookSkins[state.bookStyle] || bookSkins.inferno;
        ctx.save();
        const frameX = centerX - 4;
        const frameY = margin;
        const frameWidth = pageWidth + 8;
        const frameHeight = pageHeight;
        const frameGrad = ctx.createLinearGradient(frameX, frameY, frameX + frameWidth, frameY);
        frameGrad.addColorStop(0, skin.coverShadow);
        frameGrad.addColorStop(0.18, skin.coverBase);
        frameGrad.addColorStop(1, skin.coverShadow);
        ctx.fillStyle = frameGrad;
        ctx.fillRect(frameX, frameY, frameWidth, frameHeight);
        const sideGrad = ctx.createLinearGradient(centerX, margin, centerX + pageWidth, margin);
        sideGrad.addColorStop(0, skin.coverShadow);
        sideGrad.addColorStop(0.5, skin.coverBase);
        sideGrad.addColorStop(1, skin.coverShadow);
        ctx.fillStyle = sideGrad;
        ctx.beginPath();
        ctx.roundRect(centerX, margin, pageWidth, pageHeight, 14);
        ctx.fill();
        ctx.strokeStyle = skin.trim;
        ctx.lineWidth = 3;
        ctx.strokeRect(frameX + 1, frameY + 1, frameWidth - 2, frameHeight - 2);
        ctx.shadowColor = 'rgba(0,0,0,0.46)';
        ctx.shadowBlur = 24;
        ctx.restore();
    }

    function drawClosedCoverPage(index, coverX, pagesData) {
        const pageCanvas = getRenderedPageCanvas(index, pagesData);
        if (!pageCanvas) {
            drawLoadingPage(coverX, margin);
            void ensurePageRendered(index, state.activeRenderToken);
            return;
        }
        ctx.drawImage(pageCanvas, coverX, margin, pageWidth, pageHeight);
    }

    function getClosedBookIdleScale() {
        return 0.9 + (0.1 * clamp01(state.closedBookHoverProgress));
    }

    function renderClosedBookPresentation(pagesData, coverX, coverIndex, pulse, side, scale = 1) {
        const bookCenterX = coverX + (pageWidth / 2);
        const bookCenterY = margin + (pageHeight / 2);
        ctx.save();
        ctx.translate(bookCenterX, bookCenterY);
        ctx.scale(scale, scale);
        ctx.translate(-bookCenterX, -bookCenterY);
        drawClosedBookFrame(coverX, pulse, side);
        drawClosedCoverPage(coverIndex, coverX, pagesData);
        drawClosedBookRail(coverX, side);
        if (app.hasActiveSeal()) drawSealChains(coverX, pulse);
        ctx.restore();
    }

    function renderClosedBookSideFlipFrame(pagesData, pulse) {
        const coverX = app.getClosedCoverCenterX();
        const turn = smoothstep(state.progress);
        const beforeSwap = turn < 0.5;
        const side = beforeSwap ? state.closedSpinFromSide : state.closedSpinToSide;
        const coverIndex = side === 'back' ? pagesData.length - 1 : Math.min(1, pagesData.length - 1);
        const spinScaleX = Math.max(0.035, Math.abs(Math.cos(turn * Math.PI)));
        const centerX = coverX + (pageWidth / 2);
        const centerY = margin + (pageHeight / 2);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(spinScaleX, 1);
        ctx.translate(-centerX, -centerY);
        drawClosedBookFrame(coverX, pulse, side);
        drawClosedCoverPage(coverIndex, coverX, pagesData);
        drawClosedBookRail(coverX, side);
        if (app.hasActiveSeal()) drawSealChains(coverX, pulse);
        ctx.restore();
    }

    function renderMagnifierLens() {
        const lens = els.magnifierLens;
        const lensCanvas = els.magnifierCanvas;
        if (!lens || !lensCanvas) return;
        if (!state.magnifierEnabled || !state.magnifierVisible || !state.isCanvasHovered) {
            lens.classList.add('hidden');
            return;
        }
        const sourceX = Math.max(0, Math.min(els.canvas.width, state.magnifierPointerX));
        const sourceY = Math.max(0, Math.min(els.canvas.height, state.magnifierPointerY));
        const stageRect = els.bookStage?.getBoundingClientRect?.();
        if (!stageRect) {
            lens.classList.add('hidden');
            return;
        }
        const lensSize = lensCanvas.width;
        const radius = lensSize / 2;
        const zoom = 2.2;
        const lensCtx = lensCanvas.getContext('2d');
        if (!lensCtx) return;
        lensCtx.clearRect(0, 0, lensSize, lensSize);
        lensCtx.save();
        lensCtx.beginPath();
        lensCtx.arc(radius, radius, radius - 6, 0, Math.PI * 2);
        lensCtx.clip();
        const sampleSize = lensSize / zoom;
        const sampleHalf = sampleSize / 2;
        const sx = Math.max(0, Math.min(els.canvas.width - sampleSize, sourceX - sampleHalf));
        const sy = Math.max(0, Math.min(els.canvas.height - sampleSize, sourceY - sampleHalf));
        lensCtx.drawImage(els.canvas, sx, sy, sampleSize, sampleSize, 0, 0, lensSize, lensSize);
        const shine = lensCtx.createRadialGradient(radius * 0.72, radius * 0.68, 8, radius, radius, radius);
        shine.addColorStop(0, 'rgba(255,255,255,0.26)');
        shine.addColorStop(0.58, 'rgba(255,255,255,0.06)');
        shine.addColorStop(1, 'rgba(0,0,0,0)');
        lensCtx.fillStyle = shine;
        lensCtx.fillRect(0, 0, lensSize, lensSize);
        lensCtx.restore();
        const offsetX = 34;
        const offsetY = 34;
        const left = Math.max(12, Math.min(stageRect.width - lensSize - 12, sourceX + offsetX));
        const top = Math.max(12, Math.min(stageRect.height - lensSize - 12, sourceY - radius - offsetY));
        lens.style.left = `${left}px`;
        lens.style.top = `${top}px`;
        lens.classList.remove('hidden');
    }

    function renderAnimatedCoverTurnFrame(pagesData, centerX) {
        const plan = state.animationPlan;
        const isFrontCoverTurn = Boolean(plan?.isFrontCoverTurn);
        const isOpening = (isFrontCoverTurn && state.dir > 0) || (!isFrontCoverTurn && state.dir < 0);
        const shellProgress = getCoverShellProgress(state.progress, isOpening);
        drawCoverTurnBacking(centerX, shellProgress, isFrontCoverTurn ? 'left' : 'right');
        const spreadIndexes = app.getAnimationSpreadIndexes(pagesData);
        const coverTurnScales = getCoverTurnScales(pagesData);
        drawSpreadWithScales(
            spreadIndexes.left,
            spreadIndexes.right,
            centerX,
            isFrontCoverTurn ? 0 : coverTurnScales?.leftScale ?? 1,
            isFrontCoverTurn ? coverTurnScales?.rightScale ?? 1 : 0,
            pagesData
        );
        if (state.progress > 0.14) drawCenterSpineShadow(centerX);
        const flipIndexes = app.getFlipImageIndexes(pagesData);
        const flipIndex = state.progress >= 0.5 ? flipIndexes.back : flipIndexes.front;
        const flipImage = getRenderedPageCanvas(flipIndex, pagesData);
        if (!flipImage) {
            void ensurePageRendered(flipIndex, state.activeRenderToken);
            return;
        }
        const flipSpec = app.getFlipDrawSpec(centerX - pageWidth, centerX, pagesData);
        drawDeformedPage(flipImage, flipSpec.startX, flipSpec.direction, state.progress, flipIndex, pagesData);
        const flipMedia = state.mediaElements.get(pagesData[flipIndex]?.id);
        if (!flipMedia) return;
        try {
            ctx.save();
            drawDeformedPageWithMedia(flipMedia, pagesData[flipIndex], flipSpec.startX, flipSpec.direction, state.progress, flipIndex, pagesData);
            ctx.restore();
        } catch {}
    }

    function drawChainLink(x, y, angle, size, broken) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        const grad = ctx.createLinearGradient(-size, -size, size, size);
        grad.addColorStop(0, broken ? '#7b6b57' : '#f2dfaa');
        grad.addColorStop(0.48, broken ? '#c4a86d' : '#fff6cc');
        grad.addColorStop(1, broken ? '#4d4237' : '#7d6130');
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(5, size * 0.22);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.56, size * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (broken) {
            ctx.strokeStyle = 'rgba(20, 12, 8, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-size * 0.28, -size * 0.68);
            ctx.lineTo(size * 0.22, size * 0.62);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawChainLine(startX, startY, endX, endY, links, brokenCount) {
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx) + (Math.PI / 2);
        for (let i = 0; i < links; i += 1) {
            const t = links === 1 ? 0.5 : i / (links - 1);
            const broken = i < brokenCount;
            const jitter = broken ? Math.sin((performance.now() / 85) + i) * 4 : 0;
            drawChainLink(startX + (dx * t), startY + (dy * t) + jitter, angle + ((i % 2) * 0.55), 22, broken);
        }
    }

    function drawSealLock(centerX, centerY, integrity, pulse) {
        const brokenRatio = 1 - (integrity / maxSealIntegrity);
        ctx.save();
        ctx.shadowColor = `rgba(255, 202, 88, ${0.36 + (pulse * 0.24)})`;
        ctx.shadowBlur = 24 + (pulse * 18);
        ctx.fillStyle = integrity <= 1 ? '#7a3b2d' : '#6c4a23';
        ctx.strokeStyle = '#f4d37a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(centerX - 42, centerY - 18, 84, 76, 12);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX, centerY - 16, 31, Math.PI, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#f6df9b';
        ctx.beginPath();
        ctx.arc(centerX, centerY + 16, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(centerX - 3, centerY + 20, 6, 20);
        if (brokenRatio > 0) {
            ctx.strokeStyle = 'rgba(255, 246, 204, 0.86)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX - 22, centerY - 2);
            ctx.lineTo(centerX - 4, centerY + 12);
            ctx.lineTo(centerX - 16, centerY + 26);
            ctx.lineTo(centerX + 18, centerY + 48);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawSealChains(pageX, pulse) {
        if (!state.sealed && state.sealIntegrity <= 0) return;
        const integrity = Math.max(0, state.sealIntegrity);
        const brokenCount = maxSealIntegrity - integrity;
        const hitAge = performance.now() - state.sealHitTime;
        const shake = hitAge < 220 ? Math.sin(hitAge * 0.18) * (1 + brokenCount) : 0;
        const x = pageX + shake;
        const y = margin;
        ctx.save();
        ctx.globalAlpha = state.sealed ? 1 : 0.65;
        drawChainLine(x + 54, y + 126, x + pageWidth - 54, y + pageHeight - 126, 13, Math.max(0, brokenCount - 1));
        drawChainLine(x + pageWidth - 54, y + 126, x + 54, y + pageHeight - 126, 13, Math.max(0, brokenCount - 2));
        drawChainLine(x + 32, y + pageHeight * 0.5, x + pageWidth - 32, y + pageHeight * 0.5, 12, Math.max(0, brokenCount - 3));
        drawSealLock(x + (pageWidth / 2), y + (pageHeight / 2), integrity, pulse);
        ctx.restore();
    }

    function ensureMediaOverlay(data) {
        const container = els.canvas.parentElement?.querySelector('#media-overlay-container');
        if (!container || !data || !data.image || !data.mediaKind || data.mediaKind === 'image') return null;
        container.style.zIndex = '2';
        container.style.pointerEvents = 'none';
        container.style.overflow = 'hidden';
        let overlay = state.mediaOverlays.get(data.id);
        const isInPagesData = state.pagesData.some(page => page && page.id === data.id);
        if (!isInPagesData) {
            if (overlay) {
                overlay.element.remove();
                state.mediaOverlays.delete(data.id);
            }
            return null;
        }
        if (!overlay) {
            const element = document.createElement(data.mediaKind === 'video' ? 'video' : 'img');
            element.style.position = 'absolute';
            element.style.pointerEvents = 'none';
            element.style.objectFit = 'cover';
            element.style.display = 'none';
            element.style.zIndex = '2';
            element.style.maxWidth = 'none';
            element.style.maxHeight = 'none';
            if (data.mediaKind === 'video') {
                element.muted = true;
                element.defaultMuted = true;
                element.loop = true;
                element.playsInline = true;
                element.autoplay = true;
                element.preload = 'auto';
                element.src = data.image;
                element.load();
                element.play().catch(() => {});
            } else {
                element.src = data.image;
                element.alt = data.name || '';
            }
            container.appendChild(element);
            overlay = { element, pageIndex: -1 };
            state.mediaOverlays.set(data.id, overlay);
        }
        if (overlay.element.getAttribute('src') !== data.image) {
            overlay.element.setAttribute('src', data.image);
            if (overlay.element.tagName === 'VIDEO') {
                overlay.element.load();
                overlay.element.play().catch(() => {});
            }
        }
        return overlay;
    }

    function updateMediaOverlays() {
        const stage = els.canvas.parentElement;
        if (!stage) return;
        try {
            const canvasRect = els.canvas.getBoundingClientRect();
            const stageRect = stage.getBoundingClientRect();
            const offsetX = canvasRect.left - stageRect.left;
            const offsetY = canvasRect.top - stageRect.top;
            const scaleX = canvasRect.width / els.canvas.width;
            const scaleY = canvasRect.height / els.canvas.height;
            const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
            const isAnimating = state.isAnimating || state.isPreparingFlip || state.isDragging;
            const bookIsClosed = app.isClosedStart() || app.isClosedEnd(pagesData) || app.isSlidingCoverPhase();
            if (bookIsClosed || isAnimating) {
                state.mediaOverlays.forEach(overlay => {
                    overlay.element.style.display = 'none';
                });
                return;
            }
            const centerX = margin + pageWidth + state.viewOffsetX;
            const spreadStart = app.getRenderSpreadStart(pagesData);
            const visibleSlots = new Map([
                [app.clampPageIndex(spreadStart, pagesData), centerX - pageWidth],
                [app.clampPageIndex(spreadStart + 1, pagesData), centerX]
            ]);
            visibleSlots.forEach((_, pageIndex) => {
                const pageData = pagesData[pageIndex];
                if (app.hasLiveMedia(pageData)) ensureMediaOverlay(pageData);
            });
            state.mediaOverlays.forEach((overlay, id) => {
                try {
                    const pageIndex = pagesData.findIndex(page => page && page.id === id);
                    const pageData = pageIndex >= 0 ? pagesData[pageIndex] : null;
                    const pageX = visibleSlots.get(pageIndex);
                    if (!pageData || !app.hasLiveMedia(pageData) || pageX === undefined) {
                        overlay.element.style.display = 'none';
                        return;
                    }
                    overlay.element.style.left = `${offsetX + (pageX * scaleX)}px`;
                    overlay.element.style.top = `${offsetY + (margin * scaleY)}px`;
                    overlay.element.style.width = `${pageWidth * scaleX}px`;
                    overlay.element.style.height = `${pageHeight * scaleY}px`;
                    overlay.element.style.display = 'block';
                    if (overlay.element.tagName === 'VIDEO') overlay.element.play().catch(() => {});
                } catch (err) {
                    console.warn('[MediaOverlay] Failed to update overlay:', err?.message || err);
                }
            });
        } catch (err) {
            console.warn('[MediaOverlay] Top-level error:', err?.message || err);
        }
    }

    function clearMediaOverlays() {
        state.mediaOverlays.forEach(overlay => {
            try {
                overlay.element.remove();
            } catch {}
        });
        state.mediaOverlays.clear();
    }

    function getRenderedPageCanvas(index, pagesData) {
        if ((state.isAnimating || state.isDragging) && state.animationPageCanvases.has(index)) {
            return state.animationPageCanvases.get(index) || null;
        }
        const pageData = pagesData[index];
        if (pageData && pageData.mediaKind && pageData.mediaKind !== 'image') {
            const cacheKey = app.getPageCacheKey(pageData, index);
            if (state.prerenderedPages[index] && state.prerenderedPageKeys[index] !== cacheKey) {
                state.prerenderedPages[index] = null;
                state.prerenderedPageKeys[index] = '';
            }
        }
        return state.prerenderedPages[index] || null;
    }

    function getPageCanvasForDrag(index, pagesData) {
        const rendered = getRenderedPageCanvas(index, pagesData);
        if (rendered) return rendered;
        const pageData = pagesData[index];
        if (!pageData || pageData.isVoid) return null;
        const temp = document.createElement('canvas');
        temp.width = pageWidth;
        temp.height = pageHeight;
        const tempCtx = temp.getContext('2d');
        const skin = bookSkins[state.bookStyle] || bookSkins.inferno;
        tempCtx.fillStyle = pageData.bg || state.bgColor || skin.pageSurface || '#fff';
        tempCtx.fillRect(0, 0, pageWidth, pageHeight);
        const snap = pageData.mediaKind && pageData.mediaKind !== 'image' ? state.mediaSnapshots.get(pageData.id) : null;
        if (snap) {
            try {
                tempCtx.drawImage(snap, 0, 0, pageWidth, pageHeight);
            } catch {}
        } else if (pageData.image) {
            tempCtx.fillStyle = '#171019';
            tempCtx.fillRect(0, 0, pageWidth, pageHeight);
            tempCtx.fillStyle = 'rgba(255,243,218,0.8)';
            tempCtx.font = '700 22px Inter, system-ui, sans-serif';
            tempCtx.textAlign = 'center';
            tempCtx.fillText(pageData.mediaKind === 'video' ? 'VIDEO PAGE' : pageData.mediaKind === 'gif' ? 'GIF PAGE' : 'IMAGE PAGE', pageWidth / 2, pageHeight / 2);
        }
        if (pageData.text) {
            tempCtx.fillStyle = 'rgba(253,251,240,0.94)';
            tempCtx.fillRect(0, pageHeight - 132, pageWidth, 132);
            drawText(tempCtx, pageData);
        }
        return temp;
    }

    function drawPrerenderedPage(index, x, y, pagesData) {
        const pageData = pagesData[index];
        if (!pageData || pageData.isVoid) return;
        const hasMediaSnapshot = pageData.mediaKind && pageData.mediaKind !== 'image' && state.mediaSnapshots.has(pageData.id);
        if (hasMediaSnapshot) {
            const snap = state.mediaSnapshots.get(pageData.id);
            ctx.drawImage(snap, x, y, pageWidth, pageHeight);
            drawLiveMediaPage(pageData, x, y);
            void ensurePageRendered(index, state.activeRenderToken);
            return;
        }
        const pageCanvas = getRenderedPageCanvas(index, pagesData);
        if (!pageCanvas) {
            drawLoadingPage(x, y);
            void ensurePageRendered(index, state.activeRenderToken);
            return;
        }
        ctx.drawImage(pageCanvas, x, y, pageWidth, pageHeight);
        drawLiveMediaPage(pageData, x, y);
    }

    function drawLiveMediaPage(pageData, x, y) {
        if (!pageData || !app.hasLiveMedia(pageData)) return;
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#fff';
        ctx.font = '700 13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(pageData.mediaKind === 'video' ? 'VIDEO' : 'GIF', x + pageWidth - 8, y + 20);
        ctx.restore();
    }

    function drawLoadingPage(x, y) {
        ctx.save();
        ctx.fillStyle = '#fdfbf0';
        ctx.fillRect(x, y, pageWidth, pageHeight);
        ctx.fillStyle = '#6f6258';
        ctx.textAlign = 'center';
        ctx.font = '700 18px Inter, system-ui, sans-serif';
        ctx.fillText('Loading page...', x + (pageWidth / 2), y + (pageHeight / 2));
        ctx.restore();
    }

    function drawDeformedPage(image, hingeX, direction, foldProgress, pageIndex, pagesData) {
        if (!image) return;
        const lastPageIndex = pagesData ? pagesData.length - 1 : state.prerenderedPages.length - 1;
        const isFirstPage = pageIndex === 1;
        const isLastPage = pageIndex === lastPageIndex;
        const pageData = pagesData && pageIndex >= 0 && pageIndex < pagesData.length ? pagesData[pageIndex] : null;
        const isNoImagePage = pageData && !pageData.image;
        const onlyTwoPages = state.prerenderedPages.length <= 2;
        const isRigid = (!onlyTwoPages && (isFirstPage || isLastPage)) || isNoImagePage;
        const segments = 100;
        const stripWidth = pageWidth / segments;
        const projection = direction * Math.cos(foldProgress * Math.PI) * pageWidth;
        const projectionRatio = Math.min(1, Math.abs(projection) / pageWidth);
        const projectedStripWidth = Math.max(0.35, Math.abs(projection) / segments);
        const pageLeft = projection >= 0 ? hingeX : hingeX + projection;
        const curveStrength = Math.sin(foldProgress * Math.PI);
        if (Math.abs(projection) < 1.2) {
            ctx.save();
            const skin = bookSkins[state.bookStyle] || bookSkins.inferno;
            const edgeGradient = ctx.createLinearGradient(hingeX - 4, margin, hingeX + 4, margin);
            edgeGradient.addColorStop(0, 'rgba(0,0,0,0.42)');
            edgeGradient.addColorStop(0.5, skin.pageEdge || '#f0d39d');
            edgeGradient.addColorStop(1, 'rgba(0,0,0,0.34)');
            ctx.fillStyle = edgeGradient;
            ctx.fillRect(hingeX - 2, margin, 4, pageHeight);
            ctx.restore();
            return;
        }
        for (let index = 0; index < segments; index += 1) {
            const sectionProgress = index / segments;
            const baseBend = isRigid ? 0 : Math.sin(sectionProgress * Math.PI) * (82 * curveStrength);
            const srcX = index * stripWidth;
            const drawX = pageLeft + (index * projectedStripWidth);
            const verticalSegments = 5;
            const segmentHeight = pageHeight / verticalSegments;
            for (let row = 0; row < verticalSegments; row += 1) {
                const twistMultiplier = 1 + ((row / verticalSegments) * 0.5);
                const dynamicBend = baseBend * twistMultiplier;
                const drawY = margin + (row * segmentHeight) - (dynamicBend * 0.5);
                ctx.drawImage(image, srcX, row * segmentHeight, stripWidth, segmentHeight, drawX, drawY, projectedStripWidth + 1, segmentHeight + (dynamicBend * 0.1));
                const shadowOpacity = isRigid ? (1 - projectionRatio) * 0.4 : (Math.abs(dynamicBend) / 220) + ((1 - projectionRatio) * 0.24);
                ctx.fillStyle = `rgba(0,0,0,${shadowOpacity})`;
                ctx.fillRect(drawX, drawY, projectedStripWidth + 1, segmentHeight + (dynamicBend * 0.1));
            }
        }
    }

    function drawDeformedPageWithMedia(mediaElement, data, hingeX, direction, foldProgress, pageIndex, pagesData) {
        const segments = 60;
        const stripWidth = pageWidth / segments;
        const projection = direction * Math.cos(foldProgress * Math.PI) * pageWidth;
        const projectedStripWidth = Math.max(0.5, Math.abs(projection) / segments);
        const pageLeft = projection >= 0 ? hingeX : hingeX + projection;
        const curveStrength = Math.sin(foldProgress * Math.PI);
        const isRigid = pageIndex === 1 || pageIndex === (pagesData?.length - 1 || 0);
        if (Math.abs(projection) < 2) return;
        const sourceImage = state.mediaSnapshots.get(data?.id) || mediaElement;
        for (let index = 0; index < segments; index += 1) {
            const sectionProgress = index / segments;
            const baseBend = isRigid ? 0 : Math.sin(sectionProgress * Math.PI) * (82 * curveStrength);
            const srcX = index * stripWidth;
            const drawX = pageLeft + (index * projectedStripWidth);
            const segmentHeight = pageHeight / 4;
            for (let row = 0; row < 4; row += 1) {
                const twistMultiplier = 1 + ((row / 4) * 0.5);
                const dynamicBend = baseBend * twistMultiplier;
                const drawY = margin + (row * segmentHeight) - (dynamicBend * 0.5);
                try {
                    if (sourceImage instanceof HTMLVideoElement || sourceImage.tagName === 'VIDEO') {
                        const videoAspect = sourceImage.videoWidth / sourceImage.videoHeight;
                        let sx = 0;
                        let sy = 0;
                        let sw = sourceImage.videoWidth;
                        let sh = sourceImage.videoHeight;
                        if (videoAspect > pageWidth / pageHeight) {
                            sw = sourceImage.videoHeight * (pageWidth / pageHeight);
                            sx = (sourceImage.videoWidth - sw) / 2;
                        } else {
                            sh = sourceImage.videoWidth * (pageHeight / pageWidth);
                            sy = (sourceImage.videoHeight - sh) / 2;
                        }
                        ctx.drawImage(sourceImage, sx + srcX, sy, Math.max(1, sw / segments), sh, drawX, drawY, projectedStripWidth + 1, segmentHeight + (dynamicBend * 0.1));
                    } else {
                        const imgAspect = sourceImage.naturalWidth / sourceImage.naturalHeight;
                        let ix = 0;
                        let iy = 0;
                        let iw = sourceImage.naturalWidth || sourceImage.width;
                        let ih = sourceImage.naturalHeight || sourceImage.height;
                        if (imgAspect > pageWidth / pageHeight) {
                            iw = sourceImage.naturalHeight * (pageWidth / pageHeight);
                            ix = (sourceImage.naturalWidth - iw) / 2;
                        } else {
                            ih = sourceImage.naturalWidth * (pageHeight / pageWidth);
                            iy = (sourceImage.naturalHeight - ih) / 2;
                        }
                        ctx.drawImage(sourceImage, ix + srcX, iy, Math.max(1, iw / segments), ih, drawX, drawY, projectedStripWidth + 1, segmentHeight + (dynamicBend * 0.1));
                    }
                } catch {}
                const shadowOpacity = isRigid ? (1 - Math.min(1, Math.abs(projection) / pageWidth)) * 0.4 : (Math.abs(dynamicBend) / 220) + ((1 - Math.min(1, Math.abs(projection) / pageWidth)) * 0.24);
                ctx.fillStyle = `rgba(0,0,0,${shadowOpacity})`;
                ctx.fillRect(drawX, drawY, projectedStripWidth + 1, segmentHeight + (dynamicBend * 0.1));
            }
        }
    }

    function getQueuedFlipPageIndex(layerIndex, pagesData) {
        const direction = state.dir > 0 ? 1 : -1;
        const projectedCurrent = app.clampPageIndex(state.currentPage + (direction * 2 * (layerIndex + 1)), pagesData);
        return app.clampPageIndex(direction > 0 ? projectedCurrent + 1 : projectedCurrent, pagesData);
    }

    function drawQueuedFlipStack(flipSpec, pagesData) {
        const queued = Array.isArray(state.queuedPageFlips) ? state.queuedPageFlips : [];
        const direction = state.dir > 0 ? 1 : -1;
        const matchingTurns = queued.filter(entry => entry === direction).slice(0, 4);
        if (matchingTurns.length === 0) return;
        for (let index = matchingTurns.length - 1; index >= 0; index -= 1) {
            const pageIndex = getQueuedFlipPageIndex(index, pagesData);
            const pageCanvas = getRenderedPageCanvas(pageIndex, pagesData);
            if (!pageCanvas) {
                void ensurePageRendered(pageIndex, state.activeRenderToken);
                continue;
            }
            const staggeredProgress = clamp01((state.progress * 0.86) - ((index + 1) * 0.1));
            const visibleProgress = Math.max(0.025, staggeredProgress);
            const hingeOffset = direction > 0 ? -(index + 1) * 3 : (index + 1) * 3;
            ctx.save();
            ctx.globalAlpha = Math.max(0.2, 0.56 - (index * 0.08));
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 10 + (index * 3);
            drawDeformedPage(pageCanvas, flipSpec.startX + hingeOffset, flipSpec.direction, visibleProgress, pageIndex, pagesData);
            ctx.restore();
        }
    }

    function prepareDragFlipCanvases(direction, pagesData) {
        if (!direction || !pagesData?.length) return;
        const token = state.activeRenderToken;
        const plan = app.getFlipPlan(direction, pagesData);
        const backPage = direction > 0 ? plan.targetSpreadStart : plan.targetSpreadStart + 1;
        const indexes = Array.from(new Set([plan.leftPage, plan.rightPage, plan.targetSpreadStart, plan.targetSpreadStart + 1, plan.flipPage, backPage, plan.targetPage])).filter(index => index >= 0 && index < pagesData.length);
        state.animationPageCanvases = state.animationPageCanvases || new Map();
        indexes.forEach(index => {
            const canvas = state.prerenderedPages[index];
            if (canvas) state.animationPageCanvases.set(index, canvas);
        });
        void ensurePageIndexesRendered(indexes, token).then(() => {
            if (token !== state.activeRenderToken) return;
            indexes.forEach(index => {
                const canvas = state.prerenderedPages[index];
                if (canvas) state.animationPageCanvases.set(index, canvas);
            });
            if (state.isDragging && state.dragDirection === direction) requestBookRender();
        });
    }

    function renderDragFrame(pagesData, hingeX, flipDir, foldProgress, centerX) {
        state.mediaOverlays.forEach(overlay => {
            try {
                overlay.element.style.display = 'none';
            } catch {}
        });
        ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
        const leftX = centerX - pageWidth;
        const rightX = centerX;
        const plan = app.getFlipPlan(flipDir > 0 ? 1 : -1, pagesData);
        const coverTurnScales = getCoverTurnScales(pagesData);
        const isFrontCoverTurn = Boolean(plan.isFrontCoverTurn) || state.currentPage <= 2;
        const isBackCoverTurn = Boolean(plan.isBackCoverTurn) || state.currentPage >= pagesData.length - 2;
        if (coverTurnScales) {
            const spreadStart = app.getRenderSpreadStart(pagesData);
            const spreadLeft = app.clampPageIndex(spreadStart, pagesData);
            const spreadRight = app.clampPageIndex(spreadStart + 1, pagesData);
            drawOpenBookBacking(centerX, {
                leftScale: isFrontCoverTurn ? 0 : coverTurnScales.leftScale,
                rightScale: isBackCoverTurn ? 0 : coverTurnScales.rightScale
            });
            drawSpreadWithScales(
                spreadLeft,
                spreadRight,
                centerX,
                isFrontCoverTurn ? 0 : coverTurnScales.leftScale,
                isBackCoverTurn ? 0 : coverTurnScales.rightScale,
                pagesData
            );
        } else {
            drawOpenBookBacking(centerX);
            drawPageEdges(centerX);
            const leftPageIndex = flipDir > 0 ? app.clampPageIndex(plan.leftPage, pagesData) : app.clampPageIndex(plan.targetSpreadStart, pagesData);
            const rightPageIndex = flipDir > 0 ? app.clampPageIndex(plan.targetSpreadStart + 1, pagesData) : app.clampPageIndex(plan.rightPage, pagesData);
            drawPrerenderedPage(leftPageIndex, leftX, margin, pagesData);
            drawPrerenderedPage(rightPageIndex, rightX, margin, pagesData);
        }
        drawCenterSpineShadow(centerX);
        const showingBack = foldProgress >= 0.5;
        let frontIndex;
        let backIndex;
        if (flipDir < 0 && plan.isFrontCoverTurn) {
            frontIndex = app.clampPageIndex(plan.leftPage, pagesData);
            backIndex = app.clampPageIndex(Math.min(1, pagesData.length - 1), pagesData);
        } else if (flipDir > 0 && plan.isBackCoverTurn) {
            frontIndex = app.clampPageIndex(plan.rightPage, pagesData);
            backIndex = app.clampPageIndex(pagesData.length - 1, pagesData);
        } else {
            frontIndex = app.clampPageIndex(plan.flipPage, pagesData);
            backIndex = app.clampPageIndex(flipDir > 0 ? plan.targetSpreadStart : plan.targetSpreadStart + 1, pagesData);
        }
        const pageToDraw = showingBack ? backIndex : frontIndex;
        const flipImage = getPageCanvasForDrag(pageToDraw, pagesData);
        if (flipImage) {
            drawDeformedPage(flipImage, hingeX, flipDir, foldProgress, pageToDraw, pagesData);
            const flipMedia = state.mediaElements.get(pagesData[pageToDraw]?.id);
            if (flipMedia) {
                try {
                    ctx.save();
                    drawDeformedPageWithMedia(flipMedia, pagesData[pageToDraw], hingeX, flipDir, foldProgress, pageToDraw, pagesData);
                    ctx.restore();
                } catch {}
            }
        } else {
            void ensurePageRendered(pageToDraw, state.activeRenderToken);
        }
        if (app.hasActiveSeal()) drawSealChains(rightX, 0.5);
    }

    function render(timestamp) {
        const pagesData = state.pagesData?.length ? state.pagesData : app.buildPagesData();
        updateClosedBookHoverPresentation();
        app.updateInspectPresentationMotion();
        app.syncClosedBookUi(pagesData);
        app.updateViewOffset(pagesData);
        ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
        updateMediaOverlays();
        const pulse = (Math.sin((timestamp || performance.now()) / 420) + 1) / 2;
        const centerX = margin + pageWidth + state.viewOffsetX;
        const leftX = centerX - pageWidth;
        const rightX = centerX;
        const y = margin;
        if (state.isDragging && state.dragDirection) {
            renderDragFrame(pagesData, centerX, state.dragDirection, app.easeFlipProgress(state.dragProgress || 0), centerX);
            renderMagnifierLens();
            if (app.shouldKeepRendering(pagesData)) requestBookRender();
            return;
        }
        ctx.save();
        if (app.isClosedSpinPhase()) {
            renderClosedBookSideFlipFrame(pagesData, pulse);
            ctx.restore();
            renderMagnifierLens();
            if (app.shouldKeepRendering(pagesData)) requestBookRender();
            return;
        }
        if (app.isPopCoverPhase()) {
            const plan = state.animationPlan || app.getFlipPlan(state.dir || 1, pagesData);
            renderPopClosedCoverFrame(pagesData, plan, pulse);
            ctx.restore();
            renderMagnifierLens();
            return;
        }
        if (app.isSlidingCoverPhase()) {
            const plan = state.animationPlan || app.getFlipPlan(state.dir || 1, pagesData);
            renderSlidingClosedCoverFrame(pagesData, plan, pulse);
            ctx.restore();
            renderMagnifierLens();
            return;
        }
        if (app.isClosedStart()) {
            renderClosedBookPresentation(pagesData, leftX, 1, pulse, 'front', getClosedBookIdleScale());
            ctx.restore();
            renderMagnifierLens();
            if (app.shouldKeepRendering(pagesData)) requestBookRender();
            return;
        }
        if (app.isClosedEnd(pagesData)) {
            const coverX = rightX;
            renderClosedBookPresentation(pagesData, coverX, pagesData.length - 1, pulse, 'back', getClosedBookIdleScale());
            ctx.restore();
            renderMagnifierLens();
            if (app.shouldKeepRendering(pagesData)) requestBookRender();
            return;
        }
        const coverTurnActive = isCoverTurnActive(pagesData);
        if (state.isAnimating && state.animationPlan && coverTurnActive) {
            renderAnimatedCoverTurnFrame(pagesData, centerX);
            if (app.hasActiveSeal()) drawSealChains(rightX, pulse);
            ctx.restore();
            renderMagnifierLens();
            return;
        }
        drawOpenBookBacking(centerX);
        if (!coverTurnActive) drawPageEdges(centerX);
        const spreadIndexes = state.isAnimating ? app.getAnimationSpreadIndexes(pagesData) : (() => {
            const spreadStart = app.getRenderSpreadStart(pagesData);
            return { left: app.clampPageIndex(spreadStart, pagesData), right: app.clampPageIndex(spreadStart + 1, pagesData) };
        })();
        const coverTurnScales = getCoverTurnScales(pagesData);
        if (coverTurnScales) {
            const activeCoverPlan = state.isAnimating ? state.animationPlan : null;
            const isFrontCoverTurn = Boolean(activeCoverPlan?.isFrontCoverTurn)
                || (state.currentPage <= 2 && (state.dragDirection === 1 || state.dragDirection === -1));
            const isBackCoverTurn = Boolean(activeCoverPlan?.isBackCoverTurn)
                || (state.currentPage >= pagesData.length - 2 && (state.dragDirection === 1 || state.dragDirection === -1));
            drawSpreadWithScales(
                spreadIndexes.left,
                spreadIndexes.right,
                centerX,
                isFrontCoverTurn ? 0 : coverTurnScales.leftScale,
                isBackCoverTurn ? 0 : coverTurnScales.rightScale,
                pagesData
            );
        } else {
            drawPrerenderedPage(spreadIndexes.left, leftX, y, pagesData);
            drawPrerenderedPage(spreadIndexes.right, rightX, y, pagesData);
        }
        if (!coverTurnActive || state.progress > 0.14) drawCenterSpineShadow(centerX);
        if (state.isAnimating) {
            const flipIndexes = app.getFlipImageIndexes(pagesData);
            const flipIndex = state.progress >= 0.5 ? flipIndexes.back : flipIndexes.front;
            const flipImage = getRenderedPageCanvas(flipIndex, pagesData);
            if (flipImage) {
                const flipSpec = app.getFlipDrawSpec(leftX, rightX, pagesData);
                drawQueuedFlipStack(flipSpec, pagesData);
                drawDeformedPage(flipImage, flipSpec.startX, flipSpec.direction, state.progress, flipIndex, pagesData);
                const flipMedia = state.mediaElements.get(pagesData[flipIndex]?.id);
                if (flipMedia) {
                    try {
                        ctx.save();
                        drawDeformedPageWithMedia(flipMedia, pagesData[flipIndex], leftX + pageWidth, flipSpec.direction, state.progress, flipIndex, pagesData);
                        ctx.restore();
                    } catch {}
                } else {
                    void ensurePageRendered(flipIndex, state.activeRenderToken);
                }
            } else {
                void ensurePageRendered(flipIndex, state.activeRenderToken);
            }
        }
        if (app.hasActiveSeal()) drawSealChains(rightX, pulse);
        ctx.restore();
        renderMagnifierLens();
        if (app.shouldKeepRendering(pagesData) && !state.isAnimating) requestBookRender();
    }

    function requestBookRender() {
        if (state.renderRequested) return;
        state.renderRequested = true;
        requestAnimationFrame(timestamp => {
            state.renderRequested = false;
            render(timestamp);
        });
    }

    Object.assign(app, {
        escapeHtml,
        loadImageFromSource,
        loadAnimatedImageFromSource,
        loadVideoFromSource,
        createMediaSnapshot,
        loadMediaElement,
        renderPageToCanvas,
        ensurePageRendered,
        ensurePageIndexesRendered,
        renderVisiblePagesSoon,
        wrapTextLines,
        drawText,
        drawMediaPlaceholder,
        drawFrontCoverDecoration,
        drawBackCoverDecoration,
        drawOpenBookBacking,
        drawPageEdges,
        drawCenterSpineShadow,
        drawClosedBookFrame,
        drawSealChains,
        ensureMediaOverlay,
        updateMediaOverlays,
        clearMediaOverlays,
        getRenderedPageCanvas,
        getPageCanvasForDrag,
        drawPrerenderedPage,
        drawLoadingPage,
        drawDeformedPage,
        drawDeformedPageWithMedia,
        prepareDragFlipCanvases,
        renderMagnifierLens,
        renderDragFrame,
        render,
        requestBookRender
    });
}
