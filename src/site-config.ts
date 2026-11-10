export const SITE = {
  author: "WYH827",
  github: "https://github.com/WYH827",
  bilibili: "https://space.bilibili.com/544854596",
  repository:
    import.meta.env.VITE_REPOSITORY_URL ||
    "https://github.com/WYH827/GenshinDamageCalculator",
  website:
    import.meta.env.VITE_SITE_URL ||
    "https://wyh827.github.io/GenshinDamageCalculator/",
  published: import.meta.env.VITE_SITE_PUBLISHED === "true",
};
export function enkaApiUrl(uid: string) {
  const endpoint = import.meta.env.VITE_ENKA_API_BASE?.trim().replace(
    /\/$/,
    "",
  );
  if (endpoint) return `${endpoint}/api/enka/${uid}`;
  if (import.meta.env.VITE_STATIC_HOST === "true")
    throw new Error(
      "在线版尚未配置UID查询服务，可先用JSON快速导入；作者配置Enka接口后即可使用UID查询。",
    );
  return `/api/enka/${uid}`;
}
