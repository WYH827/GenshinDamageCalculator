import { afterEach, expect, it, vi } from "vitest";
import worker from "../deploy/site-worker";

afterEach(() => vi.unstubAllGlobals());

it("serves site assets and official presets without contacting Enka", async () => {
  const upstream = vi.fn();
  vi.stubGlobal("fetch", upstream);
  const assets = { fetch: vi.fn(async () => new Response("asset")) };
  for (const path of ["/", "/assets/app.js", "/presets/index.json"]) {
    const request = new Request(`https://studio.example${path}`);
    expect(await (await worker.fetch(request, { ASSETS: assets })).text()).toBe(
      "asset",
    );
    expect(assets.fetch).toHaveBeenLastCalledWith(request);
  }
  expect(upstream).not.toHaveBeenCalled();
});

it("routes same-origin UID queries through the cached official API and rejects arbitrary proxy targets", async () => {
  const upstream = vi.fn(async () =>
    Response.json({ playerInfo: {}, ttl: 60 }),
  );
  vi.stubGlobal("fetch", upstream);
  const env = { ASSETS: { fetch: vi.fn() } };
  const query = (
    path: string,
    origin = "https://studio.example",
    method = "GET",
  ) =>
    worker.fetch(
      new Request(`https://studio.example${path}`, {
        method,
        headers: { Origin: origin },
      }),
      env,
    );
  expect(
    (await query("/api/enka/123456799", "https://other.example")).status,
  ).toBe(403);
  expect((await query("/api/enka/https://example.com")).status).toBe(400);
  expect((await query("/api/unknown")).status).toBe(404);
  expect((await query("/api/enka/123456799", undefined, "POST")).status).toBe(
    405,
  );
  expect(upstream).not.toHaveBeenCalled();
  expect((await query("/api/enka/123456799")).status).toBe(200);
  expect((await query("/api/enka/123456799")).status).toBe(200);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream.mock.calls[0][0]).toBe(
    "https://enka.network/api/uid/123456799/",
  );
  expect(upstream).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ redirect: "manual" }),
  );
  expect(env.ASSETS.fetch).not.toHaveBeenCalled();
});
