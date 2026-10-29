// src/worker.ts
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/atlas/audio/")) {
      const upstream = `https://raw.githubusercontent.com/zhugez/stella/main/public${url.pathname}`;
      const cache = caches.default;
      let response = await cache.match(request);
      if (!response) {
        const res = await fetch(upstream);
        if (res.ok) {
          const headers = new Headers(res.headers);
          headers.set("Cache-Control", "public, max-age=604800, immutable");
          headers.set("Content-Type", "audio/mpeg");
          headers.set("Access-Control-Allow-Origin", "*");
          response = new Response(res.body, {
            status: res.status,
            headers
          });
          ctx.waitUntil(cache.put(request, response.clone()));
        } else {
          return new Response("Audio track not found", { status: 404 });
        }
      }
      return response;
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
