// Bản đồ chuẩn Ticket-02 (Phần 2). Góc đo từ +X, ngược chiều kim đồng hồ nhìn từ trên: x = r·cos, z = r·sin.
const D = Math.PI / 180;
const ring = (cx, cz, r, startDeg, stepDeg, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (startDeg + i * stepDeg) * D;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  });
const lan = (arr) => arr.map((p, i) => ({ id: `L${i + 1}`, pos: p }));

// Night 3: ramps along 30° and 150°, radial 24..30, width 3.
const RAMPS = [30, 150].map((deg) => [Math.cos(deg * D), Math.sin(deg * D)]);

function ground3(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  if (r <= 8) return 6;
  if (r >= 12 && r <= 24 && z > 0) return 3;
  for (const [ux, uz] of RAMPS) {
    const along = x * ux + z * uz;
    const perp = Math.abs(-x * uz + z * ux);
    if (perp <= 1.5 && along >= 24 && along <= 30) return (3 * (30 - along)) / 6;
  }
  return 0;
}

export const MAPS = {
  1: {
    name: 'Đảo Bến',
    duration: 300,
    start: [0, 0, 0],
    ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
    lanterns: lan([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
    motePoints: [...ring(0, 0, 12, 0, 45, 8), ...ring(0, 0, 33, 0, 22.5, 16)],
    shadePoints: ring(0, 0, 37, 15, 30, 12),
    shadeEvery: 480,
    shadeMax: 6,
    shadeSpeed: 4.0,
    pads: [],
    charms: [],
    drifters: false,
    wind: false,
    solids: [],
  },
  2: {
    name: 'Đảo Cau',
    duration: 330,
    start: [0, 0, 0],
    ground: (x, z) => {
      if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
      if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
      return null;
    },
    lanterns: lan([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
    motePoints: [
      ...ring(0, 0, 10, 0, 90, 4), ...ring(0, 0, 22, 0, 45, 8),
      ...ring(70, 0, 10, 0, 90, 4), ...ring(70, 0, 22, 0, 45, 8),
    ],
    shadePoints: [...ring(0, 0, 26, 22.5, 45, 8), ...ring(70, 0, 26, 22.5, 45, 8)],
    shadeEvery: 420,
    shadeMax: 8,
    shadeSpeed: 4.0,
    pads: [
      { pos: [20, 0, 18], vy: 14, vh: 24, target: [70, 0] },
      { pos: [50, 0, -18], vy: 14, vh: 24, target: [0, 0] },
    ],
    charms: [[35, 0, 0]],
    drifters: true,
    wind: false,
    solids: [],
  },
  3: {
    name: 'Đảo Chuông',
    duration: 360,
    // Giả định: (0,0,0) là tháp chuông nên Đêm 3 xuất phát ở (0,0,-30), quay mặt về +Z.
    start: [0, 0, -30],
    ground: ground3,
    lanterns: lan([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
    motePoints: [...ring(0, 0, 34, 0, 20, 18), ...ring(0, 0, 18, 20, 20, 8), ...ring(0, 0, 5, 45, 90, 4)],
    shadePoints: ring(0, 0, 43, 0, 22.5, 16),
    shadeEvery: 360,
    shadeMax: 10,
    shadeSpeed: 4.5,
    pads: [{ pos: [0, 3, 13], vy: 12, vh: 8, dir: [0, -1] }],
    charms: [[30, 0, 25], [-30, 0, 25]],
    drifters: true,
    wind: true,
    solids: [{ x: 0, z: 0, r: 2 }], // tháp chuông
  },
};
