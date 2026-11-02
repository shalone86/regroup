// The place-value board: one colored lane per place (thousands, hundreds, tens, ones from left to
// right), with blocks in each lane, and the animations that move blocks and digits between lanes.
//
// Animations use the "ghost" trick: we measure where things are, update the real board right
// away (new pieces hidden), then fly look-alike ghosts in a fixed overlay from the old spots to
// the new ones and reveal the real pieces when they land. The board is always the truth.

import { PLACES } from "./math.js";
import { sfx } from "./sound.js";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speed()));
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let slowFactor = 1;
/** Watch-how lessons run animations a little slower. */
export const setSlow = (f) => { slowFactor = f; };
const speed = () => (reduced() ? 0.35 : slowFactor);

export function fxLayer() {
  let el = document.getElementById("fx");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx";
    el.setAttribute("aria-hidden", "true");
    document.body.append(el);
  }
  return el;
}
export const clearFx = () => fxLayer().replaceChildren();

// ───────────────────────── pieces ─────────────────────────

const PIECE_NAMES = ["one cube", "ten rod", "hundred flat", "thousand cube"];

export function piece(i) {
  const el = document.createElement("span");
  el.className = `pc pc-${i}`;
  el.title = PIECE_NAMES[i];
  return el;
}

/** Put n pieces of place i in a tray; the last `hidden` are invisible (they're about to land). */
export function fillTray(tray, i, n, hidden = 0) {
  const kids = [];
  for (let j = 0; j < n; j++) {
    const p = piece(i);
    if (j >= n - hidden) p.classList.add("incoming");
    kids.push(p);
  }
  tray.replaceChildren(...kids);
  tray.dataset.count = n;
  tray.classList.toggle("too-many", n > 9);
}

/** Lanes from left (biggest place) to right (ones). */
export const lanesOrder = (places) => Array.from({ length: places }, (_, k) => places - 1 - k);

export function laneHead(i) {
  const p = PLACES[i];
  return `<div class="lh"><span class="chip">${p.letter}</span><span class="lname">${p.Name}</span></div>`;
}

// ───────────────────────── motion helpers ─────────────────────────

const R = (el) => el.getBoundingClientRect();
const plain = (r) => ({ left: r.left, top: r.top, width: r.width, height: r.height });

function union(rects) {
  const left = Math.min(...rects.map((r) => r.left)), top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width)), bottom = Math.max(...rects.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
}
const centered = (box, w, h) => ({ left: box.left + box.width / 2 - w / 2, top: box.top + box.height / 2 - h / 2, width: w, height: h });

/** Put an element in the overlay at a viewport rect. */
function ghostAt(el, r) {
  el.classList.add("ghost");
  Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  fxLayer().append(el);
  return el;
}

/** Fly a ghost (placed at rect `from`) to rect `to`, optionally along an arc. */
function move(g, from, to, { dur = 600, arc = 0, delay = 0, easing = "cubic-bezier(.45,.05,.3,1)" } = {}) {
  const dx = to.left - from.left, dy = to.top - from.top;
  const sx = to.width / from.width || 1, sy = to.height / from.height || 1;
  const frames = [{ transform: "translate(0,0) scale(1,1)" }];
  if (arc) frames.push({ transform: `translate(${dx / 2}px, ${dy / 2 - arc}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2})`, offset: 0.5 });
  frames.push({ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` });
  const k = speed();
  return g.animate(frames, { duration: dur * k, delay: delay * k, easing, fill: "forwards" }).finished.catch(() => {});
}

export function pop(el, scale = 1.25) {
  if (!el?.animate) return;
  el.animate([{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }], { duration: 380 * speed(), easing: "ease-out" });
}
export function shake(el) {
  el?.animate?.([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(0)" }], { duration: 380 });
}

/** Ten small pieces (place i) laid side by side make one piece of place i+1 at rect B. */
function slice(B, i, j) {
  if (i === 1) return { left: B.left + (j * B.width) / 10, top: B.top, width: B.width / 10, height: B.height }; // rods → flat
  return { left: B.left, top: B.top + (j * B.height) / 10, width: B.width, height: B.height / 10 }; // cubes → rod, flats → cube
}

/**
 * A curved arrow across lanes that says which way the group moves.
 * fromLane/toLane are lane elements; returns immediately (the arrow fades by itself).
 */
export function arrow(fromLane, toLane, label, colorIdx) {
  if (!fromLane || !toLane) return;
  const a = R(fromLane), b = R(toLane);
  const head = fromLane.querySelector(".lh") ?? fromLane;
  const y = R(head).bottom + 2;
  const x1 = a.left + a.width / 2, x2 = b.left + b.width / 2;
  const left = Math.min(x1, x2), w = Math.abs(x2 - x1);
  const toLeft = x2 < x1;
  const el = document.createElement("div");
  el.className = `arrow c${colorIdx}`;
  Object.assign(el.style, { left: `${left}px`, top: `${y}px`, width: `${w}px` });
  const sx = toLeft ? w : 0, ex = toLeft ? 0 : w;
  el.innerHTML = `<svg viewBox="0 0 ${w} 46" width="${w}" height="46" overflow="visible">
      <path class="arrow-path" d="M ${sx} 40 C ${sx} 6, ${ex} 6, ${ex} 36" />
      <path class="arrow-head" d="M ${ex - 9} 26 L ${ex} 40 L ${ex + 9} 26" />
    </svg><span class="arrow-label">${toLeft ? "⬅ " : ""}${label}${toLeft ? "" : " ➡"}</span>`;
  fxLayer().append(el);
  const k = speed();
  el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 3200 * k, fill: "forwards" })
    .finished.then(() => el.remove(), () => el.remove());
}

/** Fly a digit (html) from one cell to another; resolves when it lands. */
export async function flyDigit(fromEl, toEl, html, cls = "", { arc = 50, dur = 900 } = {}) {
  if (!fromEl || !toEl) return;
  const a = R(fromEl), b = R(toEl);
  const g = document.createElement("span");
  g.className = `fly-digit ${cls}`;
  g.innerHTML = html;
  const size = 44;
  const from = centered(a, size, size), to = centered(b, size, size);
  ghostAt(g, from);
  pop(g, 1.4);
  await sleep(250);
  await move(g, from, to, { dur, arc });
  g.remove();
}

// ───────────────────────── block animations ─────────────────────────

/** Ghosts live outside the board, so give the overlay the board's block sizes. */
function syncSizes(el) {
  const cs = getComputedStyle(el);
  const fx = fxLayer();
  for (const v of ["--u", "--cube"]) fx.style.setProperty(v, cs.getPropertyValue(v));
}

const live = (tray) => [...tray.children].filter((c) => !c.classList.contains("incoming"));

/**
 * Trade up: 10 pieces of place i (in fromTray) snap together into 1 piece of place i+1,
 * which flies LEFT into toTray. commit() updates the board (with the new piece hidden).
 */
export async function bundle(fromTray, toTray, i, commit) {
  syncSizes(fromTray);
  const src = live(fromTray).slice(-10);
  const rects = src.map((el) => plain(R(el)));
  commit();
  const target = toTray.lastElementChild;
  if (!target || rects.length < 10) return;
  const T = plain(R(target));
  const B = centered(union(rects), T.width, T.height);
  const ghosts = rects.map((r) => ghostAt(piece(i), r));
  sfx.whoosh();
  await Promise.all(ghosts.map((g, j) => move(g, rects[j], slice(B, i, j), { dur: 650, delay: j * 40 })));
  ghosts.forEach((g) => { g.style.transition = `background ${300 * speed()}ms`; g.style.background = `var(--c${i + 1})`; });
  await sleep(380);
  sfx.snap();
  const big = ghostAt(piece(i + 1), B);
  ghosts.forEach((g) => g.remove());
  pop(big, 1.2);
  await sleep(420);
  await move(big, B, T, { dur: 1000, arc: 70 });
  target.classList.remove("incoming");
  big.remove();
  pop(target);
  sfx.pop();
}

/**
 * Trade down: 1 piece of place i+1 (from fromTray) flies RIGHT and breaks into 10 pieces of
 * place i in toTray. commit() updates the board (with the 10 new pieces hidden).
 */
export async function breakApart(fromTray, toTray, i, commit) {
  syncSizes(fromTray);
  const srcEl = live(fromTray).at(-1);
  if (!srcEl) { commit(); return; }
  const S = plain(R(srcEl));
  commit();
  const targets = [...toTray.children].slice(-10);
  const TR = targets.map((t) => plain(R(t)));
  const B = centered(union(TR), S.width, S.height);
  const big = ghostAt(piece(i + 1), S);
  sfx.whoosh();
  pop(big, 1.15);
  await sleep(200);
  await move(big, S, B, { dur: 1000, arc: 70 });
  await sleep(150);
  sfx.crack();
  const pieces = TR.map((_, j) => {
    const g = ghostAt(piece(i), slice(B, i, j));
    g.style.background = `var(--c${i + 1})`;
    return g;
  });
  big.remove();
  await sleep(120);
  pieces.forEach((g) => { g.style.transition = `background ${300 * speed()}ms`; g.style.background = `var(--c${i})`; });
  await sleep(420);
  await Promise.all(pieces.map((g, j) => move(g, slice(B, i, j), TR[j], { dur: 650, delay: j * 45, arc: 24 })));
  targets.forEach((t) => t.classList.remove("incoming"));
  pieces.forEach((g) => g.remove());
  sfx.pop();
}

/** Slide every piece of one tray into another (adding two numbers' blocks together). */
export async function merge(fromTray, toTray, commit) {
  syncSizes(fromTray);
  const src = live(fromTray);
  const rects = src.map((el) => plain(R(el)));
  const n = rects.length;
  commit();
  if (!n) return;
  const targets = [...toTray.children].slice(-n);
  const TR = targets.map((t) => plain(R(t)));
  sfx.whoosh();
  const ghosts = src.map((el, j) => ghostAt(el.cloneNode(), rects[j]));
  ghosts.forEach((g) => g.classList.remove("incoming"));
  await Promise.all(ghosts.map((g, j) => move(g, rects[j], TR[j], { dur: 700, delay: j * 30, arc: 16 })));
  targets.forEach((t) => t.classList.remove("incoming"));
  ghosts.forEach((g) => g.remove());
  sfx.pop();
}

/** One piece floats away (taking away). */
export async function vanish(el) {
  syncSizes(el);
  const r = plain(R(el));
  const g = ghostAt(el.cloneNode(), r);
  el.style.visibility = "hidden";
  sfx.away();
  await g.animate([
    { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
    { transform: "translate(0,-50px) rotate(25deg) scale(.5)", opacity: 0 },
  ], { duration: 450 * speed(), easing: "ease-in", fill: "forwards" }).finished.catch(() => {});
  g.remove();
}

/** A burst of confetti from the top of the screen. */
export function confetti(n = 60) {
  if (reduced()) return;
  const colors = ["var(--c0)", "var(--c1)", "var(--c2)", "var(--c3)", "var(--sun)"];
  for (let k = 0; k < n; k++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = colors[k % colors.length];
    fxLayer().append(c);
    c.animate([
      { transform: `translate(0,-20px) rotate(0)`, opacity: 1 },
      { transform: `translate(${(Math.random() - 0.5) * 160}px, ${60 + Math.random() * 40}vh) rotate(${Math.random() * 720}deg)`, opacity: 0.9 },
    ], { duration: 1400 + Math.random() * 1200, delay: Math.random() * 300, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" })
      .finished.then(() => c.remove(), () => c.remove());
  }
}
