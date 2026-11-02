// Number Sense rounds: standard form, expanded form, number words, blocks and place value,
// as multiple-choice questions. Every place keeps its color (the help); for "which place"
// questions the number starts plain and lights up in color once it's answered.

import { PLACES } from "./math.js";
import { wordParts, expandedParts, makeRound, explain, words, senseLevel, SENSE_LEVELS, QUESTIONS_PER_ROUND } from "./sense.js";
import * as B from "./board.js";
import { speak, stop } from "./tts.js";
import { sfx } from "./sound.js";
import * as S from "./store.js";

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ───────── renderers (each place in its color) ─────────

export function numberHtml(n, places, { plain = false, mark = -1 } = {}) {
  const s = String(n).padStart(places, " ");
  return `<span class="num-big">${[...s].map((ch, k) => {
    const i = places - 1 - k;
    if (ch === " ") return "";
    return `<b class="nd ${plain ? "plain" : `c${i}`}${i === mark ? " marked" : ""}" data-place="${i}">${ch}</b>`;
  }).join("")}</span>`;
}
const expandedHtml = (n) => `<span class="exp">${expandedParts(n).map((p) => `<b class="c${p.place}">${p.value}</b>`).join(`<i> + </i>`)}</span>`;
const wordsHtml = (n) => `<span class="wrd">${wordParts(n).map((p) => `<b class="c${p.place}">${p.text}</b>`).join(" ").replace(/ <b class="c0">-/, `<b class="c0">-`)}</span>`;
const placeHtml = (i) => `<span class="plc"><span class="chipmini c${i}">${PLACES[i].letter}</span> ${PLACES[i].Name}</span>`;

function choiceHtml(c, places) {
  switch (c.kind) {
    case "number": return numberHtml(c.value, String(c.value).length);
    case "expanded": return expandedHtml(c.value);
    case "words": return wordsHtml(c.value);
    case "place": return placeHtml(c.value);
    case "digit": return `<span class="num-big"><b class="nd plain">${c.value}</b></span>`;
  }
  return String(c.value);
}

function blocksHtml(n, places) {
  const lanes = Array.from({ length: places }, (_, k) => places - 1 - k).map((i) =>
    `<div class="lane p${i}" data-i="${i}">${B.laneHead(i)}<div class="tray ta p${i}"></div></div>`).join("");
  return `<div class="board noside places-${places}">${lanes}</div>`;
}

// ───────── the round ─────────

export function viewSense(app, id, { finish }) {
  const level = senseLevel(id);
  if (!level) { location.hash = "#/"; return; }
  document.body.classList.add("in-game");
  const round = makeRound(level.places, Date.now());
  let k = 0, mistakes = 0, alive = true, lastSaid = "";

  app.innerHTML = `
    <section class="play sense">
      <div class="play-top">
        <a class="icon-btn" href="#/" aria-label="Exit">✕</a>
        <div class="dots" aria-label="Progress">${round.map((_, j) => `<i data-dot="${j}"></i>`).join("")}</div>
        <button class="icon-btn toggle" data-voice aria-pressed="${S.settings().readAloud}" title="Read aloud">🔊</button>
      </div>
      <div class="bubble" aria-live="polite">
        <span class="mascot" aria-hidden="true">${level.emoji}</span>
        <p class="say"></p>
        <button class="icon-btn replay" aria-label="Say it again">🔁</button>
      </div>
      <div class="q-card"></div>
      <div class="q-choices"></div>
      <p class="q-explain" aria-live="polite"></p>
    </section>
    <div class="dock"></div>`;
  const $ = (sel) => app.querySelector(sel);
  const dock = $(".dock");

  const say = (text) => { $(".say").textContent = text; lastSaid = text; B.pop($(".bubble"), 1.03); speak(text); };
  $("[data-voice]").onclick = (e) => {
    const on = !S.settings().readAloud;
    S.setSetting("readAloud", on);
    e.currentTarget.setAttribute("aria-pressed", on);
    sfx.toggle();
    if (!on) stop();
  };
  $(".replay").onclick = () => speak(lastSaid, { force: true });

  function show() {
    const q = round[k];
    app.querySelectorAll("[data-dot]").forEach((d) => d.classList.toggle("now", +d.dataset.dot === k));
    dock.innerHTML = "";
    $(".q-explain").textContent = "";
    const card = $(".q-card");
    const s = q.show;
    if (s.kind === "blocks") {
      card.innerHTML = blocksHtml(q.n, q.places);
      [...String(q.n).padStart(q.places, "0")].reverse().forEach((d, i) => B.fillTray(card.querySelector(`.ta.p${i}`), i, +d));
    } else if (s.kind === "number") card.innerHTML = numberHtml(q.n, q.places, { plain: s.plain, mark: s.mark ?? -1 });
    else if (s.kind === "expanded") card.innerHTML = expandedHtml(q.n);
    else if (s.kind === "words") card.innerHTML = `${wordsHtml(q.n)}<button class="icon-btn hear" aria-label="Hear the words">🔊</button>`;
    card.className = `q-card show-${s.kind}`;
    B.pop(card, 1.04);
    card.querySelector(".hear")?.addEventListener("click", () => speak(words(q.n), { force: true }));

    const kind = q.choices[0].kind;
    $(".q-choices").className = `q-choices kind-${kind} n${q.choices.length}`;
    $(".q-choices").innerHTML = q.choices.map((c, j) => `<button class="choice-card" data-j="${j}">${choiceHtml(c, q.places)}</button>`).join("");
    say(q.ask);
    let tries = 0;
    $(".q-choices").onclick = async (e) => {
      const btn = e.target.closest(".choice-card");
      if (!btn || btn.disabled || !alive) return;
      const c = q.choices[+btn.dataset.j];
      sfx.select();
      if (c.value === q.answer) return void correct(btn);
      tries++;
      mistakes++;
      btn.disabled = true;
      btn.classList.add("wrong");
      B.shake(btn);
      sfx.oops();
      if (tries >= 2) {
        const right = [...app.querySelectorAll(".choice-card")].find((b) => q.choices[+b.dataset.j].value === q.answer);
        correct(right, true);
      } else say(hint(q));
    };
  }

  function correct(btn, shown = false) {
    const q = round[k];
    app.querySelectorAll(".choice-card").forEach((b) => { b.disabled = true; });
    btn.classList.add("right");
    if (!shown) { sfx.right(); B.confetti(18); } else sfx.land();
    // Light the number up in its colors and label the places.
    $(".q-card").querySelectorAll(".nd.plain").forEach((d) => { d.classList.remove("plain"); d.classList.add(`c${d.dataset.place}`, "lit"); });
    const text = explain(q);
    $(".q-explain").textContent = text;
    const praise = shown ? "Here's the answer." : pick(["Yes!", "That's right!", "You got it!", "Great!", "Correct!"]);
    say(`${praise} ${text}`);
    app.querySelector(`[data-dot="${k}"]`)?.classList.add("done");
    S.solvedOne();
    dock.innerHTML = `<button class="btn big primary pulse" data-next>${k < round.length - 1 ? "Next ▶" : "Finish 🏁"}</button>`;
    dock.querySelector("[data-next]").onclick = () => {
      if (!alive) return;
      k++;
      if (k < round.length) show();
      else finish(level, mistakes, SENSE_LEVELS[SENSE_LEVELS.indexOf(level) + 1]);
    };
  }

  function hint(q) {
    switch (q.type) {
      case "blocks": return "Not quite. Count the blocks in each lane: each lane is one digit.";
      case "toExpanded": case "fromExpanded": return "Not quite. Look at each colored part: which place is it in?";
      case "toWords": case "fromWords": return "Not quite. Match the colors: thousands, hundreds, tens, ones.";
      case "digitIn": return `Not quite. Count places from the right: ones, tens, hundreds, thousands.`;
      case "placeOf": return `Not quite. The ones are on the far right. Count places to the left.`;
      case "valueOf": return `Not quite. A digit in the ${PLACES[q.place].name} place is worth that many ${PLACES[q.place].name}.`;
    }
    return "Try again!";
  }

  show();
  return () => { alive = false; stop(); };
}

export { QUESTIONS_PER_ROUND };
