import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STAGES, PROBLEMS_PER_STAGE, digits, fromDigits, addPlan, subPlan, makeStage, regroupCols, crossesZero,
  difficulty, exampleFor, starsFor, lengthOf,
} from "../public/js/math.js";

test("digits are ones first and round-trip", () => {
  assert.deepEqual(digits(347, 3), [7, 4, 3]);
  assert.deepEqual(digits(5, 2), [5, 0]);
  assert.equal(fromDigits([7, 4, 3]), 347);
});

test("addition carries 1 to the column on the left", () => {
  const p = addPlan(27, 15, 2);
  assert.deepEqual(p.cols.map((c) => c.sum), [12, 4]);
  assert.deepEqual(p.cols.map((c) => c.digit), [2, 4]);
  assert.deepEqual(p.cols.map((c) => c.carryIn), [0, 1]);
  assert.equal(p.answer, 42);
});

test("subtraction trades 1 from the left, even across zeros", () => {
  const p = subPlan(42, 17, 2);
  assert.deepEqual(p.cols.map((c) => c.work), [12, 3]);
  assert.deepEqual(p.cols.map((c) => c.digit), [5, 2]);

  const z = subPlan(5203, 1847, 4);
  assert.deepEqual(z.cols[0].chain, [2, 1]); // hundreds → tens → ones
  assert.deepEqual(z.cols.map((c) => c.work), [13, 9, 11, 4]);
  assert.equal(fromDigits(z.cols.map((c) => c.digit)), 3356);
});

test("every plan's digits spell the answer", () => {
  for (let a = 10; a < 1000; a += 7) {
    for (let b = 1; b < a; b += 13) {
      assert.equal(fromDigits(subPlan(a, b, 3).cols.map((c) => c.digit)), a - b);
      if (a + b < 1000) assert.equal(fromDigits(addPlan(a, b, 3).cols.map((c) => c.digit)), a + b);
    }
  }
});

test("generated stages always need regrouping and fit the columns", () => {
  for (const s of STAGES) {
    for (let seed = 1; seed <= 60; seed++) {
      const probs = makeStage(s, seed);
      assert.equal(probs.length, PROBLEMS_PER_STAGE);
      probs.forEach((p, i) => {
        const d = difficulty(s.places, i);
        const tag = `${s.id} seed ${seed} #${i}: ${p.a} ${p.op} ${p.b}`;
        assert.equal(lengthOf(p.a), s.places, tag);
        assert.equal(lengthOf(p.b), d.bLen, tag);
        assert.ok(regroupCols(p).length >= 1, `${tag} has no regrouping`);
        if (p.op === "add") assert.ok(p.a + p.b < 10 ** s.places, tag);
        else {
          assert.ok(p.b < p.a, tag);
          if (!d.zero) assert.ok(!crossesZero(p), `${tag} borrows across zero too early`);
        }
        if (s.op !== "mix") assert.equal(p.op, s.op, tag);
      });
      if (s.op === "mix") {
        const ops = new Set(probs.map((p) => p.op));
        assert.ok(ops.has("add") && ops.has("sub"), `${s.id} mix has both`);
      }
      assert.equal(new Set(probs.map((p) => `${p.a}${p.op}${p.b}`)).size, probs.length, "no repeats");
    }
  }
});

test("first problems are the gentlest", () => {
  for (const s of STAGES.filter((x) => x.places === 2)) {
    const [p] = makeStage(s, 3);
    assert.deepEqual(regroupCols(p), [0]);
    assert.ok(p.b < 10);
  }
});

test("watch-how examples regroup", () => {
  for (const s of STAGES) assert.ok(regroupCols(exampleFor(s)).length >= 1, s.id);
});

test("stars", () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(3), 2);
  assert.equal(starsFor(9), 1);
});

import { words, wordParts, expanded, makeRound, makeQuestion, TYPES, SENSE_LEVELS, lookalikes, explain } from "../public/js/sense.js";
import { seeded } from "../public/js/math.js";

test("number words", () => {
  assert.equal(words(47), "forty-seven");
  assert.equal(words(14), "fourteen");
  assert.equal(words(30), "thirty");
  assert.equal(words(305), "three hundred five");
  assert.equal(words(3471), "three thousand four hundred seventy-one");
  assert.equal(words(9012), "nine thousand twelve");
  assert.deepEqual(wordParts(347).map((p) => p.place), [2, 1, 0]);
});

test("expanded form leaves out zeros", () => {
  assert.equal(expanded(347), "300 + 40 + 7");
  assert.equal(expanded(3047), "3000 + 40 + 7");
  assert.equal(expanded(50), "50");
});

test("every number-sense question has its answer among unique choices", () => {
  for (const L of SENSE_LEVELS) {
    for (let seed = 1; seed <= 80; seed++) {
      const round = makeRound(L.places, seed);
      assert.equal(new Set(round.map((q) => q.type)).size, round.length, "each type once");
      assert.equal(round[0].type, "blocks", "starts with blocks");
      for (const q of round) {
        const vals = q.choices.map((c) => c.value);
        assert.ok(vals.includes(q.answer), `${q.type} ${q.n}: answer missing`);
        assert.equal(new Set(vals).size, vals.length, `${q.type} ${q.n}: duplicate choices`);
        assert.ok(vals.length >= 2, `${q.type} ${q.n}: too few choices`);
        assert.equal(String(q.n).length, L.places, `${q.type} ${q.n}: wrong size`);
        assert.ok(explain(q).length > 5, `${q.type}: explanation`);
        if (q.type === "toExpanded") assert.equal(new Set(vals.map(expanded)).size, vals.length);
        if (q.type === "toWords" || q.type === "fromWords") assert.equal(new Set(vals.map(words)).size, vals.length);
      }
    }
  }
});

test("look-alike numbers fit the places", () => {
  const rand = seeded(5);
  for (let k = 0; k < 200; k++) {
    for (const t of TYPES) makeQuestion(3, t, rand);
  }
  assert.ok(lookalikes(305, 3).includes(35), "dropping the zero is a classic mistake");
  assert.ok(lookalikes(47, 2).includes(74));
});
