// Settings and progress, kept in this browser's localStorage (same approach as articulation and Hablar).

const KEY = "regroup:v1";

const DEFAULTS = {
  settings: {
    readAloud: true, // say every step out loud (great for kids who are still learning to read)
    sounds: true, // pops, whooshes and dings
    blocks: true, // show the blocks under the numbers when a problem starts
    ttsSource: "auto", // auto | server | browser
    voice: "thalia", // Workers AI (Deepgram Aura-2) English voice
    browserVoice: "",
    slow: false,
    passcode: "",
  },
  stages: {}, // id → { plays, done, stars, at }
  stickers: [], // emoji earned, newest last
  solved: 0,
};

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s) return { ...structuredClone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...s.settings } };
  } catch { /* private mode or corrupted: start fresh */ }
  return structuredClone(DEFAULTS);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
}

export const settings = () => state.settings;
export function setSetting(k, v) { state.settings[k] = v; save(); }

export const stageProgress = (id) => state.stages[id] ?? { plays: 0, done: 0, stars: 0 };
export const stickers = () => state.stickers;
export const solved = () => state.solved;

export function solvedOne() { state.solved++; save(); }

/** Record a finished stage. Keeps the best stars. Returns a new sticker, if one was earned. */
export function finishStage(id, stars, sticker) {
  const p = (state.stages[id] ??= { plays: 0, done: 0, stars: 0 });
  const first = !p.done;
  p.plays++;
  p.done++;
  p.stars = Math.max(p.stars, stars);
  p.at = Date.now();
  let earned = null;
  if (sticker && (first || stars === 3)) { state.stickers.push(sticker); earned = sticker; }
  save();
  return earned;
}

export function resetProgress() { state.stages = {}; state.stickers = []; state.solved = 0; save(); }
