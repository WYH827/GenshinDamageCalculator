import enka from "./enka-worker";

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

// One deployment serves both the calculator and its same-origin Enka API.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/enka" || pathname.startsWith("/api/enka/"))
      return enka.fetch(request, {});
    if (pathname.startsWith("/api/"))
      return Response.json({ error: "接口不存在" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
