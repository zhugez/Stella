/* Stella offline cache: app shell network-first, everything else cache-first. */
const VERSION = "stella-v2";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/* Media elements always send Range. Fetch and cache the whole file once (no Range header),
   then answer each range from it, so recorded audio also plays offline. */
async function audio(req) {
  let res = await caches.match(req.url);
  if (!res) {
    res = await fetch(req.url);
    if (!res.ok) return res;
    const copy = res.clone();
    caches.open(MEDIA).then((c) => c.put(req.url, copy)).then(() => trim(MEDIA, 1500));
  }
  return ranged(req, res);
}

async function ranged(req, res) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (!m || (m[1] === "" && m[2] === "")) return res;
  const blob = await res.blob();
  const size = blob.size;
  const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] === "" || m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const body = blob.slice(start, end + 1);
  return new Response(body, {
    status: 206,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(body.size),
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes("/atlas/audio/")) {
    event.respondWith(audio(req));
    return;
  }
  if (req.headers.has("range")) return;
  const isShell = req.mode === "navigate" || url.pathname.endsWith("/index.json") || url.pathname.includes("/entries/");
  if (isShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(new URL("./", self.registration.scope).href))),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            const name = /\/atlas\/(img|thumb|audio)\//.test(url.pathname) ? MEDIA : SHELL;
            caches.open(name).then((c) => c.put(req, copy)).then(() => name === MEDIA && trim(MEDIA, 1500));
          }
          return res;
        }),
    ),
  );
});
