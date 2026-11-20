#!/usr/bin/env node
// Soak test (Ticket-04 §2): chạy headless nhiều Đêm liên tiếp trong cùng một tiến trình, đo RSS.
// Lệnh: node --expose-gc src/soak.js --seed 7 --nights 10 --out soak.json
// Đêm thứ i (i = 0, 1, …) dùng seed + i, Đêm (i mod 3) + 1. Không bật tính năng sáng tạo.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, step, mulberry32, TICK_HZ } from './sim/game.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8')).tuning;

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) { process.stderr.write(`loi: tham so khong hop le: ${argv[i]}\n`); process.exit(1); }
    a[argv[i].slice(2)] = argv[i + 1];
  }
  return a;
}

const rssMb = () => { globalThis.gc?.(); return Math.round((process.memoryUsage().rss / 2 ** 20) * 10) / 10; };

// Input ngẫu nhiên theo seed: mỗi 30 tick chọn lại hướng; mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
export function randomInputs(seed) {
  const rnd = mulberry32((seed ^ 0xa5a5a5a5) >>> 0);
  let move = [0, 0];
  let t = 0;
  return () => {
    if (t % 30 === 0) { const a = rnd() * Math.PI * 2; move = [Math.cos(a), Math.sin(a)]; }
    t++;
    return { move, cam_yaw_deg: 0, jump: rnd() < 0.05, dash: rnd() < 0.03, pulse: rnd() < 0.02, interact: rnd() < 0.1, pause: false };
  };
}

export function runNight(seed, night) {
  const g = createGame({ seed, tuning: T, night });
  const next = randomInputs(seed);
  const maxTicks = Math.ceil(g.duration * TICK_HZ) + 1;
  for (let k = 0; k < maxTicks && (g.state === 'playing' || g.state === 'paused'); k++) step(g, next());
  return g.state === 'won' || g.state === 'lost' ? g.state : 'timeout';
}

export function soak({ seed, nights }) {
  const t0 = process.hrtime.bigint();
  const results = [];
  let crashes = 0;
  let memStart = null;
  for (let i = 0; i < nights; i++) {
    const night = (i % 3) + 1;
    try {
      if (i === 0) { const g = createGame({ seed: seed + i, tuning: T, night }); memStart = rssMb(); void g; }
      results.push(runNight(seed + i, night));
    } catch (e) {
      crashes++;
      results.push('crash');
      process.stderr.write(`Dem ${i + 1} loi: ${e.stack}\n`);
    }
  }
  const memEnd = rssMb();
  const duration = Number(process.hrtime.bigint() - t0) / 1e9;
  return { nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: Math.round(duration * 10) / 10 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = parseArgs(process.argv.slice(2));
  const seed = Number(a.seed ?? 7); const nights = Number(a.nights ?? 10);
  if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) { process.stderr.write('loi: --seed va --nights phai la so nguyen\n'); process.exit(1); }
  const out = soak({ seed, nights });
  writeFileSync(a.out ?? 'soak.json', JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(out.crashes === 0 ? 0 : 1);
}
