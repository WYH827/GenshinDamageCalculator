import { beforeEach, afterEach, expect, it, vi } from "vitest";
let worker: typeof import("../deploy/enka-worker").default;
beforeEach(async () => {
  vi.resetModules();
  worker = (await import("../deploy/enka-worker")).default;
});
afterEach(() => vi.unstubAllGlobals());
const env = { ALLOWED_ORIGIN: "https://wyh827.github.io" };
const request = (source: string, uid = "123456789") =>
  new Request(
    `https://api.example/api/enka/${uid}?source=${encodeURIComponent(source)}`,
    { headers: { Origin: env.ALLOWED_ORIGIN } },
  );
it("routes all fixed sources and keeps same-UID caches and concurrent requests separate", async () => {
  const fetcher = vi.fn(async (url: string) =>
    Response.json({
      uid: "123456789",
      playerInfo: { nickname: url },
      avatarInfoList: [],
      ttl: 60,
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const rows = await Promise.all(
    ["enka", "microgg", "page"].flatMap((source) => [
      worker.fetch(request(source), env),
      worker.fetch(request(source), env),
    ]),
  );
  expect(rows.every((r) => r.status === 200)).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls.map((c) => c[0])).toEqual([
    "https://enka.network/api/uid/123456789/",
    "https://profile.microgg.cn/api/uid/123456789",
    "http://enka.microgg.cn/u/123456789/__data.json",
  ]);
  const json = await Promise.all(rows.map((r) => r.json()));
  expect(json[0]).toEqual(json[1]);
  expect(json[2]).toEqual(json[3]);
  expect(json[0]).not.toEqual(json[2]);
});
it("rejects arbitrary proxy targets and invalid UID without contacting upstream", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect((await worker.fetch(request("https://example.com"), env)).status).toBe(
    400,
  );
  expect((await worker.fetch(request("microgg", "abc"), env)).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not let a limited upstream block another source and rejects redirects or unrelated JSON", async () => {
  const fetcher = vi.fn(async (url: string) =>
    url.includes("profile.microgg")
      ? new Response("", { status: 429 })
      : Response.json({ playerInfo: {}, avatarInfoList: [], ttl: 60 }),
  );
  vi.stubGlobal("fetch", fetcher);
  expect((await worker.fetch(request("microgg"), env)).status).toBe(429);
  expect((await worker.fetch(request("microgg"), env)).status).toBe(429);
  expect((await worker.fetch(request("enka"), env)).status).toBe(200);
  expect(fetcher).toHaveBeenCalledTimes(2);
  fetcher.mockImplementationOnce(
    async () =>
      new Response("", {
        status: 302,
        headers: { Location: "https://other.example" },
      }),
  );
  expect((await worker.fetch(request("page"), env)).status).toBe(302);
  expect(fetcher).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({ redirect: "manual" }),
  );
  fetcher.mockImplementationOnce(async () =>
    Response.json({ playerInfo: {}, uid: "987654321" }),
  );
  expect((await worker.fetch(request("page"), env)).status).toBe(502);
});
