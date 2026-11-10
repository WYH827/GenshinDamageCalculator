import { Field, Num } from "./components";
import { scheduledCountLabel } from "./schedule";
export default function ScheduleEditor({
  duration,
  interval,
  onChange,
  disabled = false,
  preset = false,
  maxDuration,
}: {
  duration: number | null;
  interval: number;
  onChange: (duration: number | null) => void;
  disabled?: boolean;
  preset?: boolean;
  maxDuration?: number | null;
}) {
  return (
    <div className="schedule-range">
      <Field label={preset ? "预设在接下来的" : "在接下来的"}>
        <Num
          label={preset ? "预设在接下来的" : "在接下来的"}
          value={duration ?? 0}
          min={0}
          max={maxDuration ?? undefined}
          unit="秒"
          disabled={disabled || duration === null}
          onChange={(n) =>
            onChange(maxDuration != null ? Math.min(n, maxDuration) : n)
          }
        />
      </Field>
      <label className="infinite-toggle">
        <input
          type="checkbox"
          aria-label={preset ? "预设定时范围永久" : "定时范围永久"}
          disabled={disabled || maxDuration != null}
          checked={duration === null}
          onChange={(e) => onChange(e.target.checked ? null : 10)}
        />
        永久
      </label>
      <output className="schedule-estimate">
        预计触发 <strong>{scheduledCountLabel(duration, interval)}</strong> 次
      </output>
      {maxDuration != null && (
        <small>定时范围不能超过共用持续时间 {maxDuration}s。</small>
      )}
    </div>
  );
}
