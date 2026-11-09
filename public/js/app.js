// Regroup! A trading game for first and second graders: 10 ones make 1 ten (it moves left),
// 1 ten breaks into 10 ones (it moves right). Plain ES modules, no build step (same setup as
// the articulation and Hablar apps).

import { PLACES, WORLDS, OPS, STAGES, stageById, makeStage, exampleFor, starsFor, PROBLEMS_PER_STAGE } from "./math.js";
import { Game } from "./game.js";
import { viewMat } from "./mat.js";
import * as B from "./board.js";
import { speak, stop, browserVoices, preload } from "./tts.js";
import { health } from "./api.js";
import { sfx } from "./sound.js";
import * as S from "./store.js";
import { viewSense } from "./senseview.js";
import { showLesson } from "./lesson.js";
import { introFor } from "./lessons.js";
import { keepDockVisible } from "./dock.js";
import { SENSE_LEVELS, words } from "./sense.js";
import { viewShow } from "./show.js";
import { jingleOnce } from "./jingle.js";
import { vary } from "./vary.js";
import { STICKER_WORLD } from "./stickers.js";

const app = document.getElementById("app");
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const STICKERS = ["🦄", "🚀", "🦖", "🌈", "🐙", "🎈", "🦋", "🐢", "🌟", "🐝", "🦕", "🐼", "🐬", "🐶", "🐱", "🐴", "🐑", "🐸",
  "🦉", "🐞", "🦊", "🐻", "🐧", "🐳", "🦒", "🐘", "🐰", "🦆", "🚂", "🚁", "⛵", "🚒", "🚜", "🎠", "🏰", "🏡", "⛪", "🌳", "🌻",
  "🍄", "🌷", "⛲", "🧸", "🪁", "🍩", "🍦", "🍉", "🕊️", "👼", "🐟"];

const starsHtml = (n) => `<span class="stars" aria-label="${n} of 3 stars">${"★".repeat(n)}<span class="off">${"★".repeat(3 - n)}</span></span>`;
const placeChips = (places) => PLACES.slice(0, places).reverse().map((p, k) => `<span class="chipmini c${places - 1 - k}">${p.letter}</span>`).join("");

/** The stage the big Play button opens: first unfinished, then the first without 3 stars. */
function nextStage() {
  return STAGES.find((s) => !S.stageProgress(s.id).done)
    ?? STAGES.find((s) => S.stageProgress(s.id).stars < 3)
    ?? STAGES[0];
}

// ───────────────────────── router ─────────────────────────

let cleanup = null;
const routes = [
  [/^$/, viewHome],
  [/^play\/([\w-]+)$/, viewPlay],
  [/^watch\/([\w-]+)$/, viewWatch],
  [/^mat(?:\/(\d))?$/, (n) => viewMat(app, Number(n ?? 2))],
  [/^numbers$/, viewNumbers],
  [/^show(?:\/(\d+))?$/, (n) => viewShow(app, n !== undefined ? Number(n) : 347)],
  [/^sense\/([\w-]+)$/, (id) => viewSense(app, id, { finish: finishSense })],
  [/^grownups$/, viewGrownups],
];

function route() {
  try { cleanup?.(); } catch (e) { console.warn(e); }
  cleanup = null;
  stop();
  B.clearFx();
  B.setSlow(1);
  document.body.classList.remove("in-game");
  const path = location.hash.replace(/^#\/?/, "");
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === (path.split("/")[0] || "home")));
      // Only keep real cleanup functions (an async view returns a Promise, which isn't one).
      const out = fn(...m.slice(1));
      cleanup = typeof out === "function" ? out : null;
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = "#/";
}
window.addEventListener("hashchange", route);

// ───────────────────────── home ─────────────────────────

function viewHome() {
  const next = nextStage();
  const nw = WORLDS[next.world - 1];
  const stickers = S.stickers();
  app.innerHTML = `
    <section class="hero">
      <h1 class="title" aria-label="Regroup!"><span class="c3">R</span><span class="c2">e</span><span class="c1">g</span><span class="c0">r</span><span class="c3">o</span><span class="c2">u</span><span class="c1">p</span><span class="c0">!</span></h1>
      <p class="lede">Trade <b class="c0">10 ones</b> for <b class="c1">1 ten</b>. It moves <b>left</b> ⬅<br>Break <b class="c1">1 ten</b> into <b class="c0">10 ones</b>. It moves <b>right</b> ➡</p>
      <a class="btn big primary play-btn" href="#/play/${next.id}">▶ Play</a>
      <p class="muted small">${nw.emoji} ${esc(nw.title)} · ${OPS[next.op].emoji} ${OPS[next.op].title}</p>
      <nav class="grade-jump" aria-label="Jump to a grade">
        ${WORLDS.map((w) => `<button type="button" class="grade-chip" data-grade="${w.n}">${w.emoji} Grade ${w.n}</button>`).join("")}
      </nav>
    </section>

    <div class="legend" aria-label="Place value colors">
      ${PLACES.slice().reverse().map((p, k) => `<div class="legend-i c${3 - k}"><span class="pc pc-${3 - k} mini"></span><b>${p.Name}</b></div>`).join("")}
    </div>

    ${WORLDS.map((w) => `
      <section class="world w${w.n}" id="grade-${w.n}">
        <div class="world-head">
          <span class="world-emoji" aria-hidden="true">${w.emoji}</span>
          <div><h2>${placeChips(w.places)} Grade ${w.n}: ${esc(w.title)}</h2><p class="muted small">${esc(w.blurb)}</p></div>
        </div>
        <div class="stage-grid">
          ${STAGES.filter((s) => s.world === w.n).map((s) => {
            const pr = S.stageProgress(s.id);
            return `<div class="stage-card${pr.done ? " done" : ""}${s.id === next.id ? " next" : ""}">
              <a class="stage-main" href="#/play/${s.id}"><span class="stage-emoji">${OPS[s.op].emoji}</span><b>${OPS[s.op].title}</b>${starsHtml(pr.stars)}</a>
              <a class="stage-watch" href="#/watch/${s.id}" aria-label="Watch how: ${OPS[s.op].title}">🎬 Watch how</a>
            </div>`;
          }).join("")}
        </div>
      </section>`).join("")}

    ${senseSection()}

    <div class="row gap-md wrap mt-3">
      <a class="mat-card" href="#/mat/2" style="flex: 1 1 240px; margin-top: 0;">
        <span class="mat-icon" aria-hidden="true"><span class="pc pc-1 mini"></span><span class="pc pc-0 mini"></span><span class="pc pc-0 mini"></span></span>
        <span><b>Play Mat</b><br><span class="muted small">Build numbers with blocks. Bundle and break them yourself.</span></span>
      </a>
      <a class="mat-card" href="#/show" style="flex: 1 1 240px; margin-top: 0;">
        <span class="mat-icon" aria-hidden="true" style="font-size: 1.8rem; display: flex; align-items: center; justify-content: center;">🔢</span>
        <span><b>Big Number Board</b><br><span class="muted small">Type any number to show standard, expanded & word forms big.</span></span>
      </a>
    </div>

    <section class="sticker-book">
      <h2>My stickers <small>${S.solved()} problems solved</small></h2>
      ${stickers.length ? `<div class="stickers">${stickers.map((s) => `<span class="${s.big ? "big" : "mini"}">${s.e}</span>`).join("")}</div>
        <a class="btn world-link" href="${STICKER_WORLD}">🌍 Play in Sticker World</a>` : `<p class="muted small">Finish a level to get your first sticker! No mistakes makes it a giant one.</p>`}
    </section>`;
  app.querySelectorAll("[data-grade]").forEach((btn) => {
    btn.onclick = () => document.getElementById(`grade-${btn.dataset.grade}`)?.scrollIntoView({ behavior: "smooth" });
  });
}

// ───────────────────────── number sense ─────────────────────────

function senseSection() {
  return `
    <section class="world sense-home">
      <div class="world-head">
        <span class="world-emoji" aria-hidden="true">🔢</span>
        <div><h2>Number Sense</h2><p class="muted small">Numbers, words, expanded form, blocks and places. What number is in the tens place?</p></div>
      </div>
      <div class="stage-grid">
        ${SENSE_LEVELS.map((L) => {
          const pr = S.stageProgress(L.id);
          return `<div class="stage-card${pr.done ? " done" : ""}">
            <a class="stage-main" href="#/sense/${L.id}"><span class="stage-emoji">${L.emoji}</span><span>${placeChips(L.places)}</span><b>${L.title}</b>${starsHtml(pr.stars)}</a>
          </div>`;
        }).join("")}
      </div>
      <p class="sense-sample small muted"><b class="c2">300</b> + <b class="c1">40</b> + <b class="c0">7</b> = <b class="c2">3</b><b class="c1">4</b><b class="c0">7</b> = <b class="c2">three hundred</b> <b class="c1">forty</b><b class="c0">-seven</b></p>
    </section>`;
}

function viewNumbers() {
  app.innerHTML = `<h1>Number Sense</h1>
    <p class="muted">8 questions a round: read the blocks, match standard form, expanded form and number words (both ways), and find what digit is in each place and how much it's worth.</p>
    <div class="row mb-3">
      <a class="btn primary" href="#/show">🔢 Open Big Number Board</a>
    </div>
    ${senseSection()}`;
}

function finishSense(level, mistakes, next) {
  showFinish({
    id: level.id, stars: starsFor(Math.max(0, mistakes - 1)), mistakes,
    title: pick(["Number star!", "You know your numbers!", "Super number sense!", "Wow!"]),
    done: `${level.title}: 8 questions done.`,
    again: `#/sense/${level.id}`,
    next: next ? { href: `#/sense/${next.id}`, label: `Next: ${next.emoji} ${next.title} ▶` } : null,
  });
}

// ───────────────────────── play a stage ─────────────────────────

function playShell(stage, { watch = false } = {}) {
  document.body.classList.add("in-game");
  const w = WORLDS[stage.world - 1];
  app.innerHTML = `
    <section class="play">
      <div class="play-top">
        <a class="icon-btn" href="#/" aria-label="Exit">✕</a>
        <div class="dots" aria-label="Progress">${watch ? `<span class="watch-tag">🎬 Watch how</span>` : Array.from({ length: PROBLEMS_PER_STAGE }, (_, k) => `<i data-dot="${k}"></i>`).join("")}</div>
        <button class="icon-btn toggle" data-blocks aria-pressed="true" title="Show blocks">🧱</button>
        <button class="icon-btn toggle" data-voice aria-pressed="${S.settings().readAloud}" title="Read aloud">🔊</button>
      </div>
      <div class="bubble" aria-live="polite">
        <span class="mascot" aria-hidden="true">${w.emoji}</span>
        <p class="say"></p>
        <button class="icon-btn replay" aria-label="Say it again">🔁</button>
      </div>
      <div class="board-wrap"></div>
    </section>
    <div class="dock"></div>`;
  const els = { bubble: app.querySelector(".bubble"), board: app.querySelector(".board-wrap"), dock: app.querySelector(".dock") };
  const blocksBtn = app.querySelector("[data-blocks]");
  const voiceBtn = app.querySelector("[data-voice]");
  return { els, blocksBtn, voiceBtn };
}

function wireToggles(shell, getGame) {
  let blocks = S.settings().blocks;
  shell.blocksBtn.setAttribute("aria-pressed", blocks);
  shell.blocksBtn.onclick = () => {
    blocks = !blocks;
    shell.blocksBtn.setAttribute("aria-pressed", blocks);
    getGame()?.setBlocks(blocks);
    sfx.toggle();
  };
  shell.voiceBtn.onclick = () => {
    const on = !S.settings().readAloud;
    S.setSetting("readAloud", on);
    shell.voiceBtn.setAttribute("aria-pressed", on);
    sfx.toggle();
    if (!on) stop();
  };
  shell.els.bubble.querySelector(".replay").onclick = () => {
    const g = getGame();
    if (g?.lastSaid) speak(g.lastSaid, { force: true });
  };
  return () => blocks;
}

function viewPlay(id) {
  const stage = stageById(id);
  if (!stage) { location.hash = "#/"; return; }
  const shell = playShell(stage);
  let game = null;
  let alive = true;
  const blocksOn = wireToggles(shell, () => game);
  const problems = makeStage(stage, Date.now(), S.seenProblems(stage.id));
  S.rememberProblems(stage.id, problems.map((p) => `${p.op}:${p.a}:${p.b}`));
  let mistakes = 0;

  (async () => {
    // "How it works" card first (Listen / Skip / Start), like Grammar and Doubles.
    shell.els.bubble.querySelector(".say").textContent = "Here's how it works!";
    await showLesson(shell.els.board, introFor(stage));
    if (!alive) return;
    for (let k = 0; k < problems.length && alive; k++) {
      app.querySelectorAll("[data-dot]").forEach((d) => d.classList.toggle("now", +d.dataset.dot === k));
      game = new Game(problems[k], shell.els, { blocks: blocksOn(), index: k });
      const res = await game.run();
      if (!res || !alive) return;
      mistakes += res.mistakes;
      S.solvedOne();
      app.querySelector(`[data-dot="${k}"]`)?.classList.add(res.mistakes ? "assisted" : "done"); // yellow if it took a mistake
      await nextButton(shell.els.dock, k < problems.length - 1 ? "Next problem ▶" : "Finish 🏁");
      if (!alive) return;
      game.destroy();
    }
    if (alive) finishStage(stage, mistakes);
  })();

  return () => { alive = false; game?.destroy(); };
}

function nextButton(dock, label) {
  dock.innerHTML = `<button class="btn big primary pulse" data-next>${label}</button>`;
  return new Promise((resolve) => {
    const go = () => { document.removeEventListener("keydown", onKey); resolve(); };
    const onKey = (e) => { if (e.key === "Enter") go(); };
    dock.querySelector("[data-next]").onclick = go;
    document.addEventListener("keydown", onKey);
  });
}

function finishStage(stage, mistakes) {
  const next = STAGES[STAGES.indexOf(stage) + 1];
  showFinish({
    id: stage.id, stars: starsFor(mistakes), mistakes,
    title: pick(["Amazing trading!", "You did it!", "Super star!", "Regroup champion!"]),
    done: `${PROBLEMS_PER_STAGE} problems done.`,
    again: `#/play/${stage.id}`,
    next: next ? { href: `#/play/${next.id}`, label: `Next: ${OPS[next.op].emoji} ${OPS[next.op].title}${next.world !== stage.world ? ` · ${WORLDS[next.world - 1].emoji}` : ""} ▶` } : null,
  });
}

function showFinish({ id, stars, mistakes, title, done, again, next }) {
  document.body.classList.remove("in-game");
  const perfect = mistakes === 0;
  const st = S.finishStage(id, stars, pick(STICKERS), perfect);
  sfx.fanfare();
  B.confetti(perfect ? 100 : 45);
  const line = st.grew ? "Your sticker grew into a GIANT sticker!"
    : st.isNew && st.big ? "A giant sticker! No mistakes at all!"
    : st.isNew ? "A mini sticker! Play again with no mistakes to make it giant."
    : st.big ? (perfect ? "No mistakes at all. Wow!" : done)
    : perfect ? "" : "No mistakes next time, and your mini sticker grows giant!";
  const label = st.grew ? "It grew! 🌟" : st.isNew ? (st.big ? "Giant sticker!" : "Mini sticker!") : st.big ? "Your giant sticker" : "Your mini sticker";
  app.innerHTML = `
    <section class="finish">
      <div class="big-stars">${starsHtml(stars)}</div>
      <h1>${perfect ? vary("perfect", ["Perfect!", "No mistakes!", "Super star!"]) : title}</h1>
      <p class="new-sticker ${st.big ? "big-sticker" : "mini-sticker"}${st.grew ? " grew" : ""}"><span>${st.e}</span><br>${label}</p>
      ${line ? `<p class="muted">${esc(line)}</p>` : ""}
      <div class="row center">
        <a class="btn big${st.big ? "" : " primary"}" href="${again}" data-again>🔁 ${st.big ? "Play again" : "Try for giant!"}</a>
        ${next ? `<a class="btn big${st.big ? " primary" : ""}" href="${next.href}">${next.label}</a>` : `<a class="btn big${st.big ? " primary" : ""}" href="#/">🏠 Home</a>`}
      </div>
      <p><a class="btn world-link" href="${STICKER_WORLD}">🌍 Play in Sticker World</a></p>
    </section>`;
  speak(st.grew ? "Wow! Your sticker grew into a giant sticker!"
    : st.isNew && st.big ? vary("giant", ["You did it with no mistakes! You got a giant sticker!", "Perfect! Here's a giant sticker!"])
    : st.isNew ? vary("mini", ["You did it! You got a mini sticker. Play again with no mistakes to make it giant!", "Nice work! Here's a mini sticker. No mistakes next time makes it giant!"])
    : perfect ? "You did it! No mistakes!" : "You did it!");
  app.querySelector("[data-again]").onclick = (e) => { e.preventDefault(); route(); };
}

// ───────────────────────── watch how (auto-play lesson) ─────────────────────────

function viewWatch(id) {
  const stage = stageById(id);
  if (!stage) { location.hash = "#/"; return; }
  const shell = playShell(stage, { watch: true });
  B.setSlow(1.25);
  let game = null;
  let alive = true;
  wireToggles(shell, () => game);
  (async () => {
    game = new Game(exampleFor(stage), shell.els, { auto: true, blocks: true });
    const res = await game.run();
    if (!res || !alive) return;
    B.setSlow(1);
    speak("Now it's your turn!");
    shell.els.dock.innerHTML = `<div class="row center"><a class="btn big" href="#/watch/${stage.id}" data-again>🔁 Watch again</a><a class="btn big primary pulse" href="#/play/${stage.id}">▶ My turn!</a></div>`;
    shell.els.dock.querySelector("[data-again]").onclick = (e) => { e.preventDefault(); route(); };
  })();
  return () => { alive = false; game?.destroy(); };
}

// ───────────────────────── grown-ups ─────────────────────────

async function viewGrownups() {
  const s = S.settings();
  const toggle = (k, label, sub) => `<label class="set"><span><b>${label}</b><br><span class="muted small">${sub}</span></span><input type="checkbox" data-k="${k}" ${s[k] ? "checked" : ""}></label>`;
  app.innerHTML = `
    <section>
      <h1>For grown-ups</h1>
      <div class="card">
        ${toggle("readAloud", "Read aloud", "Says every step out loud, for kids who are still learning to read.")}
        ${toggle("slow", "Slower voice", "")}
        ${toggle("sounds", "Sound effects", "Pops, whooshes and dings.")}
        ${toggle("blocks", "Start with blocks showing", "Kids can always tap 🧱 to show or hide the blocks.")}
        <label class="set"><span><b>Voice</b><br><span class="muted small" data-voice-status>Checking…</span></span>
          <select data-k="ttsSource"><option value="auto">Best available</option><option value="server">Cloudflare voice</option><option value="browser">This device's voice</option></select></label>
        <label class="set"><span><b>Cloudflare Voice Character</b><br><span class="muted small">Aura-2 Neural Voice (Helena is warm & clear)</span></span>
          <select data-k="voice">
            <option value="helena">Helena (Warm & Natural)</option>
            <option value="thalia">Thalia (Clear & Bright)</option>
            <option value="luna">Luna (Gentle & Calm)</option>
            <option value="asteria">Asteria (Lively)</option>
            <option value="aurora">Aurora (Expressive)</option>
            <option value="apollo">Apollo (Friendly)</option>
            <option value="orion">Orion (Deep)</option>
          </select></label>
        <label class="set"><span><b>Passcode</b><br><span class="muted small">Only if you set APP_PASSCODE on the Worker.</span></span><input type="password" data-k="passcode" value="${esc(s.passcode)}" autocomplete="off"></label>
        <div class="row"><button class="btn small" data-test>🔊 Test the voice</button><button class="btn small danger" data-reset>Reset progress</button></div>
      </div>

      <h2>How the game teaches regrouping</h2>
      <div class="card prose">
        <p>Every place has its own color, everywhere in the game: <b class="c0">ones</b>, <b class="c1">tens</b>, <b class="c2">hundreds</b>, <b class="c3">thousands</b>. The numbers sit in colored lanes, and the blocks sit right under them in the same lanes, so a digit and its blocks always match.</p>
        <p><b>Adding:</b> kids push the blocks together, count, and when there are 10 or more, they tap the ones (the blocks, or the lane when the blocks are hidden) to trade. Ten cubes snap into a rod, turn green and fly <b>left</b> into the tens lane, while the little 1 flies left to the top of the tens column at the same time.</p>
        <p><b>Taking away:</b> kids decide whether there are enough. If not, they do the trade themselves: tap the 4 in the tens to take 1 ten (it becomes 3), then tap the ones to move it over. The rod flies <b>right</b> and breaks into 10 cubes, and the 2 becomes 12. When a lane doesn't change, they tap its number to bring it down. Then they tap blocks to take them away and count what's left.</p>
        <p>Levels: ${WORLDS.map((w) => `${w.emoji} ${esc(w.title)}`).join(" → ")}. Each has Add, Take away and Mix, five problems each. Problems start gentle (one trade, a 1-digit number) and grow to several trades, including taking away across a zero.</p>
        <p>Hide the blocks (🧱) to practice with just the numbers; the moving digits still show the trade. The <b>Play Mat</b> is free play: bundle and break as much as you like.</p>
        <p class="muted small">Progress is saved in this browser only. Nothing is sent anywhere except the sentences that are read aloud, if the Cloudflare voice is on.</p>
      </div>
    </section>`;
  app.querySelector('[data-k="ttsSource"]').value = s.ttsSource;
  const voiceSelect = app.querySelector('[data-k="voice"]');
  if (voiceSelect && s.voice) voiceSelect.value = s.voice;
  app.querySelectorAll("[data-k]").forEach((el) => {
    el.onchange = () => S.setSetting(el.dataset.k, el.type === "checkbox" ? el.checked : el.value);
  });
  app.querySelector("[data-test]").onclick = () => speak("Ten ones make one ten. It moves to the left!", { force: true });
  app.querySelector("[data-reset]").onclick = () => {
    if (confirm("Reset all stars and stickers?")) { S.resetProgress(); location.hash = "#/"; }
  };
  const h = await health();
  const st = app.querySelector("[data-voice-status]");
  if (st) st.textContent = h.tts ? "Cloudflare voice is available." : `Using this device's voice${browserVoices().length ? "" : " (if it has one)"}.`;
}

// ───────────────────────── sounds for every press ─────────────────────────
// Buttons that make their own sound (number keys, answer choices, blocks, toggles) are skipped.
const OWN_SOUND = ".key, .choice, .choice-card, [data-add], [data-sub], [data-up], [data-down], [data-blocks], [data-voice], .toggle";
document.addEventListener("click", (e) => {
  const el = e.target.closest("button, a");
  if (!el || el.matches(OWN_SOUND) || el.disabled) return;
  sfx.click();
}, true);

// ───────────────────────── start ─────────────────────────

jingleOnce("regroup", () => S.settings().sounds); // the app's little logo sound, on the first tap
route();
keepDockVisible();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

// Warm the voice for the words said over and over (praise, the usual lines, number names).
preload([
  "Yes!", "That's right!", "You got it!", "Great!", "Correct!", "Awesome!", "Super trading!", "Great job!", "Wow!",
  "You did it!", "Here's the answer.", "You did it! You got a new sticker!", "Now it's your turn!",
  "Ten ones make one ten. It moves to the left!",
  ...Array.from({ length: 21 }, (_, n) => words(n)),
]);
