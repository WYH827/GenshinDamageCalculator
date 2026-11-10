import { fmt, VALUE_MODES } from "./model";
import type { DamageResult } from "./damage-engine";

export default function DamageCalculation({
  result: r,
}: {
  result: DamageResult;
}) {
  const b = r.breakdown;
  if (r.error || !b)
    return (
      <div className="calculation-error" role="status">
        <strong>本事件未完成计算</strong>
        <p>{r.error}</p>
        <span>修正参数后请点击开始计算；该事件不会以0伤害计入总伤害。</span>
      </div>
    );
  const rows = [
    [
      "公式分支",
      b.family === "normal"
        ? `常规直伤（${b.amplification ?? "无反应"}）`
        : `${r.skill.damage.special}直伤`,
    ],
    [
      `${r.skill.damage.scaling} · ${VALUE_MODES[b.scalingMode]}`,
      fmt(b.scaling),
    ],
    [
      "有效倍率",
      `(${fmt(b.originalMultiplier)}% + ${fmt(b.addedMultiplier)}%) × (1 + ${fmt(b.multiplierBoost)}%) = ${fmt(b.multiplier * 100)}%`,
    ],
    ...(b.starStacks === null
      ? []
      : [
          [
            "星超导层数 / 上周期元素力",
            `${b.starStacks} 层 / ${b.starStacks - 1} 点`,
          ],
          [
            "对应冰雷增伤 / 实际应用",
            `${fmt(b.starTableBonus)}% / ${fmt(b.starElementBonus)}%${b.family === "astral" ? "（星月直伤不使用普通元素增伤）" : ""}`,
          ],
        ]),
    ...(b.amplification
      ? [
          [
            "增幅反应",
            `${b.amplification} · ${r.skill.damage.element} → ${b.amplification === "蒸发" ? (r.skill.damage.element === "水" ? "火" : "水") : r.skill.damage.element === "火" ? "冰" : "火"} · 基础系数 ${b.amplificationBase}`,
          ],
          ["反应触发者实时精通", fmt(b.amplificationMastery)],
          [
            "增幅精通加成",
            `2.78 × ${fmt(b.amplificationMastery)} / (${fmt(b.amplificationMastery)} + 1400) = ${fmt(b.amplificationMasteryBonus * 100)}%`,
          ],
          ["增幅反应增伤合计", `${fmt(b.amplificationBonus)}%`],
          [
            "蒸发融化系数",
            `${b.amplificationBase} × (1 + ${fmt(b.amplificationMasteryBonus * 100)}% + ${fmt(b.amplificationBonus)}%) = ${fmt(b.amplificationFactor)}`,
          ],
        ]
      : []),
    ...(b.family === "normal"
      ? [
          [
            "基础伤害",
            `${fmt(b.scaling)} × ${fmt(b.multiplier)} = ${fmt(b.base)}`,
          ],
          ["基础值加成 / 星月额外提升", fmt(b.baseAdd)],
          [
            "增伤系数",
            `1 + ${fmt(b.ordinaryBonus)}% + 易伤 ${fmt(b.vulnerability)}% − 减伤 ${fmt(b.reduction)}% = ${fmt(b.bonusFactor)}`,
          ],
          [
            "防御系数",
            `角色${b.characterLevel}级 / 敌人${b.enemyLevel}级，减防${fmt(b.defenseReduction)}%，无视${fmt(b.ignoreDefense)}% → ${fmt(b.defenseFactor)}`,
          ],
        ]
      : [
          ["星月系数", fmt(b.astralCoefficient)],
          ["基础提升", `${fmt(b.baseBoost)}%`],
          ["实时元素精通", fmt(b.mastery)],
          [
            "精通与专属增伤",
            `1 + 6 × ${fmt(b.mastery)} / (${fmt(b.mastery)} + 2000) + ${fmt(b.astralBonus)}% = ${fmt(b.bonusFactor)}`,
          ],
          [
            "星月基础伤害",
            `${fmt(b.astralCoefficient)} × ${fmt(b.scaling)} × ${fmt(b.multiplier)} × (1 + ${fmt(b.baseBoost)}%) × ${fmt(b.bonusFactor)} = ${fmt(b.base)}`,
          ],
          ["基础值加成 / 星月额外提升", fmt(b.astralExtra)],
          [
            "擢升合计与系数",
            `${fmt(b.upliftPercent)}% → 1 + ${fmt(b.upliftPercent)}% = ${fmt(b.uplift)}`,
          ],
          ["不使用的乘区", "普通增伤、敌方防御、增幅反应"],
        ]),
    [
      "独立乘区系数",
      b.independentFactors.length
        ? `${b.independentFactors.map((x) => fmt(x)).join(" × ")} = ${fmt(b.independentFactor)}`
        : "1（无独立乘区效果）",
    ],
    [
      `${r.skill.damage.element}抗性`,
      `${fmt(b.resistance)}% → 抗性系数 ${fmt(b.resistanceFactor)}`,
    ],
    [
      "实时暴击属性",
      `暴击率 ${fmt(b.critRate)}%（有效${fmt(b.effectiveCritRate)}%） / 暴伤 ${fmt(b.critDamage)}%`,
    ],
    [
      "暴击期望系数",
      `1 + ${fmt(b.effectiveCritRate)}% × ${fmt(b.critDamage)}% = ${fmt(b.critFactor)}`,
    ],
  ];
  return (
    <div className="calculation-breakdown">
      <div className="snapshot-heading">
        <span>伤害计算过程</span>
        <span className="soft-badge">按事件结算 · 暴击期望</span>
      </div>
      <div className="hit-outcomes">
        <div>
          <span>不暴击</span>
          <strong>{fmt(r.nonCrit!)}</strong>
        </div>
        <div>
          <span>暴击</span>
          <strong>{fmt(r.crit!)}</strong>
        </div>
        <div>
          <span>期望伤害</span>
          <strong>{fmt(r.expected!)}</strong>
        </div>
      </div>
      <dl className="factor-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="final-formula">
        期望伤害 = ({fmt(b.base)} + {fmt(b.baseAdd)})
        {b.family === "normal" ? ` × ${fmt(b.bonusFactor)}` : ""} ×{" "}
        {fmt(b.resistanceFactor)}
        {b.family === "normal"
          ? ` × ${fmt(b.defenseFactor)}`
          : ` × ${fmt(b.uplift)}`}{" "}
        × {fmt(b.critFactor)}
        {b.amplification ? ` × ${fmt(b.amplificationFactor)}` : ""}
        {` × ${fmt(b.independentFactor)}`} = <strong>{fmt(r.expected!)}</strong>
      </p>
      <p className="input-note">
        展示值按小数格式化；实际计算和总计使用未截断的数值。效果来源与参与状态见下方。
      </p>
    </div>
  );
}
