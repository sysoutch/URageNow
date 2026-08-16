(function() {
    const themes = {
        blood: { accent: '#ff4d4d', accentStrong: '#ff1a1a', bg: '#1a0d0d', surface: 'rgba(26, 13, 13, 0.95)', surfaceStrong: 'rgba(17, 11, 11, 0.98)', line: 'rgba(255, 100, 100, 0.18)', lineStrong: 'rgba(255, 100, 100, 0.34)', text: '#f6f1ee', muted: '#c8b6ae' },
        fire: { accent: '#ff8a4d', accentStrong: '#ff6136', bg: '#120d0d', surface: 'rgba(24, 14, 14, 0.92)', surfaceStrong: 'rgba(18, 11, 11, 0.98)', line: 'rgba(255, 180, 128, 0.18)', lineStrong: 'rgba(255, 180, 128, 0.34)', text: '#f6f1ee', muted: '#c8b6ae' },
        water: { accent: '#59b6ff', accentStrong: '#2f8cf0', bg: '#0d1522', surface: 'rgba(12, 21, 37, 0.94)', surfaceStrong: 'rgba(10, 17, 29, 0.98)', line: 'rgba(114, 190, 255, 0.18)', lineStrong: 'rgba(114, 190, 255, 0.34)', text: '#eef5ff', muted: '#a9bfd8' },
        light: { accent: '#8fa8ce', accentStrong: '#6f8db8', bg: '#ffffff', surface: '#ffffff', surfaceStrong: '#ffffff', line: 'rgba(124, 145, 177, 0.24)', lineStrong: 'rgba(122, 147, 186, 0.32)', text: '#1a2432', muted: '#5c6b80' },
        crystal: { accent: '#c27cff', accentStrong: '#9b59d1', bg: '#1a0d1a', surface: 'rgba(26, 13, 26, 0.95)', surfaceStrong: 'rgba(17, 11, 17, 0.98)', line: 'rgba(194, 124, 255, 0.18)', lineStrong: 'rgba(194, 124, 255, 0.34)', text: '#f9eefe', muted: '#d1a9d8' },
        nature: { accent: '#82cd5f', accentStrong: '#58a23c', bg: '#11170f', surface: 'rgba(18, 24, 16, 0.94)', surfaceStrong: 'rgba(13, 19, 11, 0.98)', line: 'rgba(146, 213, 120, 0.18)', lineStrong: 'rgba(146, 213, 120, 0.34)', text: '#f2f8ee', muted: '#bccfaf' },
        rock: { accent: '#c4ae8a', accentStrong: '#9b8563', bg: '#151515', surface: 'rgba(24, 24, 24, 0.95)', surfaceStrong: 'rgba(16, 16, 16, 0.98)', line: 'rgba(196, 190, 176, 0.18)', lineStrong: 'rgba(196, 190, 176, 0.34)', text: '#f2efea', muted: '#b7aea2' }
    }

    function getTokens(themeName) {
        const normalizedThemeName = themeName === 'purple' ? 'crystal' : themeName
        return themes[normalizedThemeName] || themes.fire
    }

    function normalizeTokens(tokens, fallbackTokens) {
        if (!tokens || typeof tokens !== 'object') return fallbackTokens
        return {
            accent: tokens.accent || fallbackTokens.accent,
            accentStrong: tokens.accentStrong || fallbackTokens.accentStrong,
            bg: tokens.bg || fallbackTokens.bg || fallbackTokens.surfaceStrong,
            surface: tokens.surface || fallbackTokens.surface,
            surfaceStrong: tokens.surfaceStrong || fallbackTokens.surfaceStrong,
            line: tokens.line || fallbackTokens.line,
            lineStrong: tokens.lineStrong || fallbackTokens.lineStrong,
            text: tokens.text || fallbackTokens.text,
            muted: tokens.muted || fallbackTokens.muted
        }
    }

    function applySharedTokenAliases(tokens) {
        const rootStyle = document.documentElement.style
        const aliases = {
            '--tool-accent': tokens.accent,
            '--tool-accent-strong': tokens.accentStrong,
            '--tool-bg': tokens.bg,
            '--tool-surface': tokens.surface,
            '--tool-surface-strong': tokens.surfaceStrong,
            '--tool-surface-alt': tokens.surfaceStrong,
            '--tool-line': tokens.line,
            '--tool-line-strong': tokens.lineStrong,
            '--tool-text': tokens.text,
            '--tool-muted': tokens.muted,
            '--primary': tokens.accent,
            '--secondary': tokens.accentStrong,
            '--accent': tokens.accent,
            '--accent-hover': tokens.accentStrong,
            '--accent-2': tokens.accentStrong,
            '--bg': tokens.bg,
            '--surface': tokens.surface,
            '--panel': tokens.surface,
            '--panel-strong': tokens.surfaceStrong,
            '--glass': tokens.surface,
            '--glass-heavy': tokens.surfaceStrong,
            '--line': tokens.line,
            '--line-strong': tokens.lineStrong,
            '--border': tokens.line,
            '--text': tokens.text,
            '--text-dim': tokens.muted,
            '--muted': tokens.muted,
            '--card-bg': tokens.surfaceStrong
        }
        Object.entries(aliases).forEach(([name, value]) => rootStyle.setProperty(name, value))
    }

    function ensureStylesheet(id, href) {
        const existing = document.getElementById(id)
        if (existing) {
            const target = document.head || document.documentElement
            target.appendChild(existing)
            return
        }
        const link = document.createElement('link')
        link.id = id
        link.rel = 'stylesheet'
        link.href = href
        const target = document.head || document.documentElement
        target.appendChild(link)
    }

    function ensureSharedToolStyles() {
        ensureStylesheet('urage-shared-tool-theme-styles', '/tools/shared/css/tool-theme.css')
        ensureStylesheet('urage-shared-tool-component-styles', '/tools/shared/css/components/tool-components.css')
        ensureStylesheet('urage-shared-tool-sidebar-styles', '/tools/shared/css/sidebar-scrollview.css')
    }

    function postThemeReady() {
        if (!window.parent || window.parent === window) return
        window.parent.postMessage({
            source: 'urage-tool',
            type: 'tool:ready',
            payload: {
                theme: (document.body && document.body.getAttribute('data-dashboard-theme')) || document.documentElement.getAttribute('data-dashboard-theme') || 'fire'
            }
        }, '*')
    }

    let sharedToolStyleRefreshScheduled = false

    function scheduleSharedToolStyleRefresh() {
        if (sharedToolStyleRefreshScheduled) return
        sharedToolStyleRefreshScheduled = true
        const refresh = () => {
            ensureSharedToolStyles()
            postThemeReady()
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', refresh, { once: true })
        } else {
            window.setTimeout(refresh, 0)
        }
        window.addEventListener('load', refresh, { once: true })
    }

    function applyBodyTheme(themeName, syncedTokens) {
        const themeHost = document.body || document.documentElement
        const nextTheme = themeName || themeHost.getAttribute('data-dashboard-theme') || document.documentElement.getAttribute('data-dashboard-theme') || 'fire'
        themeHost.setAttribute('data-dashboard-theme', nextTheme)
        document.documentElement.setAttribute('data-dashboard-theme', nextTheme)
        ensureSharedToolStyles()
        scheduleSharedToolStyleRefresh()
        const tokens = normalizeTokens(syncedTokens, getTokens(nextTheme))
        applySharedTokenAliases(tokens)
        return tokens
    }

    let lastSyncedThemeName = ''
    let lastSyncedTokens = null

    function getStoredSyncedTokens(themeName) {
        const normalizedThemeName = String(themeName || '').trim()
        return normalizedThemeName && normalizedThemeName === lastSyncedThemeName ? lastSyncedTokens : null
    }

    function applyThemeVars(themeName, cssVarMap, syncedTokens) {
        const tokens = applyBodyTheme(themeName, syncedTokens || getStoredSyncedTokens(themeName))
        if (!cssVarMap) return tokens
        Object.entries(cssVarMap).forEach(([cssVar, tokenName]) => {
            const value = tokens[tokenName]
            if (value) document.documentElement.style.setProperty(cssVar, value)
        })
        return tokens
    }

    const themeCallbacks = []

    function applySyncedTheme(themeName, syncedTokens) {
        const resolvedTheme = themeName || (document.body && document.body.getAttribute('data-dashboard-theme')) || document.documentElement.getAttribute('data-dashboard-theme') || 'fire'
        const tokens = applyBodyTheme(resolvedTheme, syncedTokens)
        lastSyncedThemeName = resolvedTheme
        lastSyncedTokens = tokens
        themeCallbacks.forEach(callback => {
            try {
                callback(resolvedTheme, tokens)
            } catch (error) {
                console.warn('Dashboard tool theme callback failed.', error)
            }
        })
        return tokens
    }

    window.addEventListener('message', (event) => {
        const message = event && event.data
        if (!message || message.type !== 'tool:theme') return
        applySyncedTheme(message.payload && message.payload.theme, message.payload && message.payload.tokens)
    })

    function registerThemeSync(onApply) {
        if (typeof onApply === 'function' && !themeCallbacks.includes(onApply)) {
            themeCallbacks.push(onApply)
        }
        return applySyncedTheme()
    }

    window.getDashboardThemeTokens = getTokens
    window.applyDashboardThemeVars = applyThemeVars
    window.ensureDashboardToolStyles = ensureSharedToolStyles
    window.registerDashboardThemeSync = registerThemeSync
    scheduleSharedToolStyleRefresh()
    postThemeReady()
})()
