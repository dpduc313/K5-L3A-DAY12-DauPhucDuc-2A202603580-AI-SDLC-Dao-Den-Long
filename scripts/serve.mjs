#!/usr/bin/env node
// Máy chủ tĩnh không phụ thuộc thư viện: phục vụ thư mục build (dist/) và API bảng xếp hạng.
// Dùng cho `node scripts/play.mjs`, bench, và bản phát hành. Chạy riêng: node scripts/serve.mjs [--port 8080] [--dir dist] [--no-open]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleLbApi } from '../src/lbstore.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4' };

export function startServer({ dir = join(root, 'dist'), port = 0, onBench } = {}) {
  const base = resolve(dir);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/leaderboard') return handleLbApi(req, res);
    if (url.pathname === '/api/bench' && req.method === 'POST' && onBench) {
      let body = ''; req.on('data', (c) => { body += c; });
      req.on('end', () => { res.writeHead(200); res.end('ok'); onBench(JSON.parse(body)); });
      return;
    }
    const file = normalize(join(base, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

export function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* không mở được thì người dùng tự mở URL */ }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const { url } = await startServer({ dir: get('--dir', join(root, 'dist')), port: Number(get('--port', 8080)) });
  console.log(`Đảo Đèn Lồng đang chạy ở ${url}  (Ctrl+C để tắt)`);
  if (!args.includes('--no-open')) openBrowser(url);
}
