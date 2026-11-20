// Âm thanh tổng hợp bằng WebAudio (không dùng file asset). Tắt hoàn toàn ở headless vì không được import ở đó.
export function makeAudio(getVolume) {
  let ctx = null; let master = null; let musicNodes = null;
  const ensure = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.connect(ctx.destination);
    }
    master.gain.value = getVolume();
    return ctx;
  };
  const tone = (freq, dur, type = 'sine', vol = 0.3, slide = 0) => {
    const c = ensure(); const t = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur);
  };
  const SFX = {
    pick: () => tone(1200, 0.12, 'sine', 0.15, 400),
    lit: () => { tone(523, 0.4, 'triangle', 0.3); setTimeout(() => tone(784, 0.6, 'triangle', 0.3), 120); },
    pulse: () => tone(300, 0.5, 'sine', 0.35, 600),
    hit: () => tone(180, 0.35, 'sawtooth', 0.25, -120),
    jump: () => tone(400, 0.15, 'square', 0.08, 300),
    dash: () => tone(700, 0.15, 'sawtooth', 0.08, -400),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'triangle', 0.3), i * 150)),
    lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'sine', 0.3), i * 220)),
    spawn: () => tone(90, 0.6, 'sawtooth', 0.12, -40),
    tick: () => tone(1000, 0.05, 'square', 0.1),
    wind: () => tone(200, 1.5, 'sawtooth', 0.05, 200),
  };
  return {
    unlock: () => ensure(),
    sfx: (name) => { try { SFX[name]?.(); } catch {} },
    music: (on) => {
      try {
        const c = ensure();
        if (on && !musicNodes) {
          const g = c.createGain(); g.gain.value = 0.05; g.connect(master);
          const os = [110, 164.8, 220.5].map((f) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(); return o; });
          musicNodes = { g, os };
        } else if (!on && musicNodes) { musicNodes.os.forEach((o) => o.stop()); musicNodes = null; }
      } catch {}
    },
  };
}
