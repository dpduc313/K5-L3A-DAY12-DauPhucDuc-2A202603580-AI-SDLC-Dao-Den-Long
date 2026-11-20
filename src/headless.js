#!/usr/bin/env node
// Chế độ headless theo Test Contract v1.0.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, step, snapshot } from './sim/game.js';

class FormatError extends Error {}

function fail(msg, code) {
  process.stderr.write(`loi: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) fail(`tham so khong hop le: ${k}`, 1);
    const v = argv[i + 1];
    if (v === undefined) fail(`thieu gia tri cho ${k}`, 1);
    a[k.slice(2)] = v;
    i++;
  }
  return a;
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);

function readJson(path, what) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch (e) { fail(`khong doc duoc ${what}: ${path}`, 1); }
  try { return JSON.parse(text); } catch (e) { throw new FormatError(`${what} khong phai JSON hop le`); }
}

export function validateInputs(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.frames)) throw new FormatError('inputs: thieu mang frames');
  let last = -1;
  for (const f of obj.frames) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) throw new FormatError('inputs: frame phai la object');
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new FormatError('inputs: tick phai la so nguyen >= 0');
    if (f.tick <= last) throw new FormatError('inputs: tick phai tang nghiem ngat');
    last = f.tick;
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every((x) => isNum(x) && x >= -1 && x <= 1))
        throw new FormatError('inputs: move phai la [x, z] trong [-1, 1]');
    }
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) throw new FormatError('inputs: cam_yaw_deg phai la so');
    for (const b of ['jump', 'interact', 'pulse', 'dash'])
      if (f[b] !== undefined && typeof f[b] !== 'boolean') throw new FormatError(`inputs: ${b} phai la boolean`);
  }
  return obj.frames;
}

export function validateScenario(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new FormatError('scenario phai la object');
  if (s.player !== undefined) {
    const p = s.player;
    if (!p || typeof p !== 'object') throw new FormatError('scenario.player phai la object');
    if (p.pos !== undefined && !isVec3(p.pos)) throw new FormatError('scenario.player.pos phai la [x,y,z]');
    if (p.carried !== undefined && !(Number.isInteger(p.carried) && p.carried >= 0)) throw new FormatError('scenario.player.carried');
    if (p.flames !== undefined && !(Number.isInteger(p.flames) && p.flames >= 0)) throw new FormatError('scenario.player.flames');
  }
  for (const k of ['random_motes', 'random_shades'])
    if (s[k] !== undefined && typeof s[k] !== 'boolean') throw new FormatError(`scenario.${k} phai la boolean`);
  if (s.motes !== undefined && !(Array.isArray(s.motes) && s.motes.every(isVec3))) throw new FormatError('scenario.motes phai la mang [x,y,z]');
  if (s.shades !== undefined) {
    if (!Array.isArray(s.shades) || !s.shades.every((x) => x && isVec3(x.pos) && (x.id === undefined || typeof x.id === 'string')))
      throw new FormatError('scenario.shades phai la mang {pos, id?}');
  }
  if (s.lanterns !== undefined) {
    if (!Array.isArray(s.lanterns)) throw new FormatError('scenario.lanterns phai la mang');
    for (const l of s.lanterns) {
      if (!l || typeof l.id !== 'string') throw new FormatError('scenario.lanterns[].id');
      if (l.pos !== undefined && !isVec3(l.pos)) throw new FormatError('scenario.lanterns[].pos');
      if (l.lit !== undefined && typeof l.lit !== 'boolean') throw new FormatError('scenario.lanterns[].lit');
      if (l.deposited !== undefined && !(Number.isInteger(l.deposited) && l.deposited >= 0)) throw new FormatError('scenario.lanterns[].deposited');
    }
  }
  if (s.time_left_s !== undefined && !(isNum(s.time_left_s) && s.time_left_s > 0)) throw new FormatError('scenario.time_left_s phai > 0');
  return s;
}

export function run({ seed, scenario, frames, ticks, every, tuning }) {
  const g = createGame({ seed, tuning, scenario });
  const lines = [snapshot(g)];
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  let fi = 0;
  for (let k = 0; k < ticks; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      Object.assign(input, frames[fi]);
      fi++;
    }
    const evs = step(g, { ...input, move: [...input.move] });
    lines.push(...evs);
    if (g.state !== 'playing') break;
    if (g.steps % every === 0) lines.push(snapshot(g));
  }
  lines.push({ type: 'end', ticks: g.steps, state: g.state, score: g.score });
  return lines;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  for (const req of ['seed', 'night', 'ticks', 'out']) if (a[req] === undefined) fail(`thieu --${req}`, 1);
  const seed = Number(a.seed);
  const ticks = Number(a.ticks);
  const every = a['snapshot-every'] === undefined ? 10 : Number(a['snapshot-every']);
  if (!Number.isInteger(seed)) fail('--seed phai la so nguyen', 1);
  if (a.night !== '1') fail('chi ho tro --night 1', 1);
  if (!Number.isInteger(ticks) || ticks < 0) fail('--ticks phai la so nguyen >= 0', 1);
  if (!Number.isInteger(every) || every < 1) fail('--snapshot-every phai la so nguyen >= 1', 1);

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const tuning = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8')).tuning;

  let scenario = {};
  let frames = [];
  try {
    if (a.scenario) scenario = validateScenario(readJson(a.scenario, 'scenario'));
    if (a.inputs) frames = validateInputs(readJson(a.inputs, 'inputs'));
  } catch (e) {
    if (e instanceof FormatError) fail(e.message, 2);
    throw e;
  }

  const lines = run({ seed, scenario, frames, ticks, every, tuning });
  writeFileSync(a.out, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(); } catch (e) { fail(e.stack || String(e), 1); }
}
