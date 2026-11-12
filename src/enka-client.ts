import {
  enkaApiUrl,
  DEFAULT_ENKA_PROVIDER,
  ENKA_PROVIDERS,
  isProxiedProvider,
  type EnkaProvider,
} from "./site-config";
const cache = new Map<string, { expires: number; data: unknown }>();
const retryAt = new Map<string, number>();
export const officialEnkaUrl = (uid: string) => {
  if (!/^[1-9]\d{8,9}$/.test(uid)) throw new Error("请输入9或10位数字UID");
  return `https://enka.network/api/uid/${uid}/`;
};
export function parseOfficialEnkaText(text: string, uid: string): unknown {
  officialEnkaUrl(uid);
  if (text.length > 16 * 1024 * 1024) throw new Error("响应过大");
  let data;
  try {
    data = JSON.parse(text.trim());
  } catch {
    throw new Error("请粘贴官方接口返回的完整JSON，不要粘贴网页地址或错误页面");
  }
  if (
    !data ||
    typeof data !== "object" ||
    (!data.playerInfo && !Array.isArray(data.avatarInfoList))
  )
    throw new Error("未读取到Enka账号数据");
  if (data.uid != null && String(data.uid) !== uid)
    throw new Error("JSON中的UID与输入的UID不一致");
  return data;
}

export async function fetchEnka(
  uid: string,
  signal: AbortSignal,
  provider: EnkaProvider = DEFAULT_ENKA_PROVIDER,
): Promise<unknown> {
  signal.throwIfAborted();
  officialEnkaUrl(uid);
  const url = enkaApiUrl(uid, provider);
  const saved = !isProxiedProvider(provider) ? cache.get(url) : undefined;
  if (saved && saved.expires > Date.now()) return saved.data;
  const wait = (retryAt.get(url) ?? 0) - Date.now();
  if (wait > 0)
    throw new Error(`查询过于频繁，请${Math.ceil(wait / 1000)}秒后重试`);
  try {
    if (
      provider === "page" &&
      typeof location !== "undefined" &&
      location.protocol === "https:"
    )
      throw new Error(
        "HTTPS网页无法直连HTTP接口，请选择Cloudflare转发 · MicroGG网页JSON",
      );
    const r = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
    const text = await r.text();
    if (text.length > 16 * 1024 * 1024) throw new Error("响应过大");
    if (!r.ok) {
      if (r.status === 429) {
        const retry = r.headers.get("Retry-After");
        const seconds =
          retry && /^\d+$/.test(retry)
            ? Number(retry)
            : retry
              ? Math.ceil((Date.parse(retry) - Date.now()) / 1000)
              : 60;
        const delay = Number.isFinite(seconds) ? Math.max(1, seconds) : 60;
        retryAt.set(url, Date.now() + delay * 1000);
        throw new Error(`查询过于频繁，请${delay}秒后重试`);
      }
      let detail = "";
      try {
        const data = JSON.parse(text);
        if (typeof data?.error === "string") detail = data.error;
      } catch {
        /* Some services return an HTML error page. */
      }
      throw new Error(detail || `查询服务暂不可用（${r.status}）`);
    }
    const data = parseOfficialEnkaText(text, uid);
    const ttlValue = (data as { ttl?: number }).ttl;
    const ttl =
      typeof ttlValue === "number" && Number.isFinite(ttlValue)
        ? Math.max(1, Math.min(ttlValue, 3600))
        : 60;
    if (!isProxiedProvider(provider)) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(url, { data, expires: Date.now() + ttl * 1000 });
    }
    return data;
  } catch (e) {
    if (signal.aborted) throw e;
    const name = ENKA_PROVIDERS[provider];
    const message =
      (e as Error).name === "TimeoutError"
        ? "查询超时"
        : (e as Error).message === "Failed to fetch" ||
            (e as Error).name === "TypeError"
          ? "网络或跨域读取失败"
          : (e as Error).message;
    throw new Error(
      `${name}：${message}。${!isProxiedProvider(provider) ? "可切换对应的Cloudflare转发后重新读取" : "可切换其它数据来源或使用下方官方JSON导入"}`,
    );
  }
}
