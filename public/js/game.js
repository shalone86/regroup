// One problem, step by step, right to left, with blocks and numbers side by side in colored lanes.
// The same code runs a "Watch how" lesson: with auto=true it presses the buttons itself.

import { PLACES, OPS, count, digits, lengthOf, plan } from "./math.js";
import * as B from "./board.js";
import { speak, stop } from "./tts.js";
import { sfx } from "./sound.js";

class Abort extends Error {}

const name = (i) => PLACES[i].name;
const one = (i) => PLACES[i].one;
const dg = (n, i, cls = "") => `<b class="d c${i} ${cls}">${n}</b>`;
/** Write a number in a lane: a 2-digit value in lane i shows its first digit in lane i+1's color. */
const dgs = (v, i, cls = "") => String(v).split("").map((ch, k, all) => dg(ch, i + (all.length - 1 - k), k === 0 && all.length > 1 ? `${cls} lead` : cls)).join("");

/** Turn on-screen text into something nice to hear. */
export function spoken(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\p{Extended_Pictographic}|️/gu, "")
    .replace(/\s*=\s*\?/g, " equals what?")
    .replace(/\s*−\s*/g, " minus ")
    .replace(/\s*\+\s*/g, " plus ")
    .replace(/\s*=\s*/g, " equals ")
    .replace(/[⬅➡]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export class Game {
  /**
   * els: { bubble, board, dock } elements. opts: { auto, blocks, mascot }
   */
  constructor(prob, els, opts = {}) {
    this.p = prob;
    this.P = prob.places;
    this.els = els;
    this.auto = !!opts.auto;
    this.blocks = opts.blocks ?? true;
    this.mistakes = 0;
    this.dead = false;
    this.pending = null;
    this.plan = plan(prob);
    this.lenB = lengthOf(prob.b);
    // board state
    this.tray = { a: digits(prob.a, this.P), b: prob.op === "add" ? digits(prob.b, this.P) : Array(this.P).fill(0) };
    this.hidden = { a: Array(this.P).fill(0), b: Array(this.P).fill(0) };
    this.work = digits(prob.a, this.P); // subtraction: top digits as they change
    this.carry = Array(this.P).fill(""); // html in the small top row
    this.struck = Array(this.P).fill(false);
    this.ans = Array(this.P).fill("");
    this.note = Array(this.P).fill(""); // "take away 5" under a tray
    this.active = -1;
    this.build();
  }

  // ───────────── lifecycle ─────────────

  destroy() {
    this.dead = true;
    stop();
    this.pending?.reject(new Abort());
    this.offKeys?.();
    B.clearFx();
  }

  wait(ms) { return B.sleep(ms).then(() => { if (this.dead) throw new Abort(); }); }

  /** A promise the UI resolves; destroy() rejects it. */
  input(setup) {
    return new Promise((resolve, reject) => {
      this.pending = { reject };
      setup((v) => { this.pending = null; resolve(v); });
    }).then((v) => { if (this.dead) throw new Abort(); return v; });
  }

  async run() {
    try {
      const { a, b, op } = this.p;
      await this.say(op === "add" ? `Let's add ${a} + ${b}! Start with the ones.` : `Let's take away: ${a} − ${b}. Start with the ones.`);
      for (let i = 0; i < this.P; i++) {
        this.setActive(i);
        if (op === "add") await this.addColumn(i);
        else await this.subColumn(i);
      }
      this.setActive(-1);
      return await this.finish();
    } catch (e) {
      if (e instanceof Abort) return null;
      throw e;
    }
  }

  // ───────────── drawing ─────────────

  build() {
    const { op } = this.p;
    const sign = OPS[op].sign;
    const lanes = B.lanesOrder(this.P).map((i) => `
      <div class="lane p${i}" data-i="${i}">
        ${B.laneHead(i)}
        <div class="cell carry"></div>
        <div class="cell top"></div>
        <div class="cell bot"></div>
        <div class="cell ans"></div>
        <div class="trays">
          <div class="tray ta p${i}"></div>
          ${op === "add" ? `<div class="tray-sep">+</div><div class="tray tb p${i}"></div>` : `<div class="tray-note"></div>`}
        </div>
      </div>`).join("");
    this.els.board.innerHTML = `
      <div class="board places-${this.P} op-${op}${this.blocks ? "" : " no-blocks"}">
        <div class="signs"><div class="lh"></div><div class="cell carry"></div><div class="cell top"></div><div class="cell bot">${sign}</div><div class="cell ans"></div></div>
        ${lanes}
      </div>`;
    this.boardEl = this.els.board.firstElementChild;
    this.lane = {};
    this.boardEl.querySelectorAll(".lane").forEach((el) => { this.lane[el.dataset.i] = el; });
    this.paint();
  }

  q(i, sel) { return this.lane[i]?.querySelector(sel); }

  paint() {
    const A = digits(this.p.a, this.P), Bd = digits(this.p.b, this.P);
    for (let i = 0; i < this.P; i++) {
      this.q(i, ".carry").innerHTML = this.carry[i];
      this.q(i, ".top").innerHTML = dg(A[i], i, this.struck[i] ? "struck" : "");
      this.q(i, ".bot").innerHTML = i < this.lenB ? dg(Bd[i], i) : "";
      this.q(i, ".ans").innerHTML = this.ans[i];
      B.fillTray(this.q(i, ".ta"), i, this.tray.a[i], this.hidden.a[i]);
      const tb = this.q(i, ".tb");
      if (tb) B.fillTray(tb, i, this.tray.b[i], this.hidden.b[i]);
      const note = this.q(i, ".tray-note");
      if (note) note.innerHTML = this.note[i];
    }
  }

  setActive(i) {
    this.active = i;
    Object.values(this.lane).forEach((el) => el.classList.toggle("active", +el.dataset.i === i));
    this.boardEl.classList.toggle("focusing", i >= 0);
    if (i >= 0) this.lane[i].scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  setBlocks(on) {
    this.blocks = on;
    this.boardEl.classList.toggle("no-blocks", !on);
  }

  /** Show (and say) a message. In a lesson, wait until it's been said. */
  async say(html, { wait } = {}) {
    if (this.dead) throw new Abort();
    const p = this.els.bubble.querySelector(".say");
    p.innerHTML = html;
    B.pop(this.els.bubble, 1.03);
    this.lastSaid = spoken(html);
    const talking = speak(this.lastSaid);
    if (this.auto || wait) {
      await Promise.all([talking, this.wait(1400)]);
      await this.wait(250);
    }
  }

  // ───────────── controls in the dock ─────────────

  dock(html) {
    this.offKeys?.();
    this.offKeys = null;
    this.els.dock.innerHTML = html;
    this.els.dock.dataset.place = this.active;
  }

  /** One big button (and optionally tapping some blocks does the same thing). */
  action(label, { tap = null, small = "" } = {}) {
    this.dock(`<button class="btn big primary pulse" data-go>${label}</button>${small ? `<p class="hint">${small}</p>` : ""}`);
    const btn = this.els.dock.querySelector("[data-go]");
    if (tap && this.blocks) tap.classList.add("tappable");
    return this.input((done) => {
      const go = () => { sfx.tap(); tap?.classList.remove("tappable"); if (tap) tap.onclick = null; this.dock(""); done(); };
      btn.onclick = go;
      if (tap && this.blocks) tap.onclick = go;
      if (this.auto) this.wait(1100).then(() => { btn.classList.add("pressed"); return this.wait(250); }).then(go, () => {});
    });
  }

  /** Yes / no style question. Returns once the right choice has been made. */
  async choice(options, correct, wrongMsg) {
    let first = true;
    for (;;) {
      this.dock(`<div class="choices">${options.map((o, k) => `<button class="btn big choice" data-k="${k}">${o.label}</button>`).join("")}</div>`);
      const pick = await this.input((done) => {
        this.els.dock.querySelectorAll("[data-k]").forEach((b) => { b.onclick = () => { sfx.tap(); done(options[+b.dataset.k].value); }; });
        if (this.auto) {
          const k = options.findIndex((o) => o.value === correct);
          this.wait(1300).then(() => { this.els.dock.querySelector(`[data-k="${k}"]`)?.classList.add("pressed"); return this.wait(300); })
            .then(() => done(correct), () => {});
        }
      });
      if (pick === correct) { sfx.right(); this.dock(""); return first; }
      first = false;
      this.mistakes++;
      sfx.oops();
      await this.say(wrongMsg, { wait: true });
      this.dock("");
      return false;
    }
  }

  /** The number pad. Typed digits appear in the active lane's answer box. */
  numberPad({ correct, alt = null, hint, row = "ans" }) {
    const i = this.active;
    const cell = this.q(i, `.${row}`);
    const len = String(correct).length;
    let typed = "";
    let tries = 0;
    let timer = 0;
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    this.dock(`<div class="pad">${keys.map((n) => `<button class="key" data-n="${n}">${n}</button>`).join("")}
      <button class="key back" data-back aria-label="Delete">⌫</button><button class="key ok" data-ok aria-label="Check">✓</button></div>`);
    const show = () => { cell.innerHTML = typed ? `<span class="typing">${dgs(typed, i)}</span>` : `<span class="typing empty">?</span>`; };
    show();
    cell.classList.add("asking");
    return this.input((done) => {
      const finish = (v) => { cell.classList.remove("asking"); this.dock(""); done(v); };
      const check = async () => {
        clearTimeout(timer);
        const v = Number(typed);
        if (!typed) return;
        if (v === correct || (alt !== null && v === alt)) { sfx.right(); finish(v); return; }
        tries++;
        this.mistakes++;
        sfx.oops();
        B.shake(cell);
        typed = "";
        show();
        if (tries >= 2) {
          await this.say(`It's ${correct}. Let's write it in!`, { wait: true }).catch(() => {});
          finish(correct);
        } else {
          this.boardEl.classList.add("counts");
          this.say(hint ?? `Not quite. Try again!`).catch(() => {});
        }
      };
      const later = () => { clearTimeout(timer); timer = setTimeout(check, 350); };
      const press = (n) => {
        clearTimeout(timer);
        sfx.tap();
        if (typed.length >= 2) typed = "";
        typed += n;
        show();
        if (alt !== null && Number(typed) === alt && len > 1 && typed.length === 1) return later();
        if (typed.length >= len) later();
      };
      this.els.dock.querySelectorAll("[data-n]").forEach((b) => { b.onclick = () => press(b.dataset.n); });
      this.els.dock.querySelector("[data-back]").onclick = () => { typed = typed.slice(0, -1); show(); };
      this.els.dock.querySelector("[data-ok]").onclick = check;
      const onKey = (e) => {
        if (/^\d$/.test(e.key)) press(e.key);
        else if (e.key === "Backspace") { typed = typed.slice(0, -1); show(); }
        else if (e.key === "Enter") check();
      };
      document.addEventListener("keydown", onKey);
      this.offKeys = () => document.removeEventListener("keydown", onKey);
      if (this.auto) {
        (async () => {
          await this.wait(1200);
          for (const ch of String(correct)) {
            const k = this.els.dock.querySelector(`[data-n="${ch}"]`);
            k?.classList.add("pressed");
            typed += ch;
            sfx.tap();
            show();
            await this.wait(450);
            k?.classList.remove("pressed");
          }
          await this.wait(300);
          sfx.right();
          finish(correct);
        })().catch(() => {});
      }
    });
  }

  /** Tap n pieces in lane i to take them away. */
  takeAway(i, n) {
    const tray = this.q(i, ".ta");
    let left = n;
    const label = () => `Take away ${count(n, i)}. Tap ${left === n ? n : `${left} more`}!`;
    this.els.bubble.querySelector(".say").innerHTML = label();
    speak(spoken(label()));
    this.dock(`<button class="btn small ghosty" data-all>✋ Take them away for me</button>`);
    tray.classList.add("tappable-each");
    return this.input((done) => {
      let busy = false;
      const removeOne = async (el) => {
        if (busy || left <= 0 || !el?.classList.contains("pc")) return;
        busy = true;
        left--;
        await B.vanish(el);
        this.tray.a[i]--;
        this.paint();
        busy = false;
        if (left > 0) this.els.bubble.querySelector(".say").innerHTML = label();
        else { tray.classList.remove("tappable-each"); tray.onclick = null; this.dock(""); done(); }
      };
      tray.onclick = (e) => removeOne(e.target.closest(".pc"));
      const all = async () => {
        this.dock("");
        while (left > 0 && !this.dead) {
          const pcs = [...this.q(i, ".ta").children];
          await removeOne(pcs.at(-1));
          await B.sleep(120);
        }
      };
      this.els.dock.querySelector("[data-all]").onclick = all;
      if (this.auto) this.wait(900).then(all, () => {});
    });
  }

  // ───────────── addition ─────────────

  async addColumn(i) {
    const c = this.plan.cols[i];
    const terms = [c.carryIn ? 1 : null, c.top, i < this.lenB ? c.bot : null].filter((x) => x !== null);
    if (terms.length === 1) {
      this.ans[i] = dgs(c.digit, i, "fresh");
      this.paint();
      await this.say(`No more ${name(i)} to add. Bring down the ${c.top}.`, { wait: true });
      return;
    }
    if (this.blocks && this.tray.b[i] > 0) {
      await this.say(`${PLACES[i].Name} first. Push the ${name(i)} together!`);
      await this.action("🤲 Push together", { tap: this.q(i, ".trays") });
      await this.mergeCol(i);
    } else {
      this.tray.a[i] += this.tray.b[i];
      this.tray.b[i] = 0;
      this.paint();
    }
    await this.say(`How many ${name(i)}? ${terms.join(" + ")} = ?`);
    const v = await this.numberPad({
      correct: c.sum,
      alt: c.regroup ? c.digit : null,
      hint: this.blocks ? `Count the ${PLACES[i].name} in the ${PLACES[i].Name} lane!` : `Start at ${Math.max(...terms)} and count up.`,
    });
    if (c.regroup) {
      this.ans[i] = dgs(c.sum, i, "fresh");
      this.paint();
      const intro = v === c.sum ? `Yes! ${c.sum} ${name(i)}!` : `Yes, ${c.digit} goes here!`;
      await this.say(`${intro} That's too many for one lane. 10 ${name(i)} make 1 ${one(i + 1)}. Trade them, and the ${one(i + 1)} moves LEFT ⬅`);
      await this.action(`🔁 Trade 10 ${name(i)} for 1 ${one(i + 1)}`, { tap: this.q(i, ".ta"), small: this.blocks ? `or tap the ${name(i)}` : "" });
      await this.tradeUp(i);
      await this.say(`${count(c.digit, i)} stay here, and 1 ${one(i + 1)} moved over to the ${name(i + 1)}!`, { wait: true });
    } else {
      this.ans[i] = dgs(c.digit, i, "fresh");
      this.paint();
      B.pop(this.q(i, ".ans"));
      await this.say(`Yes! ${count(c.sum, i)}.`, { wait: this.auto });
      if (!this.auto) await this.wait(700);
    }
  }

  async mergeCol(i) {
    await B.merge(this.q(i, ".tb"), this.q(i, ".ta"), () => {
      const n = this.tray.b[i];
      this.tray.a[i] += n;
      this.tray.b[i] = 0;
      this.hidden.a[i] = n;
      this.paint();
      this.hidden.a[i] = 0;
    });
  }

  /** 10 in lane i → 1 in lane i+1, in the blocks and in the numbers at the same time. */
  async tradeUp(i) {
    const c = this.plan.cols[i];
    B.arrow(this.lane[i], this.lane[i + 1], `10 ${name(i)} = 1 ${one(i + 1)}`, i + 1);
    const blocks = this.blocks
      ? B.bundle(this.q(i, ".ta"), this.q(i + 1, ".ta"), i, () => {
        this.tray.a[i] -= 10;
        this.tray.a[i + 1] += 1;
        this.hidden.a[i + 1] = 1;
        this.paint();
        this.hidden.a[i + 1] = 0;
      })
      : (this.tray.a[i] -= 10, this.tray.a[i + 1] += 1, Promise.resolve());
    const numbers = (async () => {
      await this.wait(this.blocks ? 900 : 200);
      const lead = this.q(i, ".ans .lead") ?? this.q(i, ".ans");
      const fly = B.flyDigit(lead, this.q(i + 1, ".carry"), dg(1, i + 1), "", { arc: 60, dur: 1000 });
      this.ans[i] = dgs(c.digit, i, "fresh");
      this.q(i, ".ans").innerHTML = this.ans[i];
      await fly;
      this.carry[i + 1] = dg(1, i + 1, "carried");
      B.pop(this.q(i + 1, ".carry"), 1.5);
    })();
    await Promise.all([blocks, numbers]);
    this.paint();
    B.pop(this.q(i + 1, ".carry .d"), 1.4);
  }

  // ───────────── subtraction ─────────────

  async subColumn(i) {
    const c = this.plan.cols[i];
    const bot = c.bot;
    const work = this.work[i];
    const lastNonZero = Math.max(0, ...this.plan.cols.filter((x) => x.digit).map((x) => x.i));
    if (bot === 0) {
      if (work === 0 && i > lastNonZero) {
        this.ans[i] = "";
        this.paint();
        await this.say(`No ${name(i)} left. We're done with this lane!`, { wait: true });
        return;
      }
      this.ans[i] = dg(work, i, "fresh");
      this.paint();
      await this.say(`No ${name(i)} to take away. Bring down the ${work}.`, { wait: true });
      return;
    }
    const enough = work >= bot;
    await this.say(`We have ${count(work, i)}. Is that enough to take away ${bot}?`);
    await this.choice(
      [{ label: "✅ Yes, enough!", value: true }, { label: "🔁 No, trade!", value: false }],
      enough,
      enough ? `We have ${work}. That's enough to take away ${bot}! No trade needed.` : `We only have ${count(work, i)}. We can't take away ${bot}! Let's trade.`,
    );
    if (!enough) {
      const chain = c.chain;
      const giver = chain[0];
      if (chain.length > 1) {
        await this.say(`Oh no, there are no ${name(i + 1)} to trade! Let's open up 1 ${one(giver)} first. It moves RIGHT ➡`);
      } else {
        await this.say(`Trade 1 ${one(i + 1)} for 10 ${name(i)}. The ${one(i + 1)} moves RIGHT ➡ and breaks into 10 ${name(i)}.`);
      }
      await this.action(`🔁 Trade 1 ${one(giver)} for 10 ${name(giver - 1)}`, { tap: this.q(giver, ".ta"), small: this.blocks ? `or tap the ${name(giver)}` : "" });
      for (const k of chain) {
        await this.tradeDown(k);
        if (k - 1 > i) await this.say(`Now we have 10 ${name(k - 1)}. Trade 1 ${one(k - 1)} for 10 ${name(k - 2)}!`, { wait: true });
      }
      await this.say(`Now we have ${count(this.work[i], i)}!`, { wait: true });
    }
    this.note[i] = `take away <b class="c${i}">${bot}</b>`;
    this.paint();
    if (this.blocks) await this.takeAway(i, bot);
    else { this.tray.a[i] -= bot; this.paint(); }
    await this.say(`${this.work[i]} − ${bot} = ?`);
    await this.numberPad({ correct: c.digit, hint: this.blocks ? `Count the ${name(i)} that are left!` : `Start at ${this.work[i]} and count back ${bot}.` });
    const leadingZero = c.digit === 0 && i > lastNonZero;
    this.ans[i] = dg(c.digit, i, leadingZero ? "fresh zero-lead" : "fresh");
    this.paint();
    B.pop(this.q(i, ".ans"));
    if (leadingZero) await this.say(`${this.work[i]} − ${bot} = 0. A 0 in front doesn't change the number, so we can leave it out.`, { wait: true });
    else if (!this.auto) await this.wait(500);
  }

  /** Lane k gives 1 to lane k−1, which gets 10: blocks fly right and break; digits change. */
  async tradeDown(k) {
    const i = k - 1;
    B.arrow(this.lane[k], this.lane[i], `1 ${one(k)} = 10 ${name(i)}`, i);
    const fromCell = this.carry[k] ? this.q(k, ".carry") : this.q(k, ".top");
    this.work[k] -= 1;
    this.struck[k] = true;
    this.carry[k] = dg(this.work[k], k, "fresh");
    this.paint();
    const blocks = this.blocks
      ? B.breakApart(this.q(k, ".ta"), this.q(i, ".ta"), i, () => {
        this.tray.a[k] -= 1;
        this.tray.a[i] += 10;
        this.hidden.a[i] = 10;
        this.paint();
        this.hidden.a[i] = 0;
      })
      : (this.tray.a[k] -= 1, this.tray.a[i] += 10, Promise.resolve());
    const numbers = (async () => {
      B.pop(this.q(k, ".carry .d"), 1.4);
      await this.wait(this.blocks ? 300 : 100);
      await B.flyDigit(fromCell, this.q(i, ".carry"), `${dg(1, k)}<small class="c${k}">${one(k)}</small>`, "chip", { arc: 60, dur: 1000 });
      this.work[i] += 10;
      this.struck[i] = true;
      this.carry[i] = [...String(this.work[i])].map((ch) => dg(ch, i, "fresh")).join("");
      this.q(i, ".carry").innerHTML = this.carry[i];
      this.q(i, ".top .d")?.classList.add("struck");
      B.pop(this.q(i, ".carry"), 1.4);
    })();
    await Promise.all([blocks, numbers]);
    this.paint();
  }

  // ───────────── the end ─────────────

  async finish() {
    const { a, b, op } = this.p;
    const total = op === "add" ? a + b : a - b;
    this.boardEl.classList.add("solved");
    sfx.win();
    B.confetti(40);
    this.dock("");
    await this.say(`${a} ${OPS[op].sign} ${b} = <b class="answer">${total}</b> 🎉 ${pick(["Awesome!", "You did it!", "Super trading!", "Great job!", "Wow!"])}`, { wait: true });
    return { mistakes: this.mistakes, total };
  }
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
