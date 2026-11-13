export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
}

// Audio has too many files to upload as static assets (20,000-file limit), so the Worker proxies it
// from GitHub. The `cf` options cache successful upstream responses at Cloudflare's edge.
const AUDIO_CACHE = { cacheEverything: true, cacheTtlByStatus: { "200-299": 31536000, "300-599": -1 } };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/atlas/audio/")) {
      const upstream = `https://raw.githubusercontent.com/zhugez/stella/main/public${url.pathname}`;
      const init: RequestInit & { cf: typeof AUDIO_CACHE } = { cf: AUDIO_CACHE };
      const res = await fetch(upstream, init);
      if (!res.ok) {
        // 404: the file does not exist. Anything else (429 rate limit, 5xx) is an upstream failure.
        const missing = res.status === 404;
        return new Response(missing ? "Audio track not found" : "Audio upstream unavailable", {
          status: missing ? 404 : 502,
          headers: { "Cache-Control": "no-store" },
        });
      }
      const headers = new Headers(res.headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("Content-Type", "audio/mpeg");
      headers.set("Access-Control-Allow-Origin", "*");
      // Cloudflare sets cf-cache-status on cached subrequests: HIT on a repeat request proves the cf cache works.
      headers.set("X-Upstream-Cache", res.headers.get("cf-cache-status") ?? "none");
      return new Response(res.body, { status: 200, headers });
    }

    // Only missing files reach the Worker under these prefixes (existing assets are served first).
    // Answer 404 instead of the SPA index.html, which _headers would cache under the file's URL.
    if (/^\/(assets|brand|atlas)\//.test(url.pathname)) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    return env.ASSETS.fetch(request);
  },
};
