const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 5173);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const ROOT_DIR = process.cwd();

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 5 * 1024 * 1024) {
                req.destroy();
                reject(new Error('Request body too large'));
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

function resolveStaticPath(urlPath) {
    const requestPath = urlPath === '/' ? '/index.html' : urlPath;
    const normalized = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
    return path.join(ROOT_DIR, normalized);
}

async function proxyToClient(res, upstream) {
    const text = await upstream.text();
    send(
        res,
        upstream.status,
        text,
        upstream.headers.get('content-type') || 'application/json; charset=utf-8'
    );
}

async function handleGenerateProxy(req, res) {
    try {
        const body = await readRequestBody(req);
        const upstream = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body
        });

        await proxyToClient(res, upstream);
    } catch (error) {
        send(res, 502, JSON.stringify({ error: String(error) }), 'application/json; charset=utf-8');
    }
}

async function handleTagsProxy(res) {
    try {
        const upstream = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            method: 'GET'
        });

        await proxyToClient(res, upstream);
    } catch (error) {
        send(res, 502, JSON.stringify({ error: String(error) }), 'application/json; charset=utf-8');
    }
}

function handleStatic(req, res, pathname) {
    const filePath = resolveStaticPath(pathname);
    if (!filePath.startsWith(ROOT_DIR)) {
        send(res, 403, 'Forbidden');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            send(res, 404, 'Not found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const headers = {
            'Content-Type': contentType,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        };

        if (req.method === 'HEAD') {
            res.writeHead(200, headers);
            res.end();
            return;
        }

        const stream = fs.createReadStream(filePath);
        res.writeHead(200, headers);
        stream.pipe(res);
        stream.on('error', () => send(res, 500, 'File read error'));
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'POST' && url.pathname === '/api/generate') {
        await handleGenerateProxy(req, res);
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/tags') {
        await handleTagsProxy(res);
        return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
        handleStatic(req, res, url.pathname);
        return;
    }

    send(res, 405, 'Method not allowed');
});

server.listen(PORT, HOST, () => {
    console.log(`WordleVS server running at http://${HOST}:${PORT}`);
    console.log(`Proxying Ollama requests to ${OLLAMA_BASE_URL}/api/generate`);
});
