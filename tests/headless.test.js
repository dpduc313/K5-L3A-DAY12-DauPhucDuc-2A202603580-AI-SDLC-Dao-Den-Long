import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
const w = (name, obj) => { const p = join(dir, name); writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj)); return p; };
const runH = (args) => spawnSync(process.execPath, ['src/headless.js', ...args], { encoding: 'utf8' });
const lines = (p) => readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const sc = w('sc.json', { random_motes: false, random_shades: false, motes: [[0, 0, 5]], shades: [], lanterns: [{ id: 'L1', pos: [0, 0, 8] }] });

test('tat dinh: cung seed cho output giong het', () => {
  const a = join(dir, 'a.jsonl'), b = join(dir, 'b.jsonl');
  runH(['--seed', '42', '--night', '1', '--ticks', '3000', '--out', a]);
  runH(['--seed', '42', '--night', '1', '--ticks', '3000', '--out', b]);
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
});

test('file inputs sai dinh dang thi exit 2', () => {
  const r = runH(['--seed', '1', '--night', '1', '--inputs', w('bad.json', '{bad'), '--ticks', '5', '--out', join(dir, 'x.jsonl')]);
  assert.equal(r.status, 2);
  const r2 = runH(['--seed', '1', '--night', '1', '--inputs', w('dec.json', { frames: [{ tick: 5 }, { tick: 5 }] }), '--ticks', '5', '--out', join(dir, 'x.jsonl')]);
  assert.equal(r2.status, 2);
});

test('nhat dom dom, nap va thap den, dong end cuoi cung', () => {
  const inp = w('in.json', { frames: [{ tick: 0, move: [0, 1] }, { tick: 70, move: [0, 0], interact: true }] });
  const out = join(dir, 'o.jsonl');
  const r = runH(['--seed', '1', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '100', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const L = lines(out);
  assert.equal(L[0].type, 'snapshot');
  assert.equal(L[0].tick, 0);
  assert.equal(L.at(-1).type, 'end');
  const picked = L.find((l) => l.name === 'mote_picked');
  assert.deepEqual(picked.data, { carried: 1 });
  const dep = L.find((l) => l.name === 'deposit');
  assert.deepEqual(dep.data, { lantern_id: 'L1', amount: 1, deposited: 1 });
  assert.equal(dep.tick, 71);
});

test('so snapshot va --ticks N chay dung N buoc', () => {
  const out = join(dir, 's.jsonl');
  runH(['--seed', '1', '--night', '1', '--scenario', sc, '--ticks', '50', '--out', out]);
  const L = lines(out);
  assert.deepEqual(L.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 10, 20, 30, 40, 50]);
  assert.equal(L.at(-1).ticks, 50);
  assert.equal(L.at(-1).state, 'playing');
});
