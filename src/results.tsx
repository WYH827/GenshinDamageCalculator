import { useState, useMemo, useLayoutEffect } from "react";
import CombatAxis from "./CombatAxis";
import DamageDistribution from "./DamageDistribution";
import {
  DAMAGE_MODES,
  summarizeDamage,
  type DamageMode,
} from "./damage-summary";
import type { CalculationController } from "./useCalculation";
import type { CalculationDetail } from "./calculation.worker";
import type { DamageResult } from "./damage-engine";
import DamageCalculation from "./DamageCalculation";
export { activeEffectsAt } from "./effect-state";
import {
  VALUE_MODES,
  isEnemyEffect,
  isDamageEffect,
  effectUnit,
  endTime,
} from "./model";
import {
  Activity,
  ChevronDown,
  Clock3,
  Layers3,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { Empty, effectSummary } from "./components";
import { Avatar, SectionTitle } from "./sections";
import {
  ALL_STATS,
  MAIN_SLOTS,
  artifactMainStatLabel,
  foregroundAt,
  effectTargetIds,
  charName,
  fmt,
  resultTeamName,
  sortedTimeline,
  statValue,
  teamCosts,
  type Damage,
  type Effect,
  type Project,
  type Skill,
  type TimelineEvent,
} from "./model";

export function damageLabel(d: Damage) {
  return `${d.special}${d.element === "物理" ? "物理属性" : `${d.element}元素`}`;
}
export function damageEvents(
  p: Project,
): { event: TimelineEvent; skill: Skill }[] {
  return sortedTimeline(p.timeline).flatMap((event) => {
    const skill =
      event.kind === "skill"
        ? p.skills.find((s) => s.id === event.skillId && s.kind === "damage")
        : undefined;
    return skill ? [{ event, skill }] : [];
  });
}
function targets(p: Project, e: Effect, eventId: string) {
  if (isEnemyEffect(e.type)) return "敌方";
  const names =
    effectTargetIds(p, e, eventId)
      .map((id) =>
        charName(
          p.characters.find((c) => c.id === id)!,
          p.characters.findIndex((c) => c.id === id),
        ),
      )
      .join("、") || "当前没有匹配角色";
  return e.target === "foreground"
    ? `前台角色 · ${names}`
    : e.target === "team"
      ? `全队 · ${names}`
      : names;
}
function Snapshot({
  project: p,
  event,
  result,
  detail,
}: {
  project: Project;
  event: TimelineEvent;
  result: DamageResult;
  detail: CalculationDetail;
}) {
  const effects = detail.effects;
  const foreground = foregroundAt(p, event.id);
  return (
    <div className="damage-snapshot">
      <DamageCalculation result={result} />
      <div className="foreground-summary">
        当前前台角色：
        {charName(
          p.characters.find((c) => c.id === foreground)!,
          p.characters.findIndex((c) => c.id === foreground),
        )}
      </div>
      <div className="snapshot-heading">
        <span>
          <Users size={15} />
          所有角色实时属性
        </span>
        <span className="soft-badge">按当前属性效果解析</span>
      </div>
      <p className="input-note">
        基础数值仅含角色和武器基础攻击力；局外数值包含装备主副词条及勾选“局外生效”的全局属性效果；实时数值计入当前有效属性效果，每条只计入一次。伤害专用增伤与倍率保留在效果详情中。
      </p>
      <div className="snapshot-characters">
        {p.characters.map((c, index) => {
          const w = p.weapons.find((w) => w.characterId === c.id)!;
          const a = p.artifacts.find((a) => a.characterId === c.id)!;
          const rows = detail.characters
            .find((x) => x.id === c.id)!
            .rows.map((row) => [
              row.stat,
              `${fmt(row.base)} / ${row.outside === null ? "引用错误" : fmt(row.outside)} / ${row.live === null ? "引用错误" : fmt(row.live)}`,
            ]);
          return (
            <div className="snapshot-character" key={c.id}>
              <div>
                <Avatar small character={c} index={index} />
                <strong>
                  {charName(c, index)}
                  {foreground === c.id && (
                    <small className="foreground-tag">前台</small>
                  )}
                </strong>
              </div>
              <p className="panel-values-label">基础 / 局外 / 实时</p>
              <dl>
                {rows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="snapshot-substats">
                <span>圣遗物主词条</span>
                {(Object.keys(MAIN_SLOTS) as (keyof typeof MAIN_SLOTS)[]).map(
                  (slot) => (
                    <p key={slot}>
                      <span>
                        {MAIN_SLOTS[slot]} · {artifactMainStatLabel(a, slot)}
                      </span>
                    </p>
                  ),
                )}
              </div>
              <div className="snapshot-substats">
                <span>装备副词条</span>
                {[
                  ...w.substats.map((s) => ({ s, source: "武器" })),
                  ...a.substats.map((s) => ({ s, source: "圣遗物" })),
                ].map(({ s, source }) => (
                  <p key={`${source}-${s.id}`}>
                    <span>
                      {source} · {ALL_STATS[s.type].name}
                    </span>
                    <b>
                      {s.type === "notImportant" ? "不计入" : fmt(statValue(s))}
                      {ALL_STATS[s.type].percent ? "%" : ""}
                    </b>
                  </p>
                ))}
                {!w.substats.length && !a.substats.length && <p>尚未配置</p>}
              </div>
              <div className="live-pending">数值单位：暴击、充能、增伤为 %</div>
            </div>
          );
        })}
      </div>
      <div className="snapshot-heading">
        <span>
          <Sparkles size={15} />
          此时生效的所有效果
        </span>
        <span className="soft-badge">{effects.length} 条</span>
      </div>
      <p className="input-note">
        按起始时间和持续时间筛选，生效区间为 [起始时间,
        结束时间)。同一时刻按时间轴添加顺序生效；普通效果重复触发刷新时间，多层效果按各自规则叠加或定时增减。变量按所选基础、局外或实时数值求值。
      </p>
      {effects.length ? (
        <div className="active-effects">
          {effects.map(
            ({
              key,
              effect: e,
              start,
              source,
              evaluation,
              stacks,
              stackBatches,
              nextStackChange,
            }) => {
              const usage = result.effects.find((x) => x.key === key);
              return (
                <div className="active-effect" key={key}>
                  <div>
                    <strong>{e.name || "未命名效果"}</strong>
                    <span>{effectSummary(e)}</span>
                  </div>
                  <div>
                    <span>来源：{source}</span>
                    {stacks !== undefined && (
                      <span>
                        当前层数：{stacks} 层 · 每层数值：
                        {evaluation.perStack === undefined
                          ? "—"
                          : fmt(evaluation.perStack)}
                        {effectUnit(e) === "percent" ? "%" : ""}
                      </span>
                    )}
                    {stackBatches?.map((b, i) => (
                      <span key={i}>
                        {b.count} 层：
                        {b.end === null ? "永久" : `${b.end.toFixed(2)}s 到期`}
                      </span>
                    ))}
                    {nextStackChange !== undefined && (
                      <span>下次层数变化：{nextStackChange.toFixed(2)}s</span>
                    )}
                    {usage && (
                      <span className={`effect-usage ${usage.status}`}>
                        {usage.status === "applied"
                          ? "参与伤害"
                          : usage.status === "panel"
                            ? "属性效果"
                            : usage.status === "error"
                              ? "错误"
                              : "未直接参与"}
                        ：{usage.reason}
                      </span>
                    )}
                    <span>对象：{targets(p, e, event.id)}</span>
                    {isDamageEffect(e.type) && (
                      <span>
                        筛选：{e.damage.element}属性 · {e.damage.attack} ·{" "}
                        {e.damage.scaling}乘区
                        {e.damage.special ? ` · ${e.damage.special}` : ""}
                      </span>
                    )}
                    {e.type === "敌方抗性" && (
                      <span>抗性属性：{e.damage.element}</span>
                    )}
                    {e.type === "增幅反应增伤" && (
                      <span>
                        增幅反应筛选：{e.amplificationReaction ?? "全部"}
                      </span>
                    )}
                    {e.valueMode !== "number" && (
                      <span>
                        变量来源：
                        {charName(
                          p.characters.find(
                            (c) => c.id === e.variableCharacterId,
                          )!,
                          p.characters.findIndex(
                            (c) => c.id === e.variableCharacterId,
                          ),
                        )}{" "}
                        · {VALUE_MODES[e.valueMode]} · {e.variableStat}{" "}
                        {evaluation.x === undefined
                          ? ""
                          : `x = ${fmt(evaluation.x)}`}
                      </span>
                    )}
                    <span className={evaluation.error ? "validation" : ""}>
                      {evaluation.error
                        ? `求值错误：${evaluation.error}`
                        : `效果数值：${fmt(evaluation.value!)}${effectUnit(e) === "percent" ? "%" : ""}`}
                    </span>
                  </div>
                  <small>
                    {stacks !== undefined ? (
                      "按层数规则生效"
                    ) : (
                      <>
                        {start.toFixed(2)}s —{" "}
                        {e.duration === null
                          ? "∞"
                          : `${(start + e.duration).toFixed(2)}s`}
                      </>
                    )}
                  </small>
                </div>
              );
            },
          )}
        </div>
      ) : (
        <div className="no-active-effects">该时刻没有生效中的效果。</div>
      )}
    </div>
  );
}
export default function Results({
  project: p,
  controller,
}: {
  project: Project;
  controller: CalculationController;
}) {
  const { run, running, stale } = controller;
  const displayProject = run?.project ?? p;
  const calculation = run?.calculation;
  const { damageMode, setDamageMode } = controller;
  const summary = useMemo(
    () =>
      calculation
        ? summarizeDamage(
            calculation.rows,
            displayProject.characters.map((c) => c.id),
            calculation.time,
            damageMode,
          )
        : null,
    [calculation, displayProject, damageMode],
  );
  const rows = calculation?.rows ?? [];
  const cost = teamCosts(displayProject);
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [jumpId, setJumpId] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!jumpId) return;
    const element = document.getElementById(`result-damage-${jumpId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setJumpId(null);
    }
  }, [jumpId, page, rows]);
  const jumpDamage = (id: string) => {
    const index = rows.findIndex((r) => r.event.id === id);
    if (index < 0) return;
    setPage(Math.floor(index / 40));
    setOpenId(id);
    controller.detail(id);
    setJumpId(id);
  };
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / 40) - 1),
  );
  const visible = rows.slice(currentPage * 40, (currentPage + 1) * 40);
  return (
    <>
      <SectionTitle
        eyebrow="07 / DAMAGE ANALYSIS"
        title="计算结果"
        description="点击开始计算后运行常规与星月直伤；编辑参数不会自动计算。"
      >
        <div className="button-group">
          <button
            className="btn primary"
            disabled={running}
            onClick={() => {
              setOpenId(null);
              setPage(0);
              controller.start();
            }}
          >
            {running ? "计算中…" : "开始计算"}
          </button>
          {running && (
            <button className="btn" onClick={controller.cancel}>
              取消计算
            </button>
          )}
        </div>
      </SectionTitle>
      <div
        className="segmented damage-mode-tabs"
        role="tablist"
        aria-label="伤害显示类型"
      >
        {(Object.keys(DAMAGE_MODES) as DamageMode[]).map((mode) => (
          <button
            key={mode}
            role="tab"
            aria-selected={mode === damageMode}
            className={mode === damageMode ? "active" : ""}
            onClick={() => setDamageMode(mode)}
          >
            {DAMAGE_MODES[mode]}
          </button>
        ))}
      </div>
      <div className="calculation-status" role="status">
        {running
          ? "计算正在后台运行，可以继续编辑或取消。"
          : stale
            ? "参数已修改，以下为上次计算结果，请点击开始计算更新。"
            : calculation
              ? "已完成计算；结果在修改参数后保持不变，直到再次点击开始计算。"
              : "尚未开始计算。点击上方按钮后才计算伤害和DPS。"}
      </div>
      {controller.error && (
        <div className="calculation-error" role="alert">
          {controller.error}
        </div>
      )}
      <div className="panel result-dashboard">
        <div className="result-teamline">
          <strong>
            队伍：<span>{resultTeamName(displayProject)}</span>
          </strong>
          <span>
            金数：<b>{fmt(cost.gold)}</b>
          </span>
          <span>
            限定金数：<b>{fmt(cost.limitedGold)}</b>
          </span>
        </div>
        <div className="result-numbers">
          <div className="dps-primary">
            <span>
              <Activity size={17} />
              DPS
            </span>
            <strong data-testid="total-dps">
              {summary?.dps == null ? "—" : fmt(summary.dps)}
            </strong>
            <small>
              {!calculation
                ? "等待开始计算"
                : calculation.failed
                  ? "有事件计算未完成"
                  : calculation.time === 0
                    ? "时长为0，DPS无法计算"
                    : `${DAMAGE_MODES[damageMode]}伤害 / 秒`}
            </small>
          </div>
          <div className="result-secondary">
            <div>
              <span>总伤害</span>
              <strong data-testid="total-damage">
                {summary?.total == null ? "—" : fmt(summary.total)}
              </strong>
              <small>
                {!calculation
                  ? "等待开始计算"
                  : calculation.failed
                    ? `${calculation.failed} 个事件需修正`
                    : `全部伤害事件的${DAMAGE_MODES[damageMode]}伤害之和`}
              </small>
            </div>
            <div>
              <span>秒数</span>
              <strong>
                {(calculation?.time ?? endTime(p)).toFixed(2)}
                <small>s</small>
              </strong>
              <small>最后有效事件时间</small>
            </div>
          </div>
        </div>
      </div>
      {summary && (summary.failed > 0 || summary.overflow) && (
        <div className="calculation-error">
          <strong>
            {summary.failed
              ? `${summary.failed} 个伤害事件未完成计算`
              : "总伤害超出数值范围"}
          </strong>
          <p>
            总伤害和DPS暂不显示完整数值。
            {summary.partial !== null
              ? `已计算部分：${fmt(summary.partial)}`
              : ""}
            ，请展开错误事件查看原因。
          </p>
        </div>
      )}
      {run && summary && (
        <DamageDistribution
          key={run.project === p ? "current" : "stale"}
          project={displayProject}
          summary={summary}
          mode={damageMode}
          panels={run.outsidePanels}
        />
      )}
      <div className="damage-detail-title">
        <div>
          <h3>
            <Layers3 size={17} />
            伤害详情
          </h3>
          <p>按时间轴排序，仅显示造成伤害的技能事件。</p>
        </div>
        <span className="soft-badge">{rows.length} 个伤害事件</span>
      </div>
      <div className="panel damage-details">
        <div className="damage-table-header">
          <span>角色</span>
          <span>时间</span>
          <span>伤害属性</span>
          <span>伤害</span>
          <span />
        </div>
        {visible.map((result) => {
          const { event, skill } = result;
          const c = displayProject.characters.find(
            (c) => c.id === skill.characterId,
          )!;
          return (
            <details
              className="damage-event"
              id={`result-damage-${event.id}`}
              key={event.id}
              open={openId === event.id}
              onToggle={(e) => {
                if (e.currentTarget.open) {
                  setOpenId(event.id);
                  controller.detail(event.id);
                } else setOpenId((id) => (id === event.id ? null : id));
              }}
            >
              <summary>
                <span className="damage-character">
                  <Avatar
                    small
                    character={c}
                    index={displayProject.characters.indexOf(c)}
                  />
                  <span>
                    <strong>
                      {charName(c, displayProject.characters.indexOf(c))}
                    </strong>
                    <small>{skill.name || "未命名技能"}</small>
                  </span>
                </span>
                <span className="damage-time">{event.time.toFixed(2)}s</span>
                <span className="damage-attribute">
                  {damageLabel(skill.damage)}
                  {result.breakdown?.amplification && (
                    <small className="soft-badge">
                      {result.breakdown.amplification}
                    </small>
                  )}
                </span>
                <span className="damage-value">
                  {result.error ? "—" : fmt(result[damageMode]!)}
                  <small>
                    {result.error
                      ? "计算错误"
                      : `${DAMAGE_MODES[damageMode]}伤害`}
                  </small>
                </span>
                <ChevronDown size={16} />
              </summary>
              {openId === event.id &&
                (run?.details[event.id] ? (
                  <Snapshot
                    project={displayProject}
                    event={event}
                    result={result}
                    detail={run.details[event.id]}
                  />
                ) : (
                  <div className="detail-pending">
                    {stale
                      ? "参数已修改，请重新计算后查看详情。"
                      : (run?.detailErrors[event.id] ?? "正在读取事件详情…")}
                  </div>
                ))}
            </details>
          );
        })}
        {!rows.length && (
          <Empty
            icon={<Swords size={28} />}
            title={calculation ? "尚未安排伤害事件" : "等待开始计算"}
            detail={
              calculation
                ? "将造成伤害的技能添加到时间轴后，再点击开始计算。"
                : "点击上方开始计算，生成伤害事件列表。"
            }
          />
        )}
      </div>
      {rows.length > 40 && (
        <div className="result-pagination">
          <button
            className="btn"
            disabled={currentPage === 0}
            onClick={() => {
              setPage(currentPage - 1);
              setOpenId(null);
            }}
          >
            上一页
          </button>
          <span>
            第 {currentPage + 1} / {Math.ceil(rows.length / 40)} 页 · 每页40条
          </span>
          <button
            className="btn"
            disabled={(currentPage + 1) * 40 >= rows.length}
            onClick={() => {
              setPage(currentPage + 1);
              setOpenId(null);
            }}
          >
            下一页
          </button>
        </div>
      )}
      <div className="info-strip">
        <Clock3 size={16} />
        <span>
          支持常规与五种星月直伤，以及时间轴指定的蒸发/融化。不模拟元素附着、激化、剧变及多人反应伤害。每条时间轴技能事件代表一次命中。
          {(calculation?.time ?? endTime(p)) === 0 &&
            "时间轴总时长为0时可统计总伤害，但DPS不可计算。"}
        </span>
      </div>
      {run?.axis && (
        <CombatAxis
          project={displayProject}
          data={run.axis}
          rows={rows}
          mode={damageMode}
          onDamage={jumpDamage}
        />
      )}
    </>
  );
}
