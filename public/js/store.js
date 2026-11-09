// Settings and progress, kept in this browser's localStorage (same approach as articulation and Hablar).

import { shareSticker } from "./stickers.js";

const KEY = "regroup:v1";

const DEFAULTS = {
  settings: {
    readAloud: true, // say every step out loud (great for kids who are still learning to read)
    sounds: true, // pops, whooshes and dings
    blocks: true, // show the blocks under the numbers when a problem starts
    ttsSource: "auto", // auto | server | browser
    voice: "helena", // Workers AI (Deepgram Aura-2) English voice
    browserVoice: "",
    slow: false,
    passcode: "",
  },
  stages: {}, // id → { plays, done, stars, at }
  seen: {}, // id → array of recently seen problem keys ("op:a:b")
  stickers: [], // emoji earned, newest last
  solved: 0,
};

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s) {
      if (!s.settings?.voiceV2 && s.settings?.voice === "thalia") delete s.settings.voice;
      if (s.settings) s.settings.voiceV2 = true;
      return { ...structuredClone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...s.settings } };
    }
  } catch { /* private mode or corrupted: start fresh */ }
  return structuredClone(DEFAULTS);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
}

export const settings = () => state.settings;
export function setSetting(k, v) { state.settings[k] = v; save(); }

export const stageProgress = (id) => state.stages[id] ?? { plays: 0, done: 0, stars: 0 };
export const seenProblems = (id) => state.seen?.[id] ?? [];
export function rememberProblems(id, keys) {
  state.seen ??= {};
  const prev = state.seen[id] ?? [];
  state.seen[id] = [...prev, ...keys].slice(-25);
  save();
}
/** Stickers as { e, big }. Older saves stored plain emoji (counted as giant). */
export const stickers = () => state.stickers.map((s) => (typeof s === "string" ? { e: s, big: true } : { e: s.e ?? s.emoji, big: s.big ?? !s.mini, id: s.id }));

export const solved = () => state.solved;

export function solvedOne() { state.solved++; save(); }

/** Record a finished stage. Keeps the best stars. Returns a new sticker, if one was earned. */
/**
 * Record a finished level (keeps the best stars) and its sticker: one per level, giant with no
 * mistakes, mini otherwise; a mini sticker grows when the level is perfect later.
 * Returns { e, big, isNew, grew }.
 */
export function finishStage(id, stars, sticker, big = false) {
  const p = (state.stages[id] ??= { plays: 0, done: 0, stars: 0 });
  p.plays++;
  p.done++;
  p.stars = Math.max(p.stars, stars);
  p.at = Date.now();
  let entry = state.stickers.find((s) => s && typeof s === "object" && s.id === id);
  let isNew = false, grew = false;
  if (!entry) { entry = { e: sticker, big: !!big, id }; state.stickers.push(entry); isNew = true; }
  else if (big && !entry.big) { entry.big = true; grew = true; }
  save();
  shareSticker("regroup", id, entry.e, entry.big);
  return { e: entry.e, big: entry.big, isNew, grew };
}

export function resetProgress() { state.stages = {}; state.stickers = []; state.solved = 0; save(); }
