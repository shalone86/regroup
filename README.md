# 🔁 Regroup! Trade tens and ones

A regrouping game for **1st and 2nd graders**. Kids add and take away with regrouping (carrying and borrowing). They watch blocks and digits **move left and right** between colored lanes, so it's clear *why* the little 1 jumps over.

- **One color per place, everywhere:** <span>🟦 ones</span> · <span>🟩 tens</span> · <span>🟥 hundreds</span> · <span>🟪 thousands</span>. Each lane holds the digits *and* the blocks for one place, in the same color.
- **Trade up (adding):** push the blocks together and count. When there are 10 or more, press *Trade*: 10 blue cubes snap into a rod, turn green and fly **left ⬅** into the tens lane. At the same moment, the little 1 flies left to the top of the tens column. An arrow says "10 ones = 1 ten".
- **Trade down (taking away):** "Is that enough to take away 7?" If not, the child does the trade: they **tap the 4** in the tens to take 1 ten away (it's crossed out and becomes 3, and the "1 ten" and a rod lift up), then **tap the ones** to move it over. The rod flies **right ➡** and breaks into 10 cubes, and the 2 becomes 12. Then they tap the blocks they take away and count what's left. Borrowing across a zero (5**0**3 − 1847) is two of these trades, one lane at a time.
- **Bring it down:** when nothing is added to or taken from a lane, the child taps the number and it slides down into the answer ("the 3 stays the same").
- **Countable blocks:** hundreds (flats) and thousands (cubes) are drawn small and side by side in rows, so kids can count them. They're not to scale with the ten-rods.
- **Blocks or just numbers:** tap 🧱 to show or hide the blocks at any time. The digits still fly between lanes when the blocks are hidden.
- **Easy to start:** one big ▶ Play button. Every step is read aloud (🔊) for kids who are still learning to read. Mistakes are gentle: after a hint and a second try, the game shows the answer and moves on.
- **Levels:** 🐸 Tens & Ones → 🦊 Hundreds, Tens & Ones → 🐳 Thousands. Each level has Add, Take away and Mix it up (5 problems). Problems start with one trade and a 1-digit number, then build up to several trades.
- **🎬 Watch how:** the game plays a worked example by itself, slowly, with narration.
- **🔢 Number Sense:** 8 multiple-choice questions a round, at each level (tens & ones, hundreds, thousands): what number do the blocks show, standard form ↔ expanded form (300 + 40 + 7), number ↔ words (three hundred forty-seven), *what digit is in the tens place?*, *what place is the 4 in?*, and *how much is the 4 worth?* Wrong answers are look-alikes (digits swapped, a zero dropped). Words and expanded parts are colored by place too; "which place" questions start plain and light up after.
- **Sounds for everything:** each number key plays its own note, and choosing, deleting, checking, tapping the board, bundling (snap), breaking (crack), lifting a ten, landing a digit, sliding a number down, and taking blocks away (lower each time) all sound different.
- **Play Mat:** free play with the blocks. Add cubes, bundle 10 into 1, break 1 into 10, and see that the number doesn't change.
- Stars, stickers and confetti. Works on phones and tablets, installable, and works offline (the device voice is used when the Cloudflare voice can't be reached).

## Deploy (Cloudflare Workers, same as articulation and Hablar)

```bash
npm install
npx wrangler login
npx wrangler deploy            # → https://regroup.<you>.workers.dev
```

- The game is static (`public/`). The Worker only adds a kid-friendly read-aloud voice: `@cf/deepgram/aura-2-en` (voice `thalia`) on Workers AI, cached at the edge. Most sentences repeat, so the free allowance is plenty.
- Without Workers AI (or on any static host), the game uses the device's own voice.
- Live at **https://regroup.shalonely.com** (custom domain in `wrangler.jsonc`; also https://regroup.ariyandhamma.workers.dev).
- Optional: `npx wrangler secret put APP_PASSCODE` locks the voice API; enter the passcode under ⚙️ For grown-ups.

Step-by-step handoff for an agent on the owner's machine: [docs/DEPLOY-HANDOFF.md](docs/DEPLOY-HANDOFF.md).

## Develop

```bash
npm test          # regrouping math + problem generator checks (node:test, no deps)
npx wrangler dev  # local dev
# or just: python3 -m http.server -d public 8787
```

| Path | What |
|---|---|
| `public/js/math.js` | Place values, carry/borrow plans (including across zeros), the problem generator and difficulty per level. Pure, tested |
| `public/js/game.js` | One problem, step by step (and the auto-playing "Watch how") |
| `public/js/board.js` | Colored lanes, blocks, and the animations: bundle ⬅, break ➡, merge, take away, flying digits, arrows |
| `public/js/mat.js` | The Play Mat |
| `public/js/sense.js`, `senseview.js` | Number Sense: number words, expanded form, question generator (tested) and its screen |
| `public/js/app.js` | Home, levels, finish screen, grown-ups page |
| `public/js/tts.js`, `api.js`, `sound.js`, `store.js` | Read-aloud voice, Worker API, sound effects, progress in localStorage |
| `worker/index.js` | Cloudflare Worker (`/api/health`, `/api/tts`) |
