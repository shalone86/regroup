# Handoff: deploy Regroup! to Cloudflare

**For:** an AI agent (or a person) running on the owner's own computer, logged in to the owner's Cloudflare account.
**Goal:** put the Regroup! game online as a Cloudflare Worker, then check that it works.
**Time:** about 10 minutes. Nothing in this repo needs editing unless you add a custom domain (step 5).

## Context

- The game is a static site in `public/` plus a tiny Worker in `worker/index.js` (config in `wrangler.jsonc`). There's no build step.
- The Worker uses the **Workers AI** binding (`AI`) only for the read-aloud voice (`@cf/deepgram/aura-2-en` for single words and numbers, `@cf/myshell-ai/melotts` for sentences). The game works without it, using the device's voice.
- It's set up the same way as the owner's `articulation` (`articulate.shalonely.com`) and `hablar` (`hablar.shalonely.com`) apps, so use that Cloudflare account (ariyandhamma@gmail.com).

## Rules

- Deploy only to the owner's own Cloudflare account: **ariyandhamma@gmail.com**, the one that hosts `articulation`. If `wrangler whoami` shows any other email, stop and ask.
- Don't change or delete any other Worker, DNS record or route on the account.
- Don't commit secrets. A passcode goes in with `wrangler secret put`, never into a file.
- Ask the owner before adding a custom domain (step 5). It creates a DNS record.

## Steps

### 1. Prerequisites

```bash
node --version        # Node 22 or newer (wrangler 4 needs it)
```

### 2. Get the code and install

```bash
cd regroup            # the folder with wrangler.jsonc
npm install
npm test              # expect: 8 pass, 0 fail
```

### 3. Log in to Cloudflare

```bash
npx wrangler login
npx wrangler whoami   # must say ariyandhamma@gmail.com
```

If `CLOUDFLARE_API_TOKEN` is set for another account, `unset CLOUDFLARE_API_TOKEN` first.

### 4. Deploy

```bash
npx wrangler deploy   # → https://regroup.<subdomain>.workers.dev
```

> **Note on Voice Passcode (TODO):** Setting `APP_PASSCODE` to lock the voice API is deferred for now and will be set later. When ready:
> `npx wrangler secret put APP_PASSCODE` (then enter it in the game under ⚙️ For grown-ups → Passcode).

### 5. Optional: custom domain (ask the owner first)

In `wrangler.jsonc`, uncomment the `routes` line (and add a comma after `"workers_dev": true`):

```jsonc
  "workers_dev": true,
  "routes": [{ "pattern": "regroup.shalonely.com", "custom_domain": true }]
```

Deploy again and commit the change.

## Verify

```bash
URL=https://regroup.<subdomain>.workers.dev
curl -s $URL/api/health                     # {"tts":true,"backend":"Cloudflare Workers AI","voices":[...]}
curl -s -o /tmp/v.mp3 -w "%{http_code} %{content_type}\n" "$URL/api/tts?text=Ten%20ones%20make%20one%20ten!&voice=thalia"
                                            # 200 audio/mpeg
curl -s -o /dev/null -w "%{http_code}\n" $URL/   # 200
```

Then on a phone or tablet: tap **▶ Play**, press **🤲 Push together**, type the number of ones, and press **🔁 Trade**. You should see 10 blue cubes turn into a green rod that flies left, and hear each step read aloud.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Deploy says Workers AI isn't enabled | In the dashboard, open **AI → Workers AI** once to accept the terms, then deploy again |
| `/api/tts` returns 502 | `npx wrangler tail regroup` and retry. If the voice name is rejected, update `TTS_VOICE_LIST` in `worker/index.js` |
| Old version keeps showing | The service worker caches the app. Reload twice, or bump `VERSION` in `public/sw.js` |
| A Worker called `regroup` already exists | Change `"name"` in `wrangler.jsonc` and deploy |
