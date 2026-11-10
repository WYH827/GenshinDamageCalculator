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
export function enkaApiUrl(uid: string) {
  const endpoint = import.meta.env.VITE_ENKA_API_BASE?.trim().replace(
    /\/$/,
    "",
  );
  if (endpoint) return `${endpoint}/api/enka/${uid}`;
  if (import.meta.env.VITE_STATIC_HOST === "true")
    return `https://r.jina.ai/https://enka.network/api/uid/${uid}/`;
  return `/api/enka/${uid}`;
}
export const usesPublicEnkaRelay = () =>
  import.meta.env.VITE_STATIC_HOST === "true" &&
  !import.meta.env.VITE_ENKA_API_BASE?.trim();
