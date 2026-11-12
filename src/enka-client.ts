import { enkaApiUrl, usesPublicEnkaRelay } from "./site-config";
const cache = new Map<string, { expires: number; data: unknown }>();
let relayRetryAt = 0;
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

// Reader wraps the unmodified API text in data.content. Only accept JSON from
// the exact requested Enka UID endpoint; never interpret prose or rendered HTML.
function unwrapReader(data: unknown, uid: string): unknown {
  const response = data as {
    code?: number;
    data?: { url?: string; content?: string };
  } | null;
  if (
    response?.code !== 200 ||
    response.data?.url !== `https://enka.network/api/uid/${uid}/` ||
    typeof response.data.content !== "string"
  )
    throw new Error("查询服务未返回有效的Enka JSON，请稍后重试");
  try {
    return JSON.parse(response.data.content);
  } catch {
    throw new Error("Enka数据不完整或不是JSON，请稍后重试");
  }
}
const rateLimitMessage = (seconds: number) =>
  `查询过于频繁，请${seconds}秒后重试`;

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
  if (relay && relayRetryAt > Date.now())
    throw new Error(
      rateLimitMessage(Math.ceil((relayRetryAt - Date.now()) / 1000)),
    );
  let last = "读取失败";
  try {
    const r = await fetch(url, {
      ...(relay
        ? {
            headers: {
              Accept: "application/json",
              "X-Engine": "curl",
              "X-Cache-Tolerance": "60",
            },
          }
        : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
    const text = await r.text();
    if (text.length > 16 * 1024 * 1024) throw new Error("响应过大");
    if (!r.ok) {
      if (relay && (r.status === 401 || r.status === 403))
        throw new Error(
          "公共服务限制了匿名查询，请使用下方“从Enka官方读取并粘贴JSON”。无需账号或下载文件",
        );
      if (relay && r.status === 429) {
        const retry = r.headers.get("Retry-After");
        const seconds =
          retry && /^\d+$/.test(retry)
            ? Number(retry)
            : retry
              ? Math.ceil((Date.parse(retry) - Date.now()) / 1000)
              : 60;
        const delay = Number.isFinite(seconds) ? Math.max(1, seconds) : 60;
        relayRetryAt = Date.now() + delay * 1000;
        throw new Error(rateLimitMessage(delay));
      }
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
    if (relay) data = unwrapReader(data, uid);
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
    if (data.uid != null && String(data.uid) !== uid)
      throw new Error("返回的UID与查询不一致，请稍后重试");
    const ttl =
      typeof data.ttl === "number" && Number.isFinite(data.ttl)
        ? Math.max(1, Math.min(data.ttl, 3600))
        : 60;
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    if (relay) cache.set(uid, { data, expires: Date.now() + ttl * 1000 });
    return data;
  } catch (e) {
    if (signal.aborted) throw e;
    last =
      (e as Error).name === "TimeoutError"
        ? "查询超时，请稍后重试"
        : (e as Error).message;
  }
  throw new Error(
    relay
      ? `公共Enka查询服务暂不可用，请稍后重试或使用JSON导入。${last}`
      : last,
  );
}
