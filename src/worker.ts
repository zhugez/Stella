export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil: (p: Promise<any>) => void }): Promise<Response> {
    const url = new URL(request.url);

    // 1. Audio stream & edge-caching proxy (avoids hitting Cloudflare's 20,000 file upload limit)
    if (url.pathname.startsWith("/atlas/audio/")) {
      const upstream = `https://raw.githubusercontent.com/zhugez/stella/main/public${url.pathname}`;
      const cache = (caches as any).default;
      let response = await cache.match(request);

      if (!response) {
        const res = await fetch(upstream);
        if (res.ok) {
          const headers = new Headers(res.headers);
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
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

    // 2. Fetch static asset from Cloudflare Edge
    const response = await env.ASSETS.fetch(request);
    const newHeaders = new Headers(response.headers);

    // 3. High-performance Cache-Control headers based on asset type
    if (url.pathname === "/robots.txt") {
      newHeaders.set("Content-Type", "text/plain; charset=utf-8");
      newHeaders.set("Cache-Control", "public, max-age=86400");
    } else if (url.pathname === "/llms.txt") {
      newHeaders.set("Content-Type", "text/markdown; charset=utf-8");
      newHeaders.set("Cache-Control", "public, max-age=86400");
    } else if (url.pathname === "/ai-catalog.json") {
      newHeaders.set("Content-Type", "application/json; charset=utf-8");
      newHeaders.set("Cache-Control", "public, max-age=86400");
    } else if (url.pathname.startsWith("/assets/")) {
      // Vite hashed JS, CSS, and fonts never change
      newHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (url.pathname.startsWith("/atlas/img/") || url.pathname.startsWith("/atlas/thumb/")) {
      // 7,298 WebP paintings and thumbnails
      newHeaders.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
    } else if (url.pathname.startsWith("/atlas/entries/") || url.pathname.endsWith("/index.json")) {
      // Vocabulary data chunks: fresh with background revalidation
      newHeaders.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    }

    // Security & performance headers
    newHeaders.set("X-Content-Type-Options", "nosniff");
    newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
