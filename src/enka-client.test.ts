import { afterEach, beforeEach, it, expect, vi } from "vitest";
let fetchEnka: typeof import("./enka-client").fetchEnka;
const uid = "123456777";
const data = {
  uid,
  ttl: 60,
  playerInfo: { nickname: "test" },
  avatarInfoList: [],
};
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("VITE_STATIC_HOST", "true");
  vi.stubEnv("VITE_ENKA_API_BASE", "https://enka-api.wyh827.workers.dev");
  ({ fetchEnka } = await import("./enka-client"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("defaults to direct MicroGG, preserves precise numbers and caches only the chosen endpoint", async () => {
  vi.useFakeTimers();
  const precise = {
    ...data,
    avatarInfoList: [{ fightPropMap: { 1: 9461.17578125, 4: 897.3515625 } }],
  };
  const fetcher = vi.fn(async () => Response.json(precise));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  expect(await fetchEnka(uid, signal, "microgg")).toEqual(precise);
  expect(fetcher.mock.calls[0][0]).toBe(
    `https://profile.microgg.cn/api/uid/${uid}`,
  );
  expect(await fetchEnka(uid, signal, "microgg")).toEqual(precise);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await fetchEnka(uid, signal, "cloudflare");
  expect(fetcher.mock.calls[1][0]).toBe(
    `https://enka-api.wyh827.workers.dev/api/enka/${uid}`,
  );
  vi.advanceTimersByTime(61000);
  await fetchEnka(uid, signal, "microgg");
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it.each([
  [{ ...data, uid: "123456778" }, "UID不一致"],
  [{ status: "ok" }, "未读取到Enka账号数据"],
])("rejects incorrect UID and invalid responses", async (payload, message) => {
  const fetcher = vi.fn(async () => Response.json(payload));
  vi.stubGlobal("fetch", fetcher);
  await expect(fetchEnka(uid, new AbortController().signal)).rejects.toThrow(
    message,
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not silently switch providers when MicroGG has a network/CORS error", async () => {
  const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    fetchEnka(uid, new AbortController().signal, "microgg"),
  ).rejects.toThrow("Cloudflare转发");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("respects Retry-After per endpoint without blocking the other provider", async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response("rate limit", {
        status: 429,
        headers: { "Retry-After": "90" },
      }),
    )
    .mockImplementation(async () => Response.json(data));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  await expect(fetchEnka(uid, signal, "microgg")).rejects.toThrow("90秒");
  await expect(fetchEnka(uid, signal, "microgg")).rejects.toThrow("90秒");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await fetchEnka(uid, signal, "cloudflare")).toEqual(data);
  vi.advanceTimersByTime(91000);
  expect(await fetchEnka(uid, signal, "microgg")).toEqual(data);
});
it("uses an explicit Cloudflare/custom origin only when selected and preserves its errors", async () => {
  vi.stubEnv("VITE_ENKA_API_BASE", "https://own.example/");
  const fetcher = vi.fn(async () =>
    Response.json({ error: "Enka暂时维护" }, { status: 502 }),
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    fetchEnka(uid, new AbortController().signal, "cloudflare"),
  ).rejects.toThrow("Enka暂时维护");
  expect(fetcher.mock.calls[0][0]).toBe(`https://own.example/api/enka/${uid}`);
});
it("validates UID and cancellation before issuing a request; pasted official JSON remains available", async () => {
  const { parseOfficialEnkaText, officialEnkaUrl } =
    await import("./enka-client");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(fetchEnka("abc", new AbortController().signal)).rejects.toThrow(
    "UID",
  );
  const controller = new AbortController();
  controller.abort();
  await expect(fetchEnka(uid, controller.signal)).rejects.toHaveProperty(
    "name",
    "AbortError",
  );
  expect(fetcher).not.toHaveBeenCalled();
  expect(officialEnkaUrl(uid)).toBe(`https://enka.network/api/uid/${uid}/`);
  expect(parseOfficialEnkaText(JSON.stringify(data), uid)).toEqual(data);
  expect(() => parseOfficialEnkaText("<html>error</html>", uid)).toThrow(
    "完整JSON",
  );
});

it("defaults to the MicroGG proxy and supports all three raw direct response formats", async () => {
  const fetcher = vi.fn(async () => Response.json(data));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  expect(await fetchEnka(uid, signal)).toEqual(data);
  expect(fetcher.mock.calls[0][0]).toBe(
    `https://enka-api.wyh827.workers.dev/api/enka/${uid}?source=microgg`,
  );
  await fetchEnka(uid, signal, "cloudflare-page");
  expect(fetcher.mock.calls[1][0]).toBe(
    `https://enka-api.wyh827.workers.dev/api/enka/${uid}?source=page`,
  );
  await fetchEnka(uid, signal, "enka");
  expect(fetcher.mock.calls[2][0]).toBe(`https://enka.network/api/uid/${uid}/`);
});
it("explains HTTP mixed content before issuing a page-direct request from HTTPS", async () => {
  vi.stubGlobal("location", { protocol: "https:" });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    fetchEnka(uid, new AbortController().signal, "page"),
  ).rejects.toThrow("HTTPS网页无法直连HTTP接口");
  expect(fetcher).not.toHaveBeenCalled();
});
