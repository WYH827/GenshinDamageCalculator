import { Field, Num } from "./components";
import { fmt, type Effect, type EffectTiming } from "./model";
import { eventTiming, realtimeConfig } from "./effect-catalog";
import type { EffectStatus } from "./realtime-state";
import ScheduleEditor from "./ScheduleEditor";
import { scheduledCountLabel, boundedActiveFor } from "./schedule";

export function timingSummary(t: EffectTiming, stacking = true) {
  return `${stacking ? `${t.mode === "independent" ? "增减" : "设为"} ${t.count}层 · ` : "固定效果 · "}${t.duration === null ? "永久" : `${fmt(t.duration)}s`}${t.mode === "periodic" ? ` · 每${fmt(t.interval)}s变化${t.delta}层` : ""}`;
}
export default function EffectTimingEditor({
  effect,
  value,
  usePreset,
  onChange,
  onPresetChange,
  status,
}: {
  effect: Effect;
  value: EffectTiming;
  usePreset: boolean;
  onChange: (v: EffectTiming) => void;
  onPresetChange: (v: boolean) => void;
  status?: EffectStatus;
}) {
  const c = realtimeConfig(effect),
    t = eventTiming(effect, value, usePreset);
  const stacking = c.kind !== "fixed",
    independent = c.kind === "independent";
  const periodic = c.kind.endsWith("Periodic");
  const patch = (v: Partial<EffectTiming>) => {
    const next = { ...t, ...v };
    onChange({
      ...next,
      activeFor: boundedActiveFor(c.kind, next.duration, next.activeFor),
    });
  };
  const current = status?.count ?? 0;
  const stateLabel = current
    ? `当前层数${current}${c.kind === "shared" ? `，剩余持续时间${status?.remaining === null ? "永久" : `${fmt(status?.remaining ?? 0)}s`}` : ""}`
    : "当前无该效果";
  return (
    <div className="trigger-timing">
      {stacking && (
        <Field
          label={
            independent ? "将该效果层数增加/减少" : "重置该效果层数并将层数设为"
          }
          hint={stateLabel}
        >
          <Num
            label={independent ? "本次增减层数" : "本次设为层数"}
            value={t.count}
            min={independent ? undefined : 0}
            unit="层"
            onChange={(n) =>
              patch({
                count: Math.max(
                  independent ? -Number.MAX_SAFE_INTEGER : 0,
                  Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(n)),
                ),
              })
            }
          />
        </Field>
      )}
      {periodic && <small>之后层数按定时增减方式变化</small>}
      <div className="timing-duration-row">
        <Field
          label={
            c.kind.startsWith("independent")
              ? "本次每层持续时间"
              : c.kind.startsWith("shared")
                ? "本次共用持续时间"
                : "本次持续时间"
          }
        >
          <Num
            value={t.duration ?? 0}
            disabled={usePreset || t.duration === null}
            min={0}
            unit="s"
            onChange={(duration) => patch({ duration })}
          />
        </Field>
        <label className="infinite-toggle">
          <input
            type="checkbox"
            checked={usePreset}
            onChange={(e) => onPresetChange(e.target.checked)}
          />
          使用预设
        </label>
        <label className="infinite-toggle">
          <input
            type="checkbox"
            checked={t.duration === null}
            disabled={usePreset}
            onChange={(e) => patch({ duration: e.target.checked ? null : 10 })}
          />
          永久
        </label>
      </div>
      {periodic && (
        <details className="periodic-settings">
          <summary>
            设置本次变化方式 · 每{fmt(t.interval)}s{" "}
            {t.delta < 0 ? "减少" : "增加"}
            {Math.abs(t.delta)}层{usePreset ? "（使用预设）" : ""}
            {" · 预计触发 "}
            {scheduledCountLabel(t.activeFor ?? null, t.interval)} 次
          </summary>
          <fieldset disabled={usePreset} className="form-grid two">
            <Field label="本次变化间隔">
              <Num
                value={t.interval}
                min={0.000001}
                unit="s"
                onChange={(interval) => patch({ interval })}
              />
            </Field>
            <Field label="本次每次变化层数" hint="正数增加，负数减少">
              <Num
                value={t.delta}
                unit="层"
                onChange={(n) =>
                  patch({
                    delta: Math.max(
                      -Number.MAX_SAFE_INTEGER,
                      Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(n)),
                    ),
                  })
                }
              />
            </Field>
          </fieldset>
          <ScheduleEditor
            maxDuration={c.kind === "sharedPeriodic" ? t.duration : undefined}
            duration={t.activeFor ?? null}
            interval={t.interval}
            disabled={usePreset}
            onChange={(activeFor) => patch({ activeFor })}
          />
          <small>
            次数按定时范围估算；效果共用时间到期、扣到0层或再次触发重置时可提前结束。
          </small>
        </details>
      )}
      {independent && (
        <small>正数增加，负数减少；优先扣除或刷新最早到期层。</small>
      )}
    </div>
  );
}
