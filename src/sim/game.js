// Logic thuần của Đảo Đèn Lồng. Không dùng Math.random, Date, DOM.
// Dùng chung cho headless (Node) và bản web.

export const TICK_HZ = 60;
const DT = 1 / TICK_HZ;
export const ISLAND_RADIUS = 30;
const LANTERN_RING = 20;
const DEFAULT_MOTES = 30;
const SHADE_Y = 1.0;
const START_SHADES = 2;
const SHADE_SPAWN_EVERY_S = 30;
const MAX_SHADES = 6;
const JUMP_VY = 6;
const GRAVITY = 20;

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

function randomGroundPoint(rng, maxR) {
  const ang = rng() * Math.PI * 2;
  const rad = Math.sqrt(rng()) * maxR;
  return [r3(Math.sin(ang) * rad), 0, r3(Math.cos(ang) * rad)];
}

function clampIsland(pos) {
  const d = Math.hypot(pos[0], pos[2]);
  if (d > ISLAND_RADIUS) {
    pos[0] *= ISLAND_RADIUS / d;
    pos[2] *= ISLAND_RADIUS / d;
  }
}

export function createGame({ seed, tuning, scenario = {} }) {
  const rng = mulberry32(seed);
  const T = tuning;
  const g = {
    T,
    rng,
    steps: 0,
    duration: scenario.time_left_s ?? T.night1_duration_s,
    state: 'playing',
    score: 0,
    player: {
      pos: [0, 0, 0],
      vy: 0,
      flames: T.flames,
      carried: 0,
      invuln: 0,
      pulseCd: 0,
    },
    lanterns: [],
    motes: [],
    shades: [],
    nextMote: 1,
    nextShade: 1,
    randomShades: scenario.random_shades ?? true,
    prevInput: { jump: false, interact: false, pulse: false, dash: false },
  };

  for (let i = 0; i < T.lantern_count_night1; i++) {
    const ang = (i * 2 * Math.PI) / T.lantern_count_night1;
    g.lanterns.push({
      id: `L${i + 1}`,
      pos: [r3(Math.sin(ang) * LANTERN_RING), 0, r3(Math.cos(ang) * LANTERN_RING)],
      lit: false,
      deposited: 0,
    });
  }

  if (scenario.player) {
    const p = scenario.player;
    if (p.pos) g.player.pos = [...p.pos];
    if (p.carried !== undefined) g.player.carried = p.carried;
    if (p.flames !== undefined) g.player.flames = p.flames;
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
    for (const m of scenario.motes) addMote(g, m);
  } else if (scenario.random_motes !== false) {
    for (let i = 0; i < DEFAULT_MOTES; i++) addMote(g, randomGroundPoint(rng, ISLAND_RADIUS - 2));
  }

  if (scenario.shades) {
    const used = new Set(scenario.shades.filter((s) => s.id).map((s) => s.id));
    for (const s of scenario.shades) {
      let id = s.id;
      while (!id) {
        const cand = `S${g.nextShade++}`;
        if (!used.has(cand)) id = cand;
      }
      g.shades.push({ id, pos: [s.pos[0], s.pos[1] ?? SHADE_Y, s.pos[2]], state: 'chase', stun: 0 });
    }
    g.usedShadeIds = used;
  } else if (g.randomShades) {
    for (let i = 0; i < START_SHADES; i++) spawnShade(g);
  }
  return g;
}

function addMote(g, pos) {
  g.motes.push({ id: `M${g.nextMote++}`, pos: [pos[0], 0, pos[2]] });
}

function spawnShade(g) {
  const used = g.usedShadeIds ?? new Set();
  let id;
  do id = `S${g.nextShade++}`;
  while (used.has(id) || g.shades.some((s) => s.id === id));
  const ang = g.rng() * Math.PI * 2;
  const pos = [r3(Math.sin(ang) * (ISLAND_RADIUS - 2)), SHADE_Y, r3(Math.cos(ang) * (ISLAND_RADIUS - 2))];
  const s = { id, pos, state: 'chase', stun: 0 };
  g.shades.push(s);
  return s;
}

export function timeLeft(g) {
  return g.duration - g.steps / TICK_HZ;
}

function endGame(g, result, reason, ev) {
  g.state = result;
  if (result === 'won') {
    g.score += Math.floor(Math.max(0, timeLeft(g))) * g.T.score.per_second_left;
    g.score += g.player.flames * g.T.score.per_flame_left;
  }
  ev('game_over', { result, reason });
}

// Một bước: đọc input của tick k, sinh trạng thái k+1. Trả về danh sách event.
export function step(g, input) {
  const T = g.T;
  const events = [];
  const tick = g.steps + 1;
  const ev = (name, data) => events.push({ type: 'event', tick, name, data });
  if (g.state !== 'playing') return events;
  const p = g.player;
  const pressed = (k) => input[k] && !g.prevInput[k];

  // Di chuyển
  let [mx, mz] = input.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (input.cam_yaw_deg * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += wx * T.player_speed * DT;
  p.pos[2] += wz * T.player_speed * DT;
  clampIsland(p.pos);

  // Nhảy
  if (pressed('jump') && p.pos[1] <= 0) p.vy = JUMP_VY;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= GRAVITY * DT;
    p.pos[1] += p.vy * DT;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // Nhặt đom đóm
  for (let i = 0; i < g.motes.length && p.carried < T.carry_capacity; ) {
    if (distXZ(p.pos, g.motes[i].pos) <= T.pickup_radius) {
      g.motes.splice(i, 1);
      p.carried += 1;
      g.score += T.score.per_mote;
      ev('mote_picked', { carried: p.carried });
    } else i++;
  }

  // Nạp đèn
  if (pressed('interact') && p.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = distXZ(p.pos, l.pos);
      if (d <= T.interact_radius && d < bestD) { best = l; bestD = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          g.score += T.score.per_lantern;
          ev('lantern_lit', { lantern_id: best.id });
          if (g.lanterns.every((l) => l.lit)) {
            endGame(g, 'won', 'all_lit', ev);
            g.steps += 1;
            g.prevInput = { ...input };
            return events;
          }
        }
      }
    }
  }

  // Tỏa sáng
  if (p.pulseCd > 0) p.pulseCd = Math.max(0, p.pulseCd - DT);
  if (pressed('pulse') && p.pulseCd <= 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = T.pulse_cooldown_s;
    const ids = [];
    for (const s of g.shades) {
      const d = distXZ(p.pos, s.pos);
      if (d <= T.pulse_radius) {
        s.state = 'stunned';
        s.stun = T.pulse_stun_s;
        let dx = s.pos[0] - p.pos[0];
        let dz = s.pos[2] - p.pos[2];
        const dl = Math.hypot(dx, dz);
        if (dl === 0) { dx = 1; dz = 0; } else { dx /= dl; dz /= dl; }
        s.pos[0] += dx * T.pulse_push_m;
        s.pos[2] += dz * T.pulse_push_m;
        clampIsland(s.pos);
        ids.push(s.id);
        g.score += T.score.per_stun;
      }
    }
    ev('pulse', { stunned_ids: ids });
  }

  // Bóng Mực
  for (const s of g.shades) {
    if (s.state === 'stunned') {
      s.stun -= DT;
      if (s.stun <= 1e-9) { s.state = 'chase'; s.stun = 0; }
      continue;
    }
    const dx = p.pos[0] - s.pos[0];
    const dz = p.pos[2] - s.pos[2];
    const d = Math.hypot(dx, dz);
    const stepLen = Math.min(d, T.shade_speed * DT);
    if (d > 0) {
      s.pos[0] += (dx / d) * stepLen;
      s.pos[2] += (dz / d) * stepLen;
    }
    for (const l of g.lanterns) {
      if (!l.lit) continue;
      const ld = distXZ(s.pos, l.pos);
      if (ld < T.safe_radius) {
        const ux = ld === 0 ? 1 : (s.pos[0] - l.pos[0]) / ld;
        const uz = ld === 0 ? 0 : (s.pos[2] - l.pos[2]) / ld;
        s.pos[0] = l.pos[0] + ux * T.safe_radius;
        s.pos[2] = l.pos[2] + uz * T.safe_radius;
      }
    }
    clampIsland(s.pos);
  }

  // Va chạm
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - DT);
  if (p.invuln <= 0) {
    const hitter = g.shades.find((s) => s.state !== 'stunned' && distXZ(p.pos, s.pos) <= T.shade_hit_radius);
    if (hitter) {
      p.flames -= 1;
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      for (let i = 0; i < dropped; i++) addMote(g, randomGroundPoint(g.rng, ISLAND_RADIUS - 2));
      p.invuln = T.invuln_s;
      ev('player_hit', { by: 'shade', flames: p.flames, dropped });
      if (p.flames <= 0) endGame(g, 'lost', 'no_flames', ev);
    }
  }

  g.steps += 1;
  g.prevInput = { ...input };
  if (g.state !== 'playing') return events;

  // Sinh Bóng Mực theo thời gian
  if (g.randomShades && g.steps % (SHADE_SPAWN_EVERY_S * TICK_HZ) === 0 && g.shades.length < MAX_SHADES) {
    const s = spawnShade(g);
    ev('shade_spawned', { id: s.id });
  }

  // Hết đêm
  if (timeLeft(g) <= 1e-9) endGame(g, 'lost', 'dawn', ev);
  return events;
}

export function snapshot(g) {
  return {
    type: 'snapshot',
    tick: g.steps,
    sim_tick: g.steps,
    state: g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    player: { pos: g.player.pos.map(r3), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
  };
}
