// MACH 25 — static dev server with ES-module MIME types
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = 4111;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath === '/') urlPath = '/index.html';
    let filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    let st = await stat(filePath).catch(() => null);
    if (!st) { res.writeHead(404); res.end('not found'); return; }
    if (st.isDirectory()) {
      filePath = join(filePath, 'index.html');
      st = await stat(filePath).catch(() => null);
      if (!st) { res.writeHead(404); res.end('not found'); return; }
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end(String(e && e.message || e));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MACH 25 archive serving at http://127.0.0.1:${PORT}/`);
});
