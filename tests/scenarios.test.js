// Scenario headless qua đúng lệnh trong game.contract.json: mỗi tính năng Ticket-02 có ít nhất 1 scenario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ddl-sc-'));
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
const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

test('night_start và các trường snapshot v1.1', () => {
  const { L, ev } = run({ night: 2, ticks: 10 });
  assert.deepEqual(ev('night_start')[0], { type: 'event', tick: 0, name: 'night_start', data: { night: 2 } });
  const s = L[0];
  for (const k of ['night', 'wind', 'motes', 'drifters', 'charms']) assert.ok(k in s, k);
  for (const k of ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, k);
  assert.equal(s.lanterns.length, 6);
});

test('Lướt: 14 m/s trong 0.2 s, phát event dash', () => {
  const { ev, snap } = run({ ticks: 12, every: 12, frames: [{ tick: 0, move: [0, 1], dash: true }] });
  assert.equal(ev('dash')[0].tick, 1);
  assert.ok(near(snap(12).player.pos[2], 2.8), String(snap(12).player.pos[2]));
});

test('Tạm dừng: tick tăng, sim_tick đứng, state paused', () => {
  const { ev, snap } = run({ ticks: 30, frames: [{ tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 20, pause: true }] });
  assert.equal(ev('paused')[0].tick, 11);
  assert.equal(ev('resumed')[0].tick, 21);
  assert.equal(snap(20).state, 'paused');
  assert.equal(snap(20).sim_tick, 10);
  assert.equal(snap(30).sim_tick, 20); // 10 bước trước pause + 10 bước sau resume (tick 21..30)
});

test('Rơi khỏi đảo: -1 lửa, mất hết đom đóm, hồi sinh ở điểm xuất phát với bất tử', () => {
  const { ev, snap } = run({ ticks: 200, every: 200, scenario: { ...off, player: { pos: [39.5, 0, 0], carried: 4 } }, frames: [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }] });
  assert.deepEqual(ev('player_hit')[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  assert.deepEqual(snap(200).player.pos, [0, 0, 0]);
  assert.ok(snap(200).player.invuln > 0 && snap(200).player.invuln <= 1.5); // trợ giảng P2: invuln là số giây
  assert.equal(snap(200).player.carried, 0);
});

test('Bục nhảy Đêm 2: bay sang đảo B và đáp đất', () => {
  const { snap } = run({ night: 2, ticks: 150, every: 150, scenario: { ...off, player: { pos: [20, 0, 18] } } });
  const p = snap(150).player;
  assert.equal(p.grounded, true);
  assert.ok(Math.hypot(p.pos[0] - 70, p.pos[2]) <= 28, JSON.stringify(p.pos));
});

test('Bùa Gió: nhặt C1, tốc độ 7.2 m/s, hồi xuất hiện 45 s', () => {
  const { ev, snap } = run({ night: 2, ticks: 60, every: 60, scenario: { ...off, player: { pos: [35, 0, 0] } }, frames: [{ tick: 0, move: [1, 0] }] });
  assert.deepEqual(ev('charm_picked')[0].data, { charm_id: 'C1', charm_ticks: 600 });
  assert.ok(near(snap(60).player.pos[0], 35 + 0.1 + 59 * 0.12), String(snap(60).player.pos[0]));
  assert.equal(snap(60).charms[0].available, false);
});

test('Bùa Gió + lướt liên tục trên biển: chỉ lướt 1 lần trên không, vẫn rơi', () => {
  // Lỗi cũ: Bùa Gió bỏ hồi chiêu, lướt trên không giữ độ cao, nên lướt nối tiếp làm Mây bay lơ lửng mãi trên biển.
  const frames = [];
  for (let t = 0; t < 300; t += 2) frames.push({ tick: t, move: [1, 0], dash: true }, { tick: t + 1, move: [1, 0], dash: false });
  const { L, ev } = run({ ticks: 300, every: 1, scenario: { ...off, player: { pos: [39.5, 0, 0], charm_ticks: 600 } }, frames });
  const fall = ev('player_hit').find((e) => e.data.by === 'fall');
  assert.ok(fall, 'phải rơi khỏi đảo');
  const airDashes = ev('dash').filter((e) => { const s = L.find((l) => l.type === 'snapshot' && l.tick === e.tick - 1); return s && !s.player.grounded; });
  assert.ok(airDashes.length <= 1, `lướt trên không ${airDashes.length} lần`);
});

test('Gió Lạc: đuổi khi mang >= 5, cướp 3; Tỏa Sáng lúc flee làm thả lại', () => {
  const { ev } = run({ night: 2, ticks: 40, scenario: { ...off, player: { carried: 6 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0] }] }, frames: [{ tick: 30, pulse: true }] });
  assert.deepEqual(ev('drifter_steal')[0].data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.deepEqual(ev('drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
});

test('Gió mạnh Đêm 3: bật ở sim_tick 1800', () => {
  const { snap } = run({ night: 3, ticks: 1810, every: 1800, scenario: off });
  assert.equal(snap(1800).wind.active, true);
  assert.ok(Number.isInteger(snap(1800).wind.dir_deg));
});

test('Vùng an toàn: đèn vừa thắp đẩy Bóng Mực ra 6 m trong 30 tick, không gây hit', () => {
  const { ev, snap } = run({ ticks: 120, every: 30, scenario: { ...off, player: { pos: [0, 0, 24], carried: 1 }, lanterns: [{ id: 'L1', deposited: 9 }], shades: [{ id: 'A', pos: [0, 1, 24.5], state: 'chase' }] }, frames: [{ tick: 0, interact: true }] });
  assert.equal(ev('lantern_lit').length, 1);
  assert.equal(ev('player_hit').length, 0);
  const s = snap(30).shades[0];
  assert.ok(Math.hypot(s.pos[0], s.pos[2] - 25) >= 6 - 1e-3, JSON.stringify(s.pos));
});

test('Bóng Mực gây hit thì chuyển recoil và lùi 2 m trong 60 tick', () => {
  const { ev, snap } = run({ ticks: 61, every: 1, scenario: { ...off, player: { carried: 4 }, shades: [{ id: 'A', pos: [0.5, 1, 0] }] } });
  assert.deepEqual(ev('player_hit')[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.equal(snap(10).shades[0].state, 'recoil');
  // Bóng tiến 0.067 m ở bước 0 rồi mới hit; sau 60 tick recoil cách vị trí hit đúng 2 m.
  assert.ok(near(snap(61).shades[0].pos[0] - snap(1).shades[0].pos[0], 2, 0.002));
  assert.equal(snap(61).shades[0].state, 'wander');
});

// Đã xóa test "Điểm chuẩn Ticket-02" (+10/đom đóm, thưởng thời gian, thắng all_lit):
// Ticket-03 [THAY THẾ] toàn bộ công thức điểm và luật thắng. Test thay thế: tests/phase3.test.js.

test('Đom đóm: 20 lúc đầu, thêm 1 ở tick 240', () => {
  const { snap } = run({ ticks: 240, every: 240, scenario: {} , frames: [] });
  assert.equal(snap(0).motes_active, 20);
  assert.equal(snap(240).motes_active, 21);
});
