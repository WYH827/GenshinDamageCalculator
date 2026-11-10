import { endTime, type Project } from "./model";
import { effectCatalog, upgradeRealtimeProject } from "./effect-catalog";
import { realtimeTimeline, type EffectTransition } from "./realtime-state";
export type EffectInterval = {
  start: number;
  end: number;
  count: number;
  transitionId: string;
};
export type AxisEffectTrack = {
  key: string;
  stacking: boolean;
  segments: EffectInterval[];
};
export type CombatAxisData = {
  end: number;
  tracks: AxisEffectTrack[];
  events: EffectTransition[];
  globalKeys: string[];
  truncated: boolean;
  error?: string;
};
export function buildCombatAxis(project: Project): CombatAxisData {
  const end = endTime(project);
  try {
    const p = upgradeRealtimeProject(project),
      catalog = effectCatalog(p);
    const state = realtimeTimeline(p, { trace: true });
    const grouped = new Map<string, EffectTransition[]>();
    for (const event of state.transitions) {
      const group = grouped.get(event.key) ?? [];
      group.push(event);
      grouped.set(event.key, group);
    }
    const tracks = catalog
      .filter((e) => !e.automatic)
      .map((entry) => {
        const events = grouped.get(entry.key) ?? [];
        const segments: EffectInterval[] = [];
        for (let i = 0; i < events.length; i++) {
          const event = events[i],
            stop = Math.min(events[i + 1]?.time ?? end, end);
          if (event.count > 0 && event.time < stop && event.time < end)
            segments.push({
              start: event.time,
              end: stop,
              count: event.count,
              transitionId: event.id,
            });
        }
        return {
          key: entry.key,
          stacking: entry.effect.realtime?.kind !== "fixed",
          segments,
        };
      })
      .filter((t) => t.segments.length);
    return {
      end,
      tracks,
      events: state.transitions.filter((t) => t.time <= end),
      globalKeys: catalog.filter((e) => e.automatic).map((e) => e.key),
      truncated: state.truncated,
    };
  } catch (e) {
    return {
      end,
      tracks: [],
      events: [],
      globalKeys: [],
      truncated: false,
      error: (e as Error).message,
    };
  }
}
export const axisEventLabel = (event: EffectTransition) =>
  event.count === 0 && (event.previous > 0 || event.kind === "expiry")
    ? `效果${event.automatic ? "·自动" : ""}·结束`
    : event.kind === "initial"
      ? "初始层数"
      : event.kind === "expiry"
        ? "层数到期"
        : event.kind === "periodic"
          ? "定时层数变化"
          : "触发效果";
