import { stackLimit, type Effect, type Project } from "./model";

export type StackSource = { key: string; effect: Effect; source: string };
export function stackEffectSources(p: Project): StackSource[] {
  const sources: StackSource[] = p.globals.map((effect) => ({
    key: `global-${effect.id}`,
    effect,
    source: "全局效果",
  }));
  for (const [kind, owners, label] of [
    ["weapon", p.weapons, "武器"],
    ["artifact", p.artifacts, "圣遗物"],
    ["talent", p.talents, "天赋"],
    ["skill", p.skills.filter((s) => s.kind !== "damage"), "技能"],
  ] as const) {
    for (const owner of owners)
      for (const effect of owner.effects)
        sources.push({
          key: `${kind}-${owner.id}-${effect.id}`,
          effect: { ...effect, sourceId: owner.characterId },
          source: `${label}「${owner.name || "未命名"}」`,
        });
  }
  for (const event of p.timeline) {
    if (event.kind !== "effect") continue;
    const key = standaloneStackKey(event.effect);
    if (!sources.some((s) => s.key === key))
      sources.push({ key, effect: event.effect, source: "独立效果事件" });
  }
  return sources.filter((s) => s.effect.stacks?.enabled);
}
export const standaloneStackKey = (e: Effect) =>
  `timeline-${e.sourceId}-${e.id}`;
export type StackBatch = { count: number; end: number | null };
export type StackState = {
  effect: Effect;
  start: number;
  batches: StackBatch[];
  count: number;
};

function validCount(count: number) {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error("效果层数必须为非负安全整数");
  return count;
}
function ticksAt(start: number, now: number, interval: number) {
  if (!(interval > 0) || !Number.isFinite(interval))
    throw new Error("层数变化间隔必须大于0");
  const elapsed = Math.max(0, now - start) / interval;
  // Include exact decimal boundaries such as (0.3 - 0.1) / 0.1.
  return Math.floor(elapsed + 8 * Number.EPSILON * Math.max(1, elapsed));
}
export function stackSnapshot(state: StackState, now: number) {
  const s = state.effect.stacks!;
  if (s.mode === "independent") {
    const batches = state.batches.filter(
      (b) =>
        b.end === null ||
        b.end - now >
          8 * Number.EPSILON * Math.max(1, Math.abs(now), Math.abs(b.end)),
    );
    const count = validCount(batches.reduce((sum, b) => sum + b.count, 0));
    return { count, batches, nextChange: undefined as number | undefined };
  }
  const end = s.duration === null ? null : state.start + s.duration;
  if (end !== null && now >= end)
    return { count: 0, batches: [], nextChange: undefined };
  if (s.mode === "direct")
    return {
      count: state.count,
      batches: state.count ? [{ count: state.count, end }] : [],
      nextChange: undefined,
    };
  const cap = stackLimit(s);
  const ticks = ticksAt(state.start, now, s.interval);
  const raw = s.delta === 0 ? state.count : state.count + ticks * s.delta;
  const count = validCount(Math.min(cap, Math.max(0, raw)));
  const stopped =
    (count === 0 && s.delta <= 0) ||
    (s.delta >= 0 && count === cap) ||
    s.delta === 0;
  return {
    count,
    batches: [] as StackBatch[],
    nextChange:
      stopped || (end !== null && state.start + (ticks + 1) * s.interval >= end)
        ? undefined
        : state.start + (ticks + 1) * s.interval,
  };
}
export function triggerStacks(
  previous: StackState | undefined,
  effect: Effect,
  time: number,
  amount: number,
): StackState {
  const s = effect.stacks!,
    cap = stackLimit(s);
  validCount(amount);
  if (!(cap >= 1)) throw new Error("效果层数上限必须大于0");
  const count = Math.min(cap, amount);
  if (s.mode !== "independent")
    return { effect, start: time, count, batches: [] };
  const batches = previous
    ? (() => {
        const snapshot = stackSnapshot(previous, time);
        return snapshot.batches.length
          ? snapshot.batches.map((b) => ({ ...b }))
          : snapshot.count
            ? [
                {
                  count: snapshot.count,
                  end:
                    previous.effect.stacks!.duration === null
                      ? null
                      : previous.start + previous.effect.stacks!.duration!,
                },
              ]
            : [];
      })()
    : [];
  // A new stack fills a vacancy, or refreshes the earliest-expiring stack.
  batches.sort((a, b) => (a.end ?? Infinity) - (b.end ?? Infinity));
  let remove = Math.max(
    0,
    batches.reduce((sum, b) => sum + b.count, 0) + count - cap,
  );
  for (const batch of batches) {
    const n = Math.min(remove, batch.count);
    batch.count -= n;
    remove -= n;
  }
  const end = s.duration === null ? null : time + s.duration;
  if (count > 0) {
    const same = batches.find((b) => b.end === end);
    if (same) same.count += count;
    else batches.push({ count, end });
  }
  return {
    effect,
    start: time,
    count: 0,
    batches: batches.filter((b) => b.count > 0),
  };
}
