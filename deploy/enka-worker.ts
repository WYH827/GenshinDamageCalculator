import { queryEnka } from "../server/enka-service";
type Env = { ALLOWED_ORIGIN?: string };
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowedOrigin = env.ALLOWED_ORIGIN || new URL(request.url).origin;
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (origin === allowedOrigin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    }
    const respond = (status: number, body: string) =>
      new Response(body, { status, headers });
    if (origin && origin !== allowedOrigin)
      return respond(403, JSON.stringify({ error: "此来源未获准访问接口" }));
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "GET")
      return respond(405, JSON.stringify({ error: "仅支持GET" }));
    const uid = /^\/api\/enka\/([1-9]\d{8,9})\/?$/.exec(
      new URL(request.url).pathname,
    )?.[1];
    if (!uid)
      return respond(400, JSON.stringify({ error: "请输入9或10位数字UID" }));
    const result = await queryEnka(uid);
    return respond(result.status, result.body);
  },
};
