import { z } from "zod";
import reference from "./data/import-reference.json";
import {
  ALL_STATS,
  MAIN_SLOTS,
  defaultMainStats,
  mainOptions,
  MAIN_STAT_VALUES,
  CHARACTER_LEVELS,
  starsForLevel,
  type CharacterElement,
  uid,
  type Artifact,
  type MainStats,
  type Project,
  type StatKey,
  type Substat,
} from "./model";

type MainValue = {
  type: StatKey;
  value: number;
  label?: string;
  full?: boolean;
};
export type ImportedCharacter = {
  avatarUrl?: string;
  baseStats?: { hp: number; atk: number; def: number };
  baseStatsNote?: string;
  key: string;
  name: string;
  level?: number;
  constellation?: number;
  element?: string;
  artifacts?: {
    name?: string;
    iconUrls?: string[];
    mainStats: MainStats;
    importedMainStats: NonNullable<Artifact["importedMainStats"]>;
    substats: Substat[];
    pieces: string[];
    mainStat20: NonNullable<Artifact["mainStat20"]>;
    mainStatValues: NonNullable<Artifact["mainStatValues"]>;
  };
  weapon?: {
    iconUrl?: string;
    name: string;
    level: number;
    atk: number;
    substats?: Substat[];
    substatError?: string;
  };
  artifactError?: string;
  weaponError?: string;
};
export type ImportAccount = {
  source: "GOOD" | "Enka";
  name: string;
  characters: ImportedCharacter[];
};
const props: Record<string, [StatKey, string]> = {
  hp: ["hp", "2"],
  hp_: ["hpPercent", "3"],
  atk: ["atk", "5"],
  atk_: ["atkPercent", "6"],
  def: ["def", "8"],
  def_: ["defPercent", "9"],
  eleMas: ["mastery", "28"],
  enerRech_: ["recharge", "23"],
  critRate_: ["critRate", "20"],
  critDMG_: ["critDamage", "22"],
  heal_: ["notImportant", "26"],
  pyro_dmg_: ["pyroBonus", "40"],
  electro_dmg_: ["electroBonus", "41"],
  hydro_dmg_: ["hydroBonus", "42"],
  dendro_dmg_: ["dendroBonus", "43"],
  anemo_dmg_: ["anemoBonus", "44"],
  geo_dmg_: ["geoBonus", "45"],
  cryo_dmg_: ["cryoBonus", "46"],
  physical_dmg_: ["physicalBonus", "30"],
};
const enkaProps: Record<string, string> = {
  FIGHT_PROP_HP: "hp",
  FIGHT_PROP_ATTACK: "atk",
  FIGHT_PROP_DEFENSE: "def",
  FIGHT_PROP_HP_PERCENT: "hp_",
  FIGHT_PROP_ATTACK_PERCENT: "atk_",
  FIGHT_PROP_DEFENSE_PERCENT: "def_",
  FIGHT_PROP_ELEMENT_MASTERY: "eleMas",
  FIGHT_PROP_CHARGE_EFFICIENCY: "enerRech_",
  FIGHT_PROP_CRITICAL: "critRate_",
  FIGHT_PROP_CRITICAL_HURT: "critDMG_",
  FIGHT_PROP_HEAL_ADD: "heal_",
  FIGHT_PROP_FIRE_ADD_HURT: "pyro_dmg_",
  FIGHT_PROP_ICE_ADD_HURT: "cryo_dmg_",
  FIGHT_PROP_ELEC_ADD_HURT: "electro_dmg_",
  FIGHT_PROP_GRASS_ADD_HURT: "dendro_dmg_",
  FIGHT_PROP_ROCK_ADD_HURT: "geo_dmg_",
  FIGHT_PROP_WIND_ADD_HURT: "anemo_dmg_",
  FIGHT_PROP_WATER_ADD_HURT: "hydro_dmg_",
  FIGHT_PROP_PHYSICAL_ADD_HURT: "physical_dmg_",
};
const slots: Record<string, keyof MainStats> = {
  flower: "flower",
  plume: "feather",
  sands: "sands",
  goblet: "goblet",
  circlet: "circlet",
  EQUIP_BRACER: "flower",
  EQUIP_NECKLACE: "feather",
  EQUIP_SHOES: "sands",
  EQUIP_RING: "goblet",
  EQUIP_DRESS: "circlet",
};
const num = z.number().finite().nonnegative();
const int = num.int();
const text = z.string().max(200);
const statSchema = z.object({ key: text, value: num });
const goodArtifact = z.object({
  slotKey: text,
  setKey: text.optional(),
  mainStatKey: text,
  level: int.max(20),
  rarity: int.min(1).max(5),
  location: text.default(""),
  substats: z.array(statSchema).max(4),
});
const goodWeapon = z.object({
  key: text,
  location: text.default(""),
  level: int.min(1).max(90),
  ascension: int.max(6),
});
const goodSchema = z.object({
  format: z.literal("GOOD"),
  version: int.min(1).max(3),
  source: text.optional(),
  characters: z
    .array(
      z.object({
        key: text.min(1),
        level: int.optional(),
        constellation: int.max(6).optional(),
        element: text.optional(),
      }),
    )
    .max(1000)
    .optional(),
  artifacts: z.array(z.unknown()).max(10000).optional(),
  weapons: z.array(z.unknown()).max(10000).optional(),
});
const characterRef = reference.characters as Record<
  string,
  {
    name: string;
    key: string;
    Element?: string;
    SideIconName?: string;
    BaseProps?: Record<string, number>;
    PropGrowCurves?: Record<string, number>;
    PromoteProps?: Record<string, number>[];
    Costumes?: Record<string, { SideIconName?: string }>;
  }
>;
const elementNames: Record<string, CharacterElement> = {
  Fire: "火",
  Ice: "冰",
  Electric: "雷",
  Grass: "草",
  Rock: "岩",
  Wind: "风",
  Water: "水",
};
function portrait(
  ref: (typeof characterRef)[string] | undefined,
  costumeId?: number,
) {
  const path =
    (costumeId
      ? ref?.Costumes?.[String(costumeId)]?.SideIconName
      : undefined) ?? ref?.SideIconName;
  return path
    ? `https://enka.network${path.startsWith("/") ? "" : "/ui/"}${path}`
    : undefined;
}
function enkaImage(icon?: string) {
  if (!icon) return undefined;
  const filename = icon.replace(/^\/ui\//, "");
  if (!/^[A-Za-z0-9_]+(?:\.png)?$/.test(filename)) return undefined;
  return `https://enka.network/ui/${filename}${filename.endsWith(".png") ? "" : ".png"}`;
}
function referenceBase(
  ref: (typeof characterRef)[string] | undefined,
  level?: number,
  ascension?: number,
) {
  if (!ref || level === undefined || ascension === undefined) return undefined;
  const values = ["1", "4", "7"].map((prop) => {
    const base = ref.BaseProps?.[prop],
      growth = curves[String(ref.PropGrowCurves?.[prop])]?.[level - 1],
      extra = ref.PromoteProps?.[ascension]?.[prop];
    return base === undefined || growth === undefined || extra === undefined
      ? undefined
      : base * growth + extra;
  });
  return values.every((v) => v !== undefined && Number.isFinite(v) && v >= 0)
    ? { hp: values[0]!, atk: values[1]!, def: values[2]! }
    : undefined;
}
const weaponRef = reference.weapons as Record<
  string,
  {
    name: string;
    base: number;
    curve: string;
    promote: number[];
    rarity: number;
    subProps: Record<string, number>;
    subCurves: Record<string, number>;
    iconUrl?: string;
  }
>;
const mainTable = reference.relicLevels as Record<
  string,
  Record<string, Record<string, number>>
>;
const curves = reference.curves as Record<string, number[]>;
const round = (x: number, percent: boolean) =>
  percent ? Math.round((x + 1e-9) * 10) / 10 : Math.round(x + 1e-9);
function mainValue(key: string, value: number): MainValue {
  const prop = props[key];
  if (!prop) throw new Error(`暂不识别主词条：${key}`);
  return {
    type: prop[0],
    value: prop[0] === "notImportant" ? 0 : value,
    ...(key === "heal_" ? { label: `治疗加成 ${value}%（不计入伤害）` } : {}),
  };
}
function combineArtifacts(
  pieces: {
    slot: string;
    main: MainValue;
    subs: { key: string; value: number }[];
    label: string;
    level: number;
    rarity?: number;
    setName?: string;
    setIcon?: string;
  }[],
): NonNullable<ImportedCharacter["artifacts"]> {
  const mainStats = defaultMainStats(),
    importedMainStats: NonNullable<Artifact["importedMainStats"]> = {},
    mainStat20: NonNullable<Artifact["mainStat20"]> = {},
    mainStatValues: NonNullable<Artifact["mainStatValues"]> = {},
    sums = new Map<StatKey, number>();
  for (const piece of pieces) {
    const slot = slots[piece.slot];
    if (!slot) throw new Error(`未知圣遗物部位：${piece.slot}`);
    if (importedMainStats[slot])
      throw new Error(`同一角色有多件${MAIN_SLOTS[slot]}，请检查导出装备归属`);
    if (
      (slot === "flower" && piece.main.type !== "hp") ||
      (slot === "feather" && piece.main.type !== "atk")
    )
      throw new Error("花或羽毛主词条无效");
    // Keep the existing editor choice if supported; the imported exact value is authoritative.
    const key = piece.main.type;
    const allowed =
      slot === "flower"
        ? ["hp"]
        : slot === "feather"
          ? ["atk"]
          : slot === "sands"
            ? ["hpPercent", "atkPercent", "defPercent", "mastery", "recharge"]
            : slot === "circlet"
              ? [
                  "hpPercent",
                  "atkPercent",
                  "defPercent",
                  "mastery",
                  "critRate",
                  "critDamage",
                  "notImportant",
                ]
              : [
                  "hpPercent",
                  "atkPercent",
                  "defPercent",
                  "mastery",
                  "pyroBonus",
                  "cryoBonus",
                  "hydroBonus",
                  "electroBonus",
                  "dendroBonus",
                  "geoBonus",
                  "anemoBonus",
                  "physicalBonus",
                ];
    if (!allowed.includes(key))
      throw new Error(`${MAIN_SLOTS[slot]}的主词条类型无效`);
    const supported = mainOptions(slot).includes(key as never);
    const selected = supported
      ? (key as keyof typeof MAIN_STAT_VALUES)
      : "notImportant";
    Object.assign(mainStats, { [slot]: selected });
    mainStat20[slot] = piece.level === 20 && piece.rarity === 5;
    mainStatValues[slot] = supported ? piece.main.value : 0;
    importedMainStats[slot] = {
      type: selected,
      value:
        selected === "notImportant"
          ? 0
          : mainStat20[slot]
            ? MAIN_STAT_VALUES[selected]
            : piece.main.value,
      ...(!supported || piece.main.label
        ? {
            label: `${piece.main.label ?? `${ALL_STATS[key].name} ${piece.main.value}${ALL_STATS[key].percent ? "%" : ""}`}（原类型列表不支持，使用NOT IMPORTANT）`,
          }
        : {}),
    };
    for (const stat of piece.subs) {
      const type = props[stat.key]?.[0];
      if (
        !type ||
        ![
          "hp",
          "hpPercent",
          "atk",
          "atkPercent",
          "def",
          "defPercent",
          "mastery",
          "recharge",
          "critRate",
          "critDamage",
        ].includes(type)
      )
        throw new Error(`未知圣遗物副词条：${stat.key}`);
      sums.set(type, (sums.get(type) ?? 0) + stat.value);
    }
  }
  for (const slot of Object.keys(MAIN_SLOTS) as (keyof MainStats)[])
    if (!importedMainStats[slot]) {
      mainStat20[slot] = false;
      mainStatValues[slot] = 0;
      importedMainStats[slot] = {
        type:
          slot === "flower"
            ? "hp"
            : slot === "feather"
              ? "atk"
              : "notImportant",
        value: 0,
        label: "未装备（0）",
      };
    }
  return {
    name: artifactSetName(pieces.map((p) => p.setName)),
    iconUrls: activatedSetIcons(pieces),
    mainStats,
    mainStat20,
    mainStatValues,
    importedMainStats,
    substats: [...sums].map(([type, value]) => ({
      id: uid(),
      type,
      mode: "direct",
      value: Math.round(value * 1e6) / 1e6,
    })),
    pieces: pieces.map((p) => p.label),
  };
}
function goodArtifacts(
  raw: unknown[],
): NonNullable<ImportedCharacter["artifacts"]> {
  return combineArtifacts(
    raw.map((input) => {
      const a = goodArtifact.parse(input),
        prop = props[a.mainStatKey];
      if (!prop) throw new Error(`未知主词条：${a.mainStatKey}`);
      const value = mainTable[a.rarity]?.[a.level + 1]?.[prop[1]];
      if (value === undefined)
        throw new Error(`无效圣遗物等级：${a.rarity}星+${a.level}`);
      const percent = a.mainStatKey.endsWith("_");
      return {
        slot: a.slotKey,
        level: a.level,
        rarity: a.rarity,
        setName: goodSetName(a.setKey),
        setIcon: setIconForName(goodSetName(a.setKey)),
        main: mainValue(
          a.mainStatKey,
          round(value * (percent ? 100 : 1), percent),
        ),
        subs: a.substats,
        label: `${MAIN_SLOTS[slots[a.slotKey]] ?? a.slotKey} · ${a.rarity}星 +${a.level} · ${a.setKey ?? ""}`,
      };
    }),
  );
}
function goodWeaponValue(
  input: unknown,
): NonNullable<ImportedCharacter["weapon"]> {
  const w = goodWeapon.parse(input),
    ref = weaponRef[w.key];
  if (!ref) throw new Error(`武器数据表未收录 ${w.key}，本次可仅导入圣遗物`);
  const curve = curves[ref.curve]?.[w.level - 1],
    promote = ref.promote[w.ascension];
  if (
    curve === undefined ||
    promote === undefined ||
    w.level > [20, 40, 50, 60, 70, 80, 90][w.ascension] ||
    w.level < [1, 20, 40, 50, 60, 70, 80][w.ascension]
  )
    throw new Error("武器等级与突破阶段不匹配");
  return {
    name: ref.name,
    iconUrl: ref.iconUrl,
    level: w.level,
    atk: Math.round(ref.base * curve + promote),
    ...weaponSubstats(
      Object.entries(ref.subProps ?? {}).map(([id, value]) => {
        const type = Object.values(props).find(([, prop]) => prop === id)?.[0];
        const growth = curves[String(ref.subCurves[id])]?.[w.level - 1];
        if (!type || growth === undefined) return { type: undefined, value: 0 };
        return {
          type,
          value: round(
            value * growth * (ALL_STATS[type].percent ? 100 : 1),
            ALL_STATS[type].percent,
          ),
        };
      }),
    ),
  };
}
function weaponSubstats(
  values: { type: StatKey | undefined; value: number }[],
) {
  if (values.length > 1 || values.some((s) => !s.type))
    return { substatError: "无法识别武器副词条，请取消此项后导入其它内容" };
  return {
    substats: values.map((s) => ({
      id: uid(),
      type: s.type!,
      value: s.value,
      mode: "direct" as const,
    })),
  };
}
const errText = (err: unknown) =>
  err instanceof z.ZodError
    ? "装备数据格式不完整或含无效数值"
    : (err as Error).message;
const locationOf = (v: unknown) =>
  typeof v === "object" &&
  v !== null &&
  "location" in v &&
  typeof v.location === "string"
    ? v.location
    : "";
export function parseGoodImport(input: unknown): ImportAccount {
  const data = goodSchema.parse(input),
    chars = new Map<
      string,
      { key: string; level?: number; element?: string; constellation?: number }
    >();
  for (const c of data.characters ?? []) {
    if (chars.has(c.key)) throw new Error(`重复角色：${c.key}`);
    chars.set(c.key, c);
  }
  for (const item of [...(data.artifacts ?? []), ...(data.weapons ?? [])]) {
    const key = locationOf(item);
    if (key && !chars.has(key)) chars.set(key, { key });
  }
  if (!chars.size)
    throw new Error("没有可导入角色，请在 GGScanner 中导出角色与已装备物品");
  return {
    source: "GOOD",
    name: data.source ?? "GGScanner",
    characters: [...chars.values()].map((c) => {
      const ref = Object.values(characterRef).find((r) => r.key === c.key);
      const row: ImportedCharacter = {
        ...c,
        avatarUrl: portrait(ref),
        element: elementNames[ref?.Element ?? ""] ?? c.element,
        name:
          Object.values(characterRef).find((r) => r.key === c.key)?.name ??
          c.key,
      };
      try {
        if (data.artifacts === undefined)
          throw new Error("文件未包含圣遗物数据");
        row.artifacts = goodArtifacts(
          data.artifacts.filter((a) => locationOf(a) === c.key),
        );
      } catch (e) {
        row.artifactError = errText(e);
      }
      try {
        const ws = (data.weapons ?? []).filter((w) => locationOf(w) === c.key);
        if (ws.length !== 1)
          throw new Error(
            ws.length ? "该角色有多把已装备武器" : "未找到已装备武器",
          );
        row.weapon = goodWeaponValue(ws[0]);
      } catch (e) {
        row.weaponError = errText(e);
      }
      return row;
    }),
  };
}
const flatStat = z.object({
  appendPropId: text.optional(),
  mainPropId: text.optional(),
  statValue: num,
});
const enkaEquip = z.object({
  weapon: z.object({ level: int, promoteLevel: int.optional() }).optional(),
  reliquary: z.object({ level: int }).optional(),
  flat: z.object({
    itemType: text,
    equipType: text.optional(),
    rankLevel: int.optional(),
    nameTextMapHash: z.union([text, z.number()]).optional(),
    setNameTextMapHash: z.union([text, z.number()]).optional(),
    setId: int.optional(),
    icon: text.optional(),
    weaponStats: z.array(flatStat).optional(),
    reliquaryMainstat: flatStat.optional(),
    reliquarySubstats: z.array(flatStat).max(4).default([]),
  }),
});
export function parseEnkaImport(input: unknown): ImportAccount {
  const data = z
    .object({
      playerInfo: z.object({ nickname: text.optional() }).optional(),
      avatarInfoList: z
        .array(
          z.object({
            avatarId: int,
            skillDepotId: int.optional(),
            costumeId: int.optional(),
            fightPropMap: z.record(z.string(), z.number().finite()).optional(),
            talentIdList: z.array(int).max(6).default([]),
            propMap: z.record(z.string(), z.unknown()).optional(),
            equipList: z.array(z.unknown()).max(6),
          }),
        )
        .max(100)
        .optional(),
    })
    .parse(input);
  if (!data.avatarInfoList?.length)
    throw new Error(
      "没有公开角色详情。请在游戏展柜放入角色并开启“显示角色详情”，等待缓存更新后重试。",
    );
  return {
    source: "Enka",
    name: data.playerInfo?.nickname ?? "Enka 展柜",
    characters: data.avatarInfoList.map((c, i) => {
      const ref =
        characterRef[`${c.avatarId}-${c.skillDepotId}`] ??
        characterRef[String(c.avatarId)];
      const level = z
        .object({ val: z.coerce.number().finite() })
        .safeParse(c.propMap?.["4001"]);
      const row: ImportedCharacter = {
        avatarUrl: portrait(ref, c.costumeId),
        element: elementNames[ref?.Element ?? ""],
        key: `${c.avatarId}-${c.skillDepotId ?? 0}-${i}`,
        name: ref?.name ?? `角色 ${c.avatarId}`,
        level: level.success ? level.data.val : undefined,
        constellation: c.talentIdList.length,
      };
      const equips = c.equipList.map((e) => enkaEquip.safeParse(e));
      try {
        if (equips.some((e) => !e.success))
          throw new Error("圣遗物装备数据不完整");
        row.artifacts = combineArtifacts(
          equips
            .filter(
              (e) => e.success && e.data.flat.itemType === "ITEM_RELIQUARY",
            )
            .map((result) => {
              const e = result.data!,
                main = e.flat.reliquaryMainstat;
              if (!main?.mainPropId || !e.flat.equipType || !e.reliquary)
                throw new Error("缺少圣遗物主词条或部位");
              const key = enkaProps[main.mainPropId];
              if (!key) throw new Error(`未知主词条：${main.mainPropId}`);
              return {
                slot: e.flat.equipType,
                level: e.reliquary.level - 1,
                rarity: e.flat.rankLevel,
                setName:
                  (reference.artifactSetNames as Record<string, string>)[
                    String(e.flat.setNameTextMapHash)
                  ] ??
                  (
                    reference.artifactSetIds as Record<
                      string,
                      { name?: string }
                    >
                  )[String(e.flat.setId)]?.name,
                setIcon:
                  (reference.artifactSetIcons as Record<string, string>)[
                    String(e.flat.setNameTextMapHash)
                  ] ??
                  (
                    reference.artifactSetIds as Record<
                      string,
                      { icon?: string | null }
                    >
                  )[String(e.flat.setId)]?.icon ??
                  undefined,
                main: mainValue(key, main.statValue),
                subs: e.flat.reliquarySubstats.map((s) => ({
                  key: enkaProps[s.appendPropId ?? ""] ?? "未知词条",
                  value: s.statValue,
                })),
                label: `${MAIN_SLOTS[slots[e.flat.equipType]]} · ${e.flat.rankLevel ?? "?"}星 +${e.reliquary.level - 1}`,
              };
            }),
        );
      } catch (e) {
        row.artifactError = errText(e);
      }
      try {
        const ws = equips.filter(
          (e) => e.success && e.data.flat.itemType === "ITEM_WEAPON",
        );
        if (ws.length !== 1) throw new Error("未找到唯一的已装备武器");
        const w = ws[0].data!,
          atk = w.flat.weaponStats?.find(
            (s) => s.appendPropId === "FIGHT_PROP_BASE_ATTACK",
          )?.statValue;
        if (atk === undefined || !w.weapon)
          throw new Error("武器未提供基础攻击力");
        row.weapon = {
          iconUrl:
            enkaImage(w.flat.icon) ??
            (reference.weaponIcons as Record<string, string>)[
              String(w.flat.nameTextMapHash)
            ],
          name:
            (reference.weaponNames as Record<string, string>)[
              String(w.flat.nameTextMapHash)
            ] ?? "展柜武器",
          level: w.weapon.level,
          atk,
          ...weaponSubstats(
            (w.flat.weaponStats ?? [])
              .filter((s) => s.appendPropId !== "FIGHT_PROP_BASE_ATTACK")
              .map((s) => ({
                type: props[enkaProps[s.appendPropId ?? ""]]?.[0],
                value: s.statValue,
              })),
          ),
        };
      } catch (e) {
        row.weaponError = errText(e);
      }
      const hp = c.fightPropMap?.["1"],
        combinedAttack = c.fightPropMap?.["4"],
        def = c.fightPropMap?.["7"];
      const weapon = equips.find(
        (e) => e.success && e.data.flat.itemType === "ITEM_WEAPON",
      )?.data;
      const baseRef = (
        reference.enkaWeaponBases as Record<
          string,
          { base: number; curve: string; promote: number[] }
        >
      )[String(weapon?.flat.nameTextMapHash)];
      const growth =
        baseRef && weapon?.weapon
          ? curves[baseRef.curve]?.[weapon.weapon.level - 1]
          : undefined;
      const extra = baseRef?.promote[weapon?.weapon?.promoteLevel ?? -1];
      const preciseWeapon =
        baseRef && growth !== undefined && extra !== undefined
          ? baseRef.base * growth + extra
          : undefined;
      const ascension = z
        .object({ val: z.coerce.number() })
        .safeParse(c.propMap?.["1002"]);
      const fallback = referenceBase(
        ref,
        row.level,
        ascension.success ? ascension.data.val : undefined,
      );
      const atk =
        combinedAttack !== undefined && preciseWeapon !== undefined
          ? combinedAttack - preciseWeapon
          : fallback?.atk;
      if (
        hp !== undefined &&
        def !== undefined &&
        atk !== undefined &&
        [hp, def, atk].every((n) => Number.isFinite(n) && n >= 0)
      ) {
        row.baseStats = { hp, atk, def };
        row.baseStatsNote =
          preciseWeapon !== undefined
            ? "Enka基础属性；攻击力已扣除武器基础攻击力"
            : "生命/防御来自Enka，角色基础攻击力来自同等级突破资料";
      } else row.baseStatsNote = "缺少可靠基础属性或武器突破资料，此项不导入";
      return row;
    }),
  };
}
export function applyQuickImport(
  p: Project,
  source: ImportedCharacter,
  targetId: string,
  options: QuickImportOptions | boolean,
  legacyWeapon = false,
): Project {
  const o: QuickImportOptions =
    typeof options === "boolean"
      ? { artifacts: options, weaponAtk: legacyWeapon }
      : options;
  if (
    !p.characters.some((c) => c.id === targetId) ||
    !Object.values(o).some(Boolean)
  )
    throw new Error("请选择目标角色与导入内容");
  if (
    ((o.artifacts || o.artifactName) && !source.artifacts) ||
    ((o.weaponAtk || o.weaponName || o.weaponSubstats) && !source.weapon) ||
    (o.weaponSubstats && !source.weapon?.substats)
  )
    throw new Error("所选装备数据不可导入");
  if (
    o.characterLevel &&
    (source.level === undefined || !CHARACTER_LEVELS.includes(source.level))
  )
    throw new Error("来源角色等级不在1～90/95/100范围内");
  if (o.characterConstellation && source.constellation === undefined)
    throw new Error("来源未提供角色命座");
  if (o.characterBase && !source.baseStats)
    throw new Error("来源未提供可靠角色基础属性");
  return {
    ...p,
    characters: p.characters.map((c) =>
      c.id !== targetId
        ? c
        : {
            ...c,
            ...(o.characterBase ? source.baseStats : {}),
            ...(o.characterAvatar && source.avatarUrl
              ? { avatarUrl: source.avatarUrl }
              : {}),
            ...(o.characterElement &&
            Object.values(elementNames).includes(
              source.element as CharacterElement,
            )
              ? {
                  element: source.element as CharacterElement,
                  elementNeedsReview: false,
                }
              : {}),
            ...(o.characterName ? { name: source.name } : {}),
            ...(o.characterLevel
              ? { level: source.level!, stars: starsForLevel(source.level!) }
              : {}),
            ...(o.characterConstellation
              ? { constellation: String(source.constellation) }
              : {}),
          },
    ),
    artifacts:
      o.artifacts || o.artifactName || o.artifactIcon
        ? p.artifacts.map((a) =>
            a.characterId === targetId
              ? {
                  ...a,
                  ...(o.artifactIcon
                    ? { iconUrls: source.artifacts?.iconUrls ?? [] }
                    : {}),
                  ...(o.artifactName && source.artifacts?.name
                    ? { name: source.artifacts.name }
                    : {}),
                  ...(o.artifacts
                    ? {
                        mainStats: structuredClone(source.artifacts!.mainStats),
                        importedMainStats: undefined,
                        mainStat20: structuredClone(
                          source.artifacts!.mainStat20,
                        ),
                        mainStatValues: structuredClone(
                          source.artifacts!.mainStatValues,
                        ),
                        substats: source.artifacts!.substats.map((s) => ({
                          ...s,
                          id: uid(),
                        })),
                      }
                    : {}),
                }
              : a,
          )
        : p.artifacts,
    weapons:
      o.weaponAtk || o.weaponName || o.weaponSubstats || o.weaponIcon
        ? p.weapons.map((w) =>
            w.characterId === targetId
              ? {
                  ...w,
                  ...(o.weaponIcon ? { iconUrl: source.weapon?.iconUrl } : {}),
                  ...(o.weaponAtk ? { atk: source.weapon!.atk } : {}),
                  ...(o.weaponName ? { name: source.weapon!.name } : {}),
                  ...(o.weaponSubstats
                    ? {
                        substats: source.weapon!.substats!.map((s) => ({
                          ...s,
                          id: uid(),
                        })),
                      }
                    : {}),
                }
              : w,
          )
        : p.weapons,
  };
}
export type QuickImportOptions = Partial<
  Record<
    | "artifacts"
    | "artifactName"
    | "weaponAtk"
    | "weaponName"
    | "weaponSubstats"
    | "characterName"
    | "characterLevel"
    | "characterConstellation"
    | "characterBase"
    | "characterAvatar"
    | "characterElement"
    | "weaponIcon"
    | "artifactIcon",
    boolean
  >
>;
export function defaultImportOptions(
  source?: ImportedCharacter,
): QuickImportOptions {
  return {
    artifacts: !!source?.artifacts,
    artifactName: !!source?.artifacts?.name,
    weaponAtk: !!source?.weapon,
    weaponName: !!source?.weapon,
    weaponSubstats: !!source?.weapon?.substats,
    weaponIcon: !!source?.weapon?.iconUrl,
    artifactIcon: !!source?.artifacts?.iconUrls?.length,
    characterName: !!source,
    characterLevel:
      source?.level !== undefined && CHARACTER_LEVELS.includes(source.level),
    characterConstellation: source?.constellation !== undefined,
    characterBase: !!source?.baseStats,
    characterAvatar: !!source?.avatarUrl,
    characterElement: Object.values(elementNames).includes(
      source?.element as CharacterElement,
    ),
  };
}
function setIconForName(name?: string) {
  const hash = Object.entries(reference.artifactSetNames).find(
    ([, n]) => n === name,
  )?.[0];
  return hash
    ? (reference.artifactSetIcons as Record<string, string>)[hash]
    : undefined;
}
function activatedSetIcons(pieces: { setName?: string; setIcon?: string }[]) {
  const counts = new Map<string, { count: number; icon?: string }>();
  for (const p of pieces)
    if (p.setName) {
      const s = counts.get(p.setName) ?? { count: 0, icon: p.setIcon };
      s.count++;
      counts.set(p.setName, s);
    }
  const sets = [...counts]
    .filter(([, s]) => s.count >= 2)
    .sort(
      (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0], "zh-CN"),
    );
  return (
    sets[0]?.[1].count >= 4 ? sets.slice(0, 1) : sets.slice(0, 2)
  ).flatMap(([, s]) => (s.icon ? [s.icon] : []));
}
export type ImportMapping = { targetId: string; sourceKey: string };
export function applyBatchQuickImport(
  p: Project,
  account: ImportAccount,
  mappings: ImportMapping[],
  enabled?: QuickImportOptions,
) {
  const rows = mappings.filter((m) => m.sourceKey);
  if (!rows.length) throw new Error("请选择要导入的角色");
  if (
    new Set(rows.map((m) => m.targetId)).size !== rows.length ||
    new Set(rows.map((m) => m.sourceKey)).size !== rows.length
  )
    throw new Error("每个来源角色与计算器角色只能匹配一次");
  return rows.reduce((next, m) => {
    const source = account.characters.find((c) => c.key === m.sourceKey);
    if (!source) throw new Error("来源角色不存在");
    const options = defaultImportOptions(source);
    if (enabled)
      for (const key of Object.keys(options) as (keyof QuickImportOptions)[])
        options[key] = options[key] && enabled[key] !== false;
    return applyQuickImport(next, source, m.targetId, options);
  }, p);
}
function goodSetName(key?: string) {
  if (!key) return undefined;
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return (
    Object.entries(reference.artifactSetKeys).find(
      ([k]) => k.toLowerCase() === normalized,
    )?.[1] ?? key
  );
}
export function artifactSetName(names: (string | undefined)[]) {
  const counts = new Map<string, number>();
  for (const name of names)
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  const sets = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"),
  );
  if (sets[0]?.[1] >= 4) return `${sets[0][0]}（4件套）`;
  const pairs = sets.filter(([, n]) => n >= 2);
  if (pairs.length >= 2) return `${pairs[0][0]}+${pairs[1][0]}（2+2）`;
  if (pairs.length) return `${pairs[0][0]}（2件套）`;
  return sets.length ? "散件" : undefined;
}
export function importedStatLabel(stat: MainValue) {
  return (
    stat.label ??
    `${ALL_STATS[stat.type].name} ${stat.value}${ALL_STATS[stat.type].percent ? "%" : ""}`
  );
}
