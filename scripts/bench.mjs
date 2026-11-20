#!/usr/bin/env node
// Benchmark (Ticket-04 §1): node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// 1) build bản web; 2) mở máy chủ cục bộ; 3) mở Chrome/Edge (hồ sơ tạm, không đụng trình duyệt của bạn) cửa sổ 1280×720,
//    tắt vsync bằng --disable-gpu-vsync --disable-frame-rate-limit; 4) trang ?bench chạy cảnh chuẩn và gửi thời gian từng khung;
// 5) tính số liệu, ghi file, đóng trình duyệt, thoát mã 0.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const seed = Number(get('--seed', 42));
const duration = Number(get('--duration', 30));
const out = get('--out', 'bench.json');
if (!Number.isInteger(seed) || !(duration > 0)) { console.error('loi: --seed phai la so nguyen, --duration > 0'); process.exit(1); }

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const cands = {
    win32: [`${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, `${local}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  }[process.platform] ?? [];
  for (const c of cands) if (existsSync(c)) return c;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch { /* thử tên tiếp */ }
  }
  return null;
}

export function stats(dts) {
  const N = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k);
  const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)];
  const r1 = (x) => Math.round(x * 10) / 10;
  return { avg_fps: r1((1000 * N) / sum), p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)), frame_ms_p95: r1(p95), frames: N };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const browser = findBrowser();
  if (!browser) { console.error('loi: khong tim thay Chrome/Chromium/Edge. Dat bien CHROME_PATH tro toi trinh duyet.'); process.exit(1); }
  console.log('Build bản web…');
  const { build } = await import('vite');
  await build({ root, logLevel: 'warn' });

  let chrome; let profile;
  const done = (code) => {
    try { chrome?.kill(); } catch { /* đã tắt */ }
    setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome còn giữ file */ } process.exit(code); }, 800);
  };
  let spawnAt = 0;
  const { url } = await startServer({
    onBench: (r) => {
      const s = stats(r.dts);
      const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
      const result = {
        contract_version: contract.contract_version,
        ...s,
        load_ms: Math.round(r.first_frame_epoch_ms - spawnAt),
        peak_mem_mb: null,
        vsync_off: true,
        renderer: `Three.js r${r.three} WebGLRenderer (WebGL2) trên ${r.gpu}; ${r.browser}; canvas ${r.canvas}`,
        os: `${os.type()} ${os.release()} ${os.arch()}; CPU ${os.cpus()[0]?.model?.trim()} (${os.cpus().length} luồng); RAM ${Math.round(os.totalmem() / 2 ** 30)} GB`,
      };
      writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify(result, null, 2));
      done(0);
    },
  });
  profile = mkdtempSync(join(os.tmpdir(), 'ddl-bench-'));
  const page = `${url}?bench=1&seed=${seed}&duration=${duration}`;
  spawnAt = Date.now();
  chrome = spawn(browser, [
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    // Cửa sổ đúng 1280×720 điểm ảnh thật, kể cả khi Windows/macOS đặt tỉ lệ hiển thị 125–200%.
    '--window-size=1280,720', '--window-position=20,20', '--force-device-scale-factor=1', `--app=${page}`,
    '--disable-gpu-vsync', '--disable-frame-rate-limit',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required',
  ], { stdio: 'ignore' });
  chrome.on('error', (e) => { console.error(`loi: khong mo duoc trinh duyet: ${e.message}`); done(1); });
  console.log(`Đang đo ${duration} s (khởi động 3 s) bằng ${browser}…`);
  setTimeout(() => { console.error('loi: qua thoi gian cho ket qua bench'); done(1); }, (duration + 90) * 1000);
}
