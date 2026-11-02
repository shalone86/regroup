// Little sound effects made with Web Audio (no files to download).

import { settings } from "./store.js";

let ctx;
function ac() {
  if (!settings().sounds) return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq, { at = 0, dur = 0.12, type = "sine", vol = 0.18, slide = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => tone(660, { dur: 0.06, type: "triangle", vol: 0.1 }),
  pop: () => tone(520, { dur: 0.09, type: "triangle", slide: 1.8 }),
  whoosh: () => tone(300, { dur: 0.35, type: "sawtooth", vol: 0.05, slide: 3 }),
  snap: () => { tone(880, { dur: 0.08, type: "square", vol: 0.06 }); tone(1320, { at: 0.06, dur: 0.1, type: "triangle" }); },
  crack: () => { tone(700, { dur: 0.06, type: "square", vol: 0.06 }); tone(350, { at: 0.05, dur: 0.12, type: "triangle", slide: 0.6 }); },
  right: () => { tone(660, { dur: 0.1 }); tone(990, { at: 0.09, dur: 0.18 }); },
  oops: () => tone(220, { dur: 0.22, type: "triangle", vol: 0.14, slide: 0.8 }),
  away: () => tone(500, { dur: 0.12, type: "sine", vol: 0.12, slide: 0.5 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.11, dur: 0.22, type: "triangle", vol: 0.16 })),
};
