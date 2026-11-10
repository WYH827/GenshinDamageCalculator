import { createPanelResolver } from "./panels";
import {
  effectTargetIds,
  isEnemyEffect,
  isDamageEffect,
  effectTargetValid,
  starSuperconduct,
  sortedTimeline,
  endTime,
  amplificationFor,
  amplificationBase,
  type AmplificationReaction,
  type Damage,
  type Project,
  type Skill,
  type TimelineEvent,
  type Effect,
} from "./model";

export type EffectUse = {
  key: string;
  name: string;
  source: string;
  type: string;
  status: "applied" | "excluded" | "error" | "panel";
  reason: string;
  value?: number;
  x?: number;
  mode?: string;
  stacks?: number;
};
export type DamageBreakdown = {
  family: "normal" | "astral";
  scaling: number;
  scalingMode: Skill["scalingMode"];
  originalMultiplier: number;
  addedMultiplier: number;
  multiplierBoost: number;
  multiplier: number;
  base: number;
  baseAdd: number;
  ordinaryBonus: number;
  vulnerability: number;
  reduction: number;
  bonusFactor: number;
  resistance: number;
  resistanceFactor: number;
  defenseFactor: number;
  defenseReduction: number;
  ignoreDefense: number;
  characterLevel: number;
  enemyLevel: number;
  critRate: number;
  effectiveCritRate: number;
  critDamage: number;
  critFactor: number;
  astralCoefficient: number;
  mastery: number;
  baseBoost: number;
  astralBonus: number;
  astralExtra: number;
  uplift: number;
  upliftPercent: number;
  starStacks: number | null;
  starElementBonus: number;
  starTableBonus: number;
  amplification: AmplificationReaction | null;
  amplificationBase: number;
  amplificationMastery: number;
  amplificationMasteryBonus: number;
  amplificationBonus: number;
  amplificationFactor: number;
  independentFactors: number[];
  independentFactor: number;
};
export type DamageResult = {
  event: Extract<TimelineEvent, { kind: "skill" }>;
  skill: Skill;
  effects: EffectUse[];
  error?: string;
  breakdown?: DamageBreakdown;
  nonCrit?: number;
  crit?: number;
  expected?: number;
};
const finite = (n: number) => {
  if (!Number.isFinite(n)) throw new Error("计算结果超出有效数值范围");
  return n;
};
const nonnegative = (n: number, label: string) => {
  finite(n);
  if (n < 0) throw new Error(`${label}不能为负数，请检查效果参数`);
  return n;
};
export function resistanceFactor(r: number): number {
  finite(r);
  return r < 0 ? 1 - r / 2 : r < 0.75 ? 1 - r : 1 / (4 * r + 1);
}
export function defenseFactor(
  characterLevel: number,
  enemyLevel: number,
  reduction = 0,
  ignore = 0,
): number {
  nonnegative(characterLevel, "角色等级");
  nonnegative(enemyLevel, "敌人等级");
  return (
    (characterLevel + 100) /
    (characterLevel +
      100 +
      (enemyLevel + 100) *
        (1 - Math.min(0.9, Math.max(0, reduction))) *
        (1 - Math.min(1, Math.max(0, ignore))))
  );
}
export function damageMatches(filter: Damage, hit: Damage): boolean {
  return (
    (filter.element === "全部" || filter.element === hit.element) &&
    (filter.attack === "全部" || filter.attack === hit.attack) &&
    (filter.scaling === "全部" || filter.scaling === hit.scaling) &&
    (!filter.special || filter.special === hit.special)
  );
}
function relevant(
  e: Effect,
  skill: Skill,
  amplification?: AmplificationReaction,
): string | null {
  if (e.skillFilter && e.skillFilter.id !== skill.id) return "不匹配限定技能";
  if (e.type === "敌方抗性")
    return e.damage.element === "全部" ||
      e.damage.element === skill.damage.element
      ? null
      : "不匹配本次伤害元素";
  if (e.type === "降低防御")
    return skill.damage.special ? "星月直伤不使用防御区" : null;
  if (!isDamageEffect(e.type)) return null;
  if (!damageMatches(e.damage, skill.damage))
    return "不匹配伤害属性、动作、依赖属性或高级属性";
  if (e.type === "增幅反应增伤") {
    if (!amplification) return "本次不是蒸发或融化伤害";
    if (
      e.amplificationReaction &&
      e.amplificationReaction !== "全部" &&
      e.amplificationReaction !== amplification
    )
      return "不匹配本次增幅反应类型";
  }
  const astral = !!skill.damage.special;
  if (astral && ["增伤区", "易伤", "减伤", "无视防御"].includes(e.type))
    return "星月直伤不使用此常规乘区";
  if (!astral && ["星月基础提升", "星月增伤", "擢升"].includes(e.type))
    return "常规直伤不使用星月乘区";
  return null;
}
export function evaluateDamage(
  p: Project,
  event: Extract<TimelineEvent, { kind: "skill" }>,
  skill: Skill,
): DamageResult {
  const result: DamageResult = { event, skill, effects: [] };
  try {
    const c = p.characters.find((c) => c.id === skill.characterId);
    if (!c) throw new Error("伤害角色不存在");
    if (c.elementNeedsReview) throw new Error("请先确认角色元素属性");
    const hit = skill.damage,
      special = hit.special;
    const amplification = amplificationFor(skill, event.amplification);
    if (hit.element === "全部" || hit.scaling === "全部")
      throw new Error("伤害必须指定元素与依赖属性");
    if (["星超导", "星扩散"].includes(special) && hit.scaling !== "攻击力")
      throw new Error(`${special}直伤依照文档须使用攻击力乘区`);
    // Keep the editor's independent damage element selection authoritative.
    // A damage tag selects the formula; the actual hit element selects resistance.
    if (event.legacyStarCoefficient !== undefined)
      throw new Error(
        `旧星超导系数${event.legacyStarCoefficient}无法对应表内层数，请在时间轴选择1～13层`,
      );
    const stars =
      event.starStacks === undefined
        ? special === "星超导"
          ? starSuperconduct(1)
          : null
        : starSuperconduct(event.starStacks);
    const starElementBonus =
      !special && ["冰", "雷"].includes(hit.element) ? (stars?.bonus ?? 0) : 0;
    const resolver = createPanelResolver(p, event.id);
    let addM = 0,
      boostM = 0,
      baseAdd = 0,
      bonus = 0,
      vulnerability = 0,
      reduction = 0,
      resistance = p.enemy.resistance[hit.element];
    let reduceDef = 0,
      ignoreDef = 0,
      baseBoost = 0,
      astralBonus = 0,
      extra = 0,
      upliftPercent = 0;
    let amplificationBonus = 0;
    const independentFactors: number[] = [];
    for (const row of resolver.active) {
      const e = row.effect,
        use: EffectUse = {
          key: row.key,
          name: e.name || "未命名效果",
          source: row.source,
          type: e.type,
          status: "excluded",
          reason: "",
          stacks: row.stacks,
        };
      result.effects.push(use);
      const reason = relevant(e, skill, amplification);
      if (reason) {
        use.reason = reason;
        continue;
      }
      if (!effectTargetValid(e)) {
        use.status = "error";
        use.reason = "效果未选择生效对象";
        throw new Error(`${use.name}：${use.reason}`);
      }
      if (
        !isEnemyEffect(e.type) &&
        !effectTargetIds(p, e, event.id).includes(c.id)
      ) {
        use.reason = "不直接作用于伤害角色（可能通过变量依赖间接引用）";
        continue;
      }
      if (
        !isDamageEffect(e.type) &&
        !["敌方抗性", "降低防御"].includes(e.type)
      ) {
        use.status = "panel";
        use.reason = "已由角色属性解析器处理；仅使用本次依赖的属性";
        continue;
      }
      const evaluation = resolver.trace(e, row.stacks ?? 1);
      use.mode = evaluation.mode;
      use.x = evaluation.x;
      if (evaluation.error) {
        use.status = "error";
        use.reason = evaluation.error;
        throw new Error(`${use.name}：${evaluation.error}`);
      }
      const value = finite(evaluation.value!);
      use.value = value;
      const percent = [
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
      ].includes(e.type);
      if (percent && e.unit !== "percent") {
        use.status = "error";
        use.reason = "该乘区需要百分比单位";
        throw new Error(`${use.name}：${use.reason}`);
      }
      if (
        ["基础值加成", "星月额外提升"].includes(e.type) &&
        e.unit !== "flat"
      ) {
        use.status = "error";
        use.reason = "该项目需要固定数值单位";
        throw new Error(`${use.name}：${use.reason}`);
      }
      use.status = "applied";
      use.reason = "参与本次伤害";
      switch (e.type) {
        case "敌方抗性":
          resistance += value;
          break;
        case "增伤区":
          bonus += value;
          break;
        case "倍率区":
          if (e.multiplierMode === "unconfirmed") {
            use.status = "error";
            use.reason = "请明确倍率增加或倍率提升";
            throw new Error(`${use.name}：${use.reason}`);
          }
          if (e.multiplierMode === "add") addM += value;
          else boostM += value;
          break;
        case "基础值加成":
        case "星月额外提升":
          if (special) extra += value;
          else baseAdd += value;
          break;
        case "易伤":
          vulnerability += value;
          break;
        case "减伤":
          reduction += value;
          break;
        case "降低防御":
          reduceDef += value;
          break;
        case "无视防御":
          ignoreDef += value;
          break;
        case "星月基础提升":
          baseBoost += value;
          break;
        case "星月增伤":
          astralBonus += value;
          break;
        case "擢升":
          upliftPercent += value;
          break;
        case "增幅反应增伤":
          amplificationBonus += value;
          break;
        case "独立乘区":
          independentFactors.push(nonnegative(value, "独立乘区系数"));
          break;
      }
    }
    const scaling = nonnegative(
      resolver.resolve(c.id, hit.scaling, skill.scalingMode),
      "伤害依赖属性",
    );
    const effectiveMultiplier =
      nonnegative((skill.multiplier + addM) / 100, "技能有效倍率") *
      nonnegative(1 + boostM / 100, "倍率提升系数");
    const critRate = resolver.resolve(c.id, "暴击率", "live"),
      critDamage = nonnegative(
        resolver.resolve(c.id, "暴击伤害", "live"),
        "暴击伤害",
      );
    const probability = Math.max(0, Math.min(1, critRate / 100));
    const critFactor = 1 + (probability * critDamage) / 100;
    const R = resistanceFactor(resistance / 100);
    const ordinaryBonus = special
      ? 0
      : resolver.resolve(
          c.id,
          hit.element === "物理"
            ? "物理伤害加成"
            : `${hit.element}元素伤害加成`,
          "live",
        ) +
        bonus +
        starElementBonus;
    const normalBonus = nonnegative(
      1 + (ordinaryBonus + vulnerability - reduction) / 100,
      "增伤区系数",
    );
    const F = special
      ? 1
      : defenseFactor(c.level, p.enemy.level, reduceDef / 100, ignoreDef / 100);
    let base = scaling * effectiveMultiplier,
      coefficient = 1,
      mastery = 0,
      bonusFactor = normalBonus,
      uplift = 1;
    if (special) {
      coefficient =
        special === "月感电"
          ? 3
          : special === "月结晶"
            ? 1.6
            : special === "星超导"
              ? (stars?.coefficient ?? 1)
              : 1;
      if (special === "星超导" && (coefficient < 1 || coefficient > 2))
        throw new Error("星超导系数必须为1～2");
      mastery = nonnegative(
        resolver.resolve(c.id, "元素精通", "live"),
        "元素精通",
      );
      bonusFactor = nonnegative(
        1 + (6 * mastery) / (mastery + 2000) + astralBonus / 100,
        "星月精通与增伤系数",
      );
      uplift = nonnegative(1 + upliftPercent / 100, "擢升系数");
      base =
        coefficient *
        base *
        nonnegative(1 + baseBoost / 100, "星月基础提升系数") *
        bonusFactor;
    }
    const reactionBase = amplification
      ? amplificationBase(hit.element, amplification)
      : 1;
    const reactionMastery = amplification
      ? nonnegative(
          resolver.resolve(c.id, "元素精通", "live"),
          "增幅反应元素精通",
        )
      : 0;
    const masteryBonus = amplification
      ? (2.78 * reactionMastery) / (reactionMastery + 1400)
      : 0;
    const reactionFactor = amplification
      ? nonnegative(
          reactionBase * (1 + masteryBonus + amplificationBonus / 100),
          "增幅反应系数",
        )
      : 1;
    const independentFactor = finite(
      independentFactors.reduce((product, factor) => product * factor, 1),
    );
    const nonCrit = finite(
      nonnegative(base + (special ? extra : baseAdd), "伤害基础值") *
        (special ? 1 : normalBonus) *
        R *
        F *
        uplift *
        reactionFactor *
        independentFactor,
    );
    result.nonCrit = nonCrit;
    result.crit = finite(nonCrit * (1 + critDamage / 100));
    result.expected = finite(nonCrit * critFactor);
    result.breakdown = {
      family: special ? "astral" : "normal",
      scaling,
      scalingMode: skill.scalingMode,
      originalMultiplier: skill.multiplier,
      addedMultiplier: addM,
      multiplierBoost: boostM,
      multiplier: effectiveMultiplier,
      base,
      baseAdd: special ? extra : baseAdd,
      ordinaryBonus,
      vulnerability,
      reduction,
      bonusFactor,
      resistance,
      resistanceFactor: R,
      defenseFactor: F,
      defenseReduction: Math.min(90, Math.max(0, reduceDef)),
      ignoreDefense: Math.min(100, Math.max(0, ignoreDef)),
      characterLevel: c.level,
      enemyLevel: p.enemy.level,
      critRate,
      effectiveCritRate: probability * 100,
      critDamage,
      critFactor,
      astralCoefficient: coefficient,
      mastery,
      baseBoost,
      astralBonus,
      astralExtra: extra,
      uplift,
      upliftPercent,
      starStacks: stars?.stacks ?? null,
      starElementBonus,
      starTableBonus: stars?.bonus ?? 0,
      amplification: amplification ?? null,
      amplificationBase: reactionBase,
      amplificationMastery: reactionMastery,
      amplificationMasteryBonus: masteryBonus,
      amplificationBonus,
      amplificationFactor: reactionFactor,
      independentFactors,
      independentFactor,
    };
  } catch (err) {
    result.error = (err as Error).message;
  }
  return result;
}
export function calculateProject(p: Project) {
  const byId = new Map(p.skills.map((s) => [s.id, s]));
  const rows = sortedTimeline(p.timeline).flatMap((event) => {
    if (event.kind !== "skill" || event.repeat) return [];
    const s = byId.get(event.skillId);
    if (!s || s.kind !== "damage") return [];
    return [evaluateDamage(p, event, s)];
  });
  const failed = rows.filter((r) => r.error).length,
    time = endTime(p);
  const partial = rows.reduce((sum, r) => sum + (r.expected ?? 0), 0);
  const overflow = !Number.isFinite(partial);
  const total = failed || overflow ? null : partial;
  const quotient = total !== null && time > 0 ? total / time : null;
  return {
    rows,
    failed,
    time,
    partial: overflow ? null : partial,
    total,
    dps: quotient !== null && Number.isFinite(quotient) ? quotient : null,
    overflow,
  };
}
