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
