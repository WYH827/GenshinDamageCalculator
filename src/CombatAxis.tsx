import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type FocusEvent,
} from "react";
import type { CombatAxisData } from "./combat-axis";
import { axisEventLabel } from "./combat-axis";
import { effectCatalog, isStackingEffect } from "./effect-catalog";
import { fmt, charName, VALUE_MODES, type Project } from "./model";
import { effectSummary } from "./components";
import EffectSourceVisual from "./EffectSourceVisual";
import type { DamageResult } from "./damage-engine";
import { DAMAGE_MODES, type DamageMode } from "./damage-summary";
import { damageScale } from "./chart-scale";

type Selection =
  { kind: "global"; key: string } | { kind: "event"; id: string };
export default function CombatAxis({
  project: p,
  data,
  rows,
  mode,
  onDamage,
}: {
  project: Project;
  data: CombatAxisData;
  rows: DamageResult[];
  mode: DamageMode;
  onDamage: (id: string) => void;
}) {
  const catalog = useMemo(() => effectCatalog(p), [p]);
  const byKey = useMemo(
    () => new Map(catalog.map((e) => [e.key, e])),
    [catalog],
  );
  const events = useMemo(
    () => new Map(data.events.map((e) => [e.id, e])),
    [data],
  );
  const [expanded, setExpanded] = useState(false),
    [selected, setSelected] = useState<Selection | null>(null),
    [effectPage, setEffectPage] = useState(0);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const detailRef = useRef<HTMLElement>(null),
    id = useId();
  const list = useMemo(
    () => [
      ...data.globalKeys.map((key) => ({
        selection: { kind: "global", key } as Selection,
        key,
        time: 0,
        id: `global-${key}`,
      })),
      ...data.events.map((e) => ({
        selection: { kind: "event", id: e.id } as Selection,
        key: e.key,
        time: e.time,
        id: e.id,
      })),
    ],
    [data],
  );
  const selectedId =
    selected?.kind === "event"
      ? selected.id
      : selected
        ? `global-${selected.key}`
        : "";
  const choose = (value: Selection) => {
    const key = value.kind === "event" ? value.id : `global-${value.key}`;
    const index = list.findIndex((e) => e.id === key);
    setEffectPage(Math.floor(Math.max(0, index) / 20));
    setSelected(value);
    setTooltip(null);
    requestAnimationFrame(() =>
      (
        document.getElementById(`${id}-effect-${key}`) ?? detailRef.current
      )?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  useEffect(() => {
    setSelected(null);
    setEffectPage(0);
    setTooltip(null);
  }, [data]);
  const show = (
    ev: MouseEvent<SVGElement> | FocusEvent<SVGElement>,
    text: string,
  ) => {
    const box = ev.currentTarget.getBoundingClientRect();
    const mouse = "clientX" in ev;
    setTooltip({
      x: Math.min(
        window.innerWidth - 280,
        Math.max(10, mouse ? ev.clientX + 12 : box.left),
      ),
      y: Math.max(
        10,
        Math.min(
          window.innerHeight - 160,
          mouse ? ev.clientY + 14 : box.bottom + 8,
        ),
      ),
      text,
    });
  };
  const activate = (fn: () => void) => (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fn();
    }
  };
  const domain = data.end || 1,
    left = 180,
    right = 940,
    x = (t: number) =>
      left + (Math.min(domain, Math.max(0, t)) / domain) * (right - left),
    baseline = 174;
  const scale = damageScale(rows.map((r) => (r.error ? 0 : (r[mode] ?? 0)))),
    max = scale.max;
  const hitPositions = useMemo(() => {
    const counts = new Map<number, number>(),
      used = new Map<number, number>();
    rows.forEach((r) =>
      counts.set(r.event.time, (counts.get(r.event.time) ?? 0) + 1),
    );
    return rows.map((r) => {
      const n = used.get(r.event.time) ?? 0;
      used.set(r.event.time, n + 1);
      return (n - ((counts.get(r.event.time) ?? 1) - 1) / 2) * 5;
    });
  }, [rows]);
  const globalY = baseline + 55 + Math.max(1, data.tracks.length) * 42,
    height = globalY + 60 + (expanded ? data.globalKeys.length * 36 : 0);
  const currentPage = Math.min(
    effectPage,
    Math.max(0, Math.ceil(list.length / 20) - 1),
  );
  return (
    <>
      <section
        className="result-effect-details"
        ref={detailRef}
        aria-label="效果事件详情"
      >
        <div className="damage-detail-title">
          <div>
            <h3>效果事件详情</h3>
            <p>
              点击下方效果区间，可定位其触发或层数变化；全局效果按定义显示。
            </p>
          </div>
          <span className="soft-badge">{list.length} 条</span>
        </div>
        <div className="panel effect-history-list">
          {list.slice(currentPage * 20, (currentPage + 1) * 20).map((item) => {
            const entry = byKey.get(item.key);
            if (!entry) return null;
            const event =
                item.selection.kind === "event"
                  ? events.get(item.selection.id)
                  : undefined,
              open = item.id === selectedId;
            return (
              <details
                className="effect-history-event"
                id={`${id}-effect-${item.id}`}
                key={item.id}
                open={open}
              >
                <summary
                  onClick={(ev) => {
                    ev.preventDefault();
                    setSelected(open ? null : item.selection);
                  }}
                >
                  <EffectSourceVisual project={p} entry={entry} />
                  <strong>{entry.effect.name || "未命名效果"}</strong>
                  <span>{item.time.toFixed(2)}s</span>
                  <span>
                    {event ? axisEventLabel(event) : "全局效果 · 全程"}
                  </span>
                  {event && isStackingEffect(entry.effect) && (
                    <b>
                      {event.previous} → {event.count} 层
                    </b>
                  )}
                </summary>
                {open && (
                  <div className="effect-history-body">
                    <p>{effectSummary(entry.effect)}</p>
                    <p>来源：{entry.source}</p>
                    {event ? (
                      <>
                        <p>
                          事件：{axisEventLabel(event)} ·{" "}
                          {event.time.toFixed(2)}s · 层数 {event.previous} →{" "}
                          {event.count}
                        </p>
                        <p>
                          来源触发时间：{event.originTime.toFixed(2)}s
                          {event.kind === "initial" ? "（初始层数）" : ""}
                          {p.timeline.find((e) => e.id === event.originId)
                            ?.kind === "skill"
                            ? " · 技能绑定"
                            : ""}
                        </p>
                        <p>
                          本次持续时间：
                          {event.timing.duration === null
                            ? "永久"
                            : `${fmt(event.timing.duration)}s`}
                          {event.timing.mode === "periodic"
                            ? ` · 每${fmt(event.timing.interval)}s变化${event.timing.delta}层 · 定时范围${event.timing.activeFor == null ? "永久" : `${fmt(event.timing.activeFor)}s`}`
                            : ""}
                        </p>
                      </>
                    ) : (
                      <p>
                        全程生效
                        {entry.effect.outsideActive ? " · 局外生效" : ""}
                      </p>
                    )}
                    {entry.effect.valueMode !== "number" && (
                      <>
                        <p>
                          变量：
                          {p.characters.find(
                            (c) => c.id === entry.effect.variableCharacterId,
                          )?.name || "角色"}{" "}
                          · {VALUE_MODES[entry.effect.valueMode]} ·{" "}
                          {entry.effect.variableStat}
                        </p>
                        {entry.effect.advanced ? (
                          entry.effect.formulas.map((f) => (
                            <p key={f.id}>
                              <code>
                                {f.condition || "默认"}：{f.formula}
                              </code>
                            </p>
                          ))
                        ) : (
                          <p>系数：{fmt(entry.effect.coefficient)}</p>
                        )}
                        <small>
                          变量按各伤害事件当时数值计算；具体数值见该伤害事件详情。
                        </small>
                      </>
                    )}
                  </div>
                )}
              </details>
            );
          })}
          {!list.length && <p className="input-note">本次计算没有效果事件。</p>}
        </div>
        {list.length > 20 && (
          <div className="result-pagination">
            <button
              className="btn"
              disabled={!currentPage}
              onClick={() => {
                setEffectPage(currentPage - 1);
                setSelected(null);
              }}
            >
              上一页效果
            </button>
            <span>
              {currentPage + 1} / {Math.ceil(list.length / 20)}
            </span>
            <button
              className="btn"
              disabled={(currentPage + 1) * 20 >= list.length}
              onClick={() => {
                setEffectPage(currentPage + 1);
                setSelected(null);
              }}
            >
              下一页效果
            </button>
          </div>
        )}
      </section>
      <section className="panel combat-axis" aria-label="伤害&效果轴">
        <div className="combat-axis-heading">
          <div>
            <h3>伤害&amp;效果轴</h3>
            <p>
              上方为{DAMAGE_MODES[mode]}
              伤害；下方为实时效果与层数区间。点击柱或区间跳转到详情。
            </p>
          </div>
          <span>{data.end.toFixed(2)}s</span>
        </div>
        {data.error ? (
          <p className="validation">{data.error}</p>
        ) : (
          <div className="combat-axis-scroll" onScroll={() => setTooltip(null)}>
            <svg
              className="combat-axis-svg"
              viewBox={`0 0 980 ${height}`}
              role="group"
              aria-label="伤害柱与效果持续区间"
              onMouseLeave={() => setTooltip(null)}
            >
              <defs>
                <marker
                  id={`${id}-arrow`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0 0 L8 4 L0 8" fill="#71866b" />
                </marker>
              </defs>
              {Array.from({ length: data.end > 0 ? 11 : 1 }, (_, i) => {
                const t = (data.end * i) / 10;
                return (
                  <g key={i}>
                    <line
                      x1={x(t)}
                      x2={x(t)}
                      y1={30}
                      y2={height - 18}
                      className="axis-grid"
                    />
                    <text
                      x={x(t)}
                      y={baseline + 22}
                      textAnchor="middle"
                      className="axis-time"
                    >
                      {fmt(t)}s
                    </text>
                  </g>
                );
              })}
              <text x="16" y="35" className="axis-label">
                {DAMAGE_MODES[mode]}伤害
              </text>
              <g className="damage-y-axis" aria-label="伤害纵轴">
                <line
                  x1={left - 6}
                  x2={left - 6}
                  y1={baseline}
                  y2={baseline - 137}
                  stroke="#71866b"
                  markerEnd={`url(#${id}-arrow)`}
                />
                {scale.ticks.map((value) => {
                  const y = baseline - (value / max) * 125;
                  return (
                    <g key={value}>
                      <line
                        x1={left - 11}
                        x2={left - 6}
                        y1={y}
                        y2={y}
                        stroke="#71866b"
                      />
                      <line
                        className="axis-grid"
                        x1={left}
                        x2={right}
                        y1={y}
                        y2={y}
                      />
                      <text
                        className="axis-y-tick"
                        x={left - 16}
                        y={y + 3}
                        textAnchor="end"
                      >
                        {value >= 1e9 ? value.toExponential(1) : fmt(value)}
                      </text>
                    </g>
                  );
                })}
              </g>
              <line
                x1={left - 6}
                x2={right + 16}
                y1={baseline}
                y2={baseline}
                stroke="#71866b"
                markerEnd={`url(#${id}-arrow)`}
              />
              {rows.map((r, i) => {
                const amount = r[mode],
                  valid =
                    !r.error && amount !== undefined && Number.isFinite(amount),
                  h = valid ? Math.max(2, (amount / max) * 125) : 6;
                const name = charName(
                  p.characters.find((c) => c.id === r.skill.characterId)!,
                  p.characters.findIndex((c) => c.id === r.skill.characterId),
                );
                const tip = `${name} · ${r.skill.name || "未命名技能"}\n${r.event.time.toFixed(2)}s · ${DAMAGE_MODES[mode]}伤害 ${valid ? fmt(amount) : r.error || "未完成"}\n点击查看伤害事件详情`;
                return (
                  <rect
                    key={r.event.id}
                    className={`axis-damage-bar ${valid ? "" : "failed"}`}
                    data-event-id={r.event.id}
                    x={x(r.event.time) + hitPositions[i] - 2}
                    y={baseline - h}
                    width={4}
                    height={h}
                    rx="1"
                    role="button"
                    tabIndex={0}
                    aria-label={tip}
                    onMouseEnter={(e) => show(e, tip)}
                    onFocus={(e) => show(e, tip)}
                    onBlur={() => setTooltip(null)}
                    onClick={() => {
                      setTooltip(null);
                      onDamage(r.event.id);
                    }}
                    onKeyDown={activate(() => onDamage(r.event.id))}
                  />
                );
              })}
              {data.tracks.map((track, i) => {
                const entry = byKey.get(track.key);
                if (!entry) return null;
                const y = baseline + 45 + i * 42;
                return (
                  <g key={track.key}>
                    <text x="16" y={y + 18} className="axis-label">
                      <title>
                        {entry.effect.name} · {entry.source}
                      </title>
                      {(entry.effect.name || "未命名效果").slice(0, 12)}
                    </text>
                    {track.segments.map((segment, j) => {
                      const event = events.get(segment.transitionId),
                        width = Math.max(
                          0.8,
                          x(segment.end) - x(segment.start),
                        );
                      const tip = `${entry.effect.name} · ${entry.source}\n${segment.start.toFixed(2)}–${segment.end.toFixed(2)}s${track.stacking ? ` · ${segment.count}层` : ""}\n${event ? `${axisEventLabel(event)} · ${event.time.toFixed(2)}s` : ""}\n点击查看对应效果变化`;
                      return (
                        <g
                          key={`${segment.transitionId}-${j}`}
                          className="axis-buff-segment"
                          role="button"
                          tabIndex={0}
                          aria-label={tip}
                          data-transition-id={segment.transitionId}
                          onMouseEnter={(e) => show(e, tip)}
                          onFocus={(e) => show(e, tip)}
                          onBlur={() => setTooltip(null)}
                          onClick={() =>
                            choose({ kind: "event", id: segment.transitionId })
                          }
                          onKeyDown={activate(() =>
                            choose({ kind: "event", id: segment.transitionId }),
                          )}
                        >
                          <rect
                            x={x(segment.start)}
                            y={y}
                            width={width}
                            height={25}
                            rx="3"
                          />
                          <text
                            x={x(segment.start) + width / 2}
                            y={y + 17}
                            textAnchor="middle"
                            style={{
                              fontSize: Math.min(
                                11,
                                width /
                                  Math.max(1, String(segment.count).length),
                              ),
                            }}
                          >
                            {track.stacking ? segment.count : ""}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
              {!data.tracks.length && (
                <text x={left} y={baseline + 60} className="axis-muted">
                  没有持续生效的实时效果
                </text>
              )}
              <text x="16" y={globalY + 18} className="axis-label">
                全局效果 · {data.globalKeys.length}
              </text>
              <g
                className="axis-global-summary"
                role="button"
                tabIndex={0}
                aria-label={`${expanded ? "收起" : "展开"}全局效果`}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
                onKeyDown={activate(() => setExpanded(!expanded))}
              >
                <rect
                  x={left}
                  y={globalY}
                  width={right - left}
                  height="26"
                  rx="5"
                />
                <text
                  x={(left + right) / 2}
                  y={globalY + 18}
                  textAnchor="middle"
                >
                  {expanded ? "收起" : "展开"} {data.globalKeys.length}{" "}
                  条全局效果 · 全程
                </text>
              </g>
              {expanded &&
                data.globalKeys.map((key, i) => {
                  const entry = byKey.get(key);
                  if (!entry) return null;
                  const y = globalY + 36 + i * 36,
                    tip = `${entry.effect.name} · ${entry.source}\n0.00–${data.end.toFixed(2)}s · 全程\n${effectSummary(entry.effect)}\n点击查看全局效果详情`;
                  return (
                    <g key={key}>
                      <text x="16" y={y + 17} className="axis-label">
                        <title>{entry.effect.name}</title>
                        {entry.effect.name.slice(0, 12)}
                      </text>
                      <g
                        className="axis-global-effect"
                        role="button"
                        tabIndex={0}
                        aria-label={tip}
                        onMouseEnter={(e) => show(e, tip)}
                        onFocus={(e) => show(e, tip)}
                        onBlur={() => setTooltip(null)}
                        onClick={() => choose({ kind: "global", key })}
                        onKeyDown={activate(() =>
                          choose({ kind: "global", key }),
                        )}
                      >
                        <rect
                          x={left}
                          y={y}
                          width={right - left}
                          height="24"
                          rx="4"
                        />
                        <text
                          x={(left + right) / 2}
                          y={y + 17}
                          textAnchor="middle"
                        >
                          全程生效
                        </text>
                      </g>
                    </g>
                  );
                })}
            </svg>
          </div>
        )}
        {data.truncated && (
          <p className="validation">效果变化过多，图中仅展示已记录部分。</p>
        )}
        <p className="input-note">
          区间显示至本次DPS统计终点，归零期间留空。同一时刻的伤害柱并排显示；效果变量取值见伤害详情。
        </p>
      </section>
      {tooltip && (
        <div
          role="tooltip"
          className="combat-axis-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
}
