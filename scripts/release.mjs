#!/usr/bin/env node
// Đóng gói bản phát hành web: release/dao-den-long-v<version>-web/ gồm dist/ + máy chủ tĩnh không phụ thuộc thư viện.
// Sau đó nén thư mục đó thành .zip và đính kèm vào GitHub Release (xem README).
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const out = join(root, 'release', `dao-den-long-v${version}-web`);

const { build } = await import('vite');
await build({ root, logLevel: 'warn' });

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'scripts'), { recursive: true });
mkdirSync(join(out, 'src'), { recursive: true });
cpSync(join(root, 'dist'), join(out, 'dist'), { recursive: true });
cpSync(join(root, 'scripts', 'serve.mjs'), join(out, 'scripts', 'serve.mjs'));
for (const f of ['lbstore.js', 'leaderboard.js']) cpSync(join(root, 'src', f), join(out, 'src', f));
for (const f of ['LICENSE', 'CREDITS.md']) cpSync(join(root, f), join(out, f));
writeFileSync(join(out, 'package.json'), JSON.stringify({ name: 'dao-den-long', version, private: true, type: 'module', engines: { node: '>=20' } }, null, 2) + '\n');
writeFileSync(join(out, 'README.txt'), [
  `Đảo Đèn Lồng v${version} — bản web`,
  '',
  'Cần Node.js >= 20 (không cần npm install).',
  '  node scripts/serve.mjs            mở game ở http://127.0.0.1:8080/',
  '  node scripts/serve.mjs --port 9000 --no-open',
  '',
  'Bảng xếp hạng lưu ở leaderboard.json trong thư mục này.',
  'Mã nguồn, test, headless, bench, soak: https://github.com/dpduc313/K5-L3A-DAY12-DauPhucDuc-2A202603580-AI-SDLC-Dao-Den-Long',
  '',
].join('\n'));
console.log(`Đã tạo ${out}`);
