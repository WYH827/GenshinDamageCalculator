const cache = new Map<
  string,
  { expires: number; body: string; status: number }
>();
const pending = new Map<string, Promise<{ body: string; status: number }>>();
export async function queryEnka(uid: string) {
  const saved = cache.get(uid);
  if (saved && saved.expires > Date.now()) return saved;
  const inflight = pending.get(uid);
  if (inflight) return inflight;
  const job = (async () => {
    try {
      const r = await fetch(`https://enka.network/api/uid/${uid}/`, {
        headers: {
          "User-Agent":
            "TeyvatDamageStudio/0.1 (+https://github.com/WYH827/GenshinDamageCalculator)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20000),
        // Workers supports manual redirects; never follow an unexpected target.
        redirect: "manual",
      });
      const error = (
        {
          400: "UID格式错误",
          404: "未找到该账号",
          424: "游戏服务维护中，请稍后重试",
          429: "Enka请求过快，请稍后重试",
          403: "Enka暂时拒绝请求，请稍后重试",
          500: "Enka服务暂不可用",
          503: "Enka服务暂不可用",
        } as Record<number, string>
      )[r.status];
      if (!r.ok) {
        const result = {
          status: r.status,
          body: JSON.stringify({
            error: error ?? `Enka请求失败（${r.status}）`,
          }),
        };
        if (r.status === 429)
          cache.set(uid, { ...result, expires: Date.now() + 60000 });
        return result;
      }
      const body = await r.text();
      if (body.length > 8 * 1024 * 1024) throw new Error("response too large");
      const data = JSON.parse(body);
      const ttl =
        typeof data.ttl === "number" && Number.isFinite(data.ttl)
          ? Math.max(1, data.ttl)
          : 60;
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      const result = { status: 200, body };
      cache.set(uid, { ...result, expires: Date.now() + ttl * 1000 });
      return result;
    } catch (error) {
      console.warn(
        "Enka upstream request failed",
        error instanceof Error ? error.message : "unknown error",
      );
      return {
        status: 502,
        body: JSON.stringify({
          error: "无法连接Enka，可能网络超时或服务暂不可用，请稍后重试",
        }),
      };
    } finally {
      pending.delete(uid);
    }
  })();
  pending.set(uid, job);
  return job;
}
