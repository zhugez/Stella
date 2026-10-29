export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil: (p: Promise<any>) => void }): Promise<Response> {
    const url = new URL(request.url);

    // Audio stream & edge-caching proxy (avoids hitting Cloudflare's 20,000 file upload limit)
    if (url.pathname.startsWith("/atlas/audio/")) {
      const upstream = `https://raw.githubusercontent.com/zhugez/stella/main/public${url.pathname}`;
      const cache = (caches as any).default;
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
            headers,
          });
          ctx.waitUntil(cache.put(request, response.clone()));
        } else {
          return new Response("Audio track not found", { status: 404 });
        }
      }
      return response;
    }

    // Serve all static assets: index.html, JS, CSS, 7,298 illustrations, thumbnails, JSON data chunks
    return env.ASSETS.fetch(request);
  },
};
