#!/usr/bin/env node
// run_cmd của contract. Mặc định: build bản web rồi mở game trong trình duyệt (bảng xếp hạng lưu ở leaderboard.json).
//   node scripts/play.mjs [--port 8080] [--no-open]
//   node scripts/play.mjs --export-leaderboard out.json   → {"entries": [...]} đúng thứ tự, rồi thoát
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportLb, LB_FILE } from '../src/lbstore.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

if (args.includes('--export-leaderboard')) {
  const out = get('--export-leaderboard');
  if (!out) { console.error('loi: thieu duong dan cho --export-leaderboard'); process.exit(1); }
  exportLb(out);
  console.log(`Đã xuất bảng xếp hạng từ ${LB_FILE} ra ${out}`);
  process.exit(0);
}

const { build } = await import('vite');
await build({ root, logLevel: 'warn' });
const { startServer, openBrowser } = await import('./serve.mjs');
const { url } = await startServer({ dir: join(root, 'dist'), port: Number(get('--port', 8080)) });
console.log(`Đảo Đèn Lồng đang chạy ở ${url}  (Ctrl+C để tắt)`);
if (!args.includes('--no-open')) openBrowser(url);
