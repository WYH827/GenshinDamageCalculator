import { useState } from "react";
import { charName, fmt, type Project } from "./model";
import { Modal } from "./components";
import {
  DAMAGE_MODES,
  type DamageMode,
  type DamageSummary,
} from "./damage-summary";
import type { OutsidePanels } from "./panels";

const COLORS = ["#708e5b", "#6f9cb6", "#b294c7", "#d2aa65"];
export default function DamageDistribution({
  project,
  summary,
  mode,
  panels,
}: {
  project: Project;
  summary: DamageSummary;
  mode: DamageMode;
  panels: OutsidePanels;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const data = summary.characters.map((row, i) => ({
    ...row,
    name: charName(project.characters[i], i),
    color: COLORS[i],
  }));
  const hover = data.find((c) => c.id === hovered);
  const chosen = data.find((c) => c.id === selected);
  const ready = summary.total !== null && summary.total > 0;
  let offset = 0;
  return (
    <section className="panel damage-distribution" aria-label="角色伤害占比">
      <div className="distribution-heading">
        <h3>角色伤害占比</h3>
        <span>{DAMAGE_MODES[mode]}伤害 · 点击查看局外面板</span>
      </div>
      <div className="distribution-content">
        <div className="damage-donut">
          <svg viewBox="0 0 240 240" aria-label="角色伤害圆环图">
            <circle
              cx="120"
              cy="120"
              r="88"
              fill="none"
              stroke="#edf0e7"
              strokeWidth="30"
            />
            {ready &&
              data
                .filter((c) => c.percent > 0)
                .map((c) => {
                  const start = offset;
                  offset += c.percent;
                  const label = `${c.name}，${fmt(c.percent)}%，造成伤害 ${fmt(c.damage!)}，点击查看局外面板`;
                  return (
                    <circle
                      key={c.id}
                      className="donut-segment"
                      cx="120"
                      cy="120"
                      r="88"
                      pathLength="100"
                      fill="none"
                      stroke={c.color}
                      strokeWidth={hovered === c.id ? 36 : 30}
                      strokeDasharray={`${c.percent} ${100 - c.percent}`}
                      strokeDashoffset={-start}
                      transform="rotate(-90 120 120)"
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      onMouseEnter={() => setHovered(c.id)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(c.id)}
                      onBlur={() => setHovered(null)}
                      onClick={() => setSelected(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(c.id);
                        }
                      }}
                    >
                      <title>{label}</title>
                    </circle>
                  );
                })}
          </svg>
          <div className="donut-center">
            <span>总{DAMAGE_MODES[mode]}伤害</span>
            <strong>{summary.total === null ? "—" : fmt(summary.total)}</strong>
          </div>
          {hover && (
            <div className="donut-tooltip" role="tooltip">
              <strong>{hover.name}</strong>
              <span>占比 {fmt(hover.percent)}%</span>
              <span>
                造成伤害 {hover.damage === null ? "—" : fmt(hover.damage)}
              </span>
            </div>
          )}
        </div>
        <div className="distribution-list">
          <div className="distribution-columns">
            <span>角色</span>
            <span>占比</span>
            <span>总伤害</span>
          </div>
          {data.map((c) => (
            <button
              key={c.id}
              className="distribution-row"
              aria-label={`查看${c.name}局外面板`}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(c.id)}
              onBlur={() => setHovered(null)}
              onClick={() => setSelected(c.id)}
            >
              <span>
                <i style={{ background: c.color }} />
                {c.name}
              </span>
              <span>{summary.total === null ? "—" : `${fmt(c.percent)}%`}</span>
              <strong>
                {c.damage === null ? "计算未完成" : fmt(c.damage)}
              </strong>
            </button>
          ))}
          {!ready && (
            <p className="input-note">
              {summary.total === null
                ? "存在未完成的伤害，暂不显示完整占比。"
                : "总伤害为0，暂无伤害占比。"}
            </p>
          )}
        </div>
      </div>
      {chosen && (
        <Modal
          title={`${chosen.name} · 局外面板`}
          onClose={() => setSelected(null)}
        >
          <p className="input-note">
            本次计算方案的角色与装备词条，加上勾选“局外生效”的全局效果；不包含时间轴增益。
          </p>
          <dl className="outside-panel-values">
            {panels
              .find((c) => c.id === chosen.id)
              ?.rows.map((r) => (
                <div key={r.stat}>
                  <dt>{r.stat}</dt>
                  <dd>
                    {r.value === null
                      ? "引用错误"
                      : `${fmt(r.value)}${["生命值", "攻击力", "防御力", "元素精通"].includes(r.stat) ? "" : "%"}`}
                    {r.error && <small className="validation">{r.error}</small>}
                  </dd>
                </div>
              ))}
          </dl>
        </Modal>
      )}
    </section>
  );
}
