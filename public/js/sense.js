// Number Sense: standard form, expanded form, number words, blocks and place value.
// Pure (no DOM) so it can be tested in Node. Rendering lives in senseview.js.

import { PLACES, digits, seeded } from "./math.js";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/**
 * Number words in pieces, each tagged with its place so it can be colored:
 * 3471 → [{text:"three thousand",place:3}, {text:"four hundred",place:2}, {text:"seventy",place:1}, {text:"-one",place:0}]
 * Teens ("fourteen") are one word, tagged as tens.
 */
export function wordParts(n) {
  if (n === 0) return [{ text: "zero", place: 0 }];
  const d = digits(n, 4);
  const parts = [];
  if (d[3]) parts.push({ text: `${ONES[d[3]]} thousand`, place: 3 });
  if (d[2]) parts.push({ text: `${ONES[d[2]]} hundred`, place: 2 });
  const rest = d[1] * 10 + d[0];
  if (rest >= 10 && rest < 20) parts.push({ text: ONES[rest], place: 1 });
  else {
    if (d[1]) parts.push({ text: TENS[d[1]], place: 1 });
    if (d[0]) parts.push({ text: d[1] ? `-${ONES[d[0]]}` : ONES[d[0]], place: 0 });
  }
  return parts;
}
export const words = (n) => wordParts(n).map((p) => p.text).join(" ").replace(/ -/g, "-");

/** Expanded form parts: 3047 → [{value:3000,place:3},{value:40,place:1},{value:7,place:0}] (zeros left out). */
export const expandedParts = (n, places = String(n).length) =>
  digits(n, places).map((d, i) => ({ value: d * 10 ** i, place: i, digit: d })).filter((p) => p.digit).reverse();
export const expanded = (n) => expandedParts(n).map((p) => p.value).join(" + ");

export const TYPES = ["blocks", "toExpanded", "fromExpanded", "toWords", "fromWords", "digitIn", "placeOf", "valueOf"];

export const SENSE_LEVELS = [
  { id: "sense-2", places: 2, title: "Tens & Ones", emoji: "🐸" },
  { id: "sense-3", places: 3, title: "Hundreds", emoji: "🦊" },
  { id: "sense-4", places: 4, title: "Thousands", emoji: "🐳" },
];
export const senseLevel = (id) => SENSE_LEVELS.find((l) => l.id === id);
export const QUESTIONS_PER_ROUND = 8;

const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A number with `places` digits. Bigger numbers sometimes get a 0 inside (305, 4071). */
export function pickNumber(places, rand, { distinct = false, zero = null } = {}) {
  for (;;) {
    const d = [randInt(rand, 1, 9)];
    for (let i = 1; i < places; i++) d.push(randInt(rand, 0, 9));
    const wantZero = zero ?? (places >= 3 && rand() < 0.3);
    if (!wantZero) for (let i = 1; i < places; i++) if (d[i] === 0) d[i] = randInt(rand, 1, 9);
    if (wantZero && places >= 3) d[randInt(rand, 1, places - 1)] = 0;
    if (places === 2 && d[1] === 0) d[1] = randInt(rand, 1, 9); // keep 2-digit numbers out of the "teens with 0" corner
    const n = Number(d.join(""));
    if (distinct && new Set(String(n)).size !== places) continue;
    return n;
  }
}

/** Numbers that look a lot like n: digits swapped, a zero dropped or moved, one place off by one. */
export function lookalikes(n, places) {
  const s = String(n).split("");
  const out = new Set();
  const perms = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
  for (const p of perms(s)) if (p[0] !== "0") out.add(Number(p.join("")));
  const noZero = s.filter((c) => c !== "0").join("");
  if (noZero && noZero !== s.join("")) out.add(Number(noZero));
  for (let i = 0; i < places; i++) {
    const d = digits(n, places)[i];
    if (d < 9) out.add(n + 10 ** i);
    if (d > (i === places - 1 ? 1 : 0)) out.add(n - 10 ** i);
  }
  out.delete(n);
  return [...out].filter((x) => x > 0 && x < 10 ** places);
}

/** Pick `k` wrong answers, preferring the trickiest (digit swaps and zero mistakes) first. */
function wrongs(n, places, k, rand) {
  const all = lookalikes(n, places);
  const swaps = all.filter((x) => String(x).length === String(n).length && [...String(x)].sort().join("") === [...String(n)].sort().join(""));
  const rest = all.filter((x) => !swaps.includes(x));
  return [...shuffle(swaps, rand), ...shuffle(rest, rand)].slice(0, k);
}

/**
 * One question. Shape:
 *   { type, n, places, ask, show: {kind, value, place?}, choices: [{kind, value}], answer }
 * kinds: number | expanded | words | blocks | place | digit
 */
export function makeQuestion(places, type, rand = Math.random) {
  const P = places;
  const pickPlace = () => randInt(rand, 0, P - 1);
  switch (type) {
    case "blocks": case "toExpanded": case "fromExpanded": case "toWords": case "fromWords": {
      const n = pickNumber(P, rand);
      const opts = shuffle([n, ...wrongs(n, P, 3, rand)], rand);
      const map = {
        blocks: ["blocks", "number", "What number do the blocks show?"],
        toExpanded: ["number", "expanded", "Which one is the expanded form of this number?"],
        fromExpanded: ["expanded", "number", "Put the parts together. Which number is it?"],
        toWords: ["number", "words", "Which words say this number?"],
        fromWords: ["words", "number", "Which number do these words say?"],
      }[type];
      return { type, n, places: P, ask: map[2], show: { kind: map[0], value: n }, choices: opts.map((v) => ({ kind: map[1], value: v })), answer: n };
    }
    case "digitIn": {
      const n = pickNumber(P, rand, { distinct: true, zero: false });
      const place = pickPlace();
      const answer = digits(n, P)[place];
      const opts = shuffle(digits(n, P), rand);
      return { type, n, places: P, ask: `What digit is in the ${PLACES[place].name} place?`, show: { kind: "number", value: n, plain: true }, choices: opts.map((v) => ({ kind: "digit", value: v })), answer, place };
    }
    case "placeOf": {
      const n = pickNumber(P, rand, { distinct: true, zero: false });
      const place = pickPlace();
      const digit = digits(n, P)[place];
      const opts = Array.from({ length: P }, (_, i) => P - 1 - i);
      return { type, n, places: P, ask: `What place is the ${digit} in?`, show: { kind: "number", value: n, plain: true, mark: place }, choices: opts.map((v) => ({ kind: "place", value: v })), answer: place, place, digit };
    }
    case "valueOf": {
      const n = pickNumber(P, rand, { distinct: true, zero: false });
      const place = randInt(rand, 1, P - 1);
      const digit = digits(n, P)[place];
      const answer = digit * 10 ** place;
      const set = new Set([answer, digit]);
      for (let i = 0; i < P; i++) set.add(digit * 10 ** i);
      while (set.size < 4) set.add(randInt(rand, 1, 9) * 10 ** place);
      const opts = shuffle([...set].slice(0, 4), rand);
      return { type, n, places: P, ask: `How much is the ${digit} worth in this number?`, show: { kind: "number", value: n, plain: true, mark: place }, choices: opts.map((v) => ({ kind: "number", value: v })), answer, place, digit };
    }
  }
  throw new Error(`unknown type ${type}`);
}

/** A round: every type once (8 questions), shuffled, with no repeated numbers. */
export function makeRound(places, seed = Date.now()) {
  const rand = seeded(seed);
  const types = shuffle([...TYPES], rand).slice(0, QUESTIONS_PER_ROUND);
  // Easiest first: blocks to number is a gentle start.
  types.sort((a, b) => (a === "blocks" ? -1 : b === "blocks" ? 1 : 0));
  const seen = new Set();
  return types.map((t) => {
    let q;
    do q = makeQuestion(places, t, rand);
    while (seen.has(q.n));
    seen.add(q.n);
    return q;
  });
}

/** A short explanation after answering. */
export function explain(q) {
  const parts = expandedParts(q.n, q.places);
  const ex = parts.map((p) => p.value).join(" + ");
  switch (q.type) {
    case "digitIn": return `The ${PLACES[q.place].name} digit of ${q.n} is ${q.answer}.`;
    case "placeOf": return `The ${q.digit} is in the ${PLACES[q.place].name} place.`;
    case "valueOf": return `The ${q.digit} is in the ${PLACES[q.place].name} place, so it's worth ${q.answer.toLocaleString("en-US")}.`;
    default: return `${q.n.toLocaleString("en-US")} = ${ex} = ${words(q.n)}.`;
  }
}
