// Logic thuần của Đảo Đèn Lồng theo Ticket-02 / Test Contract v1.1.
// Không dùng Math.random, Date, DOM. Dùng chung cho headless (Node) và bản web.
import { MAPS } from './maps.js';

export const TICK_HZ = 60;
const DT = 1 / TICK_HZ;
const sec = (s) => Math.round(s * TICK_HZ);

// Hằng số chuẩn Ticket-02 không có khóa riêng trong tuning.
const JUMP_VY = 7.0;
const GRAVITY = 20;
const STEP_UP = 0.35;
const FALL_Y = -10;
const FALL_WAIT = 60;
const START_MOTES = 20;
const MOTE_CAP = 30;
const MOTE_SPAWN_EVERY = 240;
const DROP_TTL = 480;
const PICK_DY = 1.5;
const HIT_DY = 1.5;
const PULSE_CENTER_DY = 0.8;
const PULSE_PUSH_TICKS = 15;
const RECOIL_M = 2;
const RECOIL_TICKS = 60;
const SAFE_EXPEL_TICKS = 30;
const DETECT_M = 12;
const LOSE_M = 18;
const SHADE_FIRST_TICK = 300;
const SHADE_MIN_DIST = 15;
const SHADE_Y = 1.0;
const CHARM_TICKS = 600;
const CHARM_RESPAWN = 2700;
const CHARM_SPEED = 7.2;
const DRIFTER_EVERY = 1200;
const DRIFTER_MAX = 2;
const DRIFTER_SPEED = 7;
const DRIFTER_IDLE_SPEED = 2;
const DRIFTER_CHASE_CARRY = 5;
const DRIFTER_DETECT = 15;
const DRIFTER_STEAL_R = 1.2;
const DRIFTER_STEAL_MAX = 3;
const DRIFTER_FLEE_TICKS = 240;
const DRIFTER_DROP_GONE = 120;
const DRIFTER_Y = 1.5;
const WIND_EVERY = 1800;
const WIND_TICKS = 300;
const WIND_SPEED = 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idNum = (id) => { const m = /(\d+)$/.exec(id); return m ? Number(m[1]) : Infinity; };
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function createGame({ seed, tuning, scenario = {}, night = 1 }) {
  const T = tuning;
  const map = MAPS[night];
  const rng = mulberry32(seed);
  const durS = scenario.time_left_s ?? T[`night${night}_duration_s`] ?? map.duration;
  const g = {
    T, map, night, rng,
    tick: 0,
    simTick: 0,
    duration: durS,
    state: 'playing',
    paused: false,
    score: 0,
    player: {
      pos: [...map.start], vel: [0, 0, 0], grounded: true, facing: [0, 1],
      flames: T.flames, carried: 0,
      invuln: 0, dashCd: 0, pulseCd: 0, charm: 0,
      dash: 0, dashDir: [0, 0], launch: null, fallWait: 0, fallen: false,
    },
    lanterns: map.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0 })),
    motes: [], shades: [], drifters: [], charms: [],
    nextMote: 1, nextShade: 1, nextDrifter: 1,
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    randomDrifters: (scenario.random_drifters ?? true) && map.drifters,
    windEnabled: (scenario.wind_enabled ?? true) && map.wind,
    wind: { active: false, dir: 0, left: 0 },
    prevInput: { jump: false, interact: false, pulse: false, dash: false, pause: false },
  };
  const p = g.player;

  if (scenario.player) {
    const s = scenario.player;
    if (s.pos) p.pos = [...s.pos];
    if (s.carried !== undefined) p.carried = s.carried;
    if (s.flames !== undefined) p.flames = s.flames;
    if (s.invuln_ticks !== undefined) p.invuln = s.invuln_ticks;
    if (s.dash_cd_ticks !== undefined) p.dashCd = s.dash_cd_ticks;
    if (s.pulse_cd_ticks !== undefined) p.pulseCd = s.pulse_cd_ticks;
    if (s.charm_ticks !== undefined) p.charm = s.charm_ticks;
    const gy = groundAt(g, p.pos[0], p.pos[2]);
    p.grounded = gy !== null && Math.abs(p.pos[1] - gy) < 1e-6;
  }

  if (scenario.lanterns) {
    for (const u of scenario.lanterns) {
      const l = g.lanterns.find((x) => x.id === u.id);
      if (!l) continue;
      if (u.pos) l.pos = [...u.pos];
      if (u.deposited !== undefined) l.deposited = u.deposited;
      if (u.lit !== undefined) l.lit = u.lit;
    }
  }

  if (scenario.motes) {
    for (const m of scenario.motes) addMote(g, [m[0], m[1] ?? 0, m[2]], 'random', null, null);
  } else if (g.randomMotes) {
    const pts = map.motePoints.map((_, i) => i);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    for (const i of pts.slice(0, START_MOTES)) addPointMote(g, i);
  }

  if (scenario.shades) {
    g.reservedShadeIds = new Set(scenario.shades.filter((s) => s.id).map((s) => s.id));
    for (const s of scenario.shades) {
      const id = s.id ?? newShadeId(g);
      g.shades.push({
        id, pos: [s.pos[0], s.pos[1] ?? SHADE_Y, s.pos[2]],
        state: s.state ?? 'wander', left: s.state_ticks_left ?? 0,
        push: null, expel: null,
      });
    }
  }

  if (scenario.drifters) {
    for (const d of scenario.drifters) {
      const id = d.id ?? `D${g.nextDrifter++}`;
      g.drifters.push({ id, pos: [d.pos[0], d.pos[1] ?? DRIFTER_Y, d.pos[2]], state: d.state ?? 'idle', stolen: d.stolen ?? 0, used: (d.stolen ?? 0) > 0, left: d.state_ticks_left ?? (d.state === 'flee' ? DRIFTER_FLEE_TICKS : 0), target: null });
    }
  }

  const charmSrc = scenario.charms ?? map.charms.map((pos, i) => ({ id: `C${i + 1}`, pos }));
  for (const c of charmSrc) g.charms.push({ id: c.id, pos: [...(c.pos ?? [0, 0, 0])], available: c.available ?? true, respawn: c.respawn_ticks ?? 0 });

  return g;
}

export function groundAt(g, x, z) {
  for (const s of g.map.solids) if (Math.hypot(x - s.x, z - s.z) <= s.r) return Infinity;
  return g.map.ground(x, z);
}

function addMote(g, pos, kind, ttl, point) {
  g.motes.push({ id: `M${g.nextMote++}`, pos, kind, ttl, point, from: g.tick + 1 });
}

function addPointMote(g, i) {
  const [x, z] = g.map.motePoints[i];
  addMote(g, [x, g.map.ground(x, z) ?? 0, z], 'random', null, i);
}

function newShadeId(g) {
  let id;
  do id = `S${g.nextShade++}`;
  while (g.reservedShadeIds?.has(id) || g.shades.some((s) => s.id === id));
  return id;
}

export function timeLeft(g) {
  return g.duration - g.simTick / TICK_HZ;
}

function dropMotes(g, center, n, ttl) {
  for (let i = 0; i < n; i++) {
    const a = g.rng() * Math.PI * 2;
    const r = 1.5 + g.rng();
    const x = center[0] + r * Math.cos(a);
    const z = center[2] + r * Math.sin(a);
    const gy = g.map.ground(x, z);
    addMote(g, [x, gy ?? center[1], z], 'dropped', ttl, null);
  }
}

// Một bước: đọc input của tick k, sinh trạng thái k+1. Trả về danh sách event.
export function step(g, input) {
  const T = g.T;
  const events = [];
  if (g.state !== 'playing' && g.state !== 'paused') return events;
  g.tick += 1;
  const ev = (name, data) => events.push({ type: 'event', tick: g.tick, name, data });
  const prev = g.prevInput;
  g.prevInput = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash, pause: !!input.pause };
  const wasPressed = (k) => !!input[k] && !prev[k];

  // 1. Pause
  if (wasPressed('pause')) {
    if (!g.paused) { g.paused = true; g.state = 'paused'; ev('paused', {}); return events; }
    g.paused = false; g.state = 'playing'; ev('resumed', {});
  }
  if (g.paused) return events;

  g.simTick += 1;
  const p = g.player;
  const map = g.map;

  // 2. Bộ đếm
  for (const k of ['invuln', 'dashCd', 'pulseCd', 'charm']) if (p[k] > 0) p[k] -= 1;
  for (const s of g.shades) if ((s.state === 'stunned' || s.state === 'recoil' || s.state === 'spawning') && s.left > 0) s.left -= 1;
  for (const m of g.motes) if (m.ttl !== null) m.ttl -= 1;
  g.motes = g.motes.filter((m) => m.ttl === null || m.ttl > 0);
  for (const c of g.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
  if (g.windEnabled) {
    if (g.wind.active && --g.wind.left <= 0) g.wind.active = false;
    if (g.simTick % WIND_EVERY === 0) { g.wind = { active: true, dir: Math.floor(g.rng() * 360), left: WIND_TICKS }; }
  }

  // 3. Di chuyển Mây
  if (p.fallWait > 0) {
    p.fallWait -= 1;
    if (p.fallWait === 0) {
      p.pos = [...map.start]; p.vel = [0, 0, 0]; p.grounded = true; p.launch = null; p.dash = 0;
      p.invuln = T.invuln_s * TICK_HZ;
    }
  } else {
    movePlayer(g, input, wasPressed, ev);
  }

  // 4. Nhặt đom đóm và bùa
  if (p.fallWait === 0) {
    for (let i = 0; i < g.motes.length && p.carried < T.carry_capacity; ) {
      const m = g.motes[i];
      if (m.from <= g.tick && distXZ(p.pos, m.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= PICK_DY) {
        g.motes.splice(i, 1);
        p.carried += 1;
        ev('mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of g.charms) {
      if (c.available && distXZ(p.pos, c.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= PICK_DY) {
        c.available = false; c.respawn = CHARM_RESPAWN; p.charm = CHARM_TICKS; p.dashCd = 0;
        ev('charm_picked', { charm_id: c.id, charm_ticks: CHARM_TICKS });
      }
    }
  }

  // 5. Nạp đèn
  if (wasPressed('interact') && p.carried > 0 && p.fallWait === 0) {
    let best = null; let bestD = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = distXZ(p.pos, l.pos);
      if (d <= T.interact_radius && (d < bestD || (d === bestD && idNum(l.id) < idNum(best.id)))) { best = l; bestD = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        g.score += amount * T.score.per_mote;
        ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          g.score += T.score.per_lantern;
          ev('lantern_lit', { lantern_id: best.id });
          for (const s of g.shades) {
            const d = distXZ(s.pos, best.pos);
            if (d < T.safe_radius) s.expel = { lantern: best, left: SAFE_EXPEL_TICKS };
          }
        }
      }
    }
  }

  // 6. Vùng an toàn: bóng vừa bị đẩy ra trong tối đa 30 tick
  for (const s of g.shades) {
    if (!s.expel) continue;
    const l = s.expel.lantern;
    let dx = s.pos[0] - l.pos[0]; let dz = s.pos[2] - l.pos[2];
    let d = Math.hypot(dx, dz);
    if (d === 0) { dx = 1; dz = 0; d = 1; s.pos[0] += 1e-9; }
    const need = T.safe_radius - Math.hypot(s.pos[0] - l.pos[0], s.pos[2] - l.pos[2]);
    const mv = need / s.expel.left;
    s.pos[0] += (dx / d) * mv; s.pos[2] += (dz / d) * mv;
    s.expel.left -= 1;
    if (s.expel.left <= 0 || need <= 1e-9) s.expel = null;
  }

  // 7. Tỏa sáng
  if (wasPressed('pulse') && p.pulseCd <= 0 && p.carried >= T.pulse_cost && p.fallWait === 0) {
    p.carried -= T.pulse_cost;
    p.pulseCd = sec(T.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + PULSE_CENTER_DY, p.pos[2]];
    const ids = [];
    for (const s of [...g.shades].sort(byId)) {
      if (s.state === 'spawning') continue;
      if (dist3(c, s.pos) <= T.pulse_radius) {
        let dx = s.pos[0] - p.pos[0]; let dz = s.pos[2] - p.pos[2];
        const dl = Math.hypot(dx, dz);
        if (dl === 0) { dx = 1; dz = 0; } else { dx /= dl; dz /= dl; }
        s.state = 'stunned'; s.left = sec(T.pulse_stun_s); s.push = { dir: [dx, dz], left: PULSE_PUSH_TICKS };
        ids.push(s.id);
        g.score += T.score.per_stun;
      }
    }
    for (const d of g.drifters) {
      if (dist3(c, d.pos) > T.pulse_radius) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.left = DRIFTER_FLEE_TICKS; d.used = true; }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        dropMotes(g, d.pos, amount, DROP_TTL);
        d.stolen = 0; d.left = Math.min(d.left, DRIFTER_DROP_GONE);
        ev('drifter_drop', { drifter_id: d.id, amount });
      }
    }
    ev('pulse', { stunned_ids: ids });
  }

  // 8. Di chuyển Bóng Mực và Gió Lạc
  const speed = map.shadeSpeed;
  for (const s of g.shades) {
    if (s.state === 'spawning') { if (s.left <= 0) s.state = 'wander'; continue; }
    if (s.state === 'stunned') {
      if (s.push) {
        const step = T.pulse_push_m / PULSE_PUSH_TICKS;
        s.pos[0] += s.push.dir[0] * step; s.pos[2] += s.push.dir[1] * step;
        if (--s.push.left <= 0) s.push = null;
      }
      if (s.left <= 0) { s.state = 'wander'; s.push = null; }
      blockSafe(g, s);
      continue;
    }
    if (s.state === 'recoil') {
      if (!s.recoilDir) {
        const dx = s.pos[0] - p.pos[0]; const dz = s.pos[2] - p.pos[2]; const dl = Math.hypot(dx, dz);
        s.recoilDir = dl === 0 ? [1, 0] : [dx / dl, dz / dl];
      }
      const st = RECOIL_M / RECOIL_TICKS;
      s.pos[0] += s.recoilDir[0] * st; s.pos[2] += s.recoilDir[1] * st;
      if (s.left <= 0) s.state = 'wander';
      blockSafe(g, s);
      continue;
    }
    if (s.expel) continue; // đang bị đèn vừa thắp đẩy ra: không đuổi
    const d = distXZ(s.pos, p.pos);
    const playerTargetable = p.fallWait === 0;
    if (s.state === 'wander' && playerTargetable && d <= DETECT_M) s.state = 'chase';
    else if (s.state === 'chase' && (!playerTargetable || d > LOSE_M)) s.state = 'wander';
    if (s.state === 'chase' && d > 0) {
      const mv = Math.min(d, speed * DT);
      s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * mv;
      s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * mv;
    }
    if (!s.expel) blockSafe(g, s);
  }
  for (const d of g.drifters) moveDrifter(g, d);
  g.drifters = g.drifters.filter((d) => d.state !== 'removed');

  // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực
  if (p.fallWait === 0) {
    for (const d of [...g.drifters].sort(byId)) {
      if (d.state === 'flee' || d.used || p.carried <= 0) continue;
      if (distXZ(d.pos, p.pos) <= DRIFTER_STEAL_R) {
        const amount = Math.min(DRIFTER_STEAL_MAX, p.carried);
        p.carried -= amount; d.stolen = amount; d.used = true; d.state = 'flee'; d.left = DRIFTER_FLEE_TICKS;
        ev('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    if (p.invuln <= 0) {
      for (const s of [...g.shades].sort(byId)) {
        if (!(s.state === 'wander' || s.state === 'chase') || s.expel) continue;
        if (distXZ(s.pos, p.pos) <= T.shade_hit_radius && Math.abs(s.pos[1] - p.pos[1]) <= HIT_DY) {
          p.flames -= 1;
          const dropped = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= dropped;
          dropMotes(g, p.pos, dropped, DROP_TTL);
          p.invuln = sec(T.invuln_s);
          let dx = s.pos[0] - p.pos[0]; let dz = s.pos[2] - p.pos[2];
          const dl = Math.hypot(dx, dz);
          if (dl === 0) { dx = 1; dz = 0; } else { dx /= dl; dz /= dl; }
          s.state = 'recoil'; s.left = RECOIL_TICKS; s.recoilDir = [dx, dz];
          ev('player_hit', { by: 'shade', flames: p.flames, dropped });
          break;
        }
      }
    }
  }

  // 10. Sinh theo lịch
  if (g.randomMotes && g.simTick % MOTE_SPAWN_EVERY === 0 && g.motes.length < MOTE_CAP) {
    const used = new Set(g.motes.filter((m) => m.point !== null).map((m) => m.point));
    const free = map.motePoints.map((_, i) => i).filter((i) => !used.has(i));
    if (free.length) addPointMote(g, free[Math.floor(g.rng() * free.length)]);
  }
  if (g.randomShades && g.simTick >= SHADE_FIRST_TICK && (g.simTick - SHADE_FIRST_TICK) % map.shadeEvery === 0) {
    const n = g.simTick === SHADE_FIRST_TICK ? 2 : 1;
    for (let i = 0; i < n && g.shades.length < map.shadeMax; i++) {
      const valid = map.shadePoints.filter(([x, z]) => Math.hypot(x - p.pos[0], z - p.pos[2]) >= SHADE_MIN_DIST);
      if (!valid.length) break;
      const [x, z] = valid[Math.floor(g.rng() * valid.length)];
      const s = { id: newShadeId(g), pos: [x, (map.ground(x, z) ?? 0) + SHADE_Y, z], state: 'spawning', left: 1, push: null, expel: null };
      g.shades.push(s);
      ev('shade_spawned', { id: s.id });
    }
  }
  if (g.randomDrifters && g.simTick % DRIFTER_EVERY === 0 && g.drifters.length < DRIFTER_MAX) {
    const [x, z] = map.shadePoints[Math.floor(g.rng() * map.shadePoints.length)];
    g.drifters.push({ id: `D${g.nextDrifter++}`, pos: [x, (map.ground(x, z) ?? 0) + DRIFTER_Y, z], state: 'idle', stolen: 0, used: false, left: 0, target: null });
  }

  // 11. Thắng / thua
  if (p.flames <= 0) end(g, 'lost', 'no_flames', ev);
  else if (g.lanterns.every((l) => l.lit)) end(g, 'won', 'all_lit', ev);
  else if (timeLeft(g) <= 1e-9) end(g, 'lost', 'dawn', ev);
  return events;
}

function end(g, result, reason, ev) {
  g.state = result;
  if (result === 'won') {
    g.score += Math.floor(Math.max(0, timeLeft(g)) + 1e-9) * g.T.score.per_second_left;
    g.score += g.player.flames * g.T.score.per_flame_left;
  }
  ev('game_over', { result, reason });
}

function blockSafe(g, s) {
  for (const l of g.lanterns) {
    if (!l.lit) continue;
    const d = distXZ(s.pos, l.pos);
    if (d < g.T.safe_radius) {
      const ux = d === 0 ? 1 : (s.pos[0] - l.pos[0]) / d;
      const uz = d === 0 ? 0 : (s.pos[2] - l.pos[2]) / d;
      s.pos[0] = l.pos[0] + ux * g.T.safe_radius;
      s.pos[2] = l.pos[2] + uz * g.T.safe_radius;
    }
  }
}

function moveDrifter(g, d) {
  const p = g.player;
  if (d.state === 'flee') {
    let dx = d.pos[0] - p.pos[0]; let dz = d.pos[2] - p.pos[2];
    const dl = Math.hypot(dx, dz);
    if (dl === 0) { dx = 1; dz = 0; } else { dx /= dl; dz /= dl; }
    d.pos[0] += dx * DRIFTER_SPEED * DT; d.pos[2] += dz * DRIFTER_SPEED * DT;
    if (--d.left <= 0) d.state = 'removed';
    return;
  }
  const dist = distXZ(d.pos, p.pos);
  const canChase = !d.used && p.fallWait === 0 && p.carried >= DRIFTER_CHASE_CARRY && dist <= DRIFTER_DETECT;
  d.state = canChase ? 'chase' : 'idle';
  if (d.state === 'chase' && dist > 0) {
    const mv = Math.min(dist, DRIFTER_SPEED * DT);
    d.pos[0] += ((p.pos[0] - d.pos[0]) / dist) * mv; d.pos[2] += ((p.pos[2] - d.pos[2]) / dist) * mv;
    return;
  }
  if (!d.target || Math.hypot(d.target[0] - d.pos[0], d.target[1] - d.pos[2]) < 0.5) {
    d.target = g.map.shadePoints[Math.floor(g.rng() * g.map.shadePoints.length)];
  }
  const tx = d.target[0] - d.pos[0]; const tz = d.target[1] - d.pos[2];
  const tl = Math.hypot(tx, tz);
  const mv = Math.min(tl, DRIFTER_IDLE_SPEED * DT);
  if (tl > 0) { d.pos[0] += (tx / tl) * mv; d.pos[2] += (tz / tl) * mv; }
}

function movePlayer(g, input, wasPressed, ev) {
  const T = g.T;
  const p = g.player;
  let [mx, mz] = input.move || [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const wl = Math.hypot(wx, wz);
  if (wl > 1e-9) p.facing = [wx / wl, wz / wl];

  // Lướt
  if (wasPressed('dash') && p.dash === 0 && p.dashCd <= 0) {
    p.dash = sec(T.dash_duration_s);
    p.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : [...p.facing];
    p.dashCd = p.charm > 0 ? 0 : sec(T.dash_cooldown_s);
    ev('dash', {});
  }
  // Nhảy
  if (wasPressed('jump') && p.grounded) { p.vel[1] = JUMP_VY; p.grounded = false; }

  const speed = p.charm > 0 ? CHARM_SPEED : T.player_speed;
  const dashingNow = p.dash > 0;
  let vx; let vz;
  if (dashingNow) {
    vx = p.dashDir[0] * T.dash_speed; vz = p.dashDir[1] * T.dash_speed; p.vel[1] = 0;
    p.dash -= 1;
  } else if (p.launch) {
    vx = p.launch[0]; vz = p.launch[1];
  } else {
    vx = wx * speed; vz = wz * speed;
  }
  if (g.wind.active) {
    const a = (g.wind.dir * Math.PI) / 180;
    vx += Math.cos(a) * WIND_SPEED; vz += Math.sin(a) * WIND_SPEED;
  }
  p.vel[0] = vx; p.vel[2] = vz;

  // Ngang, chặn vách
  const nx = p.pos[0] + vx * DT; const nz = p.pos[2] + vz * DT;
  const ng = groundAt(g, nx, nz);
  if (!(ng !== null && ng > p.pos[1] + STEP_UP)) { p.pos[0] = nx; p.pos[2] = nz; }

  // Dọc
  const gy = groundAt(g, p.pos[0], p.pos[2]);
  if (p.grounded) {
    if (gy !== null && gy <= p.pos[1] + STEP_UP && gy >= p.pos[1] - STEP_UP) { p.pos[1] = gy; p.vel[1] = 0; }
    else p.grounded = false;
  }
  // Lướt trên không giữ nguyên độ cao: không áp trọng lực trong tick đang lướt.
  if (!p.grounded && !dashingNow) {
    p.vel[1] -= GRAVITY * DT;
    p.pos[1] += p.vel[1] * DT;
    if (gy !== null && p.vel[1] <= 0 && p.pos[1] <= gy && p.pos[1] >= gy - 1.0) {
      p.pos[1] = gy; p.vel[1] = 0; p.grounded = true; p.launch = null;
    }
  }

  // Bục nhảy
  if (p.grounded) {
    for (const pad of g.map.pads) {
      if (Math.hypot(p.pos[0] - pad.pos[0], p.pos[2] - pad.pos[2]) <= 1 && Math.abs(p.pos[1] - pad.pos[1]) < 0.01) {
        let dx; let dz;
        if (pad.target) { dx = pad.target[0] - p.pos[0]; dz = pad.target[1] - p.pos[2]; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
        else [dx, dz] = pad.dir;
        p.launch = [dx * pad.vh, dz * pad.vh]; p.vel[1] = pad.vy; p.grounded = false;
      }
    }
  }

  // Rơi khỏi đảo
  if (p.pos[1] < FALL_Y) {
    p.flames -= 1;
    const lost = p.carried;
    p.carried = 0;
    ev('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    p.fallWait = p.flames > 0 ? FALL_WAIT : 0;
    p.pos = [p.pos[0], FALL_Y, p.pos[2]];
    p.vel = [0, 0, 0]; p.launch = null; p.dash = 0;
  }
}

export function snapshot(g) {
  const p = g.player;
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.simTick,
    night: g.night,
    state: g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: g.wind.active ? g.wind.dir : null },
    player: {
      pos: p.pos.map(r3), vel: p.vel.map(r3), grounded: p.grounded,
      flames: p.flames, carried: p.carried,
      invuln: p.invuln > 0,
      dash_cd_s: r3(p.dashCd / TICK_HZ), pulse_cd_s: r3(p.pulseCd / TICK_HZ), charm_s: r3(p.charm / TICK_HZ),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / TICK_HZ) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / TICK_HZ) })),
  };
}
