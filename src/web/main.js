// Bản 3D: chỉ đọc state của src/sim và vẽ. Logic chạy cố định 60 tick/s như headless.
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { createGame, step, timeLeft, ISLAND_RADIUS, TICK_HZ } from '../sim/game.js';

const T = contract.tuning;
const REASON = { all_lit: 'Đã thắp hết đèn', dawn: 'Trời sáng mà đèn chưa thắp hết', no_flames: 'Mây đã hết lửa' };

// ---------- Cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0816);
scene.fog = new THREE.Fog(0x140a26, 15, 60);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
const ambient = new THREE.AmbientLight(0x6a4c9c, 0.35);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x9c8cff, 0.4);
moon.position.set(10, 30, -10);
scene.add(moon);

const island = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.8, 3, 64),
  new THREE.MeshStandardMaterial({ color: 0x2e3b2a, roughness: 1 })
);
island.position.y = -1.5;
scene.add(island);
const sea = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshBasicMaterial({ color: 0x1a1030 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -6;
scene.add(sea);

// ---------- Mây: thân, nón lá, đèn lồng nhỏ ----------
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 12), new THREE.MeshStandardMaterial({ color: 0x5f8fd6 }));
  body.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2d0a9 }));
  head.position.y = 1.45;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 24), new THREE.MeshStandardMaterial({ color: 0xe8d39a }));
  hat.position.y = 1.75;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffa040 }));
  lamp.position.set(0.55, 1.45, 0);
  const lampLight = new THREE.PointLight(0xffa040, 1.5, 7);
  lampLight.position.copy(lamp.position);
  g.add(body, head, hat, lamp, lampLight);
  return g;
}
const may = makeMay();
scene.add(may);

const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1, 48),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, side: THREE.DoubleSide })
);
pulseRing.rotation.x = -Math.PI / 2;
pulseRing.visible = false;
scene.add(pulseRing);

// ---------- Đồng bộ thực thể theo id ----------
const moteMeshes = new Map();
const shadeMeshes = new Map();
const lanternMeshes = new Map();
const moteGeo = new THREE.SphereGeometry(0.15, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xfff08a });
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);

function syncMap(map, items, create) {
  const alive = new Set();
  for (const it of items) {
    alive.add(it.id);
    if (!map.has(it.id)) { const m = create(it); map.set(it.id, m); scene.add(m); }
  }
  for (const [id, m] of map) if (!alive.has(id)) { scene.remove(m); map.delete(id); }
}

function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3, 8), new THREE.MeshStandardMaterial({ color: 0x5a3b22 }));
  post.position.y = 1.5;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x553322, emissive: 0x000000 }));
  shade.position.y = 3.3;
  const light = new THREE.PointLight(0xffa040, 0, 14);
  light.position.y = 3.3;
  g.add(post, shade, light);
  g.userData = { shade, light };
  return g;
}

// ---------- Input ----------
const keys = new Set();
let yaw = 0;
let dragging = false;
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyR') restart(); });
addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('mousedown', () => (dragging = true));
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => { if (dragging) yaw -= e.movementX * 0.3; });

function readInput() {
  if (keys.has('ArrowLeft')) yaw += 2;
  if (keys.has('ArrowRight')) yaw -= 2;
  // Camera nhìn theo hướng (sinθ, cosθ); bên phải màn hình ứng với move.x = -1 theo công thức contract.
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const z = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  return { move: [x, z], cam_yaw_deg: yaw, jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyQ'), dash: false };
}

// ---------- Vòng lặp ----------
let game;
let acc = 0;
let last = performance.now();
let pulseAnim = 0;
const endEl = document.getElementById('end');

function restart() {
  game = createGame({ seed: (Math.random() * 2 ** 31) | 0, tuning: T, scenario: {} });
  endEl.style.display = 'none';
  acc = 0;
}
document.getElementById('replay').onclick = restart;
restart();

function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= 1 / TICK_HZ) {
    acc -= 1 / TICK_HZ;
    const evs = step(game, readInput());
    for (const e of evs) {
      if (e.name === 'pulse') { pulseAnim = 1; pulseRing.position.set(game.player.pos[0], 0.05, game.player.pos[2]); }
      if (e.name === 'game_over') showEnd(e.data);
    }
  }
  draw(now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function showEnd({ result, reason }) {
  document.getElementById('end-title').textContent = result === 'won' ? 'Đảo đã sáng trở lại!' : 'Đêm vẫn còn tối…';
  document.getElementById('end-text').textContent = `${REASON[reason]} · Điểm: ${game.score}`;
  endEl.style.display = 'flex';
}

function draw(t) {
  const p = game.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  may.rotation.y = (yaw * Math.PI) / 180;
  may.visible = p.invuln <= 0 || Math.floor(t * 10) % 2 === 0;

  syncMap(moteMeshes, game.motes, () => new THREE.Mesh(moteGeo, moteMat));
  for (const m of game.motes) moteMeshes.get(m.id).position.set(m.pos[0], 0.6 + Math.sin(t * 3 + m.pos[0]) * 0.15, m.pos[2]);

  syncMap(shadeMeshes, game.shades, () => new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: 0x2a0a40, emissive: 0x3a0060, transparent: true, opacity: 0.85 })));
  for (const s of game.shades) {
    const m = shadeMeshes.get(s.id);
    m.position.set(s.pos[0], s.pos[1] + Math.sin(t * 2 + s.pos[2]) * 0.1, s.pos[2]);
    m.material.opacity = s.state === 'stunned' ? 0.35 : 0.85;
  }

  syncMap(lanternMeshes, game.lanterns, makeLantern);
  let lit = 0;
  for (const l of game.lanterns) {
    const g = lanternMeshes.get(l.id);
    g.position.set(l.pos[0], 0, l.pos[2]);
    const frac = l.deposited / T.lantern_cost;
    g.userData.shade.material.emissive.setHex(l.lit ? 0xff9a30 : 0x331100);
    g.userData.shade.material.emissiveIntensity = l.lit ? 1.5 : 0.3 + frac;
    g.userData.light.intensity = l.lit ? 25 : frac * 3;
    if (l.lit) lit++;
  }
  ambient.intensity = 0.35 + lit * 0.12;
  scene.fog.far = 60 + lit * 15;

  if (pulseAnim > 0) {
    pulseAnim = Math.max(0, pulseAnim - 1 / 30);
    pulseRing.visible = true;
    const s = T.pulse_radius * (1 - pulseAnim);
    pulseRing.scale.set(s, s, s);
    pulseRing.material.opacity = pulseAnim;
  } else pulseRing.visible = false;

  const th = (yaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  document.getElementById('hud').innerHTML =
    `Lửa: <b>${'🔥'.repeat(Math.max(0, p.flames))}</b> (${p.flames}/${T.flames})<br>` +
    `Đom đóm mang: <b>${p.carried}/${T.carry_capacity}</b><br>` +
    `Đèn đã thắp: <b>${lit}/${game.lanterns.length}</b><br>` +
    `Thời gian: <b>${Math.max(0, Math.ceil(timeLeft(game)))} s</b><br>` +
    `Điểm: <b>${game.score}</b><br>` +
    `Tỏa sáng: <b>${p.pulseCd > 0 ? p.pulseCd.toFixed(1) + ' s' : (p.carried >= T.pulse_cost ? 'sẵn sàng' : 'cần đom đóm')}</b>`;
}

requestAnimationFrame(frame);
