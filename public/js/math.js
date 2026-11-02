// Regrouping math, kept pure so it can be tested in Node (npm test).
// Digits are stored least-significant first: digits(347, 3) → [7, 4, 3] (ones, tens, hundreds).

export const PLACES = [
  { key: "ones", name: "ones", Name: "Ones", one: "one", letter: "O", value: 1 },
  { key: "tens", name: "tens", Name: "Tens", one: "ten", letter: "T", value: 10 },
  { key: "hundreds", name: "hundreds", Name: "Hundreds", one: "hundred", letter: "H", value: 100 },
  { key: "thousands", name: "thousands", Name: "Thousands", one: "thousand", letter: "Th", value: 1000 },
];

/** "1 ten", "12 ones" */
export const count = (n, i) => `${n} ${n === 1 ? PLACES[i].one : PLACES[i].name}`;

export const WORLDS = [
  { n: 1, places: 2, title: "Tens & Ones", emoji: "🐸", blurb: "10 ones make 1 ten." },
  { n: 2, places: 3, title: "Hundreds, Tens & Ones", emoji: "🦊", blurb: "10 tens make 1 hundred." },
  { n: 3, places: 4, title: "Thousands, Hundreds, Tens & Ones", emoji: "🐳", blurb: "10 hundreds make 1 thousand." },
];

export const OPS = {
  add: { title: "Add", emoji: "➕", sign: "+" },
  sub: { title: "Take away", emoji: "➖", sign: "−" },
  mix: { title: "Mix it up", emoji: "🔀" },
};

export const STAGES = WORLDS.flatMap((w) => ["add", "sub", "mix"].map((op) => ({
  id: `${w.n}-${op}`, world: w.n, op, places: w.places,
})));
export const stageById = (id) => STAGES.find((s) => s.id === id);
export const PROBLEMS_PER_STAGE = 5;

export function digits(n, len) {
  const d = [];
  for (let i = 0; i < len; i++) d.push(Math.floor(n / 10 ** i) % 10);
  return d;
}
export const fromDigits = (d) => d.reduce((s, x, i) => s + x * 10 ** i, 0);
export const lengthOf = (n) => String(Math.abs(n)).length;

/** Column-by-column plan for a + b (right to left). */
export function addPlan(a, b, places) {
  const A = digits(a, places), B = digits(b, places);
  const cols = [];
  let carry = 0;
  for (let i = 0; i < places; i++) {
    const sum = A[i] + B[i] + carry;
    cols.push({ i, top: A[i], bot: B[i], carryIn: carry, sum, digit: sum % 10, regroup: sum >= 10 });
    carry = sum >= 10 ? 1 : 0;
  }
  return { cols, answer: a + b, overflow: carry };
}

/**
 * Column-by-column plan for a − b (right to left), the standard US algorithm.
 * A column that is short "trades" with the nearest column on its left that has something;
 * zeros in between become 10 and then 9 (borrowing across zeros). `chain` lists the columns
 * that each give 1 to the column on their right, from left to right.
 */
export function subPlan(a, b, places) {
  const work = digits(a, places), B = digits(b, places);
  const cols = [];
  for (let i = 0; i < places; i++) {
    const before = work[i];
    const chain = [];
    if (work[i] < B[i]) {
      let j = i + 1;
      while (j < places && work[j] === 0) j++;
      if (j >= places) throw new Error("a must be larger than b");
      for (let k = j; k > i; k--) {
        work[k] -= 1;
        work[k - 1] += 10;
        chain.push(k);
      }
    }
    cols.push({ i, top: before, work: work[i], bot: B[i], digit: work[i] - B[i], regroup: chain.length > 0, chain });
  }
  return { cols, answer: a - b };
}

export const plan = (p) => (p.op === "add" ? addPlan(p.a, p.b, p.places) : subPlan(p.a, p.b, p.places));
export const regroupCols = (p) => plan(p).cols.filter((c) => c.regroup).map((c) => c.i);
export const crossesZero = (p) => p.op === "sub" && plan(p).cols.some((c) => c.chain.length > 1);

/** Small seeded random generator so a stage can be replayed (and tested). */
export function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const randDigits = (rand, len) => randInt(rand, 10 ** (len - 1), 10 ** len - 1);

/**
 * How hard problem `index` (0-based) of a stage is. Problems start easy (the bottom number has
 * fewer digits, one trade, in the ones) and grow toward several trades.
 *   bLen:  digits in the bottom number
 *   cols:  exact columns that must regroup (or null)
 *   min/max: how many columns regroup
 *   zero:  subtraction may borrow across a zero
 */
export function difficulty(places, index) {
  if (places === 2) {
    return [
      { bLen: 1, cols: [0] }, { bLen: 1, cols: [0] }, { bLen: 2, cols: [0] }, { bLen: 2, cols: [0] }, { bLen: 2, cols: [0] },
    ][Math.min(index, 4)];
  }
  if (places === 3) {
    return [
      { bLen: 2, cols: [0] }, { bLen: 3, cols: [1] }, { bLen: 3, min: 1, max: 1 }, { bLen: 3, min: 2, max: 2 }, { bLen: 3, min: 2, max: 2, zero: true },
    ][Math.min(index, 4)];
  }
  return [
    { bLen: 3, min: 1, max: 1 }, { bLen: 4, min: 1, max: 2 }, { bLen: 4, min: 2, max: 2 }, { bLen: 4, min: 2, max: 3, zero: true }, { bLen: 4, min: 3, max: 3, zero: true },
  ][Math.min(index, 4)];
}

/** The operation of problem `index` in a stage ("mix" alternates, starting with add or sub). */
export function opFor(stage, index, mixStart = 0) {
  if (stage.op !== "mix") return stage.op;
  return (index + mixStart) % 2 ? "sub" : "add";
}

export function makeProblem(stage, index, rand = Math.random, mixStart = 0) {
  const places = stage.places;
  const op = opFor(stage, index, mixStart);
  const d = difficulty(places, index);
  for (let tries = 0; tries < 20000; tries++) {
    const a = randDigits(rand, places);
    const b = randDigits(rand, d.bLen);
    if (op === "add" && a + b >= 10 ** places) continue;
    if (op === "sub" && b >= a) continue;
    const p = { op, a, b, places };
    if (fits(p, d)) return p;
  }
  // Never expected, but a stage must never hang.
  return op === "add" ? { op, a: 10 ** (places - 1) + 7, b: 5, places } : { op, a: 10 ** (places - 1) + 3, b: 6, places };
}

export function fits(p, d) {
  const rc = regroupCols(p);
  if (!rc.length) return false;
  if (d.cols && (rc.length !== d.cols.length || d.cols.some((c) => !rc.includes(c)))) return false;
  if (d.min && rc.length < d.min) return false;
  if (d.max && rc.length > d.max) return false;
  if (p.op === "sub") {
    if (!d.zero && crossesZero(p)) return false;
    // Keep the bottom number's ones from being 0 (nothing to do in the very first step).
    if (digits(p.b, p.places)[0] === 0) return false;
  }
  return true;
}

export function makeStage(stage, seed = Date.now()) {
  const rand = seeded(seed);
  const mixStart = Math.floor(rand() * 2);
  const out = [];
  for (let i = 0; i < PROBLEMS_PER_STAGE; i++) {
    let p;
    do p = makeProblem(stage, i, rand, mixStart);
    while (out.some((q) => q.a === p.a && q.b === p.b));
    out.push(p);
  }
  return out;
}

/** A fixed, friendly example for the "Watch how" lesson of each stage. */
export function exampleFor(stage) {
  const ex = {
    2: { add: { a: 27, b: 15 }, sub: { a: 42, b: 17 } },
    3: { add: { a: 258, b: 167 }, sub: { a: 432, b: 158 } },
    4: { add: { a: 2476, b: 1658 }, sub: { a: 5203, b: 1847 } },
  }[stage.places];
  const op = stage.op === "mix" ? "add" : stage.op;
  return { op, places: stage.places, ...ex[op] };
}

/** Stars for a finished stage of 5 problems, from the number of wrong answers. */
export const starsFor = (mistakes) => (mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1);
