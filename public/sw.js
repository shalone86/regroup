// Offline support (same strategy as articulation and Hablar): network first for the app so
// updates show right away, cache first for fonts and voice clips. The game itself works offline.

const VERSION = "v18";
// Cache names start with the app id: several apps can share one site (angelio.org/regroup/, /snap/…),
// and each must only clean up its own caches.
const APP = "regroup";
const SHELL = `${APP}-shell-${VERSION}`;
const RUNTIME = `${APP}-runtime-v1`;

const ASSETS = [
  "./", "index.html", "manifest.webmanifest", "icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png", "css/app.css",
  "js/app.js", "js/api.js", "js/dock.js", "js/lesson.js", "js/lessons.js", "js/vary.js", "js/stickers.js", "js/jingle.js", "js/board.js", "js/game.js", "js/mat.js", "js/math.js", "js/sense.js", "js/senseview.js", "js/show.js", "js/sound.js", "js/store.js", "js/tts.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => (k.startsWith(`${APP}-`) || /^(shell|runtime)-/.test(k)) && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) ?? (await cache.match("index.html")) ?? Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.endsWith("/api/tts")) return e.respondWith(cacheFirst(req));
  if (url.origin === location.origin && url.pathname.includes("/api/")) return;
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return e.respondWith(cacheFirst(req));
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
});
