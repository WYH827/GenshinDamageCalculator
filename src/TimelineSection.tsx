import EffectSourceVisual from "./EffectSourceVisual";
import CharacterVisual from "./CharacterVisual";
import TimelineEventGroup from "./TimelineEventGroup";
import { Fragment, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import {
  CharacterSelect,
  Field,
  Modal,
  Num,
  effectSummary,
} from "./components";
import { SectionTitle, type Update } from "./sections";
import {
  effectCatalog,
  defaultTiming,
  isStackingEffect,
  skillBoundEffects,
  eventTiming,
  EFFECT_SOURCE_LABELS,
  type EffectSourceKind,
} from "./effect-catalog";
import TimelineBatchControls from "./TimelineBatchControls";
import ScheduleEditor from "./ScheduleEditor";
import { realtimeTimeline, effectEventBadge } from "./realtime-state";
import EffectTimingEditor, { timingSummary } from "./EffectTimingEditor";
import {
  sortedTimeline,
  endTime,
  charName,
  uid,
  STAR_SUPERCONDUCT_TABLE,
  starSuperconduct,
  canAmplify,
  amplificationFor,
  amplificationBase,
  type AmplificationReaction,
  type EffectTiming,
  type Project,
  type TimelineEvent,
} from "./model";

type TriggerDraft = {
  id?: string;
  time: number;
  kind: EffectSourceKind;
  effectKey: string;
  timing: EffectTiming;
  usePreset: boolean;
};
export default function TimelineSection({
  project: p,
  update,
  openLibrary,
}: {
  project: Project;
  update: Update;
  openLibrary: () => void;
}) {
  const catalog = effectCatalog(p),
    automatic = catalog.filter((r) => r.automatic),
    realtime = catalog.filter((r) => !r.automatic);
  const [draft, setDraft] = useState<TriggerDraft | null>(null);
  const [skillDraft, setSkillDraft] = useState<{
    skillId: string;
    time: number;
  } | null>(null);
  const [switchDraft, setSwitchDraft] = useState<{
    characterId: string;
    time: number;
  } | null>(null);
  const [globalsExpanded, setGlobalsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [addingBatch, setAddingBatch] = useState(false);
  const patchEvent = (id: string, fn: (e: TimelineEvent) => TimelineEvent) =>
    update((p) => ({
      ...p,
      timeline: p.timeline.map((e) => (e.id === id ? fn(e) : e)),
    }));
  const append = (event: TimelineEvent) =>
    update((p) => ({ ...p, timeline: [...p.timeline, event] }));
  const newDraft = () => {
    const r = realtime[0];
    setDraft({
      usePreset: true,
      time: endTime(p),
      kind: r?.kind ?? "weapon",
      effectKey: r?.key ?? "",
      timing: r
        ? defaultTiming(r.effect)
        : {
            mode: "direct",
            count: 1,
            duration: 10,
            limit: "none",
            max: 5,
            interval: 1,
            delta: 1,
          },
    });
  };
  const state = useMemo(() => {
    try {
      return { ...realtimeTimeline(p, { collect: true }), error: "" };
    } catch (error) {
      return {
        statuses: new Map(),
        changes: [],
        truncated: false,
        error: (error as Error).message,
      };
    }
  }, [p]);
  const draftStatus = useMemo(() => {
    if (!draft) return undefined;
    const event: TimelineEvent = {
      id: draft.id ?? "draft-trigger",
      kind: "effectTrigger",
      time: draft.time,
      effectKey: draft.effectKey,
      timing: draft.timing,
    };
    const timeline = draft.id
      ? p.timeline.map((e) => (e.id === draft.id ? event : e))
      : [...p.timeline, event];
    try {
      return realtimeTimeline(
        { ...p, timeline },
        { eventId: event.id, before: true },
      ).statuses.get(event.id)?.[draft.effectKey];
    } catch {
      return undefined;
    }
  }, [p, draft]);
  const boundEditor = (
    entry: ReturnType<typeof effectCatalog>[number],
    e: TimelineEvent,
  ) => {
    const own =
      e.kind === "skill" &&
      entry.kind === "skill" &&
      entry.ownerId === e.skillId;
    const saved =
      e.kind === "effectTrigger"
        ? e.timing
        : (e.effectTimings?.[entry.key] ??
          (own ? e.effectTimings?.[entry.effect.id] : undefined));
    const preset =
      e.kind === "effectTrigger"
        ? e.usePreset !== false
        : (e.effectUsePresets?.[entry.key] ??
            (own ? e.effectUsePresets?.[entry.effect.id] : undefined)) !==
          false;
    return (
      <EffectTimingEditor
        effect={entry.effect}
        value={saved ?? defaultTiming(entry.effect)}
        usePreset={preset}
        status={state.statuses.get(e.id)?.[entry.key]}
        onChange={(timing) =>
          patchEvent(e.id, (event) =>
            event.kind === "effectTrigger"
              ? { ...event, timing }
              : {
                  ...event,
                  effectTimings: {
                    ...event.effectTimings,
                    [entry.key]: timing,
                  },
                },
          )
        }
        onPresetChange={(usePreset) =>
          patchEvent(e.id, (event) =>
            event.kind === "effectTrigger"
              ? {
                  ...event,
                  usePreset,
                  timing: eventTiming(
                    entry.effect,
                    event.timing,
                    usePreset || preset,
                  ),
                }
              : {
                  ...event,
                  effectUsePresets: {
                    ...event.effectUsePresets,
                    [entry.key]: usePreset,
                  },
                  effectTimings: {
                    ...event.effectTimings,
                    [entry.key]: eventTiming(
                      entry.effect,
                      saved,
                      usePreset || preset,
                    ),
                  },
                },
          )
        }
      />
    );
  };
  const ordered = useMemo(() => {
    try {
      return sortedTimeline(p.timeline);
    } catch {
      return [...p.timeline].sort((a, b) => a.time - b.time);
    }
  }, [p.timeline]);
  const renderAutomatic = (
    change: ReturnType<typeof realtimeTimeline>["changes"][number],
  ) => (
    <div
      className={`timeline-row ${change.reason ? "expiry-event" : "periodic-event"} event-effect readonly-event`}
      key={change.id}
    >
      <div className="timeline-time">
        {change.time.toFixed(2)} <small>s</small>
      </div>
      <div className="event-name">
        <EffectSourceVisual
          project={p}
          entry={catalog.find((r) => r.key === change.key)}
        />
        <div>
          <strong>
            <span className="event-kind-badge">
              {effectEventBadge(
                change.count === 0 && (change.delta < 0 || !!change.reason),
                change.automatic ?? change.reason !== "cleared",
              )}
            </span>
            {change.name}
          </strong>
          <span>{change.source}</span>
        </div>
      </div>
      <div className="event-detail">
        <span>
          {change.reason || (change.count === 0 && change.delta < 0)
            ? change.count === 0
              ? "效果结束 · "
              : "层数到期 · "
            : ""}
          {change.delta >= 0 ? "增加" : "减少"}
          {Math.abs(change.delta)}层 · 当前{change.count}层
          {change.actualDelta === 0 && change.delta > 0
            ? "（已满层，刷新持续时间）"
            : ""}
        </span>
        <small>
          来源：{change.reason ? "效果触发" : "定时变化层数"} ·{" "}
          {change.originTime.toFixed(2)}s
        </small>
      </div>
    </div>
  );
  return (
    <>
      <SectionTitle
        eyebrow="COMBAT TIMELINE"
        title="编排战斗时间轴"
        description="效果数值引用原定义；持续时间、层数及更改方式在每次触发中独立设置。"
      >
        <div className="button-group timeline-actions">
          <button className="btn" onClick={newDraft}>
            <Plus size={16} />
            触发效果
          </button>
          <button
            className="btn"
            onClick={() =>
              setSwitchDraft({
                time: endTime(p),
                characterId: p.initialCharacterId,
              })
            }
          >
            切换角色
          </button>
          <button className="btn" onClick={() => setAddingBatch(true)}>
            批量添加技能
          </button>
          <button
            className="btn primary"
            onClick={() =>
              setSkillDraft({
                time: endTime(p),
                skillId: p.skills[0]?.id ?? "",
              })
            }
          >
            添加技能事件
          </button>
        </div>
      </SectionTitle>
      <TimelineBatchControls
        project={p}
        update={update}
        selected={selectedIds}
        onSelection={setSelectedIds}
        selecting={selecting}
        onSelecting={setSelecting}
        adding={addingBatch}
        onAdding={setAddingBatch}
      />
      <div className="timeline-legend">
        <span className="legend-skill">技能事件</span>
        <span className="legend-effect">效果事件</span>
        <span className="legend-switch">切换角色</span>
        <span>斜纹 / 自动：不可直接编辑</span>
      </div>
      <div className="timeline-overview">
        <div>
          <span>计算时长</span>
          <strong>
            {endTime(p).toFixed(2)}
            <small>s</small>
          </strong>
        </div>
        <div>
          <span>已编排事件</span>
          <strong>{p.timeline.length}</strong>
        </div>
        <div>
          <span>起始全局效果</span>
          <strong>{automatic.length}</strong>
        </div>
      </div>
      <div className="panel timeline-panel">
        <div className="timeline-table-header">
          <span>起始时间</span>
          <span>事件 / 技能</span>
          <span>属性与效果</span>
          <span>操作</span>
        </div>
        <div className="timeline-start">
          <strong>0.00s</strong>
          <span>战斗开始</span>
        </div>
        <details className="global-effects-fold" open={globalsExpanded}>
          <summary
            onClick={(event) => {
              event.preventDefault();
              setGlobalsExpanded(!globalsExpanded);
            }}
          >
            0.00s · 全局效果（{automatic.length}）· 仅展示，始终参与计算
          </summary>
          {automatic.map((r) => (
            <div
              className="timeline-row global-event event-effect readonly-event"
              key={r.key}
            >
              <div className="timeline-time">
                0.00 <small>s</small>
              </div>
              <div className="event-name">
                <EffectSourceVisual project={p} entry={r} />
                <div>
                  <strong>{r.effect.name || "未命名全局效果"}</strong>
                  <span>{r.source} · 始终生效</span>
                </div>
              </div>
              <div className="event-detail">
                <span>{effectSummary(r.effect)}</span>
                <small>不参与时间轴 · 实时变量按事件求值</small>
              </div>
              <button
                className="icon-btn"
                aria-label={`查看全局效果 ${r.effect.name}`}
                onClick={openLibrary}
              >
                <Pencil size={15} />
              </button>
            </div>
          ))}
        </details>
        <div className="initial-character">
          <span>0.00s</span>
          <Field label="初始场上角色">
            <CharacterSelect
              value={p.initialCharacterId}
              characters={p.characters}
              onChange={(initialCharacterId) =>
                update((p) => ({ ...p, initialCharacterId }))
              }
            />
          </Field>
          <small>技能事件不会自动切换角色。</small>
        </div>
        {ordered.map((e, eventIndex) => {
          const r =
            e.kind === "effectTrigger"
              ? catalog.find((r) => r.key === e.effectKey)
              : undefined;
          const s =
            e.kind === "skill"
              ? p.skills.find((s) => s.id === e.skillId)
              : undefined;
          const title =
            e.kind === "effectTrigger"
              ? `触发效果：${r ? r.effect.name.trim() || "未命名效果" : "效果已删除"}`
              : e.kind === "switch"
                ? `切换角色：${p.characters.find((c) => c.id === e.characterId)?.name || "未命名角色"}`
                : s?.name || "未命名技能";
          const priorTime = eventIndex ? ordered[eventIndex - 1].time : -1;
          const changes = state.changes.filter(
            (change) => change.time > priorTime && change.time <= e.time,
          );
          const bound =
            e.kind === "skill" && !e.repeat
              ? skillBoundEffects(p, e.skillId)
              : [];
          const generated = e.kind === "skill" && !!e.generatedBy;
          const category =
            e.kind === "switch"
              ? "switch"
              : e.kind === "skill"
                ? "skill"
                : "effect";
          return (
            <Fragment key={e.id}>
              {changes.map(renderAutomatic)}
              <TimelineEventGroup
                className={`timeline-event-group ${generated ? "generated-event-group" : ""}`}
              >
                <div
                  className={`timeline-row event-${category} ${generated ? "readonly-event" : ""} ${selectedIds.has(e.id) ? "event-selected" : ""}`}
                >
                  {selecting && !generated && (
                    <input
                      className="event-selection"
                      type="checkbox"
                      aria-label={`选择事件 ${title} ${e.time}s`}
                      checked={selectedIds.has(e.id)}
                      onChange={(event) =>
                        setSelectedIds((old) => {
                          const next = new Set(old);
                          if (event.target.checked) next.add(e.id);
                          else next.delete(e.id);
                          return next;
                        })
                      }
                    />
                  )}

                  <div className="timeline-time">
                    <Num
                      disableWheel
                      disabled={generated}
                      label={`起始时间 ${title}`}
                      value={e.time}
                      min={0}
                      unit="s"
                      onChange={(time) =>
                        patchEvent(e.id, (e) => ({ ...e, time }))
                      }
                    />
                  </div>
                  <div className="event-name">
                    {e.kind === "effectTrigger" ? (
                      <EffectSourceVisual project={p} entry={r} />
                    ) : (
                      (() => {
                        const id =
                          e.kind === "switch" ? e.characterId : s?.characterId;
                        const i = p.characters.findIndex((c) => c.id === id);
                        return i >= 0 ? (
                          <CharacterVisual
                            small
                            character={p.characters[i]}
                            index={i}
                          />
                        ) : null;
                      })()
                    )}
                    <div>
                      <span className="event-kind-badge">
                        {category === "skill"
                          ? "技能"
                          : category === "switch"
                            ? "切换角色"
                            : effectEventBadge(
                                state.changes.some(
                                  (c) =>
                                    c.reason === "cleared" &&
                                    c.originId === e.id,
                                ),
                                false,
                              )}
                        {generated ? " · 自动" : ""}
                        {e.kind === "skill" && e.repeat ? " · 循环规则" : ""}
                      </span>
                      {e.kind === "switch" ? (
                        <label className="switch-select">
                          <strong>切换前台角色</strong>
                          <CharacterSelect
                            label="切换到角色"
                            value={e.characterId}
                            characters={p.characters}
                            onChange={(characterId) =>
                              patchEvent(e.id, (e) => ({
                                ...e,
                                kind: "switch",
                                characterId,
                              }))
                            }
                          />
                        </label>
                      ) : e.kind === "skill" ? (
                        <select
                          aria-label="时间轴技能"
                          className="event-skill-select"
                          disabled={generated}
                          value={e.skillId}
                          onChange={(ev) => {
                            const selected = p.skills.find(
                              (s) => s.id === ev.target.value,
                            )!;
                            patchEvent(e.id, (x) => ({
                              ...x,
                              kind: "skill",
                              skillId: selected.id,
                              effectUsePresets: Object.fromEntries(
                                selected.effects.map((e) => [e.id, true]),
                              ),
                              effectTimings: Object.fromEntries(
                                selected.effects.map((e) => [
                                  e.id,
                                  defaultTiming(e),
                                ]),
                              ),
                            }));
                          }}
                        >
                          {p.characters.map((c, i) => (
                            <optgroup key={c.id} label={charName(c, i)}>
                              {p.skills
                                .filter((s) => s.characterId === c.id)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name || "未命名技能"}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </select>
                      ) : (
                        <strong>{title}</strong>
                      )}
                      <span>
                        {r?.source ||
                          (s
                            ? p.characters.find((c) => c.id === s.characterId)
                                ?.name
                            : "前台角色切换")}
                      </span>
                    </div>
                  </div>
                  <div className="event-detail">
                    {e.kind === "skill" && e.repeat ? (
                      <div className="repeat-rule-editor">
                        <Field label="循环间隔">
                          <Num
                            value={e.repeat.interval}
                            min={0.000001}
                            unit="秒"
                            onChange={(interval) =>
                              patchEvent(e.id, () => ({
                                ...e,
                                repeat: { ...e.repeat!, interval },
                              }))
                            }
                          />
                        </Field>
                        <ScheduleEditor
                          duration={e.repeat.duration}
                          interval={e.repeat.interval}
                          onChange={(duration) =>
                            patchEvent(e.id, () => ({
                              ...e,
                              repeat: { ...e.repeat!, duration },
                            }))
                          }
                        />
                        <small>
                          规则本身不释放技能，自动事件仅展开到当前时间轴结束。
                        </small>
                      </div>
                    ) : e.kind === "effectTrigger" ? (
                      <>
                        <span>
                          {r ? effectSummary(r.effect) : "请重新选择效果来源"}
                        </span>
                        <small>
                          {timingSummary(
                            r
                              ? eventTiming(
                                  r.effect,
                                  e.timing,
                                  e.usePreset !== false,
                                )
                              : e.timing,
                            r ? isStackingEffect(r.effect) : false,
                          )}
                          {e.usePreset !== true && "（已更改）"}
                        </small>
                        {r && boundEditor(r, e)}
                      </>
                    ) : s?.kind === "damage" ? (
                      <>
                        <span>
                          {s.damage.element} · {s.damage.attack} ·{" "}
                          {s.multiplier}%
                        </span>
                        <small>
                          {s.damage.scaling}乘区 {s.damage.special}
                        </small>
                      </>
                    ) : s?.kind === "effect" ? (
                      <span>触发 {bound.length} 条实时效果</span>
                    ) : s?.kind === "empty" ? (
                      <span>不造成伤害 · 计入统计时长，可触发绑定效果</span>
                    ) : (
                      <span>从此事件起成为前台角色</span>
                    )}
                    {e.kind === "skill" &&
                      !e.repeat &&
                      !generated &&
                      s &&
                      canAmplify(s) && (
                        <div className="amplification-editor">
                          <label className="infinite-toggle">
                            <input
                              type="checkbox"
                              checked={!!amplificationFor(s, e.amplification)}
                              onChange={(ev) =>
                                patchEvent(e.id, () => {
                                  const next = { ...e };
                                  delete next.amplification;
                                  if (ev.target.checked)
                                    next.amplification =
                                      s.damage.element === "冰"
                                        ? "融化"
                                        : "蒸发";
                                  return next;
                                })
                              }
                            />
                            是增幅反应伤害
                          </label>
                          {amplificationFor(s, e.amplification) && (
                            <>
                              <Field label="本次增幅反应">
                                <select
                                  value={amplificationFor(s, e.amplification)}
                                  disabled={s.damage.element !== "火"}
                                  onChange={(ev) =>
                                    patchEvent(e.id, () => ({
                                      ...e,
                                      amplification: ev.target
                                        .value as AmplificationReaction,
                                    }))
                                  }
                                >
                                  <option value="蒸发">蒸发</option>
                                  <option value="融化">融化</option>
                                </select>
                              </Field>
                              <small>
                                基础系数 ×
                                {amplificationBase(
                                  s.damage.element,
                                  amplificationFor(s, e.amplification)!,
                                )}{" "}
                                · 仅本事件 · 精通按命中时取值
                              </small>
                            </>
                          )}
                        </div>
                      )}
                    {e.kind === "skill" &&
                      !e.repeat &&
                      !generated &&
                      s?.kind === "damage" &&
                      (s.damage.special === "星超导" ||
                        (!s.damage.special &&
                          ["冰", "雷"].includes(s.damage.element))) && (
                        <div className="star-stacks">
                          <Field
                            label="星超导层数"
                            hint="上周期元素力+1 · 仅本事件"
                          >
                            <select
                              aria-label="本次星超导层数"
                              value={
                                e.legacyStarCoefficient !== undefined
                                  ? "legacy"
                                  : (e.starStacks ??
                                    (s.damage.special === "星超导"
                                      ? 1
                                      : "none"))
                              }
                              onChange={(ev) =>
                                patchEvent(e.id, () => ({
                                  ...e,
                                  legacyStarCoefficient: undefined,
                                  starStacks:
                                    ev.target.value === "none"
                                      ? undefined
                                      : Number(ev.target.value),
                                }))
                              }
                            >
                              {e.legacyStarCoefficient !== undefined && (
                                <option value="legacy" disabled>
                                  旧系数需重选
                                </option>
                              )}
                              {s.damage.special !== "星超导" && (
                                <option value="none">不应用增益</option>
                              )}
                              {STAR_SUPERCONDUCT_TABLE.map((t) => (
                                <option key={t.stacks} value={t.stacks}>
                                  {t.stacks}层（上周期元素力{t.energy}） ·
                                  冰雷增伤
                                  {t.bonus}% · 系数
                                  {t.coefficient}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {(e.starStacks !== undefined ||
                            s.damage.special === "星超导") && (
                            <small>
                              冰雷增伤{" "}
                              {starSuperconduct(e.starStacks ?? 1).bonus}% ·
                              星超导系数{" "}
                              {starSuperconduct(e.starStacks ?? 1).coefficient}
                            </small>
                          )}
                        </div>
                      )}
                  </div>
                  {!generated && (
                    <div className="button-group">
                      {e.kind === "effectTrigger" && (
                        <button
                          className="icon-btn"
                          aria-label={`编辑事件 ${title}`}
                          onClick={() =>
                            setDraft({
                              id: e.id,
                              time: e.time,
                              kind: r?.kind ?? "weapon",
                              effectKey: e.effectKey,
                              timing: e.timing,
                              usePreset: e.usePreset === true,
                            })
                          }
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <button
                        className="icon-btn"
                        aria-label={`复制事件 ${title}`}
                        onClick={() =>
                          append({ ...structuredClone(e), id: uid() })
                        }
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={`删除事件 ${title}`}
                        onClick={() =>
                          update((p) => ({
                            ...p,
                            timeline: p.timeline.filter((x) => x.id !== e.id),
                          }))
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {!!bound.length && (
                  <div className="bound-effects-children">
                    {bound.map((entry) => (
                      <div
                        className={`timeline-row bound-effect-row event-effect ${generated ? "readonly-event" : ""}`}
                        key={`${e.id}-${entry.key}`}
                      >
                        <div className="timeline-time">
                          ↳ {e.time.toFixed(2)}s
                        </div>
                        <div className="event-name">
                          <EffectSourceVisual project={p} entry={entry} />
                          <div>
                            <strong>
                              {state.changes.some(
                                (c) =>
                                  c.reason === "cleared" &&
                                  c.originId === e.id &&
                                  c.key === entry.key,
                              ) && (
                                <span className="event-kind-badge">
                                  {effectEventBadge(true, generated)}
                                </span>
                              )}
                              {entry.effect.name || "未命名效果"}
                            </strong>
                            <span>技能绑定 · {entry.source}</span>
                          </div>
                        </div>
                        <div className="event-detail">
                          <span>{effectSummary(entry.effect)}</span>
                          {generated ? (
                            <small>效果 · 自动绑定触发，跟随循环规则</small>
                          ) : (
                            boundEditor(entry, e)
                          )}
                          {(e.effectUsePresets?.[entry.key] ??
                            e.effectUsePresets?.[entry.effect.id]) ===
                            false && <small>（已更改）</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TimelineEventGroup>
            </Fragment>
          );
        })}
        {!p.timeline.length && (
          <p className="info-strip">添加伤害技能或触发已定义的效果。</p>
        )}
        <div className="timeline-end">
          <strong>{endTime(p).toFixed(2)}s</strong>
          <span>计算结束</span>
        </div>
        {state.changes.some((change) => change.time > endTime(p)) && (
          <div className="expiry-tail">
            <p>后续效果结束时间 · 不计入DPS时长</p>
            {state.changes
              .filter((change) => change.time > endTime(p))
              .map(renderAutomatic)}
          </div>
        )}
      </div>
      {state.error && <p className="validation">{state.error}</p>}
      {state.truncated && (
        <p className="input-note">
          定时变化超过5000条，仅显示前5000条；计算仍处理全部变化。
        </p>
      )}
      <p className="input-note">
        同一时刻按添加顺序生效；自动增减层数不延长时间轴。全局效果独立于时间轴，始终参与每次伤害计算。实时效果勾选使用预设时，时间参数跟随效果定义；层数始终可编辑。取消勾选后独立设置，并标注“已更改”。
      </p>
      {draft && (
        <Modal
          wide
          title="触发效果"
          subtitle="只修改本次时间与层数设置；效果数值与公式请在效果列表或原来源修改。"
          onClose={() => setDraft(null)}
        >
          <div className="form-grid two">
            <Field label="效果来源">
              <select
                value={draft.kind}
                onChange={(e) => {
                  const kind = e.target.value as EffectSourceKind,
                    row = realtime.find((r) => r.kind === kind);
                  setDraft({
                    ...draft,
                    kind,
                    effectKey: row?.key ?? "",
                    timing: row ? defaultTiming(row.effect) : draft.timing,
                    usePreset: true,
                  });
                }}
              >
                {Object.entries(EFFECT_SOURCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="详细效果">
              <select
                value={draft.effectKey}
                onChange={(e) => {
                  const row = realtime.find((r) => r.key === e.target.value)!;
                  setDraft({
                    ...draft,
                    effectKey: row.key,
                    timing: defaultTiming(row.effect),
                    usePreset: true,
                  });
                }}
              >
                {!realtime.some((r) => r.kind === draft.kind) && (
                  <option value="">该来源暂无效果</option>
                )}
                {realtime
                  .filter((r) => r.kind === draft.kind)
                  .map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.source} · {r.effect.name || "未命名效果"}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          {realtime.find((r) => r.key === draft.effectKey) && (
            <div className="info-strip">
              {effectSummary(
                realtime.find((r) => r.key === draft.effectKey)!.effect,
              )}
            </div>
          )}
          <Field label="起始时间">
            <Num
              disableWheel
              value={draft.time}
              min={0}
              unit="s"
              onChange={(time) => setDraft({ ...draft, time })}
            />
          </Field>
          {realtime.find((r) => r.key === draft.effectKey) && (
            <EffectTimingEditor
              effect={realtime.find((r) => r.key === draft.effectKey)!.effect}
              usePreset={draft.usePreset}
              value={draft.timing}
              status={draftStatus}
              onPresetChange={(usePreset) =>
                setDraft({
                  ...draft,
                  usePreset,
                  timing: eventTiming(
                    realtime.find((r) => r.key === draft.effectKey)!.effect,
                    draft.timing,
                    usePreset || draft.usePreset,
                  ),
                })
              }
              onChange={(timing) => setDraft({ ...draft, timing })}
            />
          )}
          <div className="form-actions">
            <button className="btn" onClick={() => setDraft(null)}>
              取消
            </button>
            <button
              className="btn primary"
              disabled={!realtime.some((r) => r.key === draft.effectKey)}
              onClick={() => {
                const event: TimelineEvent = {
                  id: draft.id || uid(),
                  kind: "effectTrigger",
                  time: draft.time,
                  effectKey: draft.effectKey,
                  timing: draft.timing,
                  usePreset: draft.usePreset,
                };
                if (draft.id) patchEvent(draft.id, () => event);
                else append(event);
                setDraft(null);
              }}
            >
              保存触发事件
            </button>
          </div>
        </Modal>
      )}
      {skillDraft && (
        <Modal title="添加技能事件" onClose={() => setSkillDraft(null)}>
          <Field label="技能">
            <select
              value={skillDraft.skillId}
              onChange={(e) =>
                setSkillDraft({ ...skillDraft, skillId: e.target.value })
              }
            >
              {p.skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || "未命名技能"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="起始时间">
            <Num
              disableWheel
              value={skillDraft.time}
              min={0}
              unit="s"
              onChange={(time) => setSkillDraft({ ...skillDraft, time })}
            />
          </Field>
          <div className="form-actions">
            <button
              className="btn primary"
              disabled={!skillDraft.skillId}
              onClick={() => {
                const s = p.skills.find((s) => s.id === skillDraft.skillId)!;
                append({
                  id: uid(),
                  kind: "skill",
                  ...skillDraft,
                  effectUsePresets: Object.fromEntries(
                    s.effects.map((e) => [e.id, true]),
                  ),
                  effectTimings: Object.fromEntries(
                    s.effects.map((e) => [e.id, defaultTiming(e)]),
                  ),
                });
                setSkillDraft(null);
              }}
            >
              添加到时间轴
            </button>
          </div>
        </Modal>
      )}
      {switchDraft && (
        <Modal title="切换前台角色" onClose={() => setSwitchDraft(null)}>
          <Field label="切换到角色">
            <CharacterSelect
              value={switchDraft.characterId}
              characters={p.characters}
              onChange={(characterId) =>
                setSwitchDraft({ ...switchDraft, characterId })
              }
            />
          </Field>
          <Field label="起始时间">
            <Num
              disableWheel
              value={switchDraft.time}
              min={0}
              unit="s"
              onChange={(time) => setSwitchDraft({ ...switchDraft, time })}
            />
          </Field>
          <div className="form-actions">
            <button
              className="btn primary"
              onClick={() => {
                append({ id: uid(), kind: "switch", ...switchDraft });
                setSwitchDraft(null);
              }}
            >
              添加切换事件
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
