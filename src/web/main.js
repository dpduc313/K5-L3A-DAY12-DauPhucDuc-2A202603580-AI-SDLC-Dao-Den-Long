// Bản 3D: chỉ đọc state của src/sim và vẽ. Logic chạy cố định 60 tick/s như headless.
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { createGame, step, timeLeft, capacity, TICK_HZ } from '../sim/game.js';
import { MAPS } from '../sim/maps.js';
import { makeAudio } from './audio.js';

const T = contract.tuning;
const C = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lit: 0xffb347, core: 0xffe9b0, off: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeEdge: 0x7a3cff, shadeStun: 0x3a3450, coat: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
  king: 0xffd23f, kingHalo: 0xff9f1c, torch: 0xff7a1a,
};
const STORY = {
  1: 'Ông Đăng: "Sương đen đã nuốt Đảo Bến. Gom đom đóm, thắp lại năm ngọn đèn trước khi trời sáng, cháu nhé."',
  2: 'Ông Đăng: "Đảo Cau có hai nửa nối bằng cầu tre. Bục nhảy sẽ đưa cháu qua biển mây. Coi chừng Gió Lạc giật đom đóm!"',
  3: 'Ông Đăng: "Đảo Chuông nhiều tầng, gió mạnh lắm. Leo dốc, nhảy bục lên tháp chuông và thắp đủ bảy đèn."',
};
const REASON = { dawn_survived: 'Đảo giữ đủ đèn sáng tới bình minh.', dawn: 'Bình minh tới nhưng không đủ đèn sáng.', no_flames: 'Mây đã hết Ngọn Lửa.' };
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// ?bench=1&seed=42&duration=30: cảnh benchmark chuẩn Ticket-04 (scripts/bench.mjs mở trang này).
const BENCH = params.has('bench') ? { seed: Number(params.get('seed') ?? 42), duration: Number(params.get('duration') ?? 30), t0: null, last: null, dts: [], sent: false } : null;
const IDLE = { move: [0, 0], cam_yaw_deg: 0 };

// ---------- Cài đặt (lưu giữa các lần mở) ----------
const settings = { volume: 0.6, sens: 0.3, cb: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch {} };
const audio = makeAudio(() => settings.volume);

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.Fog(C.fog, 20, 90);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const ambient = new THREE.AmbientLight(0xbfc6ff, 0.15);
scene.add(ambient);
const sea = new THREE.Mesh(new THREE.CircleGeometry(250, 48), new THREE.MeshBasicMaterial({ color: C.sea }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -8;
scene.add(sea);
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

// ---------- Địa hình theo Đêm ----------
let terrain = new THREE.Group();
function disk(x, z, r, topY, depth, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, depth, 64), std(color));
  m.position.set(x, topY - depth / 2, z);
  return m;
}
function buildTerrain(night) {
  scene.remove(terrain);
  terrain = new THREE.Group();
  const map = MAPS[night];
  if (night === 1) terrain.add(disk(0, 0, 40, 0, 4, C.grass), disk(0, 0, 40.6, -0.05, 4, C.sand));
  if (night === 2) {
    terrain.add(disk(0, 0, 28, 0, 4, C.grass), disk(70, 0, 28, 0, 4, C.grass));
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), std(C.wood));
    bridge.position.set(35, -0.15, 0);
    terrain.add(bridge);
  }
  if (night === 3) {
    terrain.add(disk(0, 0, 45, 0, 4, C.grass));
    const tier1 = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(12, 0), new THREE.Vector2(24, 0), new THREE.Vector2(24, 3), new THREE.Vector2(12, 3), new THREE.Vector2(12, 0)], 48, -Math.PI / 2, Math.PI), std(C.sand, { side: THREE.DoubleSide }));
    terrain.add(tier1, disk(0, 0, 8, 6, 6, C.sand));
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), std(C.wood));
    tower.position.set(0, 10, 0);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(C.gold, { metalness: 0.6 }));
    bell.position.set(0, 14.5, 0);
    terrain.add(tower, bell);
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180; const u = [Math.cos(a), Math.sin(a)]; const n = [-u[1], u[0]];
      const P = (r, s, y) => [u[0] * r + n[0] * s, y, u[1] * r + n[1] * s];
      const v = [...P(24, 1.5, 3), ...P(24, -1.5, 3), ...P(30, -1.5, 0), ...P(24, 1.5, 3), ...P(30, -1.5, 0), ...P(30, 1.5, 0)];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      geo.computeVertexNormals();
      terrain.add(new THREE.Mesh(geo, std(C.wood, { side: THREE.DoubleSide })));
    }
  }
  for (const pad of map.pads) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.15, 24), std(C.gold, { emissive: C.gold, emissiveIntensity: 0.4 }));
    m.position.set(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]);
    terrain.add(m);
  }
  scene.add(terrain);
}

// ---------- Mây: áo sáng, khăn đỏ, nón lá treo đèn lồng ----------
const may = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 12), std(C.coat));
  body.position.y = 0.75;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), std(C.scarf));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), std(0xf2d0a9));
  head.position.y = 1.45;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 24), std(C.sand));
  hat.position.y = 1.75;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: C.lit }));
  lamp.position.set(0.55, 1.45, 0);
  const lampLight = new THREE.PointLight(C.lit, 2, 9);
  lampLight.position.copy(lamp.position);
  may.add(body, scarf, head, hat, lamp, lampLight);
}
// Sáng tạo: đuốc Mây cầm tay trái, chỉ hiện khi đang cầm
const heldTorch = new THREE.Group();
{
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 8), std(C.wood));
  stick.position.y = 0.4;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 10), new THREE.MeshBasicMaterial({ color: C.torch }));
  flame.position.y = 0.95; flame.name = 'flame';
  heldTorch.add(stick, flame);
  heldTorch.position.set(-0.5, 0.7, 0.15);
  heldTorch.visible = false;
  may.add(heldTorch);
}
scene.add(may);
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: C.core, transparent: true, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2; pulseRing.visible = false;
scene.add(pulseRing);

// ---------- Thực thể đồng bộ theo id ----------
const pools = { motes: new Map(), shades: new Map(), lanterns: new Map(), drifters: new Map(), charms: new Map(), kings: new Map(), torches: new Map() };
function sync(map, items, create) {
  const alive = new Set();
  for (const it of items) { alive.add(it.id); if (!map.has(it.id)) { const m = create(it); map.set(it.id, m); scene.add(m); } }
  for (const [id, m] of map) if (!alive.has(id)) { scene.remove(m); map.delete(id); }
}
function clearPools() { for (const p of Object.values(pools)) { for (const m of p.values()) scene.remove(m); p.clear(); } }
const moteGeo = new THREE.SphereGeometry(0.12, 8, 6);
const haloGeo = new THREE.SphereGeometry(0.3, 8, 6);
const makeMote = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(moteGeo, new THREE.MeshBasicMaterial({ color: C.moteCore })), new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.35 }))); return g; };
// Đom Đóm Chúa: lõi vàng to, quầng cam, vòng vương miện xoay
const makeKing = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: C.king })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: C.kingHalo, transparent: true, opacity: 0.3 })));
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: C.gold }));
  crown.rotation.x = Math.PI / 2; crown.name = 'crown';
  g.add(crown);
  return g;
};
// Đuốc cắm trên đất
const makeTorch = () => {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 8), std(C.wood));
  stick.position.y = 0.6;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 10), new THREE.MeshBasicMaterial({ color: C.torch }));
  flame.position.y = 1.45; flame.name = 'flame';
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: C.torch, transparent: true, opacity: 0.25 }));
  halo.position.y = 1.4;
  g.add(stick, flame, halo);
  return g;
};
const shadeBodyGeo = new THREE.SphereGeometry(0.8, 16, 12);
const shadeEdgeGeo = new THREE.SphereGeometry(0.9, 16, 12);
const makeShade = () => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shadeBodyGeo, std(C.shade, { emissive: C.shadeEdge, emissiveIntensity: 0.15 }));
  const edge = new THREE.Mesh(shadeEdgeGeo, new THREE.MeshBasicMaterial({ color: C.shadeEdge, transparent: true, opacity: 0.25, side: THREE.BackSide }));
  g.add(body, edge); g.userData = { body, edge };
  return g;
};
const makeLantern = () => {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3, 8), std(C.wood));
  post.position.y = 1.5;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 12), std(C.off, { emissive: 0x000000 }));
  shell.position.y = 3.3;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: C.core }));
  core.position.y = 3.3; core.visible = false;
  const light = new THREE.PointLight(C.lit, 0, 16);
  light.position.y = 3.3;
  // Thanh dầu (Ticket-03): nền tối + phần dầu co giãn theo fuel, luôn quay về camera.
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), new THREE.MeshBasicMaterial({ color: 0x0e1430 }));
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.12), new THREE.MeshBasicMaterial({ color: C.lit }));
  bar.position.z = 0.01;
  const barG = new THREE.Group(); barG.add(barBg, bar); barG.position.y = 4.3;
  // Vết rách giấy cho đèn tắt (phân biệt không cần màu).
  const tear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.6), new THREE.MeshBasicMaterial({ color: 0x0e1430 }));
  tear.position.set(0.45, 3.3, 0); tear.rotation.z = 0.5;
  g.add(post, shell, core, light, barG, tear); g.userData = { shell, core, light, barG, bar, tear };
  return g;
};
const makeDrifter = () => new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.08, 48, 6), std(C.drifter, { emissive: C.drifter, emissiveIntensity: 0.3 }));
const makeCharm = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.05), std(C.scarf, { emissive: C.scarf, emissiveIntensity: 0.4 })));
  const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.66, 0.86, 0.06)), new THREE.LineBasicMaterial({ color: C.gold }));
  g.add(rim);
  return g;
};

// ---------- Input ----------
const keys = new Set();
let yaw = 0; let dragging = false; let pauseTap = false;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if ((e.code === 'Escape' || e.code === 'KeyP') && mode === 'play') pauseTap = true;
});
addEventListener('keyup', (e) => keys.delete(e.code));
// Bấm Shift 5 lần, Windows bật hộp thoại Sticky Keys và lấy mất focus. Khi đó trình duyệt
// không nhận keyup, phím W (hoặc Shift) bị "kẹt" nên Mây tự chạy ra mép đảo, rơi 3 lần và thua.
// Mất focus thì xóa mọi phím đang giữ và tự tạm dừng.
function releaseAll() {
  keys.clear(); dragging = false;
  if (mode === 'play' && game && !game.paused) pauseTap = true;
}
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
renderer.domElement.addEventListener('mousedown', () => (dragging = true));
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => { if (dragging) yaw -= e.movementX * settings.sens; });
function readInput() {
  if (keys.has('ArrowLeft')) yaw += 2;
  if (keys.has('ArrowRight')) yaw -= 2;
  // Camera nhìn theo (sinθ, cosθ); bên phải màn hình ứng với move.x = -1 theo công thức contract.
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const z = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const pause = pauseTap; pauseTap = false;
  return { move: [x, z], cam_yaw_deg: yaw, jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyQ'), dash: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyF'), pause };
}

// ---------- Luồng màn hình ----------
let mode = 'menu'; // menu | intro | play | result | dawn
let game = null; let night = 1; let total = 0; let lastWin = false;
let settingsBack = 's-menu';
const show = (id) => { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id); };
function intro(n) {
  night = n; mode = 'intro';
  $('intro-title').textContent = `Đêm ${n} – ${MAPS[n].name}`;
  $('intro-text').textContent = STORY[n];
  show('s-intro');
}
function startNight() {
  clearPools(); buildTerrain(night);
  game = createGame({ seed: (Math.random() * 2 ** 31) | 0, tuning: T, scenario: {}, night, creative: true });
  yaw = 0; mode = 'play'; show(null); audio.music(true);
}
$('b-start').onclick = () => { audio.unlock(); total = 0; intro(1); };
$('b-go').onclick = startNight;
$('b-next').onclick = () => { if (!lastWin) return intro(night); if (night === 3) { $('dawn-text').textContent = `Ba hòn đảo đã sáng. Tổng điểm: ${total}`; mode = 'dawn'; show('s-dawn'); audio.music(false); } else intro(night + 1); };
$('b-menu2').onclick = () => { mode = 'menu'; show('s-menu'); };
$('b-resume').onclick = () => { pauseTap = true; };
$('b-retry').onclick = () => { startNight(); };
$('b-menu').onclick = () => { mode = 'menu'; game = null; audio.music(false); show('s-menu'); };
const openSettings = (back) => { settingsBack = back; $('vol').value = settings.volume; $('sens').value = settings.sens; $('cb').checked = settings.cb; show('s-settings'); };
$('b-settings1').onclick = () => openSettings('s-menu');
$('b-settings2').onclick = () => openSettings('s-pause');
$('vol').oninput = (e) => { settings.volume = Number(e.target.value); saveSettings(); };
$('sens').oninput = (e) => { settings.sens = Number(e.target.value); saveSettings(); };
$('cb').onchange = (e) => { settings.cb = e.target.checked; saveSettings(); };
$('b-close').onclick = () => show(settingsBack);

let msg = ''; let msgUntil = 0;
const banner = (text) => { msg = text; msgUntil = performance.now() + 2500; };
function onEvents(evs) {
  for (const e of evs) {
    switch (e.name) {
      case 'mote_picked': audio.sfx('pick'); break;
      case 'lantern_lit': audio.sfx('lit'); break;
      case 'pulse': audio.sfx('pulse'); pulseAnim = 1; pulseRing.position.set(game.player.pos[0], game.player.pos[1] + 0.05, game.player.pos[2]); break;
      case 'torch_pulse': audio.sfx('pulse'); pulseAnim = 1; pulseRing.position.set(game.player.pos[0], game.player.pos[1] + 0.05, game.player.pos[2]); break;
      case 'king_picked': audio.sfx('king'); banner(`Đom Đóm Chúa! +${e.data.amount} đom đóm, +25 điểm`); break;
      case 'torch_picked': audio.sfx('torch'); banner('Cầm Đuốc: tự tỏa sáng mỗi 3 giây trong 30 giây'); break;
      case 'torch_out': banner('Đuốc đã tàn'); break;
      case 'player_hit': audio.sfx('hit'); break;
      case 'dash': audio.sfx('dash'); break;
      case 'shade_spawned': audio.sfx('spawn'); break;
      case 'paused': show('s-pause'); break;
      case 'resumed': show(null); break;
      case 'game_over': {
        lastWin = e.data.result === 'won';
        if (lastWin) total += game.score;
        audio.sfx(lastWin ? 'win' : 'lose'); audio.music(false);
        $('res-title').textContent = lastWin ? `Đêm ${night} đã sáng!` : `Đêm ${night} vẫn còn tối…`;
        $('res-text').textContent = `${REASON[e.data.reason]} Điểm đêm: ${game.score}. Tổng: ${total}.`;
        $('b-next').textContent = lastWin ? (night === 3 ? 'Đón bình minh' : 'Đêm kế tiếp') : 'Chơi lại Đêm này';
        mode = 'result'; show('s-result');
      }
    }
  }
}

// ---------- Vòng lặp ----------
let acc = 0; let last = performance.now(); let pulseAnim = 0; let lastCountdown = -1; let wasJumpGrounded = true;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  if (BENCH && BENCH.t0 === null && game) { BENCH.t0 = now; BENCH.firstEpoch = performance.timeOrigin + now; }
  if (mode === 'play' && game) {
    while (acc >= 1 / TICK_HZ) {
      acc -= 1 / TICK_HZ;
      const before = game.player.grounded;
      onEvents(step(game, BENCH ? IDLE : readInput()));
      if (before && !game.player.grounded && game.player.vel[1] > 0) audio.sfx('jump');
      if (mode !== 'play') break;
    }
    draw(now / 1000);
  } else acc = 0;
  renderer.render(scene, camera);
  if (BENCH && BENCH.t0 !== null) benchTick(now);
  requestAnimationFrame(frame);
}

// 3 s khởi động không đo, rồi ghi dt từng khung trong đúng `duration` giây và gửi về scripts/bench.mjs.
function benchTick(now) {
  const el = (now - BENCH.t0) / 1000;
  if (el > 3 && el <= 3 + BENCH.duration && BENCH.last !== null) BENCH.dts.push(now - BENCH.last);
  BENCH.last = now;
  if (el > 3 + BENCH.duration && !BENCH.sent) {
    BENCH.sent = true;
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const ua = navigator.userAgent.match(/(Edg|Chrome)\/[\d.]+/);
    fetch('/api/bench', { method: 'POST', body: JSON.stringify({ dts: BENCH.dts, first_frame_epoch_ms: BENCH.firstEpoch, three: THREE.REVISION, gpu, browser: ua ? ua[0] : navigator.userAgent, canvas: `${renderer.domElement.width}x${renderer.domElement.height}` }) });
    $('banner').style.display = 'block'; $('banner').textContent = `Bench xong: ${BENCH.dts.length} khung`;
  }
}

function draw(t) {
  const g = game; const p = g.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  may.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  may.visible = p.invuln <= 0 || Math.floor(t * 10) % 2 === 0;

  sync(pools.motes, g.motes, makeMote);
  for (const m of g.motes) pools.motes.get(m.id).position.set(m.pos[0], m.pos[1] + 0.6 + Math.sin(t * 3 + m.pos[0]) * 0.15, m.pos[2]);
  sync(pools.shades, g.shades, makeShade);
  for (const s of g.shades) {
    const m = pools.shades.get(s.id);
    m.position.set(s.pos[0], s.pos[1] + Math.sin(t * 2 + s.pos[2]) * 0.1, s.pos[2]);
    const stun = s.state === 'stunned';
    m.userData.body.material.color.setHex(stun ? C.shadeStun : C.shade);
    m.userData.edge.material.opacity = stun ? 0.08 : 0.25;
    m.userData.edge.material.color.setHex(settings.cb ? 0x00b3ff : C.shadeEdge); // chế độ mù màu
    m.userData.body.material.emissive.setHex(settings.cb ? 0x00b3ff : C.shadeEdge);
    m.scale.setScalar(s.state === 'spawning' ? 0.4 : 1);
  }
  sync(pools.lanterns, g.lanterns, makeLantern);
  let lit = 0;
  for (const l of g.lanterns) {
    const m = pools.lanterns.get(l.id);
    m.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const cost = l.everLit ? T.relight_cost : T.lantern_cost;
    const frac = l.deposited / cost;
    const fuel = l.fuel / 60;
    const low = l.lit && fuel < T.low_fuel_threshold;
    const blinkOff = low && Math.floor(t * 2) % 2 === 1; // nhấp nháy chậm 1 Hz
    const u = m.userData;
    u.shell.material.color.setHex(l.lit ? C.lit : C.off);
    u.shell.material.emissive.setHex(l.lit ? C.lit : 0x221100);
    u.shell.material.emissiveIntensity = l.lit ? (blinkOff ? 0.2 : 1.2) : frac;
    u.shell.scale.set(1, l.lit ? 1 : 0.8, 1); // đèn tắt xẹp 20%
    u.tear.visible = !l.lit;
    u.core.visible = l.lit && !blinkOff;
    u.light.intensity = l.lit ? (blinkOff ? 6 : 30) : frac * 4;
    u.barG.visible = l.lit && !blinkOff;
    u.bar.scale.x = Math.max(0.001, fuel / T.fuel_max);
    u.bar.position.x = -0.75 * (1 - fuel / T.fuel_max);
    u.bar.material.color.setHex(low ? (settings.cb ? 0xffffff : 0xff5a5f) : C.lit);
    u.barG.quaternion.copy(camera.quaternion);
    if (l.lit) lit++;
  }
  sync(pools.drifters, g.drifters, makeDrifter);
  for (const d of g.drifters) { const m = pools.drifters.get(d.id); m.position.set(d.pos[0], d.pos[1], d.pos[2]); m.rotation.y = t * 4; m.material.opacity = 1; }
  sync(pools.charms, g.charms, makeCharm);
  for (const c of g.charms) { const m = pools.charms.get(c.id); m.position.set(c.pos[0], c.pos[1] + 1, c.pos[2]); m.rotation.y = t * 2; m.visible = c.available; }
  if (g.creative) {
    sync(pools.kings, g.creative.kings, makeKing);
    for (const k of g.creative.kings) {
      const m = pools.kings.get(k.id);
      m.position.set(k.pos[0], k.pos[1] + 0.9 + Math.sin(t * 2) * 0.25, k.pos[2]);
      m.getObjectByName('crown').rotation.z = t * 3;
      m.visible = k.ttl > 180 || Math.floor(t * 6) % 2 === 0; // nhấp nháy 3 s cuối trước khi bay mất
    }
    sync(pools.torches, g.creative.torches, makeTorch);
    for (const tc of g.creative.torches) {
      const m = pools.torches.get(tc.id);
      m.position.set(tc.pos[0], tc.pos[1], tc.pos[2]);
      m.getObjectByName('flame').scale.y = 1 + Math.sin(t * 12) * 0.15;
    }
    heldTorch.visible = p.torch > 0 && (p.torch > 300 || Math.floor(t * 6) % 2 === 0); // nhấp nháy 5 s cuối
    heldTorch.getObjectByName('flame').scale.y = 1 + Math.sin(t * 12) * 0.15;
  }

  // Ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn)
  ambient.intensity = 0.15 + 0.55 * (lit / g.lanterns.length);
  scene.fog.far = 90 + 60 * (lit / g.lanterns.length);

  if (pulseAnim > 0) {
    pulseAnim = Math.max(0, pulseAnim - 1 / 30);
    pulseRing.visible = true;
    pulseRing.scale.setScalar(T.pulse_radius * (1 - pulseAnim));
    pulseRing.material.opacity = pulseAnim;
  } else pulseRing.visible = false;

  const th = (yaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
  if (BENCH) {
    // Camera bay vòng tròn tâm (0,0,0), bán kính 30 m, cao 15 m, bắt đầu ở (30,15,0), ngược chiều kim đồng hồ nhìn từ trên, 15 s một vòng.
    const a = (2 * Math.PI * (performance.now() - BENCH.t0)) / 15000;
    camera.position.set(30 * Math.cos(a), 15, -30 * Math.sin(a));
    camera.lookAt(0, 0, 0);
  }
  camera.updateMatrixWorld(); // để project() trong HUD dùng đúng camera của frame này
  hud(g, lit);
}

// Chỉ ghi DOM khi nội dung đổi: ghi innerHTML mỗi khung gây layout và rác bộ nhớ (làm tụt p1_low_fps).
function setDom(id, key, v) { const el = $(id); if (el['_' + key] !== v) { el['_' + key] = v; el[key] = v; } }
function hud(g, lit) {
  const p = g.player;
  setDom('flames', 'textContent', '🔥'.repeat(Math.max(0, p.flames)) + '·'.repeat(Math.max(0, T.flames - p.flames)));
  const left = Math.max(0, Math.ceil(timeLeft(g)));
  const danger = left <= 30;
  setDom('timer', 'textContent', `${danger && settings.cb ? '⚠ ' : ''}${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`);
  $('timer').classList.toggle('danger', danger);
  const dz = settings.cb ? '#FFFFFF' : '#FF5A5F';
  if (hud.dz !== dz) { hud.dz = dz; document.documentElement.style.setProperty('--danger', dz); }
  if (left <= 10 && left !== lastCountdown) { lastCountdown = left; audio.sfx('tick'); }
  const cap = capacity(g);
  const need = Math.ceil(T.win_ratio * g.lanterns.length - 1e-9);
  setDom('topright', 'innerHTML', `Đèn <b>${lit}/${g.lanterns.length}</b><br>Điểm <b>${g.score}</b><br><small>Đêm ${g.night} – ${MAPS[g.night].name}</small>`
    + `<br><small>Cần ${need} đèn sáng lúc bình minh</small>`
    + (p.torch > 0 ? `<br>🔥 Đuốc <b>${Math.ceil(p.torch / TICK_HZ)}s</b>` : ''));
  setDom('bar', 'innerHTML', Array.from({ length: cap }, (_, i) => `<i class="${i < p.carried ? 'on' : ''}"></i>`).join('') + `<span style="margin-left:8px">${p.carried}/${cap}</span>`);
  const cd = (el, ticks, total) => { const h = `${total ? Math.round((100 * ticks) / total) : 0}%`; const s = el.querySelector('span'); if (s.style.height !== h) s.style.height = h; };
  cd($('cd-dash'), p.dashCd, T.dash_cooldown_s * TICK_HZ);
  cd($('cd-pulse'), p.pulseCd, T.pulse_cooldown_s * TICK_HZ);
  $('cd-dash').style.borderColor = p.charm > 0 ? '#C8102E' : '';

  // Nhắc nạp đèn và mũi tên chỉ đèn chưa sáng gần nhất
  // Đèn cần chăm: chưa sáng, hoặc sáng nhưng dầu dưới 30.
  let nearest = null; let nd = Infinity;
  for (const l of g.lanterns) {
    if (l.lit && l.fuel / 60 >= T.low_fuel_threshold) continue;
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
    if (d < nd) { nd = d; nearest = l; }
  }
  let close = null; let cd2 = Infinity;
  for (const l of g.lanterns) {
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
    if (d <= T.interact_radius && d < cd2 && !(l.lit && l.fuel >= T.fuel_max * 60)) { close = l; cd2 = d; }
  }
  const pr = $('prompt');
  if (close) {
    pr.style.display = 'block';
    pr.textContent = close.lit ? `E — Châm dầu (${Math.round(close.fuel / 60)}/${T.fuel_max})` : `E — Nạp ánh sáng (${close.deposited}/${close.everLit ? T.relight_cost : T.lantern_cost})`;
  } else pr.style.display = 'none';
  const ar = $('arrow');
  if (nearest) {
    const v = new THREE.Vector3(nearest.pos[0], nearest.pos[1] + 3, nearest.pos[2]).project(camera);
    const behind = v.z > 1; // điểm sau lưng camera: đảo hướng để mũi tên chỉ về phía sau
    if (behind || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) {
      let x = behind ? -v.x : v.x; let y = behind ? -v.y : v.y;
      const k = 0.85 / Math.max(Math.abs(x), Math.abs(y), 1e-6); x *= k; y *= k;
      ar.style.display = 'block';
      ar.style.left = `${(x * 0.5 + 0.5) * innerWidth - 14}px`;
      ar.style.top = `${(-y * 0.5 + 0.5) * innerHeight - 15}px`;
      ar.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    } else ar.style.display = 'none';
  } else ar.style.display = 'none';

  const bn = $('banner');
  const warn = g.windEnabled && (g.simTick % 1800) >= 1680;
  if (warn && g.simTick % 1800 === 1680) audio.sfx('wind');
  if (performance.now() < msgUntil) { bn.style.display = 'block'; bn.textContent = msg; }
  else if (warn && !g.wind.active) { bn.style.display = 'block'; bn.textContent = '🍃 Gió sắp nổi…'; }
  else if (g.wind.active) { bn.style.display = 'block'; bn.textContent = '🍃 Gió mạnh!'; }
  else bn.style.display = 'none';
}

buildTerrain(1);
camera.position.set(0, 30, -50); camera.lookAt(0, 0, 0);

// ?night=N vào thẳng Đêm N (để kiểm chứng); ?fps hiện FPS trung bình từ lúc vào đêm.
if (BENCH) {
  night = 1; clearPools(); buildTerrain(1);
  game = createGame({ seed: BENCH.seed, tuning: T, night: 1, bench: true });
  yaw = 0; mode = 'play'; show(null);
} else if (params.has('night')) { night = Math.min(3, Math.max(1, Number(params.get('night')) || 1)); startNight(); }
if (params.has('fps')) {
  const el = document.createElement('div');
  el.id = 'fps'; el.className = 'hud'; el.style.cssText = 'bottom:40px;left:8px;font:14px monospace;color:#F2C14E';
  document.body.append(el);
  let frames = 0; const t0 = performance.now();
  const tickFps = () => { frames++; const s = (performance.now() - t0) / 1000; el.textContent = `FPS TB ${(frames / s).toFixed(1)} · ${innerWidth}x${innerHeight} · ${s.toFixed(0)} s`; requestAnimationFrame(tickFps); };
  requestAnimationFrame(tickFps);
}
requestAnimationFrame(frame);
