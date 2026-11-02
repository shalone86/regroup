// Play Mat: free play with the blocks. Add and remove pieces, bundle 10 into 1 (it moves left),
// or break 1 into 10 (it moves right), and watch the number change (or not!).

import { PLACES } from "./math.js";
import * as B from "./board.js";
import { speak, stop } from "./tts.js";
import { sfx } from "./sound.js";

const MAX = 19;

export function viewMat(app, places = 2) {
  places = Math.min(4, Math.max(2, places));
  const counts = Array(places).fill(0);
  counts[0] = 12; counts[1] = 3; // start with "too many ones" so the first thing to try is a trade
  if (places > 2) counts[2] = 1;
  if (places > 3) counts[3] = 1;
  let busy = false;

  app.innerHTML = `
    <section class="mat-view">
      <div class="mat-top">
        <h1>Play Mat</h1>
        <div class="seg" role="group" aria-label="How many lanes">
          ${[2, 3, 4].map((n) => `<a class="seg-b${n === places ? " on" : ""}" href="#/mat/${n}">${PLACES.slice(0, n).reverse().map((p) => `<span class="chipmini c${PLACES.indexOf(p)}">${p.letter}</span>`).join("")}</a>`).join("")}
        </div>
      </div>
      <p class="muted small">Tap <b>＋</b> to add blocks. When a lane has 10 or more, <b>bundle</b> 10 into 1 and it moves <b>left ⬅</b>. <b>Break</b> 1 into 10 and it moves <b>right ➡</b>. The number stays the same!</p>
      <div class="mat-value" aria-live="polite"></div>
      <div class="board mat places-${places}">
        ${B.lanesOrder(places).map((i) => `
          <div class="lane p${i}" data-i="${i}">
            ${B.laneHead(i)}
            <div class="cell big"></div>
            <div class="mat-pm"><button class="btn small" data-add="${i}" aria-label="Add one ${PLACES[i].one}">＋</button><button class="btn small" data-sub="${i}" aria-label="Remove one ${PLACES[i].one}">－</button></div>
            <div class="tray ta p${i}"></div>
            <div class="mat-trade">
              ${i < places - 1 ? `<button class="btn small trade-up" data-up="${i}">⬅ Bundle 10</button>` : ""}
              ${i > 0 ? `<button class="btn small trade-down" data-down="${i}">Break 1 ➡</button>` : ""}
            </div>
          </div>`).join("")}
      </div>
      <div class="row center">
        <button class="btn" data-random>🎲 New number</button>
        <button class="btn" data-clear>🧹 Clear</button>
        <a class="btn primary" href="#/">🏠 Done</a>
      </div>
    </section>`;

  const board = app.querySelector(".board");
  const lane = (i) => board.querySelector(`.lane[data-i="${i}"]`);
  const tray = (i) => lane(i).querySelector(".tray");
  const hidden = Array(places).fill(0);

  function paint() {
    for (let i = 0; i < places; i++) {
      const n = counts[i];
      const cell = lane(i).querySelector(".big");
      cell.innerHTML = n > 9
        ? `<b class="d c${i + 1 < places ? i + 1 : i} lead">${String(n)[0]}</b><b class="d c${i}">${String(n)[1]}</b>`
        : `<b class="d c${i}">${n}</b>`;
      cell.classList.toggle("over", n > 9);
      B.fillTray(tray(i), i, n, hidden[i]);
      lane(i).querySelector("[data-add]").disabled = n >= MAX;
      lane(i).querySelector("[data-sub]").disabled = n <= 0;
      const up = lane(i).querySelector("[data-up]");
      if (up) { up.disabled = n < 10 || counts[i + 1] >= MAX; up.classList.toggle("pulse", n >= 10); }
      const down = lane(i).querySelector("[data-down]");
      if (down) down.disabled = n < 1 || counts[i - 1] > MAX - 10;
    }
    const value = counts.reduce((s, n, i) => s + n * 10 ** i, 0);
    const over = counts.findIndex((n, i) => n > 9 && i < places - 1);
    const parts = counts.map((n, i) => `<span class="c${i}">${n} ${n === 1 ? PLACES[i].one : PLACES[i].name}</span>`).reverse().join(" + ");
    const top = over >= 0
      ? `<div class="mv-warn">Too many ${PLACES[over].name}! Bundle 10 of them ⬅</div>`
      : `<div class="mv-num">${String(value).padStart(places, "0").split("").map((ch, k) => `<b class="c${places - 1 - k}">${ch}</b>`).join("")}</div>`;
    app.querySelector(".mat-value").innerHTML = `${top}<div class="mv-parts">${parts} = <b>${value.toLocaleString("en-US")}</b></div>`;
  }

  async function guard(fn) {
    if (busy) return;
    busy = true;
    board.classList.add("busy");
    try { await fn(); } finally { busy = false; board.classList.remove("busy"); paint(); }
  }

  board.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.add) guard(async () => { counts[+t.dataset.add]++; sfx.add(counts[+t.dataset.add]); paint(); B.pop(tray(+t.dataset.add).lastElementChild, 1.4); });
    if (t.dataset.sub) guard(async () => {
      const i = +t.dataset.sub;
      const last = tray(i).lastElementChild;
      if (last) await B.vanish(last);
      counts[i]--;
    });
    if (t.dataset.up) guard(async () => {
      const i = +t.dataset.up;
      speak(`10 ${PLACES[i].name} make 1 ${PLACES[i + 1].one}. It moves to the left!`);
      B.arrow(lane(i), lane(i + 1), `10 ${PLACES[i].name} = 1 ${PLACES[i + 1].one}`, i + 1);
      await B.bundle(tray(i), tray(i + 1), i, () => { counts[i] -= 10; counts[i + 1]++; hidden[i + 1] = 1; paint(); hidden[i + 1] = 0; });
    });
    if (t.dataset.down) guard(async () => {
      const i = +t.dataset.down;
      speak(`1 ${PLACES[i].one} breaks into 10 ${PLACES[i - 1].name}. They move to the right!`);
      B.arrow(lane(i), lane(i - 1), `1 ${PLACES[i].one} = 10 ${PLACES[i - 1].name}`, i - 1);
      await B.breakApart(tray(i), tray(i - 1), i - 1, () => { counts[i]--; counts[i - 1] += 10; hidden[i - 1] = 10; paint(); hidden[i - 1] = 0; });
    });
  });
  app.querySelector("[data-random]").onclick = () => guard(async () => {
    for (let i = 0; i < places; i++) counts[i] = Math.floor(Math.random() * 10);
    counts[places - 1] ||= 1;
    if (Math.random() < 0.6) counts[0] += 10 * (counts[1] > 0 && Math.random() < 0.5 ? 0 : 1);
    sfx.pop();
  });
  app.querySelector("[data-clear]").onclick = () => guard(async () => { counts.fill(0); sfx.away(); });

  paint();
  return () => { stop(); B.clearFx(); };
}
