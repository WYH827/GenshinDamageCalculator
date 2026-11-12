import { afterEach, beforeEach, it, expect, vi } from "vitest";
let fetchEnka: typeof import("./enka-client").fetchEnka;
const uid = "123456777";
const data = {
  uid,
  ttl: 60,
  playerInfo: { nickname: "test" },
  avatarInfoList: [],
};
const wrapper = (content: unknown = data, source = uid) => ({
  code: 200,
  data: {
    url: `https://enka.network/api/uid/${source}/`,
    content: JSON.stringify(content),
  },
});
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("VITE_STATIC_HOST", "true");
  vi.stubEnv("VITE_ENKA_API_BASE", "");
  ({ fetchEnka } = await import("./enka-client"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("reads the Reader JSON envelope without changing equipment or stat numbers and expires Enka TTL", async () => {
  vi.useFakeTimers();
  const precise = {
    ...data,
    avatarInfoList: [{ fightPropMap: { 1: 9461.17578125, 4: 897.3515625 } }],
  };
  const fetcher = vi.fn(async () => Response.json(wrapper(precise)));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  expect(await fetchEnka(uid, signal)).toEqual(precise);
  expect(fetcher).toHaveBeenCalledWith(
    `https://r.jina.ai/https://enka.network/api/uid/${uid}/`,
    expect.objectContaining({
      headers: {
        Accept: "application/json",
        "X-Engine": "curl",
        "X-Cache-Tolerance": "60",
      },
    }),
  );
  expect(await fetchEnka(uid, signal)).toEqual(precise);
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(61000);
  await fetchEnka(uid, signal);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([
  [wrapper(data, "123456778"), "有效的Enka JSON"],
  [wrapper({ ...data, uid: "123456778" }), "UID与查询不一致"],
  [
    {
      code: 200,
      data: {
        url: `https://enka.network/api/uid/${uid}/`,
        content: "# Cloudflare challenge",
      },
    },
    "不是JSON",
  ],
  [wrapper({ status: "ok" }), "未读取到Enka账号数据"],
])(
  "rejects wrong UID, non-JSON and invalid upstream data",
  async (payload, message) => {
    const fetcher = vi.fn(async () => Response.json(payload));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchEnka(uid, new AbortController().signal)).rejects.toThrow(
      String(message),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it("respects 429 Retry-After and does not retry or switch proxies", async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": "90" },
      }),
    )
    .mockResolvedValueOnce(Response.json(wrapper()));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  await expect(fetchEnka(uid, signal)).rejects.toThrow("90秒");
  await expect(fetchEnka(uid, signal)).rejects.toThrow("90秒");
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(91000);
  expect(await fetchEnka(uid, signal)).toEqual(data);
});
it("never uses Reader for a custom/local API, preserving server errors", async () => {
  vi.stubEnv("VITE_ENKA_API_BASE", "https://own.example");
  const fetcher = vi.fn(async () =>
    Response.json({ error: "Enka请求过快" }, { status: 429 }),
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(fetchEnka(uid, new AbortController().signal)).rejects.toThrow(
    "Enka请求过快",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(`https://own.example/api/enka/${uid}`);
});
it("invalid UID and cancellation never issue a request", async () => {
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
});

it("explains anonymous denial and validates directly pasted official JSON", async () => {
  const { parseOfficialEnkaText, officialEnkaUrl } =
    await import("./enka-client");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("denied", { status: 401 })),
  );
  await expect(fetchEnka(uid, new AbortController().signal)).rejects.toThrow(
    "官方读取并粘贴JSON",
  );
  expect(officialEnkaUrl(uid)).toBe(`https://enka.network/api/uid/${uid}/`);
  expect(parseOfficialEnkaText(JSON.stringify(data), uid)).toEqual(data);
  expect(() => parseOfficialEnkaText("<html>error</html>", uid)).toThrow(
    "完整JSON",
  );
  expect(() =>
    parseOfficialEnkaText(JSON.stringify(data), "123456778"),
  ).toThrow("UID不一致");
});
