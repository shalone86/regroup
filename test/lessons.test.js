import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES } from "../public/js/math.js";
import { SENSE_LEVELS } from "../public/js/sense.js";
import { introFor, senseIntro } from "../public/js/lessons.js";
import { vary, leadIn } from "../public/js/vary.js";

test("every level has a complete 'How it works' card", () => {
  const cards = [...STAGES.map(introFor), ...SENSE_LEVELS.map(senseIntro)];
  for (const c of cards) {
    for (const k of ["title", "rule", "voice", "exampleHtml"]) {
      assert.ok(c[k], `missing ${k}`);
      assert.doesNotMatch(String(c[k]), /undefined|NaN|\[object/, `${c.title}: ${k}`);
    }
  }
});

test("varied prompts never repeat twice in a row", () => {
  let prev = "";
  for (let i = 0; i < 200; i++) { const x = leadIn(); assert.notEqual(x, prev); prev = x; }
  assert.equal(vary("one", ["only"]), "only");
});
