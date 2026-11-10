import { afterEach, expect, it, vi } from "vitest";
import enkaProxy from "../enka-proxy";

function server() {
  let middleware: (req: unknown, res: unknown, next: () => void) => void;
  const hook = enkaProxy().configureServer as (s: unknown) => void;
  hook({
    middlewares: {
      use: (fn: typeof middleware) => {
        middleware = fn;
      },
    },
  });
  return (url: string, method = "GET") =>
    new Promise<{ status: number; body: string }>((resolve) => {
      const res = {
        statusCode: 200,
        setHeader: () => {},
        end: (body: string) => resolve({ status: res.statusCode, body }),
      };
      middleware({ url, method }, res, () =>
        resolve({ status: 404, body: "" }),
      );
    });
}
afterEach(() => vi.unstubAllGlobals());
it("validates local UID requests before contacting Enka", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const query = server();
  expect((await query("/api/enka/abc")).status).toBe(400);
  expect((await query("/api/enka/123456789", "POST")).status).toBe(405);
  expect(fetcher).not.toHaveBeenCalled();
});
it("sends the documented request and reuses TTL data without additional upstream queries", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          ttl: 300,
          playerInfo: { nickname: "Test" },
          avatarInfoList: [],
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const query = server();
  const first = await query("/api/enka/123456781");
  const second = await query("/api/enka/123456781");
  expect(first.status).toBe(200);
  expect(second.body).toBe(first.body);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    "https://enka.network/api/uid/123456781/",
    expect.objectContaining({
      headers: expect.objectContaining({
        "User-Agent": expect.stringContaining("TeyvatDamageStudio"),
      }),
    }),
  );
});
it("reports rate limits and backs off instead of issuing repeated upstream calls", async () => {
  const fetcher = vi.fn(async () => new Response("", { status: 429 }));
  vi.stubGlobal("fetch", fetcher);
  const query = server();
  expect(await query("/api/enka/123456782")).toMatchObject({ status: 429 });
  expect((await query("/api/enka/123456782")).body).toContain("请求过快");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
