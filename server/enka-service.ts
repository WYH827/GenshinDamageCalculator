import {
  enkaSourceUrl,
  ENKA_SOURCES,
  type EnkaSource,
} from "../shared/enka-sources.ts";
const cache = new Map<
  string,
  { expires: number; body: string; status: number }
>();
const pending = new Map<string, Promise<{ body: string; status: number }>>();
export async function queryEnka(uid: string, source: EnkaSource = "enka") {
  const sourceUrl = enkaSourceUrl(uid, source);
  // Keep the browser's direct option on HTTPS; only this server-side upstream
  // uses HTTP to avoid MicroGG's Cloudflare-to-origin TLS handshake failure.
  const url =
      source === "microgg" ? sourceUrl.replace(/^https:/, "http:") : sourceUrl,
    key = `${source}:${uid}`,
    name = ENKA_SOURCES[source];
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved;
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const job = (async () => {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent":
            source === "microgg"
              ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
              : "TeyvatDamageStudio/0.1 (+https://github.com/WYH827/GenshinDamageCalculator)",
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
          429: `${name}请求过快，请稍后重试`,
          403: `${name}暂时拒绝请求，请稍后重试`,
          500: `${name}服务暂不可用`,
          503: `${name}服务暂不可用`,
          525: `${name}上游HTTPS握手失败（525），可选择Cloudflare转发 · MicroGG网页JSON或Enka官方`,
        } as Record<number, string>
      )[r.status];
      if (!r.ok) {
        const result = {
          status: r.status,
          body: JSON.stringify({
            error: error ?? `${name}请求失败（${r.status}）`,
          }),
        };
        if (r.status === 429)
          cache.set(key, { ...result, expires: Date.now() + 60000 });
        return result;
      }
      const body = await r.text();
      if (body.length > 8 * 1024 * 1024) throw new Error("response too large");
      const data = JSON.parse(body);
      if (
        !data ||
        typeof data !== "object" ||
        (!data.playerInfo && !Array.isArray(data.avatarInfoList))
      )
        throw new Error("invalid upstream data");
      if (data.uid != null && String(data.uid) !== uid)
        throw new Error("UID mismatch");
      const ttl =
        typeof data.ttl === "number" && Number.isFinite(data.ttl)
          ? Math.max(1, Math.min(data.ttl, 3600))
          : 60;
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      const result = { status: 200, body };
      cache.set(key, { ...result, expires: Date.now() + ttl * 1000 });
      return result;
    } catch (error) {
      console.warn(
        "Enka upstream request failed",
        error instanceof Error ? error.message : "unknown error",
      );
      return {
        status: 502,
        body: JSON.stringify({
          error: `无法读取${name}，可能网络超时或数据不完整，请稍后重试`,
        }),
      };
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, job);
  return job;
}
