export const ENKA_SOURCES = {
  enka: "Enka官方",
  microgg: "MicroGG API",
  page: "MicroGG网页JSON",
} as const;
export type EnkaSource = keyof typeof ENKA_SOURCES;
export const validUid = (uid: string) => /^[1-9]\d{8,9}$/.test(uid);
export function enkaSourceUrl(uid: string, source: EnkaSource): string {
  if (!validUid(uid)) throw new Error("请输入9或10位数字UID");
  switch (source) {
    case "enka":
      return `https://enka.network/api/uid/${uid}/`;
    case "microgg":
      return `https://profile.microgg.cn/api/uid/${uid}`;
    case "page":
      return `http://enka.microgg.cn/u/${uid}/__data.json`;
    default:
      throw new Error("未知数据来源");
  }
}
export const isEnkaSource = (value: string): value is EnkaSource =>
  Object.prototype.hasOwnProperty.call(ENKA_SOURCES, value);
