// "How it works" cards shown before the first problem of each level (kit lesson.js).
// Built from each level's own worked example, so the numbers match "Watch how".

import { PLACES, WORLDS, exampleFor, plan, digits } from "./math.js";

const c = (i, text) => `<b class="c${i}">${text}</b>`; // text in a place's color
const name = (i) => PLACES[i].name;
const one = (i) => PLACES[i].one;
const step = (html) => `<div class="lesson-step lesson-focus">${html}</div>`;
const colored = (n, places) => digits(n, places).map((d, i) => c(i, d)).reverse().join("").replace(/^(<b class="c\d">0<\/b>)+/, "");

function addCard(stage, w) {
  const ex = exampleFor({ ...stage, op: "add" });
  const P = ex.places;
  const col = plan(ex).cols.find((x) => x.regroup);
  const i = col.i;
  return {
    emoji: w.emoji,
    title: "Adding with a trade",
    rule: `Add one lane at a time, starting with the ${c(0, "ones")}. When a lane gets <b>10 or more</b>, trade 10 of them for 1 of the next lane. It moves <b>left ⬅</b>.`,
    exampleHtml: `
      <p class="lesson-problem">${colored(ex.a, P)} + ${colored(ex.b, P)}</p>
      ${step(`${c(i, `${col.carryIn ? "1 + " : ""}${col.top} + ${col.bot} = ${col.sum} ${name(i)}`)}: that's 10 or more!`)}
      ${step(`10 ${c(i, name(i))} → 1 ${c(i + 1, one(i + 1))}, and it moves left ⬅`)}
      ${step(`${colored(ex.a, P)} + ${colored(ex.b, P)} = ${colored(ex.a + ex.b, P)} ✅`)}`,
    voice: `Add one lane at a time, starting with the ones. When a lane gets ten or more, trade ten of them for one of the next lane, and it moves left. For example, ${ex.a} plus ${ex.b}: ${col.carryIn ? "1 plus " : ""}${col.top} plus ${col.bot} is ${col.sum} ${name(i)}. That's ten or more, so ten ${name(i)} become one ${one(i + 1)}. The answer is ${ex.a + ex.b}.`,
  };
}

function subCard(stage, w) {
  const ex = exampleFor({ ...stage, op: "sub" });
  const P = ex.places;
  const col = plan(ex).cols.find((x) => x.regroup);
  const i = col.i;
  return {
    emoji: w.emoji,
    title: "Taking away with a trade",
    rule: `Take away one lane at a time, starting with the ${c(0, "ones")}. If there aren't enough, trade 1 from the next lane for 10. It moves <b>right ➡</b>.`,
    exampleHtml: `
      <p class="lesson-problem">${colored(ex.a, P)} − ${colored(ex.b, P)}</p>
      ${step(`${c(i, `${col.top} − ${col.bot}`)}? Not enough ${c(i, name(i))}!`)}
      ${step(`1 ${c(i + 1, one(i + 1))} → 10 ${c(i, name(i))}, and it moves right ➡. Now ${c(i, `${col.work} − ${col.bot} = ${col.digit}`)}`)}
      ${step(`${colored(ex.a, P)} − ${colored(ex.b, P)} = ${colored(ex.a - ex.b, P)} ✅`)}`,
    voice: `Take away one lane at a time, starting with the ones. If there aren't enough, trade one from the next lane for ten, and it moves right. For example, ${ex.a} minus ${ex.b}: ${col.top} take away ${col.bot}? Not enough! Trade one ${one(i + 1)} for ten ${name(i)}. Now ${col.work} take away ${col.bot} is ${col.digit}. The answer is ${ex.a - ex.b}.`,
  };
}

/** The card for a play level. */
export function introFor(stage) {
  const w = WORLDS[stage.world - 1];
  if (stage.op === "add") return addCard(stage, w);
  if (stage.op === "sub") return subCard(stage, w);
  return {
    emoji: w.emoji,
    title: "Adding and taking away",
    rule: "Look at the sign first! <b>+</b>: when a lane gets 10 or more, trade it <b>left ⬅</b>. <b>−</b>: when a lane doesn't have enough, trade from the left, and it moves <b>right ➡</b>.",
    exampleHtml: `
      ${step(`<b>+</b> 10 ${c(0, "ones")} → 1 ${c(1, "ten")} ⬅`)}
      ${step(`<b>−</b> 1 ${c(1, "ten")} → 10 ${c(0, "ones")} ➡`)}`,
    voice: "Look at the sign first! When you add and a lane gets ten or more, trade it to the left. When you take away and a lane doesn't have enough, trade from the left, and it moves right.",
  };
}

/** The card for a Number Sense round. */
export function senseIntro(level) {
  const n = { 2: 47, 3: 347, 4: 2347 }[level.places] ?? 347;
  const P = level.places;
  const parts = digits(n, P).map((d, i) => ({ d, i })).reverse();
  const words = { 47: "forty-seven", 347: "three hundred forty-seven", 2347: "two thousand three hundred forty-seven" }[n];
  return {
    emoji: level.emoji,
    title: "Every digit has a place",
    rule: `Each digit's <b>place</b> tells what it's worth: ${parts.map(({ i }) => c(i, PLACES[i].name)).join(", ")}.`,
    exampleHtml: `
      <p class="lesson-problem">${colored(n, P)}</p>
      ${step(parts.map(({ d, i }) => c(i, d * 10 ** i)).join(" + "))}
      ${step(words)}`,
    voice: `Each digit's place tells what it's worth. ${n} is ${parts.map(({ d, i }) => d * 10 ** i).join(" plus ")}. We say it: ${words}.`,
  };
}
