// Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3): cảnh benchmark, soak, bảng xếp hạng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, step, snapshot } from '../src/sim/game.js';
import { soak } from '../src/soak.js';
import { addEntry, sortEntries, validName } from '../src/leaderboard.js';

const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));
const T = contract.tuning;
const idle = { move: [0, 0], cam_yaw_deg: 0 };

test('contract v1.3 có bench_cmd và soak_cmd, giữ các khóa cũ', () => {
  assert.equal(contract.contract_version, '1.3');
  for (const k of ['build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd']) assert.equal(typeof contract[k], 'string', k);
});

test('cảnh bench: Đêm 1, đúng 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng fuel 100, Mây ở (0,0,0)', () => {
  const g = createGame({ seed: 42, tuning: T, night: 1, bench: true });
  const s = snapshot(g);
  assert.equal(s.shades.length, 200);
  assert.ok(s.shades.every((x) => x.state === 'wander'));
  assert.ok(s.shades.every((x) => Math.hypot(x.pos[0], x.pos[2]) <= 40), 'rải trên đảo');
  assert.equal(s.motes.length, 100);
  for (const id of ['L1', 'L2', 'L3']) { const l = s.lanterns.find((x) => x.id === id); assert.deepEqual([l.lit, l.fuel], [true, 100]); }
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal('creative' in s, false);
});

test('cảnh bench tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm; bóng vẫn di chuyển', () => {
  const g = createGame({ seed: 42, tuning: T, night: 1, bench: true });
  const before = g.shades.map((x) => [...x.pos]);
  const names = new Set();
  for (let i = 0; i < 60 * 300; i++) for (const e of step(g, idle)) names.add(e.name);
  assert.equal(g.state, 'playing');
  assert.equal(g.shades.length, 200);
  assert.equal(g.motes.length, 100);
  assert.equal(g.player.flames, T.flames);
  assert.equal(g.lanterns.filter((l) => l.lit).length, 3);
  assert.ok(g.lanterns.filter((l) => l.lit).every((l) => l.fuel === 100 * 60));
  for (const n of ['shade_spawned', 'player_hit', 'mote_picked', 'lantern_out', 'game_over', 'fuel_drain']) assert.equal(names.has(n), false, n);
  assert.ok(g.shades.some((x, i) => Math.hypot(x.pos[0] - before[i][0], x.pos[2] - before[i][2]) > 1), 'bóng có di chuyển');
});

test('cảnh bench tất định theo seed', () => {
  const a = createGame({ seed: 42, tuning: T, night: 1, bench: true });
  const b = createGame({ seed: 42, tuning: T, night: 1, bench: true });
  for (let i = 0; i < 600; i++) { step(a, idle); step(b, idle); }
  assert.deepEqual(snapshot(a), snapshot(b));
});

test('soak 3 Đêm: không crash, đủ kết quả, có số đo bộ nhớ', () => {
  const r = soak({ seed: 7, nights: 3 });
  assert.equal(r.nights, 3);
  assert.equal(r.crashes, 0);
  assert.equal(r.results.length, 3);
  assert.ok(r.results.every((x) => x === 'won' || x === 'lost'));
  assert.ok(r.mem_start_mb > 0 && r.mem_end_mb > 0 && r.duration_s >= 0);
});

test('bảng xếp hạng: tên 3–12 ký tự [A-Za-z0-9_] (cho phép chữ tiếng Việt)', () => {
  for (const n of ['Duc', 'dau_phuc_duc', 'Đức_99', 'Mây']) assert.equal(validName(n), true, n);
  for (const n of ['ab', 'a'.repeat(13), 'có cách', 'x-y', '']) assert.equal(validName(n), false, n);
});

test('bảng xếp hạng: điểm giảm dần, bằng điểm thì ai đạt trước đứng trên, giữ top 10', () => {
  let list = [];
  const at = (m) => `2026-11-20T10:${String(m).padStart(2, '0')}:00+07:00`;
  for (let i = 0; i < 12; i++) list = addEntry(list, { name: `P${i}xx`, score: i * 10, nights_won: 1, achieved_at: at(i), seed: i });
  list = addEntry(list, { name: 'Late', score: 110, nights_won: 3, achieved_at: at(30), seed: 99 });
  list = addEntry(list, { name: 'Early', score: 110, nights_won: 3, achieved_at: at(0), seed: 98 });
  assert.equal(list.length, 10);
  assert.deepEqual(list.slice(0, 3).map((e) => e.name), ['Early', 'P11xx', 'Late']);
  assert.deepEqual(list.map((e) => e.score), [...list.map((e) => e.score)].sort((a, b) => b - a));
  assert.deepEqual(sortEntries([...list].reverse()), list);
});
