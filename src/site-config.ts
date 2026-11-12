export const SITE = {
  author: "WYH827",
  github: "https://github.com/WYH827",
  bilibili: "https://space.bilibili.com/544854596",
  repository:
    import.meta.env.VITE_REPOSITORY_URL ||
    "https://github.com/WYH827/GenshinDamageCalculator",
  website:
    import.meta.env.VITE_SITE_URL ||
    (import.meta.env.VITE_SITE_PUBLISHED === "true" &&
    typeof location !== "undefined"
      ? new URL(import.meta.env.BASE_URL, location.href).href
      : "https://wyh827.github.io/GenshinDamageCalculator/"),
  published: import.meta.env.VITE_SITE_PUBLISHED === "true",
};
export const ENKA_PROVIDERS = {
  microgg: "MicroGG（默认）",
  cloudflare: "Cloudflare（Enka官方）",
} as const;
export type EnkaProvider = keyof typeof ENKA_PROVIDERS;
export function enkaApiUrl(uid: string, provider: EnkaProvider = "microgg") {
  if (provider === "microgg")
    return `https://profile.microgg.cn/api/uid/${uid}`;
  const endpoint = import.meta.env.VITE_ENKA_API_BASE?.trim().replace(
    /\/$/,
    "",
  );
  if (endpoint) return `${endpoint}/api/enka/${uid}`;
  if (import.meta.env.VITE_STATIC_HOST === "true")
    return `https://enka-api.wyh827.workers.dev/api/enka/${uid}`;
  return `/api/enka/${uid}`;
}
