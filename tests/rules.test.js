// Test luật game trực tiếp trên src/sim (không qua CLI). Mỗi test ứng với một yêu cầu PRD-0 / giả định phase 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, step } from '../src/sim/game.js';

const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));
const T = contract.tuning;
const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
const base = { random_motes: false, random_shades: false, motes: [], shades: [] };
const runSteps = (g, n, inp = idle) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...step(g, inp)); return ev; };

test('contract có đủ trường bắt buộc và đúng 5 đèn', () => {
  for (const k of ['contract_version', 'team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.ok(contract[k], k);
  assert.equal(contract.contract_version, '1.0');
  const need = ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius', 'interact_radius', 'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio', 'pulse_stun_s', 'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius', 'fall_enabled'];
  for (const k of need) assert.ok(k in T, k);
  assert.equal(T.lantern_count_night1, 5);
  assert.equal(createGame({ seed: 1, tuning: T }).lanterns.length, 5);
});

test('di chuyển theo công thức quay cam_yaw_deg = 90: move [0,1] đi về +X', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: base });
  runSteps(g, 60, { ...idle, move: [0, 1], cam_yaw_deg: 90 });
  assert.ok(Math.abs(g.player.pos[0] - T.player_speed) < 1e-6);
  assert.ok(Math.abs(g.player.pos[2]) < 1e-6);
});

test('vector move dài hơn 1 được chuẩn hóa', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: base });
  runSteps(g, 60, { ...idle, move: [1, 1] });
  assert.ok(Math.abs(Math.hypot(g.player.pos[0], g.player.pos[2]) - T.player_speed) < 1e-6);
});

test('không nhặt quá carry_capacity', () => {
  const motes = Array.from({ length: T.carry_capacity + 2 }, () => [0, 0, 0.5]);
  const g = createGame({ seed: 1, tuning: T, scenario: { ...base, motes } });
  runSteps(g, 1);
  assert.equal(g.player.carried, T.carry_capacity);
});

test('nạp đủ lantern_cost thì thắp đèn, thắp hết thì thắng với lý do all_lit', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: id !== 'L1' }));
  lanterns[0].pos = [0, 0, 1];
  const g = createGame({ seed: 1, tuning: T, scenario: { ...base, lanterns, player: { carried: T.lantern_cost } } });
  const ev = runSteps(g, 1, { ...idle, interact: true });
  assert.deepEqual(ev.map((e) => e.name), ['deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(ev[2].data, { result: 'won', reason: 'all_lit' });
  assert.equal(g.state, 'won');
});

test('dựng scenario với lit:true không cộng điểm', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: { ...base, lanterns: [{ id: 'L1', lit: true }] } });
  assert.equal(g.score, 0);
});

test('nút chỉ kích hoạt khi false -> true (giữ nút không nạp lần hai)', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: { ...base, lanterns: [{ id: 'L1', pos: [0, 0, 1] }], player: { carried: 2 } } });
  const ev = runSteps(g, 5, { ...idle, interact: true });
  assert.equal(ev.filter((e) => e.name === 'deposit').length, 1);
});

test('tỏa sáng làm choáng Bóng Mực trong pulse_radius và đẩy ra pulse_push_m', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: { ...base, player: { carried: 1 }, shades: [{ id: 'A', pos: [3, 1, 0] }, { id: 'B', pos: [20, 1, 0] }] } });
  const ev = step(g, { ...idle, pulse: true });
  assert.deepEqual(ev.find((e) => e.name === 'pulse').data, { stunned_ids: ['A'] });
  assert.equal(g.shades[0].state, 'stunned');
  assert.ok(Math.abs(g.shades[0].pos[0] - (3 + T.pulse_push_m)) < 1e-6);
  assert.equal(g.player.carried, 1 - T.pulse_cost);
});

test('Bóng Mực không vào safe_radius của đèn đã thắp', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: { ...base, player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true }], shades: [{ id: 'A', pos: [0, 1, 10] }] } });
  runSteps(g, 600);
  const d = Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 20);
  assert.ok(d >= T.safe_radius - 1e-6, `d=${d}`);
  assert.equal(g.player.flames, T.flames);
});

test('bị chạm: mất 1 lửa, rơi floor(carried*ratio), có invuln_s', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: { ...base, player: { carried: 4 }, shades: [{ id: 'A', pos: [0.5, 1, 0] }] } });
  const ev = runSteps(g, Math.round(T.invuln_s * 60) - 1);
  const hits = ev.filter((e) => e.name === 'player_hit');
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) });
});

test('hết lửa thì thua no_flames', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: { ...base, player: { flames: 1 }, shades: [{ pos: [0, 1, 0] }] } });
  const ev = runSteps(g, 1);
  assert.deepEqual(ev.at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('hết giờ thì thua dawn; time_left_s theo scenario', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: { ...base, time_left_s: 1 } });
  const ev = runSteps(g, 100);
  assert.equal(g.steps, 60);
  assert.deepEqual(ev.at(-1).data, { result: 'lost', reason: 'dawn' });
});

test('random_shades mặc định: Bóng Mực mới sinh theo thời gian và phát shade_spawned', () => {
  // shades: [] thay danh sách ban đầu, random_shades vẫn bật nên con đầu tiên sinh ở giây 30.
  const g = createGame({ seed: 3, tuning: T, scenario: { random_motes: false, shades: [] } });
  const ev = runSteps(g, 30 * 60);
  assert.deepEqual(ev.filter((e) => e.name === 'shade_spawned').map((e) => [e.tick, e.data.id]), [[1800, 'S1']]);
});
