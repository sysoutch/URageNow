(function() {
    function postToDashboard(type, payload, requestId) {
        if (!window.parent || window.parent === window) return
        window.parent.postMessage({
            source: 'urage-tool',
            type,
            requestId,
            payload: payload || {}
        }, '*')
    }

    function normalizeErrorMessage(error, fallback) {
        if (error && typeof error.message === 'string' && error.message.trim()) return error.message.trim()
        if (typeof error === 'string' && error.trim()) return error.trim()
        return fallback || 'Tool bridge action failed.'
    }

    function registerDashboardToolBridge(options) {
        const config = options && typeof options === 'object' ? options : {}
        const onLoadAsset = typeof config.onLoadAsset === 'function' ? config.onLoadAsset : null
        const onExportImage = typeof config.onExportImage === 'function' ? config.onExportImage : null
        const onDescribeCurrentAsset = typeof config.onDescribeCurrentAsset === 'function' ? config.onDescribeCurrentAsset : null
        const onDescribeCurrentAssets = typeof config.onDescribeCurrentAssets === 'function' ? config.onDescribeCurrentAssets : null
        const onTheme = typeof config.onTheme === 'function' ? config.onTheme : null

        window.__urageToolLoadAssetPayload = onLoadAsset
            ? (payload) => Promise.resolve(onLoadAsset(payload || {}))
            : undefined
        window.__urageToolRequestExportImage = onExportImage
            ? () => Promise.resolve(onExportImage())
            : undefined
        window.__urageToolDescribeCurrentAssets = onDescribeCurrentAssets
            ? () => Promise.resolve(onDescribeCurrentAssets())
            : undefined
        window.__urageToolDescribeCurrentAsset = onDescribeCurrentAsset
            ? () => Promise.resolve(onDescribeCurrentAsset())
            : onDescribeCurrentAssets
                ? () => Promise.resolve(onDescribeCurrentAssets()).then(payload => Array.isArray(payload) ? (payload[0] || null) : payload || null)
            : undefined

        window.addEventListener('message', event => {
            const message = event && event.data ? event.data : null
            if (!message || message.source !== 'urage-dashboard') return
            if (message.type === 'tool:theme') {
                if (onTheme) onTheme(message.payload && message.payload.theme)
                return
            }
            if (message.type === 'tool:load-asset' && onLoadAsset) {
                Promise.resolve(onLoadAsset(message.payload || {})).catch(error => {
                    postToDashboard('tool:error', { error: normalizeErrorMessage(error, 'Failed to load dashboard asset.') }, message.requestId)
                })
                return
            }
            if (message.type === 'tool:request-export-image' && onExportImage) {
                Promise.resolve(onExportImage())
                    .then(payload => postToDashboard('tool:export-image', payload || {}, message.requestId))
                    .catch(error => {
                        postToDashboard('tool:error', { error: normalizeErrorMessage(error, 'Failed to export image.') }, message.requestId)
                    })
            }
        })
    }

    window.registerDashboardToolBridge = registerDashboardToolBridge
    window.postDashboardToolBridgeMessage = postToDashboard
})()
