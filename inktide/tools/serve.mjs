// Minimal static server for development and headless tests.
// Usage: node tools/serve.mjs [--port 8080] [--root www]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

export function createServer(root = path.join(here, '..', 'www')) {
  return http.createServer((req, res) => {
    try {
      let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (url.endsWith('/')) url += 'index.html';
      const file = path.normalize(path.join(root, url));
      if (!file.startsWith(path.normalize(root))) {
        res.writeHead(403);
        return res.end('forbidden');
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404, { 'content-type': 'text/plain' });
          return res.end('not found: ' + url);
        }
        res.writeHead(200, {
          'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'no-store',
        });
        res.end(data);
      });
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(arg('--port', process.env.PORT || 8080));
  const root = path.resolve(arg('--root', path.join(here, '..', 'www')));
  createServer(root).listen(port, () => console.log(`INKTIDE dev server: http://localhost:${port}/  (root ${root})`));
}
