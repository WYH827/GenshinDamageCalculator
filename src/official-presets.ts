import { z } from "zod";
import { parsePreset, parseProject } from "./storage";
export const PRESET_FOLDERS = {
  project: "方案预设",
  character: "角色",
  weapon: "武器",
} as const;
export type OfficialPresetKind = keyof typeof PRESET_FOLDERS;
const entrySchema = z
  .object({
    id: z.string().min(1).max(100),
    kind: z.enum(["project", "character", "weapon"]),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).default(""),
    author: z.string().max(100).default(""),
    file: z.string().min(1).max(400),
  })
  .refine((e) => {
    const parts = e.file.split("/");
    return (
      parts.length === 2 &&
      parts[0] === PRESET_FOLDERS[e.kind] &&
      /^[^/\\?#]+\.json$/i.test(parts[1]) &&
      parts[1] !== ".json"
    );
  }, "预设文件必须位于对应分类目录");
export const officialIndexSchema = z
  .object({ version: z.literal(1), presets: z.array(entrySchema).max(5000) })
  .refine(
    (x) => new Set(x.presets.map((p) => p.id)).size === x.presets.length,
    "预设ID重复",
  );
export type OfficialPresetEntry = z.infer<typeof entrySchema>;
export function parseOfficialPreset(entry: OfficialPresetEntry, raw: unknown) {
  if (entry.kind === "project")
    return { kind: "project" as const, data: parseProject(raw) };
  const preset = parsePreset(raw);
  if (preset.kind !== entry.kind) throw new Error("预设类型与目录不匹配");
  return { kind: entry.kind, preset };
}
async function json(url: string, signal: AbortSignal) {
  const r = await fetch(url, { signal, cache: "no-cache" });
  if (!r.ok) throw new Error(`官方预设库读取失败（${r.status}）`);
  const text = await r.text();
  if (text.length > 16 * 1024 * 1024) throw new Error("预设文件过大");
  return JSON.parse(text);
}
export async function loadOfficialIndex(signal: AbortSignal) {
  return officialIndexSchema.parse(
    await json(`${import.meta.env.BASE_URL}presets/index.json`, signal),
  );
}
export async function loadOfficialPreset(
  entry: OfficialPresetEntry,
  signal: AbortSignal,
) {
  const valid = entrySchema.parse(entry);
  return parseOfficialPreset(
    valid,
    await json(
      `${import.meta.env.BASE_URL}presets/${valid.file.split("/").map(encodeURIComponent).join("/")}`,
      signal,
    ),
  );
}
