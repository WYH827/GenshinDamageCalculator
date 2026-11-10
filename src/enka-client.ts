import { enkaApiUrl, usesPublicEnkaRelay } from "./site-config";
const cache = new Map<string, { expires: number; data: unknown }>();
export async function fetchEnka(
  uid: string,
  signal: AbortSignal,
): Promise<unknown> {
  signal.throwIfAborted();
  if (!/^[1-9]\d{8,9}$/.test(uid)) throw new Error("请输入9或10位数字UID");
  const url = enkaApiUrl(uid),
    relay = usesPublicEnkaRelay();
  const saved = relay ? cache.get(uid) : undefined;
  if (saved && saved.expires > Date.now()) return saved.data;
  const urls = relay ? [url.replace("/raw?", "/get?"), url] : [url];
  let last = "读取失败";
  for (const endpoint of urls) {
    try {
      const r = await fetch(endpoint, {
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(relay ? 18000 : 30000),
        ]),
      });
      const text = await r.text();
      if (text.length > 16 * 1024 * 1024) throw new Error("响应过大");
      if (!r.ok) {
        let detail = "";
        if (!relay) {
          try {
            const error = JSON.parse(text)?.error;
            if (typeof error === "string") detail = error;
          } catch {
            /* The upstream may return an HTML error page. */
          }
        }
        throw new Error(
          detail ||
            (r.status === 429
              ? "请求过快，请稍后再试"
              : `查询服务暂不可用（${r.status}）`),
        );
      }
      let data = JSON.parse(text);
      if (relay && typeof data?.contents === "string")
        data = JSON.parse(data.contents);
      if (data?.error)
        throw new Error(
          typeof data.error === "string" ? data.error : "Enka返回错误",
        );
      if (
        !data ||
        typeof data !== "object" ||
        (!data.playerInfo && !Array.isArray(data.avatarInfoList))
      )
        throw new Error("未读取到Enka账号数据");
      const ttl =
        typeof data.ttl === "number" && Number.isFinite(data.ttl)
          ? Math.max(1, Math.min(data.ttl, 3600))
          : 60;
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      if (relay) cache.set(uid, { data, expires: Date.now() + ttl * 1000 });
      return data;
    } catch (e) {
      if (signal.aborted) throw e;
      last = (e as Error).message;
    }
  }
  throw new Error(
    relay
      ? `公共Enka查询服务暂不可用，请稍后重试或使用JSON导入。${last}`
      : last,
  );
}
