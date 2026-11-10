import { afterEach, describe, expect, it, vi } from "vitest";
import { damageScale } from "./chart-scale";
import { enkaApiUrl } from "./site-config";
import worker from "../deploy/enka-worker";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("damage reference scale", () => {
  it.each([
    [0, 0],
    [150, 245],
    [0.02, 0.37],
    [1e10, 3e10],
  ])("provides increasing ticks covering %j", (a, b) => {
    const scale = damageScale([a, b]);
    expect(scale.ticks[0]).toBe(0);
    expect(scale.max).toBeGreaterThanOrEqual(Math.max(a, b));
    expect(scale.ticks.at(-1)).toBe(scale.max);
    expect(scale.ticks.every((t, i) => i === 0 || t > scale.ticks[i - 1])).toBe(
      true,
    );
  });
});
describe("static host and Enka deployment", () => {
  it("uses the local API by default and an explicit service on static hosts", () => {
    vi.stubEnv("VITE_STATIC_HOST", "");
    vi.stubEnv("VITE_ENKA_API_BASE", "");
    expect(enkaApiUrl("123456789")).toBe("/api/enka/123456789");
    vi.stubEnv("VITE_STATIC_HOST", "true");
    expect(enkaApiUrl("123456789")).toBe(
      "https://r.jina.ai/https://enka.network/api/uid/123456789/",
    );
    vi.stubEnv("VITE_ENKA_API_BASE", "https://example.workers.dev/");
    expect(enkaApiUrl("123456789")).toBe(
      "https://example.workers.dev/api/enka/123456789",
    );
  });
  it("restricts origin, validates UID, handles CORS and uses the shared cached query", async () => {
    const env = { ALLOWED_ORIGIN: "https://wyh827.github.io" },
      fetcher = vi.fn(
        async () =>
          new Response(JSON.stringify({ ttl: 120, avatarInfoList: [] })),
      );
    vi.stubGlobal("fetch", fetcher);
    const request = (
      path: string,
      origin = env.ALLOWED_ORIGIN,
      method = "GET",
    ) =>
      worker.fetch(
        new Request(`https://api.example${path}`, {
          method,
          headers: { Origin: origin },
        }),
        env,
      );
    expect(
      (await request("/api/enka/123456787", "https://wrong.example")).status,
    ).toBe(403);
    expect((await request("/api/enka/abc")).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    const preflight = await request(
      "/api/enka/123456787",
      undefined,
      "OPTIONS",
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(
      env.ALLOWED_ORIGIN,
    );
    const first = await request("/api/enka/123456787"),
      second = await request("/api/enka/123456787");
    expect(first.status).toBe(200);
    expect(await second.text()).toBe(await first.text());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
