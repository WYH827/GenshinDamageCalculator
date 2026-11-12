import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import { queryEnka } from "./server/enka-service.ts";
import { isEnkaSource } from "./shared/enka-sources.ts";

function send(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}
function middleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url ?? "/", "http://localhost"),
    pathname = url.pathname;
  if (!pathname.startsWith("/api/enka/")) return next();
  if (req.method !== "GET")
    return send(res, 405, JSON.stringify({ error: "仅支持GET" }));
  const match = /^\/api\/enka\/([1-9]\d{8,9})\/?$/.exec(pathname);
  if (!match)
    return send(res, 400, JSON.stringify({ error: "请输入9或10位数字UID" }));
  const source = url.searchParams.get("source") ?? "enka";
  if (!isEnkaSource(source))
    return send(res, 400, JSON.stringify({ error: "未知数据来源" }));
  void queryEnka(match[1], source).then((result) =>
    send(res, result.status, result.body),
  );
}
export default function enkaProxy(): Plugin {
  return {
    name: "enka-equipment-import",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
