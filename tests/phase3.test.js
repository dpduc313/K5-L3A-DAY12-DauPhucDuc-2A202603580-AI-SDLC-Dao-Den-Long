// Ticket-03 "Đèn cạn dầu" (Contract v1.2): mỗi luật mới có ít nhất 1 scenario headless qua CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGame, step } from '../src/sim/game.js';

const T = JSON.parse(readFileSync('game.contract.json', 'utf8')).tuning;

const dir = mkdtempSync(join(tmpdir(), 'ddl-p3-'));
const off = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [] };
let n = 0;
function run({ night = 1, scenario = off, frames = [], ticks, every = 10 }) {
  n++;
  const sc = join(dir, `s${n}.json`); const inp = join(dir, `i${n}.json`); const out = join(dir, `o${n}.jsonl`);
  writeFileSync(sc, JSON.stringify(scenario)); writeFileSync(inp, JSON.stringify({ frames }));
  const r = spawnSync(process.execPath, ['src/headless.js', '--seed', '7', '--night', String(night), '--scenario', sc, '--inputs', inp, '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const L = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  return { L, ev: (name) => L.filter((l) => l.type === 'event' && l.name === name), snap: (t) => L.find((l) => l.type === 'snapshot' && l.tick === t), end: L.at(-1) };
}
const lan = (s, id) => s.lanterns.find((l) => l.id === id);

test('dầu hao 1/s; hết dầu thì tắt, deposited = 0, ever_lit giữ, phát lantern_out', () => {
  const { ev, snap } = run({ ticks: 130, scenario: { ...off, lanterns: [{ id: 'L1', lit: true, fuel: 2 }] } });
  assert.equal(lan(snap(60), 'L1').fuel, 1);
  assert.equal(ev('lantern_out')[0].tick, 120);
  const l = lan(snap(130), 'L1');
  assert.deepEqual([l.lit, l.fuel, l.deposited, l.ever_lit], [false, 0, 0, true]);
});

test('đèn lit:true không có fuel thì mặc định 100; snapshot có fuel, ever_lit, relit_count, capacity', () => {
  const { snap } = run({ ticks: 1, scenario: { ...off, lanterns: [{ id: 'L1', lit: true }] } });
  assert.deepEqual([lan(snap(0), 'L1').fuel, lan(snap(0), 'L1').ever_lit, lan(snap(0), 'L1').relit_count], [100, true, 0]);
  assert.equal(lan(snap(0), 'L2').fuel, 0);
  assert.equal(snap(0).player.capacity, 10);
});

test('châm dầu: used = min(mang, ceil((100-fuel)/10)), +5 điểm mỗi đom đóm, phát refuel', () => {
  const { ev, end } = run({ ticks: 1, scenario: { ...off, player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 55 }] }, frames: [{ tick: 0, interact: true }] });
  // bước 2 trừ 1/60 trước -> fuel 54.983 -> cần ceil(45.017/10) = 5 đom đóm -> fuel = min(100, 54.983 + 50) = 100
  assert.deepEqual(ev('refuel')[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 });
  assert.equal(end.score, 25);
});

test('đèn đầy dầu (used = 0) không được chọn khi tương tác: không sự kiện, không điểm', () => {
  // Qua scenario, fuel 100 luôn bị hao 1/60 ở bước 2 trước khi tương tác, nên dựng trực tiếp trên sim:
  // đặt fuel = 100 + 1/60 để sau bước 2 đèn đúng 100.
  const g = createGame({ seed: 1, tuning: T, scenario: { ...off, player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', lit: true }] } });
  g.lanterns[0].fuel = T.fuel_max * 60 + 1;
  const evs = step(g, { move: [0, 0], cam_yaw_deg: 0, interact: true });
  assert.deepEqual(evs.map((e) => e.name), []);
  assert.equal(g.score, 0);
  assert.equal(g.player.carried, 10);
});

test('thắp lại đèn từng sáng chỉ cần 5, +40 điểm, relight: true, relit_count tăng', () => {
  const { ev, end, snap } = run({ ticks: 1, every: 1, scenario: { ...off, player: { pos: [0, 0, 24], carried: 7 }, lanterns: [{ id: 'L1', lit: false, ever_lit: true }] }, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(ev('deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(ev('lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.equal(end.score, 5 * 5 + 40);
  assert.equal(lan(snap(1), 'L1').relit_count, 1);
  assert.equal(snap(1).player.capacity, 12); // sức chứa = 10 + 2 × successful_lights
});

test('Bóng Mực wander đi tới đèn fuel < 30, hút 5/s ở trạng thái drain, phát fuel_drain mỗi 60 tick', () => {
  const { ev, snap } = run({ ticks: 200, every: 10, scenario: { ...off, player: { pos: [-35, 0, 0] }, lanterns: [{ id: 'L1', lit: true, fuel: 29 }], shades: [{ id: 'A', pos: [0, 1, 22], state: 'wander' }] } });
  const s = snap(60).shades[0]; // cách đèn 3 m, đi 1.5 m/s -> vào trong 2 m sau khoảng 40 tick
  assert.equal(s.state, 'drain');
  assert.equal(s.target_lantern_id, 'L1');
  const fd = ev('fuel_drain');
  assert.ok(fd.length >= 2);
  assert.equal(fd[0].data.shade_id, 'A');
  // mỗi giây: hao 1 + hút 5 = 6
  assert.ok(Math.abs(fd[1].data.fuel - (fd[0].data.fuel - 6)) < 0.11, JSON.stringify(fd.slice(0, 2)));
});

test('đúng 30 vẫn còn vùng an toàn; dưới 30 thì mất', () => {
  const near = { id: 'A', pos: [0, 1, 21], state: 'chase' };
  const keep = run({ ticks: 1, every: 1, scenario: { ...off, player: { pos: [0, 0, 25.5], invuln_ticks: 999 }, lanterns: [{ id: 'L1', lit: true, fuel: 30.1 }], shades: [near] } });
  const d1 = Math.hypot(keep.snap(1).shades[0].pos[0], keep.snap(1).shades[0].pos[2] - 25);
  assert.ok(d1 >= 6 - 1e-3, String(d1));
  const lose = run({ ticks: 1, every: 1, scenario: { ...off, player: { pos: [0, 0, 25.5], invuln_ticks: 999 }, lanterns: [{ id: 'L1', lit: true, fuel: 29 }], shades: [near] } });
  const d2 = Math.hypot(lose.snap(1).shades[0].pos[0], lose.snap(1).shades[0].pos[2] - 25);
  assert.ok(d2 < 6, String(d2));
});

test('Tỏa Sáng trúng Bóng Mực đang drain: +15', () => {
  const { end } = run({ ticks: 1, scenario: { ...off, player: { pos: [0, 0, 20], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'A', pos: [0, 1, 23.5], state: 'drain', target_lantern_id: 'L1' }] }, frames: [{ tick: 0, pulse: true }] });
  assert.equal(end.score, 15);
});

test('bình minh: đủ 3/5 đèn sáng thì thắng dawn_survived, điểm = 50 + floor(fuel) mỗi đèn + 50 mỗi lửa', () => {
  const lanterns = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 50 }));
  const { ev, end } = run({ ticks: 120, scenario: { ...off, lanterns, time_left_s: 1 } });
  assert.deepEqual(ev('game_over')[0].data, { result: 'won', reason: 'dawn_survived' });
  // sau 60 tick mỗi đèn còn 49 -> 3 × (50 + 49) + 3 × 50
  assert.equal(end.score, 3 * 99 + 150);
  assert.equal(end.ticks, 60);
});

test('bình minh mà dưới ngưỡng (2/5) thì thua dawn; thắp hết sớm không kết thúc', () => {
  const lanterns = ['L1', 'L2'].map((id) => ({ id, lit: true }));
  const { ev } = run({ ticks: 120, scenario: { ...off, lanterns, time_left_s: 1 } });
  assert.deepEqual(ev('game_over')[0].data, { result: 'lost', reason: 'dawn' });
  const all = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r2 = run({ ticks: 30, scenario: { ...off, lanterns: all } });
  assert.equal(r2.end.state, 'playing');
});

test('ngưỡng thắng Đêm 2 là 4/6 và Đêm 3 là 5/7', () => {
  const mk = (k, night) => run({ night, ticks: 70, scenario: { ...off, lanterns: Array.from({ length: k }, (_, i) => ({ id: `L${i + 1}`, lit: true })), time_left_s: 1 } }).ev('game_over')[0].data.result;
  assert.equal(mk(3, 2), 'lost'); assert.equal(mk(4, 2), 'won');
  assert.equal(mk(4, 3), 'lost'); assert.equal(mk(5, 3), 'won');
});

test('sức chứa tối đa 20; successful_lights đặt qua scenario', () => {
  const { snap } = run({ ticks: 1, scenario: { ...off, player: { successful_lights: 9 } } });
  assert.equal(snap(0).player.capacity, 20);
});
