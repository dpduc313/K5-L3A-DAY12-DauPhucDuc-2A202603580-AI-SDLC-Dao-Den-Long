// Tính năng sáng tạo: Đom Đóm Chúa và Đuốc. Chỉ bật khi createGame({ creative: true }) (bản web).
// Headless không bật, nên đầu ra headless không đổi (AGENTS.md: tính năng sáng tạo không được đổi đầu ra headless).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, step, snapshot } from '../src/sim/game.js';

const T = JSON.parse(readFileSync('game.contract.json', 'utf8')).tuning;
const off = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [] };
const idle = { move: [0, 0], cam_yaw_deg: 0 };
const run = (g, n) => { const evs = []; for (let i = 0; i < n; i++) evs.push(...step(g, idle)); return evs; };

test('tắt sáng tạo (mặc định): không sinh Chúa/Đuốc, snapshot không có khóa creative, đầu ra giống hệt', () => {
  const a = createGame({ seed: 3, tuning: T, night: 1 });
  const b = createGame({ seed: 3, tuning: T, night: 1, creative: false });
  const ea = run(a, 3600); const eb = run(b, 3600);
  assert.deepEqual(ea, eb);
  assert.equal('creative' in snapshot(a), false);
  assert.equal(ea.some((e) => /king|torch/.test(e.name)), false);
});

test('bật sáng tạo không làm đổi chuỗi ngẫu nhiên của game gốc', () => {
  // Sáng tạo dùng RNG riêng: vị trí đom đóm ban đầu và bóng đầu tiên giống bản tắt.
  const a = createGame({ seed: 5, tuning: T, night: 1 });
  const b = createGame({ seed: 5, tuning: T, night: 1, creative: true });
  assert.deepEqual(a.motes, b.motes);
  run(a, 301); run(b, 301);
  assert.deepEqual(a.shades.map((s) => s.pos), b.shades.map((s) => s.pos));
});

test('Đom Đóm Chúa: sinh lúc 15 s, tối đa 1, tự biến mất sau 20 s', () => {
  const g = createGame({ seed: 1, tuning: T, night: 1, scenario: off, creative: true });
  g.player.pos = [0, 0, -30]; // tránh đứng trùng điểm sinh
  run(g, 899);
  assert.equal(g.creative.kings.length, 0);
  run(g, 1);
  assert.equal(g.creative.kings.length, 1);
  run(g, 1199);
  assert.equal(g.creative.kings.length, 1);
  run(g, 1);
  assert.equal(g.creative.kings.length, 0);
});

test('Đom Đóm Chúa: nhặt được +5 đom đóm và +25 điểm', () => {
  const g = createGame({ seed: 1, tuning: T, night: 1, scenario: off, creative: true });
  g.creative.kings.push({ id: 'K1', pos: [0.5, 0, 0], ttl: 600 });
  const evs = run(g, 1);
  assert.equal(g.player.carried, 5);
  assert.equal(g.score, 25);
  assert.deepEqual(evs.find((e) => e.name === 'king_picked').data, { king_id: 'K1', amount: 5, carried: 5 });
  assert.equal(g.creative.kings.length, 0);
});

test('Đom Đóm Chúa: chỉ lấy tới sức chứa; đầy thì không nhặt', () => {
  const g = createGame({ seed: 1, tuning: T, night: 1, scenario: { ...off, player: { carried: 8 } }, creative: true });
  g.creative.kings.push({ id: 'K1', pos: [0.5, 0, 0], ttl: 600 });
  run(g, 1);
  assert.equal(g.player.carried, 10);
  const h = createGame({ seed: 1, tuning: T, night: 1, scenario: { ...off, player: { carried: 10 } }, creative: true });
  h.creative.kings.push({ id: 'K1', pos: [0.5, 0, 0], ttl: 600 });
  run(h, 1);
  assert.equal(h.creative.kings.length, 1);
  assert.equal(h.score, 0);
});

test('Đuốc: sinh lúc 30 s, tối đa 1 trên đảo', () => {
  const g = createGame({ seed: 1, tuning: T, night: 1, scenario: off, creative: true });
  g.player.pos = [0, 0, -30];
  run(g, 1799);
  assert.equal(g.creative.torches.length, 0);
  run(g, 1);
  assert.equal(g.creative.torches.length, 1);
  run(g, 2700);
  assert.equal(g.creative.torches.length, 1);
});

test('Đuốc: cầm 30 s, tỏa sáng như Q ngay khi nhặt và mỗi 3 s, không tốn đom đóm, không đụng hồi chiêu Q', () => {
  const sc = { ...off, player: { carried: 4 }, shades: [{ id: 'S1', pos: [3, 1, 0], state: 'wander' }] };
  const g = createGame({ seed: 1, tuning: T, night: 1, scenario: sc, creative: true });
  g.creative.torches.push({ id: 'T1', pos: [0.5, 0, 0] });
  const evs = run(g, 1);
  assert.ok(evs.find((e) => e.name === 'torch_picked'));
  assert.deepEqual(evs.find((e) => e.name === 'torch_pulse').data, { stunned_ids: ['S1'] });
  assert.equal(g.shades[0].state, 'stunned');
  assert.equal(g.player.carried, 4);
  assert.equal(g.player.pulseCd, 0);
  assert.equal(g.score, T.score.per_stun);
  assert.equal(g.player.torch, 1799); // cầm đúng 1800 tick, tính cả tick nhặt
  const later = run(g, 1799);
  assert.equal(later.filter((e) => e.name === 'torch_pulse').length, 9); // tick 181, 361, …, 1621
  assert.ok(later.find((e) => e.name === 'torch_out'));
  assert.equal(g.player.torch, 0);
  assert.equal(snapshot(g).creative.torch_s, 0);
});
