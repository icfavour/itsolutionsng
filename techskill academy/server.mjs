/**
 * TechSkill Academy — local development / demo server.
 *
 * Serves the static frontend from ./public and mounts the SAME API code used by
 * the Netlify Function (netlify/functions/api.mjs) at /api/*.
 * Uses a file-based datastore in ./.data when not running on Netlify
 * (on Netlify the API automatically uses Netlify Blobs instead).
 *
 * Local runs seed rich sample data (demo students, classes, materials…) so the
 * portals can be explored immediately. A fresh Netlify deployment starts CLEAN
 * (courses + admin only) unless you set SEED_DEMO=true there.
 *
 * Run:  node server.mjs     (no npm install needed)
 */

// Local demo gets the full sample dataset (read lazily by the seeder).
process.env.SEED_DEMO = process.env.SEED_DEMO || 'true';

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './netlify/functions/api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // ---- API: hand off to the Netlify Function handler ----
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bodyBuf = chunks.length ? Buffer.concat(chunks) : null;

      const init = { method: req.method, headers: req.headers };
      if (bodyBuf && req.method !== 'GET' && req.method !== 'HEAD') init.body = bodyBuf;

      const response = await handle(new Request(`http://localhost:${PORT}${req.url}`, init));

      const headers = {};
      response.headers.forEach((v, k) => { headers[k] = v; });
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    // ---- Static files ----
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    try {
      const data = await fs.readFile(filePath);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch {
      // SPA fallback
      try {
        const index = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(index);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error: ' + err.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TechSkill Academy running at http://localhost:${PORT}`);
  console.log('Datastore: file-based (./.data). On Netlify the API uses Netlify Blobs.');
});
