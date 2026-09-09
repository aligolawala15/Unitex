'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createStore } = require('./store');
const api = require('./api');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';

  // Prevent path traversal.
  const target = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!target.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      // SPA fallback: unknown paths render the app shell.
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, shell) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME['.html'],
          'Content-Length': shell.length,
        });
        res.end(shell);
      });
      return;
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300',
    });
    res.end(data);
  });
}

(async () => {
  let store;
  try {
    store = await createStore();
    console.log(`[unitex] store ready (${store.mode})`);
  } catch (err) {
    console.error('[unitex] store init failed:', err.message);
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';

    if (url === '/healthz') {
      sendJson(res, 200, { ok: true, mode: store.mode });
      return;
    }

    if (url.startsWith('/api/')) {
      try {
        const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readBody(req);
        const result = await api.handle({ store, method: req.method, url, body });
        sendJson(res, result.status, result.body);
      } catch (err) {
        console.error('[api]', err);
        sendJson(res, 500, { error: err.message || 'server error' });
      }
      return;
    }

    serveStatic(req, res, url);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[unitex] listening on 0.0.0.0:${PORT}`);
  });
})();
