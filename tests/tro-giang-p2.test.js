// Câu trả lời của trợ giảng Phase 2 (sau tag phase-2), mỗi câu một test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, step, snapshot } from '../src/sim/game.js';

const T = JSON.parse(readFileSync('game.contract.json', 'utf8')).tuning;
const idle = { move: [0, 0], cam_yaw_deg: 0 };

test('Đêm 3 xuất phát ở (0,0,-30)', () => {
  assert.deepEqual(snapshot(createGame({ seed: 1, tuning: T, night: 3 })).player.pos, [0, 0, -30]);
});

test('spawning kéo dài 3 s (180 tick) rồi mới wander', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: { random_motes: false } });
  for (let i = 0; i < 300; i++) step(g, idle);
  assert.equal(g.shades[0].state, 'spawning');
  for (let i = 0; i < 179; i++) step(g, idle);
  assert.equal(g.shades[0].state, 'spawning');
  step(g, idle);
  assert.ok(['wander', 'chase'].includes(g.shades[0].state), g.shades[0].state);
});

test('wander di chuyển ngẫu nhiên nhưng tất định theo seed', () => {
  const run = () => {
    const g = createGame({ seed: 5, tuning: T, scenario: { random_motes: false, random_shades: false, shades: [{ id: 'A', pos: [30, 1, 0], state: 'wander' }] } });
    for (let i = 0; i < 120; i++) step(g, idle);
    return g.shades[0].pos.slice();
  };
  const a = run();
  assert.ok(Math.hypot(a[0] - 30, a[2]) > 1, 'phải di chuyển');
  assert.deepEqual(a, run());
});

test('player.invuln trong snapshot là số giây', () => {
  const g = createGame({ seed: 1, tuning: T, scenario: { player: { invuln_ticks: 90 } } });
  assert.equal(snapshot(g).player.invuln, 1.5);
});
