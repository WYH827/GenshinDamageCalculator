import { z } from "zod";
import { migrateEffectEvents } from "./effect-catalog";
import {
  ATTACKS,
  SCALINGS,
  ELEMENTS,
  SPECIALS,
  EFFECT_TYPES,
  STATS,
  ALL_STATS,
  ASCENSION_STATS,
  type AscensionStat,
  mainOptions,
  MAIN_STAT_VALUES,
  CHARACTER_ELEMENTS,
  SANDS_STATS,
  GOBLET_STATS,
  CIRCLET_STATS,
  defaultMainStats,
  defaultEnemy,
  effect,
  effectUnit,
  STAR_SUPERCONDUCT_TABLE,
  uid,
  CHARACTER_LEVELS,
  starsForLevel,
  triggerSources,
  VARIABLE_STATS,
  normalizeAmplification,
  type Effect,
  type Project,
  type Preset,
  type Character,
  type Weapon,
} from "./model";

const id = z.string().min(1).max(100);
const text = z.string().max(1000);
const num = z.number().finite();
const positive = num.min(0);
const count = num.int().min(0).max(Number.MAX_SAFE_INTEGER);
const stackCounts = z.record(id, count).optional();
const timingPresetSchema = z.object({
  activeFor: positive.nullable().optional(),
  mode: z.enum(["direct", "independent", "periodic"]).optional(),
  count,
  duration: positive.nullable(),
  limit: z.enum(["none", "capped", "unlimited"]),
  max: count.min(1),
  interval: num.positive(),
  delta: num.int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
});
const timingSchema = timingPresetSchema.extend({
  mode: z.enum(["direct", "independent", "periodic"]),
  count: num.int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
});
const stacksSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["direct", "independent", "periodic"]),
  limit: z.enum(["none", "capped", "unlimited"]),
  max: count.min(1),
  initial: count,
  duration: positive.nullable(),
  interval: num.positive(),
  delta: num.int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
});
const damageSchema = z.object({
  element: z.enum([...ELEMENTS, "全部"]),
  attack: z.enum([...ATTACKS, "全部"]),
  scaling: z.enum([...SCALINGS, "全部"]),
  special: z.enum([...SPECIALS, ""]),
});
const characterSchema = z
  .object({
    avatarUrl: z.string().max(2000).optional(),
    id,
    name: text,
    short: z.string().refine((s) => Array.from(s).length <= 1),
    constellation: text,
    level: num
      .refine(
        (v) => CHARACTER_LEVELS.includes(v),
        "角色等级只能为1～90、95、100",
      )
      .optional(),
    gold: positive,
    limitedGold: positive.default(0),
    stars: z.union([z.literal(0), z.literal(1), z.literal(3)]),
    element: z.enum(ELEMENTS),
    elementNeedsReview: z.boolean().optional(),
    hp: positive,
    atk: positive,
    def: positive,
    critRate: num,
    critDamage: num,
    mastery: positive,
    bonus: num,
    physicalBonus: num.optional(),
    ascension: z
      .object({ type: z.enum(ASCENSION_STATS), value: num })
      .optional(),
    legacyAscension: z
      .array(z.object({ type: z.enum(ASCENSION_STATS), value: num }))
      .max(20)
      .optional(),
  })
  .transform((c) => {
    const legacy = /^(\d+)级(.*)$/.exec(c.constellation);
    const level =
      c.level ??
      (legacy
        ? Number(legacy[1])
        : c.stars === 3
          ? 100
          : c.stars === 1
            ? 95
            : 90);
    return {
      ...c,
      level,
      stars: starsForLevel(level),
      constellation: legacy ? legacy[2] : c.constellation,
    };
  })
  .refine(
    (c) => CHARACTER_LEVELS.includes(c.level),
    "角色等级只能为1～90、95、100",
  )
  .transform((c) =>
    c.element === "物理"
      ? {
          ...c,
          element: "火" as const,
          bonus: 0,
          physicalBonus: c.physicalBonus ?? c.bonus,
          elementNeedsReview: true,
        }
      : { ...c, element: c.element, physicalBonus: c.physicalBonus ?? 0 },
  )
  .transform((c) => {
    const entries: AscensionStat[] = c.ascension
      ? [c.ascension, ...(c.legacyAscension ?? [])]
      : [
          ...(c.critRate !== 5
            ? [
                {
                  type: "critRate" as const,
                  value: Number((c.critRate - 5).toFixed(12)),
                },
              ]
            : []),
          ...(c.critDamage !== 50
            ? [
                {
                  type: "critDamage" as const,
                  value: Number((c.critDamage - 50).toFixed(12)),
                },
              ]
            : []),
          ...(c.mastery
            ? [{ type: "mastery" as const, value: c.mastery }]
            : []),
          ...(c.bonus
            ? [
                {
                  type: (
                    {
                      火: "pyroBonus",
                      水: "hydroBonus",
                      冰: "cryoBonus",
                      雷: "electroBonus",
                      草: "dendroBonus",
                      风: "anemoBonus",
                      岩: "geoBonus",
                    } as const
                  )[c.element],
                  value: c.bonus,
                },
              ]
            : []),
          ...(c.physicalBonus
            ? [{ type: "physicalBonus" as const, value: c.physicalBonus }]
            : []),
        ];
    return {
      ...c,
      critRate: 5,
      critDamage: 50,
      mastery: 0,
      bonus: 0,
      physicalBonus: 0,
      ascension: entries[0] ?? { type: "critRate" as const, value: 0 },
      legacyAscension: entries.slice(1),
    };
  });
const substatSchema = z
  .object({
    id,
    type: z.enum(
      Object.keys(ALL_STATS) as [
        keyof typeof ALL_STATS,
        ...Array<keyof typeof ALL_STATS>,
      ],
    ),
    mode: z.enum(["rolls", "direct"]),
    value: positive,
  })
  .refine(
    (s) =>
      s.mode === "direct" ||
      ALL_STATS[s.type].average !== null ||
      s.type === "notImportant",
    "此词条没有词条数均值，请使用直接数值",
  );
const artifactSubstatSchema = substatSchema.refine(
  (s) => s.type in STATS || s.type === "notImportant",
  "圣遗物副词条不含元素伤害加成",
);
const mainStatsSchema = z.object({
  flower: z.literal("hp"),
  feather: z.literal("atk"),
  sands: z.enum(SANDS_STATS),
  goblet: z.enum(GOBLET_STATS),
  circlet: z.enum(CIRCLET_STATS),
});
const effectSchema = z
  .object({
    enabled: z.boolean().optional(),
    id,
    name: text,
    nameMode: z.enum(["auto", "custom"]).optional(),
    sourceId: z.union([id, z.literal("")]),
    target: z.enum(["self", "team", "custom", "elements", "foreground"]),
    targetIds: z.array(id).max(4),
    targetElements: z
      .array(z.enum(CHARACTER_ELEMENTS))
      .max(7)
      .refine((a) => new Set(a).size === a.length)
      .default([]),
    type: z
      .union([
        z.enum(EFFECT_TYPES),
        z.literal("基础增伤"),
        z.literal("改变倍率"),
        z.literal("基础值加成 / 星月额外提升"),
      ])
      .transform((t) =>
        t === "基础增伤"
          ? ("增伤区" as const)
          : t === "改变倍率"
            ? ("倍率区" as const)
            : t === "星月额外提升" || t === "基础值加成 / 星月额外提升"
              ? ("基础值加成" as const)
              : t,
      ),
    multiplierMode: z
      .enum(["add", "scale", "unconfirmed"])
      .default("unconfirmed"),
    valueMode: z
      .enum(["number", "variable", "base", "outside", "live"])
      .transform((v) => (v === "variable" ? ("live" as const) : v)),
    value: num,
    unit: z.enum(["flat", "percent"]),
    variableCharacterId: id,
    variableStat: z
      .string()
      .refine((v) => VARIABLE_STATS.includes(v as never), "未知角色属性"),
    advanced: z.boolean().default(false),
    formulaPreset: z
      .object({
        threshold: num,
        step: num.positive(),
        change: num,
        cap: positive.nullable(),
        wholeSteps: z.boolean(),
      })
      .optional(),
    stacks: stacksSchema.optional(),
    timingPreset: timingPresetSchema.optional(),
    formulas: z
      .array(
        z.object({
          id,
          condition: z.string().max(500),
          formula: z.string().max(500),
        }),
      )
      .max(50)
      .default([]),
    global: z.boolean().default(false),
    category: z.enum(["global", "realtime"]).optional(),
    outsideActive: z.boolean().default(false),
    realtimeKind: z.enum(["fixed", "stacking"]).optional(),
    realtime: z
      .object({
        activeFor: positive.nullable().optional(),
        kind: z.enum([
          "fixed",
          "independent",
          "independentPeriodic",
          "shared",
          "sharedPeriodic",
        ]),
        max: count.min(1).nullable(),
        initial: count,
        duration: positive.nullable(),
        interval: num.positive(),
        delta: num
          .int()
          .min(-Number.MAX_SAFE_INTEGER)
          .max(Number.MAX_SAFE_INTEGER),
      })
      .optional(),
    boundSkillIds: z.array(id).max(1000).optional(),
    coefficient: num,
    duration: positive.nullable(),
    damage: damageSchema,
    skillFilter: z.object({ id, name: text }).optional(),
    amplificationReaction: z.enum(["全部", "蒸发", "融化"]).optional(),
    origin: z
      .object({
        kind: z.enum(["weapon", "artifact", "talent", "skill", "global"]),
        name: text,
      })
      .optional(),
  })
  .transform((e) => ({ ...e, unit: effectUnit(e) }))
  .transform((e) =>
    !e.sourceId && e.target === "self" ? { ...e, target: "team" as const } : e,
  )
  .transform((e) => {
    if (e.type !== "擢升" || e.unit !== "flat") return e;
    const converted = { ...e, unit: "percent" as const };
    if (e.valueMode === "number")
      converted.value = Number(((e.value - 1) * 100).toFixed(12));
    else {
      converted.advanced = true;
      converted.formulas = e.advanced
        ? e.formulas.map((r) => ({
            ...r,
            formula: `((${r.formula}) - 1) * 100`,
          }))
        : [
            {
              id: uid(),
              condition: "",
              formula: `(x * ${e.coefficient} - 1) * 100`,
            },
          ];
      if (converted.formulas.some((r) => r.formula.length > 500))
        throw new Error("旧擢升公式转换后过长，请先简化");
    }
    if (!Number.isFinite(converted.value))
      throw new Error("旧擢升数值转换超出范围");
    return converted;
  });
const weaponSchema = z.object({
  iconUrl: z.string().max(2000).optional(),
  id,
  name: text,
  short: text.default(""),
  gold: positive.default(0),
  limitedGold: positive.default(0),
  characterId: id,
  atk: positive,
  substats: z.array(substatSchema).max(1),
  effects: z.array(effectSchema).max(200),
});
const skillSchema = z
  .object({
    id,
    name: text,
    characterId: id,
    kind: z.enum(["damage", "effect", "empty"]),
    multiplier: positive,
    scalingMode: z.enum(["base", "outside", "live"]).default("live"),
    astral: z
      .object({
        coefficient: num.min(1).max(2),
        baseBoost: num,
        bonus: num,
        extra: num,
        uplift: positive,
      })
      .optional(),
    damage: damageSchema,
    effects: z.array(effectSchema).max(200),
  })
  .refine(
    (s) =>
      s.kind !== "damage" ||
      (s.damage.element !== "全部" &&
        s.damage.attack !== "全部" &&
        s.damage.scaling !== "全部"),
    "伤害技能需要指定属性、类型和乘区",
  );
const projectSchema = z
  .object({
    version: z.literal(1),
    starStackVersion: z.literal(2).optional(),
    name: text,
    characters: z.array(characterSchema).length(4),
    initialCharacterId: id.optional(),
    weapons: z.array(weaponSchema).length(4),
    artifacts: z
      .array(
        z
          .object({
            iconUrls: z.array(z.string().max(2000)).max(2).optional(),
            id,
            name: text,
            characterId: id,
            substats: z.array(artifactSubstatSchema).max(500),
            mainStats: mainStatsSchema.default(defaultMainStats),
            mainStat20: z
              .partialRecord(
                z.enum(["flower", "feather", "sands", "goblet", "circlet"]),
                z.boolean(),
              )
              .optional(),
            mainStatValues: z
              .partialRecord(
                z.enum(["flower", "feather", "sands", "goblet", "circlet"]),
                num,
              )
              .optional(),
            importedMainStats: z
              .partialRecord(
                z.enum(["flower", "feather", "sands", "goblet", "circlet"]),
                z.object({
                  type: z.enum(
                    Object.keys(ALL_STATS) as [
                      keyof typeof ALL_STATS,
                      ...Array<keyof typeof ALL_STATS>,
                    ],
                  ),
                  value: positive,
                  label: text.optional(),
                }),
              )
              .optional(),
            effects: z.array(effectSchema).max(200).default([]),
          })
          .transform((a) => {
            if (!a.importedMainStats) return a;
            const mainStats = { ...a.mainStats },
              mainStat20 = { ...a.mainStat20 },
              mainStatValues = { ...a.mainStatValues };
            for (const slot of Object.keys(
              a.importedMainStats,
            ) as (keyof typeof mainStats)[]) {
              const old = a.importedMainStats[slot]!;
              const type = mainOptions(slot).includes(old.type as never)
                ? (old.type as (typeof mainStats)[typeof slot])
                : "notImportant";
              Object.assign(mainStats, { [slot]: type });
              mainStat20[slot] = old.value === MAIN_STAT_VALUES[type];
              mainStatValues[slot] = type === "notImportant" ? 0 : old.value;
            }
            const { importedMainStats, ...rest } = a;
            void importedMainStats;
            return { ...rest, mainStats, mainStat20, mainStatValues };
          }),
      )
      .length(4),
    skills: z.array(skillSchema).max(2000),
    globals: z.array(effectSchema).max(2000),
    customEffects: z.array(effectSchema).max(2000).default([]),
    talents: z
      .array(
        z.object({
          id,
          name: text,
          characterId: id,
          effects: z.array(effectSchema).max(200),
        }),
      )
      .max(500)
      .default([]),
    enemy: z
      .object({
        level: positive,
        resistance: z.object({
          火: num,
          冰: num,
          雷: num,
          草: num,
          岩: num,
          风: num,
          水: num,
          物理: num,
        }),
      })
      .default(defaultEnemy),
    timeline: z
      .array(
        z.discriminatedUnion("kind", [
          z.object({
            id,
            enabled: z.boolean().optional(),
            disabledEffectKeys: z
              .array(z.string().max(500))
              .max(2000)
              .optional(),
            disabledOccurrences: z
              .array(z.string().max(500))
              .max(10000)
              .optional(),
            time: positive,
            kind: z.literal("effectTrigger"),
            effectKey: z.string().min(1).max(500),
            timing: timingSchema,
            usePreset: z.boolean().optional(),
          }),
          z.object({
            id,
            enabled: z.boolean().optional(),
            disabledEffectKeys: z
              .array(z.string().max(500))
              .max(2000)
              .optional(),
            disabledOccurrences: z
              .array(z.string().max(500))
              .max(10000)
              .optional(),
            time: positive,
            kind: z.literal("trigger"),
            sourceKind: z.enum(["weapon", "artifact", "talent"]),
            sourceId: id,
            stackCounts,
          }),
          z.object({
            id,
            enabled: z.boolean().optional(),
            disabledEffectKeys: z
              .array(z.string().max(500))
              .max(2000)
              .optional(),
            disabledOccurrences: z
              .array(z.string().max(500))
              .max(10000)
              .optional(),
            time: positive,
            kind: z.literal("skill"),
            skillId: id,
            repeat: z
              .object({
                interval: num.positive(),
                duration: positive.nullable(),
              })
              .optional(),
            effectTimings: z
              .record(z.string().min(1).max(500), timingSchema)
              .optional(),
            effectUsePresets: z
              .record(z.string().min(1).max(500), z.boolean())
              .optional(),
            stackCounts,
            starCoefficient: num.min(1).max(2).optional(),
            starStacks: num.int().min(0).max(13).optional(),
            legacyStarCoefficient: num.min(1).max(2).optional(),
            amplification: z.enum(["蒸发", "融化"]).optional(),
          }),
          z.object({
            id,
            enabled: z.boolean().optional(),
            disabledEffectKeys: z
              .array(z.string().max(500))
              .max(2000)
              .optional(),
            disabledOccurrences: z
              .array(z.string().max(500))
              .max(10000)
              .optional(),
            time: positive,
            kind: z.literal("switch"),
            characterId: id,
          }),
          z.object({
            id,
            enabled: z.boolean().optional(),
            disabledEffectKeys: z
              .array(z.string().max(500))
              .max(2000)
              .optional(),
            disabledOccurrences: z
              .array(z.string().max(500))
              .max(10000)
              .optional(),
            time: positive,
            kind: z.literal("effect"),
            effect: effectSchema,
            stackCounts,
          }),
          z.object({
            id,
            enabled: z.boolean().optional(),
            disabledEffectKeys: z
              .array(z.string().max(500))
              .max(2000)
              .optional(),
            disabledOccurrences: z
              .array(z.string().max(500))
              .max(10000)
              .optional(),
            time: positive,
            kind: z.literal("stacks"),
            effectKey: z.string().min(1).max(500),
            count,
          }),
        ]),
      )
      .max(10000),
  })
  .transform((p) => ({
    ...p,
    initialCharacterId: p.initialCharacterId ?? p.characters[0].id,
  }));
const presetSchema = z.discriminatedUnion("kind", [
  z.object({
    id,
    name: text,
    kind: z.literal("character"),
    data: characterSchema,
  }),
  z.object({ id, name: text, kind: z.literal("weapon"), data: weaponSchema }),
]);
function unique(values: string[]) {
  return new Set(values).size === values.length;
}
export function parseProject(data: unknown): Project {
  const p = projectSchema.parse(data);
  for (const event of p.timeline) {
    if (event.kind !== "skill" || event.starStacks === undefined) continue;
    if (p.starStackVersion === 2) {
      if (event.starStacks < 1) throw new Error("星超导层数必须为1～13的整数");
    } else {
      if (event.starStacks > 12)
        throw new Error("旧方案上周期元素力必须为0～12的整数");
      event.starStacks += 1;
    }
  }
  p.starStackVersion = 2;
  const characters = new Set(p.characters.map((c) => c.id)),
    skills = new Set(p.skills.map((s) => s.id));
  if (
    ![
      p.characters,
      p.weapons,
      p.artifacts,
      p.skills,
      p.globals,
      p.customEffects,
      p.talents,
      p.timeline,
    ].every((items) => unique(items.map((x) => x.id)))
  )
    throw new Error("存在重复条目 ID");
  if (
    ![p.weapons, p.artifacts].every((items) =>
      unique(items.map((x) => x.characterId)),
    )
  )
    throw new Error("每个角色只能装备一把武器和一套圣遗物");
  if (
    ![...p.weapons, ...p.artifacts, ...p.skills, ...p.talents].every((x) =>
      characters.has(x.characterId),
    )
  )
    throw new Error("装备或技能引用了不存在的角色");
  if (!p.timeline.every((e) => e.kind !== "skill" || skills.has(e.skillId)))
    throw new Error("时间轴引用了不存在的技能");
  if (
    !characters.has(p.initialCharacterId) ||
    p.timeline.some(
      (e) => e.kind === "switch" && !characters.has(e.characterId),
    )
  )
    throw new Error("前台角色引用无效");
  for (const e of p.timeline) {
    if (
      e.kind === "trigger" &&
      !triggerSources(p, e.sourceKind).some((x) => x.id === e.sourceId)
    )
      throw new Error("触发事件引用无效");
  }
  const effects = [
    ...p.globals,
    ...p.customEffects,
    ...p.weapons.flatMap((w) => w.effects),
    ...p.artifacts.flatMap((a) => a.effects),
    ...p.talents.flatMap((t) => t.effects),
    ...p.skills.flatMap((s) => s.effects),
    ...p.timeline.flatMap((e) => (e.kind === "effect" ? [e.effect] : [])),
  ];
  if (
    !effects.every(
      (e) =>
        (characters.has(e.sourceId) ||
          (e.sourceId === "" &&
            (p.globals.includes(e) || p.customEffects.includes(e)))) &&
        characters.has(e.variableCharacterId) &&
        e.targetIds.every((t) => characters.has(t)) &&
        unique(e.targetIds) &&
        (!e.skillFilter || skills.has(e.skillFilter.id)),
    )
  )
    throw new Error("效果引用了无效或重复的角色");
  for (const owner of [...p.weapons, ...p.artifacts, ...p.skills, ...p.talents])
    owner.effects = owner.effects.map((e) => ({
      ...e,
      sourceId: owner.characterId,
    }));
  // Upgrade old skill-local inputs into editable, skill-scoped global effects.
  // Removing the old object makes this migration idempotent on save/reload.
  for (const s of p.skills) {
    if (!s.astral) continue;
    const old = s.astral;
    if (s.damage.special === "星超导")
      for (const e of p.timeline) {
        if (
          e.kind === "skill" &&
          e.skillId === s.id &&
          e.starCoefficient === undefined &&
          e.starStacks === undefined &&
          e.legacyStarCoefficient === undefined
        )
          e.starCoefficient = old.coefficient;
      }
    const entries: [Effect["type"], number, Effect["unit"]][] = [
      ["星月基础提升", old.baseBoost, "percent"],
      ["星月增伤", old.bonus, "percent"],
      ["星月额外提升", old.extra, "flat"],
      ["擢升", Number(((old.uplift - 1) * 100).toFixed(12)), "percent"],
    ];
    for (const [type, value, unit] of entries) {
      if (value === 0) continue;
      if (!Number.isFinite(value)) throw new Error("旧技能加成数值超出范围");
      p.globals.push({
        ...effect(s.characterId, true),
        outsideActive: false,
        name: `${s.name || "未命名技能"} · ${type}（迁移）`,
        type: type === "星月额外提升" ? "基础值加成" : type,
        value,
        unit,
        target: "self",
        damage: { ...s.damage },
        skillFilter: { id: s.id, name: s.name },
        origin: { kind: "skill", name: s.name },
      });
    }
  }
  return normalizeAmplification(
    migrateEffectEvents({
      ...p,
      timeline: p.timeline.map((e) => {
        if (e.kind !== "skill") return e;
        const { starCoefficient, ...next } = e;
        if (next.starStacks !== undefined) {
          delete next.legacyStarCoefficient;
          return next;
        }
        const old = starCoefficient ?? next.legacyStarCoefficient;
        if (old === undefined) return next;
        const match = STAR_SUPERCONDUCT_TABLE.find(
          (row) => Math.abs(row.coefficient - old) < 1e-9,
        );
        if (match) {
          next.starStacks = match.stacks;
          delete next.legacyStarCoefficient;
        } else next.legacyStarCoefficient = old;
        return next;
      }),
      skills: p.skills.map(({ astral, ...s }) => {
        void astral;
        return s;
      }),
    }),
  );
}
export const parsePreset = (data: unknown): Preset => presetSchema.parse(data);
export const parsePresets = (data: unknown): Preset[] =>
  z.array(presetSchema).parse(data);
export function readJson(file: File): Promise<unknown> {
  if (file.size > 8 * 1024 * 1024)
    return Promise.reject(new Error("文件不能超过 8 MB"));
  return file.text().then(JSON.parse);
}
export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[<>:"/\\|?*]/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function applyCharacterPreset(
  data: Character,
  target: Character,
): Character {
  return { ...data, id: target.id };
}
export function applyWeaponPreset(
  data: Weapon,
  target: Weapon,
  characters: Character[],
): Weapon {
  const ids = new Set(characters.map((c) => c.id));
  return {
    ...structuredClone(data),
    id: target.id,
    characterId: target.characterId,
    effects: data.effects.map((e) => ({
      ...structuredClone(e),
      sourceId: target.characterId,
      variableCharacterId:
        e.variableCharacterId === data.characterId ||
        !ids.has(e.variableCharacterId)
          ? target.characterId
          : e.variableCharacterId,
      targetIds: [
        ...new Set(
          e.targetIds.map((t) =>
            t === data.characterId || !ids.has(t) ? target.characterId : t,
          ),
        ),
      ],
    })),
  };
}
