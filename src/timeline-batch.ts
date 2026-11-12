import { uid, type TimelineEvent } from "./model";
import { scheduledCount } from "./schedule";
export function copyTimelineEvent(e: TimelineEvent): TimelineEvent {
  const id = uid();
  return {
    ...structuredClone(e),
    id,
    ...(e.disabledOccurrences
      ? {
          disabledOccurrences: e.disabledOccurrences.map((key) =>
            key.startsWith(`${e.id}~`) ? `${id}${key.slice(e.id.length)}` : key,
          ),
        }
      : {}),
  };
}
export function batchSkills(
  skillId: string,
  time: number,
  interval: number,
  duration: number | null,
): TimelineEvent[] {
  if (
    !skillId ||
    !Number.isFinite(time) ||
    time < 0 ||
    !Number.isFinite(interval) ||
    interval <= 0
  )
    throw new Error("请填写有效技能、起始时间和触发间隔");
  if (duration === null)
    return [
      {
        id: uid(),
        kind: "skill",
        time,
        skillId,
        repeat: { interval, duration: null },
      },
    ];
  const count = scheduledCount(duration, interval);
  if (!Number.isFinite(duration) || duration < 0 || count > 10000)
    throw new Error("批量事件最多10000次，请缩短范围或增大间隔");
  return Array.from({ length: count }, (_, i) => ({
    id: uid(),
    kind: "skill",
    skillId,
    time: Number((time + (i + 1) * interval).toPrecision(15)),
  }));
}
export function transformEvents(
  events: TimelineEvent[],
  ids: Set<string>,
  action: "move" | "copy" | "delete",
  mode: "before" | "after" | "at" = "after",
  seconds = 0,
): TimelineEvent[] {
  const selected = events.filter((e) => ids.has(e.id));
  if (!selected.length) return events;
  if (action === "delete") return events.filter((e) => !ids.has(e.id));
  const first = Math.min(...selected.map((e) => e.time));
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error("秒数必须是非负数");
  const offset =
    mode === "at" ? seconds - first : mode === "before" ? -seconds : seconds;
  if (first + offset < 0)
    throw new Error("移动或复制后不能早于0.00s，请调整秒数");
  const change = (e: TimelineEvent) => ({
    ...(action === "copy" ? copyTimelineEvent(e) : structuredClone(e)),
    time: Number((e.time + offset).toPrecision(15)),
  });
  return action === "copy"
    ? [...events, ...selected.map(change)]
    : events.map((e) => (ids.has(e.id) ? change(e) : e));
}
