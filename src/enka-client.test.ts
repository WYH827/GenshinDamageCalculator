import { afterEach, it, expect, vi } from "vitest";
import { fetchEnka } from "./enka-client";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("unwraps the public relay response, falls back on failure and caches Enka TTL", async () => {
  vi.stubEnv("VITE_STATIC_HOST", "true");
  vi.stubEnv("VITE_ENKA_API_BASE", "");
  const data = {
    ttl: 60,
    playerInfo: { nickname: "test" },
    avatarInfoList: [],
  };
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(new Response(JSON.stringify(data)));
  vi.stubGlobal("fetch", fetcher);
  expect(await fetchEnka("123456777", new AbortController().signal)).toEqual(
    data,
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0]).toContain("/get?");
  expect(fetcher.mock.calls[1][0]).toContain("/raw?");
  expect(await fetchEnka("123456777", new AbortController().signal)).toEqual(
    data,
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ contents: JSON.stringify(data) })),
  );
  expect(await fetchEnka("123456778", new AbortController().signal)).toEqual(
    data,
  );
});
it("never falls back to a third party for custom/local service and rejects invalid UID before fetch", async () => {
  vi.stubEnv("VITE_STATIC_HOST", "true");
  vi.stubEnv("VITE_ENKA_API_BASE", "https://own.example");
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response("{}", { status: 429 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(fetchEnka("abc", new AbortController().signal)).rejects.toThrow(
    "UID",
  );
  expect(fetcher).not.toHaveBeenCalled();
  await expect(
    fetchEnka("123456779", new AbortController().signal),
  ).rejects.toThrow("请求过快");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://own.example/api/enka/123456779",
  );
});
