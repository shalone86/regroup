// Big Number Board: Parent & Teacher Presentation Tool for Regroup!
// Type any number (0 to 9,999) to display it big in standard form,
// expanded form, and written number words with place-value colors.

import { PLACES, digits } from "./math.js";
import { words, wordParts, expandedParts, expanded } from "./sense.js";
import { speak, stop } from "./tts.js";
import { sfx } from "./sound.js";
import * as B from "./board.js";

const PRESETS = [7, 42, 305, 1284, 5000, 9999];

export function viewShow(app, initialNumber = 347) {
  let currentNum = Math.min(9999, Math.max(0, Math.floor(Number(initialNumber) || 0)));
  if (isNaN(currentNum)) currentNum = 347;
  let showBlocks = true;

  app.innerHTML = `
    <section class="show-number-section">
      <div class="show-head">
        <h1>Big Number Board</h1>
        <p class="muted small">Type any number (0 to 9,999) to see it written out, in standard form, and in expanded form with place-value colors.</p>
      </div>

      <!-- Input card -->
      <div class="card show-input-card">
        <div class="show-input-row">
          <input type="number" id="show-num-input" class="show-num-input" min="0" max="9999" value="${currentNum}" placeholder="0 - 9999">
          <button class="btn big primary" data-update>Show Big ✨</button>
        </div>
        <div class="show-presets-row">
          <span class="muted small">Quick numbers:</span>
          ${PRESETS.map((n) => `<button class="btn small" data-set-num="${n}">${n.toLocaleString()}</button>`).join(" ")}
          <button class="btn small" data-random-num>🎲 Random</button>
          <button class="btn small danger" data-clear-num>Clear</button>
        </div>
      </div>

      <!-- Display Card -->
      <div class="card show-display-card">
        <!-- 1. Standard Form -->
        <div class="show-block-section" data-speak-type="standard" title="Tap to hear standard form">
          <div class="show-section-top">
            <span class="show-section-label">Standard Form:</span>
            <button class="icon-btn small-speak" data-speak-btn="standard" aria-label="Listen to standard form">🔊</button>
          </div>
          <div class="show-standard-digits" id="show-standard"></div>
        </div>

        <hr class="show-divider">

        <!-- 2. Expanded Form -->
        <div class="show-block-section" data-speak-type="expanded" title="Tap to hear expanded form">
          <div class="show-section-top">
            <span class="show-section-label">Expanded Form:</span>
            <button class="icon-btn small-speak" data-speak-btn="expanded" aria-label="Listen to expanded form">🔊</button>
          </div>
          <div class="show-expanded-row" id="show-expanded"></div>
        </div>

        <hr class="show-divider">

        <!-- 3. Word Form -->
        <div class="show-block-section" data-speak-type="words" title="Tap to hear number words">
          <div class="show-section-top">
            <span class="show-section-label">In Words (Written Form):</span>
            <button class="icon-btn small-speak" data-speak-btn="words" aria-label="Listen to number words">🔊</button>
          </div>
          <div class="show-words-row" id="show-words"></div>
        </div>

        <!-- 4. Visual Blocks Tray -->
        <div class="show-blocks-container" id="show-blocks-box">
          <hr class="show-divider">
          <div class="show-blocks-header">
            <span class="show-section-label">Place-Value Blocks:</span>
            <label class="show-toggle-label">
              <input type="checkbox" id="show-blocks-toggle" ${showBlocks ? "checked" : ""}>
              <span>Show Blocks</span>
            </label>
          </div>
          <div class="show-blocks-trays" id="show-blocks-trays"></div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="row center mt-4">
        <button class="btn big primary" data-speak-all>🔊 Read All Aloud</button>
        <a class="btn big" href="#/numbers">🔢 Number Sense</a>
        <a class="btn big" href="#/">🏠 Home</a>
      </div>
    </section>`;

  const inputEl = app.querySelector("#show-num-input");
  const standardEl = app.querySelector("#show-standard");
  const expandedEl = app.querySelector("#show-expanded");
  const wordsEl = app.querySelector("#show-words");
  const blocksTraysEl = app.querySelector("#show-blocks-trays");
  const blocksBox = app.querySelector("#show-blocks-box");

  function render() {
    const n = currentNum;
    const sLen = String(n).length;
    const numPlaces = Math.max(1, sLen);
    const d = digits(n, numPlaces);

    // 1. Standard Form
    const standardHtml = [];
    for (let i = numPlaces - 1; i >= 0; i--) {
      standardHtml.push(`
        <div class="standard-digit-col">
          <b class="standard-digit c${i}">${d[i]}</b>
          <span class="chipmini c${i}">${PLACES[i].letter}</span>
        </div>`);
      if (i === 3) standardHtml.push(`<span class="standard-comma">,</span>`);
    }
    standardEl.innerHTML = standardHtml.join("");

    // 2. Expanded Form
    const expParts = expandedParts(n);
    if (expParts.length === 0) {
      expandedEl.innerHTML = `<span class="expanded-piece"><b class="c0">0</b></span>`;
    } else {
      expandedEl.innerHTML = expParts.map((p, i) => `
        <span class="expanded-piece">
          <b class="c${p.place}">${p.value.toLocaleString()}</b>
        </span>
      `).join(` <span class="expanded-plus">+</span> `);
    }

    // 3. Word Form
    const wParts = wordParts(n);
    wordsEl.innerHTML = wParts.map((p) => `<b class="c${p.place} word-part">${p.text}</b>`).join(" ").replace(/ -/g, "-");

    // 4. Place-Value Blocks
    if (showBlocks) {
      blocksBox.style.display = "block";
      const trayPlaces = Math.min(4, Math.max(2, numPlaces));
      const trayLanes = B.lanesOrder(trayPlaces);

      blocksTraysEl.innerHTML = `
        <div class="board show-board places-${trayPlaces}">
          ${trayLanes.map((i) => `
            <div class="lane p${i}" data-i="${i}">
              ${B.laneHead(i)}
              <div class="cell big"><b class="d c${i}">${d[i] || 0}</b></div>
              <div class="tray ta p${i}" id="show-tray-${i}"></div>
            </div>
          `).join("")}
        </div>`;

      trayLanes.forEach((i) => {
        const trayEl = blocksTraysEl.querySelector(`#show-tray-${i}`);
        if (trayEl) B.fillTray(trayEl, i, d[i] || 0);
      });
    } else {
      blocksBox.style.display = "none";
    }
  }

  // Event handlers
  app.querySelector("[data-update]").onclick = () => {
    currentNum = Math.min(9999, Math.max(0, Math.floor(Number(inputEl.value) || 0)));
    inputEl.value = currentNum;
    sfx.click();
    render();
  };

  inputEl.onkeydown = (e) => {
    if (e.key === "Enter") {
      currentNum = Math.min(9999, Math.max(0, Math.floor(Number(inputEl.value) || 0)));
      inputEl.value = currentNum;
      sfx.click();
      render();
    }
  };

  app.querySelectorAll("[data-set-num]").forEach((btn) => {
    btn.onclick = () => {
      currentNum = Number(btn.dataset.setNum);
      inputEl.value = currentNum;
      sfx.select();
      render();
    };
  });

  app.querySelector("[data-random-num]").onclick = () => {
    const places = Math.floor(Math.random() * 4) + 1;
    currentNum = places === 1 ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * (10 ** places - 10 ** (places - 1))) + 10 ** (places - 1);
    inputEl.value = currentNum;
    sfx.pop();
    render();
  };

  app.querySelector("[data-clear-num]").onclick = () => {
    currentNum = 0;
    inputEl.value = 0;
    sfx.back();
    render();
  };

  app.querySelector("#show-blocks-toggle").onchange = (e) => {
    showBlocks = e.target.checked;
    sfx.toggle();
    render();
  };

  // Section speech handlers
  app.querySelectorAll("[data-speak-btn]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const type = btn.dataset.speakBtn;
      sfx.click();
      if (type === "standard") speak(`${currentNum}.`, { force: true });
      else if (type === "expanded") speak(`${expanded(currentNum)}.`, { force: true });
      else if (type === "words") speak(`${words(currentNum)}.`, { force: true });
    };
  });

  app.querySelector("[data-speak-all]").onclick = () => {
    sfx.right();
    const spokenText = `Standard form: ${currentNum}. Expanded form: ${expanded(currentNum)}. In words: ${words(currentNum)}.`;
    speak(spokenText, { force: true });
  };

  render();

  return () => {
    stop();
  };
}
