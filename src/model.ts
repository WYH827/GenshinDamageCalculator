import { scheduledCount } from "./schedule";
export const CHARACTER_ELEMENTS = [
  "火",
  "冰",
  "雷",
  "草",
  "岩",
  "风",
  "水",
] as const;
export const ELEMENTS = [...CHARACTER_ELEMENTS, "物理"] as const;
export const CHARACTER_LEVELS = [
  ...Array.from({ length: 90 }, (_, i) => i + 1),
  95,
  100,
];
export const starsForLevel = (level: number): 0 | 1 | 3 =>
  level === 100 ? 3 : level === 95 ? 1 : 0;
export const constellationLabel = (c: Character) =>
  `${c.level === 95 || c.level === 100 ? `${c.level}级` : ""}${c.constellation || "0"}`;
export const ATTACKS = ["普攻", "重击", "战技", "大招"] as const;
export const VARIABLE_STATS = [
  "生命值",
  "攻击力",
  "防御力",
  "元素精通",
  "暴击率",
  "暴击伤害",
  "元素充能效率",
  "治疗加成",
  ...CHARACTER_ELEMENTS.map((e) => `${e}元素伤害加成`),
  "物理伤害加成",
] as const;
export const VALUE_MODES = {
  number: "固定数值",
  base: "角色基础数值",
  outside: "角色局外数值",
  live: "角色实时数值",
} as const;
export type FormulaRule = { id: string; condition: string; formula: string };
export type FormulaPreset = {
  threshold: number;
  step: number;
  change: number;
  cap: number | null;
  wholeSteps: boolean;
};
export type EffectStacks = {
  enabled: boolean;
  mode: "direct" | "independent" | "periodic";
  limit: "none" | "capped" | "unlimited";
  max: number;
  initial: number;
  duration: number | null;
  interval: number;
  delta: number;
};
export const defaultEffectStacks = (): EffectStacks => ({
  enabled: true,
  mode: "independent",
  limit: "capped",
  max: 5,
  initial: 1,
  duration: 10,
  interval: 1,
  delta: 1,
});
export const stackLimit = (s: EffectStacks) =>
  s.limit === "unlimited" ? Infinity : s.limit === "none" ? 1 : s.max;
export type EffectTimingPreset = {
  activeFor?: number | null;
  mode?: EffectStacks["mode"];
  count: number;
  duration: number | null;
  limit: EffectStacks["limit"];
  max: number;
  interval: number;
  delta: number;
};
export type EffectTiming = EffectTimingPreset & { mode: EffectStacks["mode"] };
export const REALTIME_KINDS = {
  fixed: "固定效果",
  independent: "多层类效果 · 每层持续时间独立",
  independentPeriodic: "多层类效果 · 每层持续时间独立 · 定时增减",
  shared: "多层类效果 · 每层共用持续时间",
  sharedPeriodic: "多层类效果 · 每层共用持续时间 · 定时增减",
} as const;
export type RealtimeKind = keyof typeof REALTIME_KINDS;
export type RealtimeConfig = {
  activeFor?: number | null;
  kind: RealtimeKind;
  max: number | null;
  initial: number;
  duration: number | null;
  interval: number;
  delta: number;
};
export const SCALINGS = ["生命值", "攻击力", "防御力", "元素精通"] as const;
export const SPECIALS = [
  "月感电",
  "月绽放",
  "月结晶",
  "星超导",
  "星扩散",
] as const;
export const EFFECT_TYPES = [
  "生命值",
  "攻击力",
  "防御力",
  "元素精通",
  "暴击率",
  "暴击伤害",
  "敌方抗性",
  "增伤区",
  "倍率区",
  "基础值加成",
  "易伤",
  "减伤",
  "降低防御",
  "无视防御",
  "星月基础提升",
  "星月增伤",
  "星月额外提升",
  "擢升",
  "增幅反应增伤",
  "独立乘区",
] as const;
export const DAMAGE_EFFECTS = [
  "增伤区",
  "倍率区",
  "基础值加成",
  "易伤",
  "减伤",
  "无视防御",
  "星月基础提升",
  "星月增伤",
  "星月额外提升",
  "擢升",
  "增幅反应增伤",
  "独立乘区",
] as const;
export const effectTypeName = (type: Effect["type"]) =>
  type === "增伤区"
    ? "基础增伤"
    : type === "倍率区"
      ? "改变倍率"
      : type === "基础值加成" || type === "星月额外提升"
        ? "基础值加成 / 星月额外提升"
        : type;
export const effectTypeNote = (type: Effect["type"]) => {
  if (type === "基础值加成" || type === "星月额外提升")
    return "【造成的伤害提高 X】";
  if (["增伤区", "星月增伤", "增幅反应增伤", "擢升"].includes(type))
    return "【造成的伤害提升 X%】";
  if (type === "易伤") return "【目标受到的伤害提升 X%】";
  if (type === "减伤") return "【目标受到的伤害降低 X%】";
  if (type === "星月基础提升") return "【造成的XXX反应的基础伤害提升 X%】";
  if (type === "独立乘区") return "【造成原本 X% 的伤害】";
  return "";
};
export const isEnemyEffect = (type: string) =>
  ["敌方抗性", "降低防御", "易伤", "减伤"].includes(type);
export const isDamageEffect = (type: string) =>
  (DAMAGE_EFFECTS as readonly string[]).includes(type);
export const PERCENT_EFFECTS = [
  "增伤区",
  "倍率区",
  "易伤",
  "减伤",
  "降低防御",
  "无视防御",
  "星月基础提升",
  "星月增伤",
  "敌方抗性",
  "擢升",
  "增幅反应增伤",
] as const;
export const STATS = {
  critRate: {
    name: "暴击率",
    average: 3.3,
    percent: true,
    tiers: "2.7 / 3.1 / 3.5 / 3.9%",
  },
  critDamage: {
    name: "暴击伤害",
    average: 6.6,
    percent: true,
    tiers: "5.4 / 6.2 / 7.0 / 7.8%",
  },
  atkPercent: {
    name: "攻击力百分比",
    average: 5,
    percent: true,
    tiers: "4.1 / 4.7 / 5.3 / 5.8%",
  },
  hpPercent: {
    name: "生命值百分比",
    average: 5,
    percent: true,
    tiers: "4.1 / 4.7 / 5.3 / 5.8%",
  },
  defPercent: {
    name: "防御力百分比",
    average: 6.2,
    percent: true,
    tiers: "5.1 / 5.8 / 6.6 / 7.3%",
  },
  recharge: {
    name: "元素充能效率",
    average: 5.5,
    percent: true,
    tiers: "4.5 / 5.2 / 5.8 / 6.5%",
  },
  mastery: {
    name: "元素精通",
    average: 20,
    percent: false,
    tiers: "16 / 19 / 21 / 23",
  },
  atk: {
    name: "攻击力（固定值）",
    average: 17,
    percent: false,
    tiers: "14 / 16 / 18 / 19",
  },
  hp: {
    name: "生命值（固定值）",
    average: 254,
    percent: false,
    tiers: "209 / 239 / 269 / 299",
  },
  def: {
    name: "防御力（固定值）",
    average: 20,
    percent: false,
    tiers: "16 / 19 / 21 / 23",
  },
} as const;
export const BONUS_STATS = {
  pyroBonus: {
    name: "火元素伤害加成",
    average: null,
    percent: true,
    tiers: "",
  },
  cryoBonus: {
    name: "冰元素伤害加成",
    average: null,
    percent: true,
    tiers: "",
  },
  electroBonus: {
    name: "雷元素伤害加成",
    average: null,
    percent: true,
    tiers: "",
  },
  dendroBonus: {
    name: "草元素伤害加成",
    average: null,
    percent: true,
    tiers: "",
  },
  geoBonus: { name: "岩元素伤害加成", average: null, percent: true, tiers: "" },
  anemoBonus: {
    name: "风元素伤害加成",
    average: null,
    percent: true,
    tiers: "",
  },
  hydroBonus: {
    name: "水元素伤害加成",
    average: null,
    percent: true,
    tiers: "",
  },
  physicalBonus: {
    name: "物理伤害加成",
    average: null,
    percent: true,
    tiers: "",
  },
} as const;
export const ALL_STATS = {
  ...STATS,
  ...BONUS_STATS,
  healingBonus: { name: "治疗加成", average: null, percent: true, tiers: "" },
  notImportant: {
    name: "NOT IMPORTANT",
    average: null,
    percent: false,
    tiers: "",
  },
} as const;
export const ASCENSION_STATS = [
  "atkPercent",
  "defPercent",
  "hpPercent",
  "recharge",
  "critRate",
  "critDamage",
  "mastery",
  "healingBonus",
  "physicalBonus",
  "pyroBonus",
  "hydroBonus",
  "cryoBonus",
  "electroBonus",
  "anemoBonus",
  "geoBonus",
  "dendroBonus",
] as const;
export type AscensionStat = {
  type: (typeof ASCENSION_STATS)[number];
  value: number;
};
const COMMON_MAIN_STATS = [
  "atkPercent",
  "hpPercent",
  "defPercent",
  "mastery",
  "notImportant",
] as const;
export const SANDS_STATS = [
  ...COMMON_MAIN_STATS.filter((s) => s !== "notImportant"),
  "recharge",
  "notImportant",
] as const;
export const GOBLET_STATS = [
  ...COMMON_MAIN_STATS.filter((s) => s !== "notImportant"),
  ...(Object.keys(BONUS_STATS) as (keyof typeof BONUS_STATS)[]),
  "notImportant",
] as const;
export const CIRCLET_STATS = [
  ...COMMON_MAIN_STATS.filter((s) => s !== "notImportant"),
  "critRate",
  "critDamage",
  "notImportant",
] as const;
export const MAIN_STAT_VALUES = {
  recharge: 51.8,
  hp: 4780,
  atk: 311,
  atkPercent: 46.6,
  hpPercent: 46.6,
  defPercent: 58.3,
  mastery: 187,
  critRate: 31.1,
  critDamage: 62.2,
  pyroBonus: 46.6,
  cryoBonus: 46.6,
  electroBonus: 46.6,
  dendroBonus: 46.6,
  geoBonus: 46.6,
  anemoBonus: 46.6,
  hydroBonus: 46.6,
  physicalBonus: 58.3,
  notImportant: 0,
} as const;
export type MainStats = {
  flower: "hp";
  feather: "atk";
  sands: (typeof SANDS_STATS)[number];
  goblet: (typeof GOBLET_STATS)[number];
  circlet: (typeof CIRCLET_STATS)[number];
};
export const defaultMainStats = (): MainStats => ({
  flower: "hp",
  feather: "atk",
  sands: "notImportant",
  goblet: "notImportant",
  circlet: "notImportant",
});
export const MAIN_SLOTS = {
  flower: "花",
  feather: "毛",
  sands: "沙",
  goblet: "杯",
  circlet: "头",
} as const;
export function mainStatLabel(key: keyof typeof MAIN_STAT_VALUES) {
  return key === "notImportant"
    ? "NOT IMPORTANT"
    : `${ALL_STATS[key].name} ${MAIN_STAT_VALUES[key]}${ALL_STATS[key].percent ? "%" : ""}`;
}
export type StatKey = keyof typeof ALL_STATS;
export type CharacterElement = (typeof CHARACTER_ELEMENTS)[number];
export type Element = (typeof ELEMENTS)[number];
export type Damage = {
  element: Element | "全部";
  attack: (typeof ATTACKS)[number] | "全部";
  scaling: (typeof SCALINGS)[number] | "全部";
  special: (typeof SPECIALS)[number] | "";
};
export type Character = {
  avatarUrl?: string;
  id: string;
  name: string;
  short: string;
  constellation: string;
  level: number;
  gold: number;
  limitedGold: number;
  stars: 0 | 1 | 3;
  element: CharacterElement;
  elementNeedsReview?: boolean;
  hp: number;
  atk: number;
  def: number;
  critRate: number;
  critDamage: number;
  mastery: number;
  bonus: number;
  physicalBonus: number;
  ascension?: AscensionStat;
  legacyAscension?: AscensionStat[];
};
export type Substat = {
  id: string;
  type: StatKey;
  mode: "rolls" | "direct";
  value: number;
};
export type EffectOrigin = {
  kind: "weapon" | "artifact" | "talent" | "skill" | "global";
  name: string;
};
export type Effect = {
  enabled?: boolean;
  id: string;
  name: string;
  nameMode?: "auto" | "custom";
  sourceId: string;
  target: "self" | "team" | "custom" | "elements" | "foreground";
  targetIds: string[];
  targetElements: CharacterElement[];
  type: (typeof EFFECT_TYPES)[number];
  multiplierMode: "add" | "scale" | "unconfirmed";
  valueMode: keyof typeof VALUE_MODES;
  value: number;
  unit: "flat" | "percent";
  variableCharacterId: string;
  variableStat: string;
  advanced: boolean;
  formulas: FormulaRule[];
  formulaPreset?: FormulaPreset;
  stacks?: EffectStacks;
  timingPreset?: EffectTimingPreset;
  global: boolean;
  category?: "global" | "realtime";
  outsideActive?: boolean;
  realtimeKind?: "fixed" | "stacking";
  realtime?: RealtimeConfig;
  boundSkillIds?: string[];
  coefficient: number;
  duration: number | null;
  damage: Damage;
  origin?: EffectOrigin;
  skillFilter?: { id: string; name: string };
  amplificationReaction?: "全部" | AmplificationReaction;
};
export type Weapon = {
  iconUrl?: string;
  id: string;
  name: string;
  short: string;
  gold: number;
  limitedGold: number;
  characterId: string;
  atk: number;
  substats: Substat[];
  effects: Effect[];
};
export type Artifact = {
  iconUrls?: string[];
  mainStats: MainStats;
  mainStat20?: Partial<Record<keyof MainStats, boolean>>;
  mainStatValues?: Partial<Record<keyof MainStats, number>>;
  importedMainStats?: Partial<
    Record<keyof MainStats, { type: StatKey; value: number; label?: string }>
  >;
  id: string;
  name: string;
  characterId: string;
  substats: Substat[];
  effects: Effect[];
};
export function mainOptions(
  slot: keyof MainStats,
): readonly (keyof typeof MAIN_STAT_VALUES)[] {
  return slot === "flower"
    ? ["hp"]
    : slot === "feather"
      ? ["atk"]
      : slot === "sands"
        ? SANDS_STATS
        : slot === "goblet"
          ? GOBLET_STATS
          : CIRCLET_STATS;
}
export function artifactMainStat(
  a: Pick<
    Artifact,
    "mainStats" | "importedMainStats" | "mainStat20" | "mainStatValues"
  >,
  slot: keyof MainStats,
) {
  return (
    a.importedMainStats?.[slot] ?? {
      type: a.mainStats[slot],
      value:
        a.mainStats[slot] === "notImportant"
          ? 0
          : a.mainStat20?.[slot] === false
            ? (a.mainStatValues?.[slot] ?? 0)
            : MAIN_STAT_VALUES[a.mainStats[slot]],
    }
  );
}
export function artifactMainStatLabel(
  a: Pick<
    Artifact,
    "mainStats" | "importedMainStats" | "mainStat20" | "mainStatValues"
  >,
  slot: keyof MainStats,
) {
  const stat = artifactMainStat(a, slot);
  return (
    stat.label ??
    (stat.type === "notImportant"
      ? "NOT IMPORTANT"
      : `${ALL_STATS[stat.type].name} ${fmt(stat.value)}${ALL_STATS[stat.type].percent ? "%" : ""}`)
  );
}
export type Skill = {
  id: string;
  name: string;
  characterId: string;
  kind: "damage" | "effect" | "empty";
  multiplier: number;
  scalingMode: "base" | "outside" | "live";
  damage: Damage;
  effects: Effect[];
};
export type Talent = {
  id: string;
  name: string;
  characterId: string;
  effects: Effect[];
};
export type Enemy = { level: number; resistance: Record<Element, number> };
export const defaultEnemy = (): Enemy => ({
  level: 100,
  resistance: Object.fromEntries(ELEMENTS.map((e) => [e, 10])) as Record<
    Element,
    number
  >,
});
export type TimelineEvent = (
  | {
      id: string;
      time: number;
      kind: "effectTrigger";
      effectKey: string;
      timing: EffectTiming;
      usePreset?: boolean;
    }
  | {
      id: string;
      time: number;
      kind: "skill";
      skillId: string;
      starStacks?: number;
      legacyStarCoefficient?: number;
      amplification?: AmplificationReaction;
      repeat?: { interval: number; duration: number | null };
      generatedBy?: string;
    }
  | { id: string; time: number; kind: "effect"; effect: Effect }
  | { id: string; time: number; kind: "switch"; characterId: string }
  | {
      id: string;
      time: number;
      kind: "trigger";
      sourceKind: "weapon" | "artifact" | "talent";
      sourceId: string;
    }
  | {
      id: string;
      time: number;
      kind: "stacks";
      effectKey: string;
      count: number;
    }
) & {
  enabled?: boolean;
  disabledOccurrences?: string[];
  disabledEffectKeys?: string[];
  stackCounts?: Record<string, number>;
  effectTimings?: Record<string, EffectTiming>;
  effectUsePresets?: Record<string, boolean>;
};
export type Project = {
  version: 1;
  starStackVersion?: 2;
  name: string;
  initialCharacterId: string;
  characters: Character[];
  weapons: Weapon[];
  artifacts: Artifact[];
  skills: Skill[];
  globals: Effect[];
  customEffects?: Effect[];
  talents: Talent[];
  enemy: Enemy;
  timeline: TimelineEvent[];
};
export type Preset =
  | { id: string; name: string; kind: "character"; data: Character }
  | { id: string; name: string; kind: "weapon"; data: Weapon };
export const uid = () => crypto.randomUUID();
export const damage = (all = false): Damage => ({
  element: all ? "全部" : "火",
  attack: all ? "全部" : "战技",
  scaling: all ? "全部" : "攻击力",
  special: "",
});
export const character = (): Character => ({
  id: uid(),
  name: "",
  short: "",
  constellation: "0",
  level: 90,
  gold: 0,
  limitedGold: 0,
  stars: 0,
  element: "火",
  hp: 0,
  atk: 0,
  def: 0,
  critRate: 5,
  critDamage: 50,
  mastery: 0,
  bonus: 0,
  physicalBonus: 0,
});
export const effect = (sourceId: string, infinite = false): Effect => ({
  id: uid(),
  name: "",
  sourceId,
  target: "team",
  targetIds: [],
  targetElements: [],
  type: "攻击力",
  multiplierMode: "add",
  valueMode: "number",
  value: 0,
  unit: "percent",
  variableCharacterId: sourceId,
  variableStat: "攻击力",
  coefficient: 1,
  advanced: false,
  formulas: [],
  global: false,
  outsideActive: false,
  duration: infinite ? null : 10,
  damage: damage(true),
});
export const skill = (characterId: string): Skill => ({
  id: uid(),
  name: "",
  characterId,
  kind: "damage",
  multiplier: 100,
  scalingMode: "live",
  damage: damage(),
  effects: [],
});
export function newProject(): Project {
  const characters = Array.from({ length: 4 }, character);
  return {
    version: 1,
    starStackVersion: 2,
    name: "未命名方案",
    characters,
    initialCharacterId: characters[0].id,
    weapons: characters.map((c) => ({
      id: uid(),
      characterId: c.id,
      name: "",
      short: "",
      gold: 0,
      limitedGold: 0,
      atk: 0,
      substats: [],
      effects: [],
    })),
    artifacts: characters.map((c) => ({
      mainStats: defaultMainStats(),
      id: uid(),
      characterId: c.id,
      name: "",
      substats: [],
      effects: [],
    })),
    skills: [],
    globals: [],
    customEffects: [],
    talents: [],
    enemy: defaultEnemy(),
    timeline: [],
  };
}
export const statValue = (s: Substat) => {
  if (s.type === "notImportant") return 0;
  const average = ALL_STATS[s.type].average;
  return Number(
    (s.value * (s.mode === "rolls" && average !== null ? average : 1)).toFixed(
      6,
    ),
  );
};
export const fmt = (n: number) =>
  new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 }).format(n);
export const charName = (c: Character, index: number) =>
  c.name || `角色 ${String(index + 1).padStart(2, "0")}`;
export function teamName(characters: Character[]) {
  return (
    characters
      .map((c) =>
        c.short || c.name
          ? `${c.short || Array.from(c.name)[0]}${constellationLabel(c)}`
          : "",
      )
      .filter(Boolean)
      .join(" / ") || "等待配置队伍"
  );
}
export function resultTeamName(p: Project): string {
  if (
    !p.characters.some((c) => c.short || c.name) &&
    !p.weapons.some((w) => w.short)
  )
    return "等待配置队伍";
  return p.characters
    .map(
      (c, i) =>
        `${constellationLabel(c)}${p.weapons.find((w) => w.characterId === c.id)?.short || ""}${c.short || Array.from(c.name)[0] || `角色${i + 1}`}`,
    )
    .join(" ");
}
export function teamCosts(p: Project) {
  return [...p.characters, ...p.weapons].reduce(
    (sum, item) => ({
      gold: sum.gold + item.gold,
      limitedGold: sum.limitedGold + item.limitedGold,
    }),
    { gold: 0, limitedGold: 0 },
  );
}
export function sortedEquipment<T extends { characterId: string }>(
  items: T[],
  characters: Character[],
): T[] {
  return [...items].sort(
    (a, b) =>
      characters.findIndex((c) => c.id === a.characterId) -
      characters.findIndex((c) => c.id === b.characterId),
  );
}
export function assignEquipment<T extends { id: string; characterId: string }>(
  items: T[],
  id: string,
  target: string,
): T[] {
  const previous = items.find((item) => item.id === id)?.characterId;
  return items.map((item) =>
    item.id === id
      ? { ...item, characterId: target }
      : item.characterId === target
        ? { ...item, characterId: previous! }
        : item,
  );
}
export const timelineEnd = (events: TimelineEvent[]) =>
  events
    .filter((e) => e.enabled !== false)
    .reduce(
      (end, e) =>
        Math.max(
          end,
          e.kind === "skill" &&
            e.repeat?.duration !== undefined &&
            e.repeat.duration !== null
            ? e.time +
                scheduledCount(e.repeat.duration, e.repeat.interval) *
                  e.repeat.interval
            : e.time,
        ),
      0,
    );
export function sortedTimeline(
  events: TimelineEvent[],
  includeDisabled = false,
) {
  const end = timelineEnd(events),
    expanded: TimelineEvent[] = [];
  for (const e of events) {
    if (includeDisabled || e.enabled !== false) expanded.push(e);
    if (e.enabled === false || e.kind !== "skill" || !e.repeat) continue;
    const count = scheduledCount(
      e.repeat.duration ?? Math.max(0, end - e.time),
      e.repeat.interval,
    );
    if (count > 10000 || expanded.length + count > 20000)
      throw new Error(
        "循环技能事件过多，请增大间隔或缩短时间轴（最多10000次）",
      );
    for (let i = 1; i <= count; i++)
      expanded.push({
        ...e,
        id: `${e.id}~${i}`,
        time: Number((e.time + i * e.repeat.interval).toPrecision(15)),
        repeat: undefined,
        generatedBy: e.id,
        enabled: !e.disabledOccurrences?.includes(`${e.id}~${i}`),
      });
  }
  return expanded
    .filter((e) => includeDisabled || e.enabled !== false)
    .sort((a, b) => a.time - b.time);
}
// Kept for older callers; non-damaging skills now have fully active effects.
export function emptySkillEffectKeys(_p: Project) {
  return new Set<string>();
}
export const endTime = (p: Project) => timelineEnd(p.timeline);
export function deleteSkill(p: Project, id: string): Project {
  const clean = (e: Effect): Effect =>
    e.boundSkillIds?.includes(id)
      ? { ...e, boundSkillIds: e.boundSkillIds.filter((key) => key !== id) }
      : e;
  return {
    ...p,
    skills: p.skills
      .filter((s) => s.id !== id)
      .map((s) => ({ ...s, effects: s.effects.map(clean) })),
    weapons: p.weapons.map((w) => ({ ...w, effects: w.effects.map(clean) })),
    artifacts: p.artifacts.map((a) => ({
      ...a,
      effects: a.effects.map(clean),
    })),
    talents: p.talents.map((t) => ({ ...t, effects: t.effects.map(clean) })),
    customEffects: p.customEffects?.map(clean),
    globals: p.globals.filter((e) => e.skillFilter?.id !== id).map(clean),
    timeline: p.timeline.filter(
      (e) =>
        (e.kind !== "skill" || e.skillId !== id) &&
        ((e.kind !== "stacks" && e.kind !== "effectTrigger") ||
          (!e.effectKey.startsWith(`skill-${id}-`) &&
            !p.globals.some(
              (g) =>
                g.skillFilter?.id === id && e.effectKey === `global-${g.id}`,
            ))),
    ),
  };
}
export function moveSkill(p: Project, id: string, direction: number): Project {
  const current = p.skills.find((s) => s.id === id)!;
  const group = p.skills.filter((s) => s.characterId === current.characterId);
  const index = group.findIndex((s) => s.id === id);
  const neighbor = group[index + direction];
  if (!neighbor) return p;
  const skills = [...p.skills];
  const a = skills.findIndex((s) => s.id === id),
    b = skills.findIndex((s) => s.id === neighbor.id);
  [skills[a], skills[b]] = [skills[b], skills[a]];
  return { ...p, skills };
}
export const STORAGE_KEY = "teyvat-studio.project.v1";
export const PRESETS_KEY = "teyvat-studio.presets.v1";
export const RESET_BACKUP_KEY = "teyvat-studio.before-reset.v1";

export function foregroundAt(p: Project, eventId: string): string {
  let current = p.initialCharacterId;
  for (const e of sortedTimeline(p.timeline)) {
    if (e.id === eventId) break;
    if (e.kind === "switch") current = e.characterId;
  }
  return current;
}
export function effectTargetValid(e: Effect): boolean {
  return (
    isEnemyEffect(e.type) ||
    (e.target === "custom"
      ? e.targetIds.length > 0
      : e.target === "elements"
        ? e.targetElements.length > 0
        : e.target !== "self" || !!e.sourceId)
  );
}
export function effectTargetIds(
  p: Project,
  e: Effect,
  eventId: string,
): string[] {
  if (isEnemyEffect(e.type)) return [];
  switch (e.target) {
    case "team":
      return p.characters.map((c) => c.id);
    case "self":
      return e.sourceId ? [e.sourceId] : [];
    case "foreground":
      return [foregroundAt(p, eventId)];
    case "elements":
      return p.characters
        .filter((c) => e.targetElements.includes(c.element))
        .map((c) => c.id);
    default:
      return e.targetIds;
  }
}

export const TRIGGER_LABELS = {
  weapon: "武器效果",
  artifact: "圣遗物",
  talent: "天赋/命座",
} as const;
export function triggerSources(
  p: Project,
  kind: keyof typeof TRIGGER_LABELS,
): (Weapon | Artifact | Talent)[] {
  return kind === "weapon"
    ? p.weapons
    : kind === "artifact"
      ? p.artifacts
      : p.talents;
}
export function triggerSource(
  p: Project,
  e: Extract<TimelineEvent, { kind: "trigger" }>,
) {
  return triggerSources(p, e.sourceKind).find((x) => x.id === e.sourceId);
}
export function deleteTalent(p: Project, id: string): Project {
  return {
    ...p,
    talents: p.talents.filter((t) => t.id !== id),
    timeline: p.timeline.filter(
      (e) =>
        (e.kind !== "trigger" ||
          e.sourceKind !== "talent" ||
          e.sourceId !== id) &&
        ((e.kind !== "stacks" && e.kind !== "effectTrigger") ||
          !e.effectKey.startsWith(`talent-${id}-`)),
    ),
  };
}

// Derived attribute effects already produce an absolute amount, not a percent.
export const usesDirectVariableValue = (
  e: Pick<Effect, "type" | "valueMode">,
) =>
  e.valueMode !== "number" && (SCALINGS as readonly string[]).includes(e.type);
export const effectUnit = (
  e: Pick<Effect, "type" | "valueMode" | "unit">,
): Effect["unit"] =>
  usesDirectVariableValue(e) || e.type === "独立乘区" ? "flat" : e.unit;

export const STAR_SUPERCONDUCT_TABLE = [
  { stacks: 1, energy: 0, bonus: 20, coefficient: 1 },
  { stacks: 2, energy: 1, bonus: 29, coefficient: 1.45 },
  { stacks: 3, energy: 2, bonus: 30, coefficient: 1.5 },
  { stacks: 4, energy: 3, bonus: 31, coefficient: 1.55 },
  { stacks: 5, energy: 4, bonus: 32, coefficient: 1.6 },
  { stacks: 6, energy: 5, bonus: 33, coefficient: 1.65 },
  { stacks: 7, energy: 6, bonus: 34, coefficient: 1.7 },
  { stacks: 8, energy: 7, bonus: 35, coefficient: 1.75 },
  { stacks: 9, energy: 8, bonus: 36, coefficient: 1.8 },
  { stacks: 10, energy: 9, bonus: 37, coefficient: 1.85 },
  { stacks: 11, energy: 10, bonus: 38, coefficient: 1.9 },
  { stacks: 12, energy: 11, bonus: 39, coefficient: 1.95 },
  { stacks: 13, energy: 12, bonus: 40, coefficient: 2 },
] as const;
export function starSuperconduct(stacks: number) {
  if (!Number.isInteger(stacks) || stacks < 1 || stacks > 13)
    throw new Error("星超导层数必须为1～13的整数（上周期元素力+1）");
  return STAR_SUPERCONDUCT_TABLE[stacks - 1];
}

export type AmplificationReaction = "蒸发" | "融化";
export const canAmplify = (s: Skill) =>
  s.kind === "damage" &&
  !s.damage.special &&
  ["火", "水", "冰"].includes(s.damage.element);
export function amplificationFor(
  s: Skill,
  reaction?: AmplificationReaction,
): AmplificationReaction | undefined {
  if (!reaction || !canAmplify(s)) return undefined;
  return s.damage.element === "水"
    ? "蒸发"
    : s.damage.element === "冰"
      ? "融化"
      : reaction;
}
export function amplificationBase(
  element: Damage["element"],
  reaction: AmplificationReaction,
): 1.5 | 2 {
  return element === "水" || (element === "火" && reaction === "融化")
    ? 2
    : 1.5;
}
export function normalizeAmplification(p: Project): Project {
  let changed = false;
  const skills = new Map(p.skills.map((s) => [s.id, s]));
  const timeline = p.timeline.map((e) => {
    if (e.kind !== "skill" || e.amplification === undefined) return e;
    const s = skills.get(e.skillId),
      reaction = s ? amplificationFor(s, e.amplification) : undefined;
    if (reaction === e.amplification) return e;
    changed = true;
    const next = { ...e };
    delete next.amplification;
    if (reaction) next.amplification = reaction;
    return next;
  });
  return changed ? { ...p, timeline } : p;
}

export const isConditionalCritEffect = (e: Effect) =>
  ["暴击率", "暴击伤害"].includes(e.type) &&
  (!!e.skillFilter ||
    e.damage.element !== "全部" ||
    e.damage.attack !== "全部" ||
    e.damage.scaling !== "全部" ||
    !!e.damage.special);
export const allowsDamageFilter = (type: string) =>
  isDamageEffect(type) || ["暴击率", "暴击伤害"].includes(type);
