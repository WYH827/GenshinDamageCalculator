import { enkaSourceUrl, type EnkaSource } from "../shared/enka-sources";
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
  "cloudflare-page": "Cloudflare转发 · MicroGG网页JSON（默认）",
  cloudflare: "Cloudflare转发 · Enka官方",
  "cloudflare-microgg": "Cloudflare转发 · MicroGG API",
  microgg: "直连 · MicroGG API",
  enka: "直连 · Enka官方",
  page: "直连 · MicroGG网页JSON（HTTP）",
} as const;
export type EnkaProvider = keyof typeof ENKA_PROVIDERS;
export const DEFAULT_ENKA_PROVIDER: EnkaProvider = "cloudflare-page";
export const isDiscouragedProvider = (provider: EnkaProvider) =>
  provider !== "cloudflare-page" && provider !== "cloudflare";
// Native select popups do not consistently render CSS text-decoration on Windows.
// Combining strike marks keep the crossed-out label visible in the popup too.
export const enkaProviderLabel = (provider: EnkaProvider) =>
  isDiscouragedProvider(provider)
    ? Array.from(ENKA_PROVIDERS[provider], (char) =>
        /\s/.test(char) ? char : `${char}\u0336`,
      ).join("")
    : ENKA_PROVIDERS[provider];
export const providerSource = (provider: EnkaProvider): EnkaSource =>
  provider === "cloudflare"
    ? "enka"
    : provider === "cloudflare-microgg"
      ? "microgg"
      : provider === "cloudflare-page"
        ? "page"
        : provider;
export const isProxiedProvider = (provider: EnkaProvider) =>
  provider.startsWith("cloudflare");
export function enkaApiUrl(
  uid: string,
  provider: EnkaProvider = DEFAULT_ENKA_PROVIDER,
) {
  const source = providerSource(provider);
  if (!isProxiedProvider(provider)) return enkaSourceUrl(uid, source);
  enkaSourceUrl(uid, source); // Validate UID for proxy routes too.
  const endpoint = import.meta.env.VITE_ENKA_API_BASE?.trim().replace(
    /\/$/,
    "",
  );
  const base =
    endpoint ||
    (import.meta.env.VITE_STATIC_HOST === "true"
      ? "https://enka-api.wyh827.workers.dev"
      : "");
  return `${base}/api/enka/${uid}${source === "enka" ? "" : `?source=${source}`}`;
}
