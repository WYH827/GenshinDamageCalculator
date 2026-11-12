import {
  artifactMainStat,
  isConditionalCritEffect,
  MAIN_SLOTS,
  type MainStats,
  statValue,
  effectTargetIds,
  effectUnit,
  VALUE_MODES,
  VARIABLE_STATS,
  type Effect,
  type Project,
  type StatKey,
} from "./model";
import { activeEffectsAt, globalEffects } from "./effect-state";
import { evaluateEffectValue } from "./formulas";

export type Panel = Record<string, number>;
const keyNames: Partial<Record<StatKey, string>> = {
  hp: "生命值",
  atk: "攻击力",
  def: "防御力",
  mastery: "元素精通",
  critRate: "暴击率",
  critDamage: "暴击伤害",
  recharge: "元素充能效率",
  healingBonus: "治疗加成",
  pyroBonus: "火元素伤害加成",
  cryoBonus: "冰元素伤害加成",
  electroBonus: "雷元素伤害加成",
  dendroBonus: "草元素伤害加成",
  geoBonus: "岩元素伤害加成",
  anemoBonus: "风元素伤害加成",
  hydroBonus: "水元素伤害加成",
  physicalBonus: "物理伤害加成",
};
const percentNames: Partial<Record<StatKey, string>> = {
  hpPercent: "生命值",
  atkPercent: "攻击力",
  defPercent: "防御力",
};
export function staticPanels(
  p: Project,
  id: string,
): { base: Panel; outside: Panel } {
  const c = p.characters.find((c) => c.id === id);
  if (!c) throw new Error("角色不存在");
  const w = p.weapons.find((w) => w.characterId === id)!,
    a = p.artifacts.find((a) => a.characterId === id)!;
  const base: Panel = {
    生命值: c.hp,
    攻击力: c.atk + w.atk,
    防御力: c.def,
    元素精通: c.mastery,
    暴击率: c.critRate,
    暴击伤害: c.critDamage,
    元素充能效率: 100,
    治疗加成: 0,
    火元素伤害加成: 0,
    冰元素伤害加成: 0,
    雷元素伤害加成: 0,
    草元素伤害加成: 0,
    岩元素伤害加成: 0,
    风元素伤害加成: 0,
    水元素伤害加成: 0,
    物理伤害加成: c.physicalBonus,
  };
  base[`${c.element}元素伤害加成`] = c.bonus;
  const outside = { ...base };
  const add = (type: StatKey, value: number) => {
    const flat = keyNames[type],
      pct = percentNames[type];
    if (flat) outside[flat] += value;
    else if (pct) outside[pct] += (base[pct] * value) / 100;
  };
  for (const stat of [c.ascension, ...(c.legacyAscension ?? [])])
    if (stat) add(stat.type, stat.value);
  for (const slot of Object.keys(MAIN_SLOTS) as (keyof MainStats)[]) {
    const stat = artifactMainStat(a, slot);
    add(stat.type, stat.value);
  }
  for (const s of [...w.substats, ...a.substats]) add(s.type, statValue(s));
  return { base, outside };
}
export function createPanelResolver(p: Project, eventId: string) {
  const active = activeEffectsAt(p, eventId),
    outsideEffects = globalEffects(p).filter((row) => row.effect.outsideActive),
    cache = new Map<string, number>(),
    stack: string[] = [];
  const panels = new Map(
    p.characters.map((c) => [c.id, staticPanels(p, c.id)]),
  );
  function resolve(
    id: string,
    stat: string,
    mode: Exclude<Effect["valueMode"], "number">,
  ): number {
    const set = panels.get(id);
    if (!set || !(stat in set.base))
      throw new Error("变量引用的角色或属性无效");
    if (mode === "base") return set.base[stat];
    const key = `${mode}:${id}:${stat}`;
    if (cache.has(key)) return cache.get(key)!;
    if (stack.includes(key))
      throw new Error(
        `${mode === "outside" ? "局外" : "实时"}数值存在循环引用，请调整变量来源或改用基础数值`,
      );
    stack.push(key);
    try {
      let value = set.outside[stat];
      // Both contexts start from equipment alone: an outside-enabled global must
      // not be counted again when resolving the live panel.
      for (const row of mode === "outside" ? outsideEffects : active) {
        const e = row.effect;
        const targets =
          mode === "outside" && e.target === "foreground"
            ? [p.initialCharacterId]
            : effectTargetIds(p, e, eventId);
        if (
          e.type !== stat ||
          !targets.includes(id) ||
          isConditionalCritEffect(e)
        )
          continue;
        const amount = evaluate(e, mode) * (row.stacks ?? 1);
        value +=
          effectUnit(e) === "percent" &&
          ["生命值", "攻击力", "防御力", "元素精通"].includes(stat)
            ? (set.base[stat] * amount) / 100
            : amount;
      }
      if (!Number.isFinite(value)) throw new Error("角色数值超出范围");
      cache.set(key, value);
      return value;
    } finally {
      stack.pop();
    }
  }
  function evaluate(e: Effect, context: "outside" | "live"): number {
    if (e.valueMode === "number") return e.value;
    // No timeline effects exist outside combat, even for a live variable.
    const mode =
      context === "outside" && e.valueMode === "live" ? "outside" : e.valueMode;
    const x = resolve(e.variableCharacterId, e.variableStat, mode);
    return evaluateEffectValue(e, x);
  }
  function trace(
    e: Effect,
    stacks = 1,
  ): {
    value?: number;
    perStack?: number;
    x?: number;
    mode: string;
    error?: string;
  } {
    try {
      const x =
        e.valueMode === "number"
          ? undefined
          : resolve(e.variableCharacterId, e.variableStat, e.valueMode);
      const perStack = evaluateEffectValue(e, x ?? 0);
      if (e.type === "独立乘区" && perStack < 0)
        throw new Error("独立乘区系数不能为负数");
      const value =
        e.type === "独立乘区" ? perStack ** stacks : perStack * stacks;
      if (!Number.isFinite(value)) throw new Error("效果数值超出范围");
      return {
        value,
        perStack,
        x,
        mode: VALUE_MODES[e.valueMode],
      };
    } catch (err) {
      return { mode: VALUE_MODES[e.valueMode], error: (err as Error).message };
    }
  }
  return { resolve, trace, panels, active };
}
export function calculateOutsidePanels(p: Project) {
  const resolver = createPanelResolver({ ...p, timeline: [] }, "");
  return p.characters.map((c) => ({
    id: c.id,
    rows: VARIABLE_STATS.map((stat) => {
      try {
        return {
          stat,
          value: resolver.resolve(c.id, stat, "outside"),
          error: undefined,
        };
      } catch (error) {
        return { stat, value: null, error: (error as Error).message };
      }
    }),
  }));
}
export type OutsidePanels = ReturnType<typeof calculateOutsidePanels>;
