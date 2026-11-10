import {
  sortedTimeline,
  endTime,
  type EffectTiming,
  type Project,
  type TimelineEvent,
} from "./model";
import {
  effectCatalog,
  eventTiming,
  skillBoundEffects,
  type CatalogEffect,
} from "./effect-catalog";
import type { ActiveEffect } from "./effect-state";
import type { StackBatch } from "./stack-state";

type State = {
  entry: CatalogEffect;
  batches: StackBatch[];
  start: number;
  sharedEnd: number | null;
  timing: EffectTiming;
  next?: number;
  tick: number;
  originTime: number;
  originId: string;
};
export type PeriodicChange = {
  automatic?: boolean;
  reason?: "expiry" | "cleared";
  id: string;
  time: number;
  key: string;
  name: string;
  source: string;
  originId: string;
  originTime: number;
  delta: number;
  actualDelta: number;
  count: number;
};
export type EffectStatus = { count: number; remaining: number | null };
export type EffectTransition = {
  id: string;
  key: string;
  time: number;
  count: number;
  previous: number;
  kind: "initial" | "trigger" | "periodic" | "expiry";
  originId: string;
  originTime: number;
  automatic: boolean;
  timing: EffectTiming;
};
export function effectEventBadge(ended: boolean, automatic: boolean) {
  return `效果${automatic ? "·自动" : ""}${ended ? "·结束" : ""}`;
}
const epsilon = (a: number, b: number) =>
  8 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
const due = (a: number, b: number) => a - b <= epsilon(a, b);
const total = (s: State) => s.batches.reduce((n, b) => n + b.count, 0);
const shared = (s: State) => s.entry.effect.realtime!.kind.startsWith("shared");
function expire(s: State, time: number) {
  s.batches = s.batches.filter(
    (b) => b.count > 0 && (b.end === null || !due(b.end, time)),
  );
  if (shared(s) && s.sharedEnd !== null && due(s.sharedEnd, time))
    s.next = undefined;
}
function change(s: State, amount: number, time: number) {
  if (!Number.isSafeInteger(amount)) throw new Error("效果层数必须为安全整数");
  const cap = s.entry.effect.realtime!.max ?? Infinity;
  const before = total(s);
  const added = Math.min(cap, Math.max(0, amount));
  // Remove earliest expiry first for both deductions and overflow refreshes.
  let remove =
    amount < 0 ? Math.min(before, -amount) : Math.max(0, before + added - cap);
  s.batches.sort((a, b) => (a.end ?? Infinity) - (b.end ?? Infinity));
  for (const b of s.batches) {
    const n = Math.min(remove, b.count);
    b.count -= n;
    remove -= n;
  }
  if (added) {
    const end = shared(s)
      ? s.sharedEnd
      : s.timing.duration === null
        ? null
        : time + s.timing.duration;
    const batch = s.batches.find((b) => b.end === end);
    if (batch) batch.count += added;
    else s.batches.push({ count: added, end });
  }
  expire(s, time);
  if (!Number.isSafeInteger(total(s)))
    throw new Error("效果层数超出安全整数范围");
}
export function realtimeTimeline(
  p: Project,
  options: {
    eventId?: string;
    before?: boolean;
    collect?: boolean;
    trace?: boolean;
  } = {},
) {
  const ordered = sortedTimeline(p.timeline);
  const index =
    options.eventId === undefined
      ? ordered.length
      : ordered.findIndex((e) => e.id === options.eventId);
  const now =
    index < 0 ? 0 : index === ordered.length ? endTime(p) : ordered[index].time;
  const entries = effectCatalog(p).filter(
    (e) => !e.automatic && !!e.effect.realtime,
  );
  if (!entries.length)
    return {
      active: [] as ActiveEffect[],
      statuses: new Map<string, Record<string, EffectStatus>>(),
      changes: [] as PeriodicChange[],
      truncated: false,
      transitions: [] as EffectTransition[],
    };
  const definitions = new Map(entries.map((e) => [e.key, e]));
  const states = new Map<string, State>();
  const changes: PeriodicChange[] = [];
  const statuses = new Map<string, Record<string, EffectStatus>>();
  const transitions: EffectTransition[] = [];
  const record = (
    s: State,
    time: number,
    previous: number,
    kind: EffectTransition["kind"],
    automatic: boolean,
  ) => {
    if (!options.trace) return;
    if (transitions.length >= 20000) {
      truncated = true;
      return;
    }
    transitions.push({
      id: `transition-${transitions.length}`,
      key: s.entry.key,
      time,
      previous,
      count: total(s),
      kind,
      originId: s.originId,
      originTime: s.originTime,
      automatic,
      timing: { ...s.timing },
    });
  };
  let operations = 0,
    batchWork = 0,
    truncated = false;
  const expireWithEvents = (s: State, time: number) => {
    if (options.collect || options.trace) {
      const ends = [
        ...new Set(
          s.batches
            .filter((b) => b.count > 0 && b.end !== null && due(b.end, time))
            .map((b) => b.end!),
        ),
      ].sort((a, b) => a - b);
      for (const at of ends) {
        const lost = s.batches
          .filter((b) => b.count > 0 && b.end !== null && due(b.end, at))
          .reduce((sum, b) => sum + b.count, 0);
        const previous = total(s);
        expire(s, at);
        record(s, at, previous, "expiry", true);
        if (changes.length < 5000)
          changes.push({
            id: `${s.originId}-${s.entry.key}-end-${at}`,
            reason: "expiry",
            time: at,
            key: s.entry.key,
            name: s.entry.effect.name,
            source: s.entry.source,
            originId: s.originId,
            originTime: s.originTime,
            delta: -lost,
            actualDelta: -lost,
            count: total(s),
          });
        else truncated = true;
      }
    }
    expire(s, time);
  };
  const snapshot = (time: number) =>
    Object.fromEntries(
      [...states].map(([key, s]) => {
        expire(s, time);
        return [
          key,
          {
            count: total(s),
            remaining: !total(s)
              ? 0
              : s.sharedEnd === null
                ? null
                : Math.max(0, s.sharedEnd - time),
          },
        ];
      }),
    );
  const advance = (time: number) => {
    for (const s of states.values()) {
      while (s.next !== undefined && due(s.next, time)) {
        const at = s.next;
        if (
          s.timing.activeFor != null &&
          at - s.originTime - s.timing.activeFor >
            epsilon(at - s.originTime, s.timing.activeFor)
        ) {
          s.next = undefined;
          break;
        }
        expireWithEvents(s, at);
        if (s.next === undefined) break;
        if (++operations > 100000)
          throw new Error(
            "定时层数变化超过100000次，请增大变化间隔或缩短时间轴",
          );
        batchWork += s.batches.length + 1;
        if (batchWork > 1000000)
          throw new Error("独立层数批次过多，请增大变化间隔或缩短时间轴");
        const before = total(s);
        change(s, s.timing.delta, at);
        record(s, at, before, "periodic", true);
        if (options.collect) {
          if (changes.length < 5000)
            changes.push({
              id: `${s.originId}-${s.entry.key}-${s.tick}`,
              time: at,
              key: s.entry.key,
              name: s.entry.effect.name,
              source: s.entry.source,
              originId: s.originId,
              originTime: s.originTime,
              delta: s.timing.delta,
              actualDelta: total(s) - before,
              count: total(s),
            });
          else truncated = true;
        }
        s.tick++;
        s.next = s.originTime + s.tick * s.timing.interval;
        if (
          s.timing.activeFor != null &&
          s.next - s.originTime - s.timing.activeFor >
            epsilon(s.next - s.originTime, s.timing.activeFor)
        )
          s.next = undefined;
        if (s.timing.delta === 0 || (total(s) === 0 && s.timing.delta < 0))
          s.next = undefined;
        if (
          s.next !== undefined &&
          shared(s) &&
          s.sharedEnd !== null &&
          due(s.sharedEnd, s.next)
        )
          s.next = undefined;
      }
      expireWithEvents(s, time);
    }
  };
  const apply = (
    entry: CatalogEffect,
    t: EffectTiming,
    time: number,
    originId: string,
    initial = false,
    automatic = false,
  ) => {
    const c = entry.effect.realtime!;
    let s = states.get(entry.key);
    const before = s ? total(s) : 0;
    if (!s || c.kind !== "independent" || initial) {
      s = {
        entry,
        batches: [],
        start: time,
        timing: t,
        sharedEnd: t.duration === null ? null : time + t.duration,
        tick: 1,
        originTime: time,
        originId,
      };
      states.set(entry.key, s);
    }
    s.timing = t;
    s.start = time;
    s.originTime = time;
    s.originId = originId;
    const amount = c.kind === "fixed" ? 1 : t.count;
    if (c.kind !== "independent" && amount < 0)
      throw new Error("重置层数不能为负数");
    change(s, amount, time);
    record(s, time, before, initial ? "initial" : "trigger", automatic);
    if (
      options.collect &&
      amount > 0 &&
      total(s) === 0 &&
      t.duration === 0 &&
      changes.length < 5000
    )
      changes.push({
        id: `${originId}-${entry.key}-instant-end`,
        reason: "expiry",
        time,
        key: entry.key,
        name: entry.effect.name,
        source: entry.source,
        originId,
        originTime: time,
        delta: -Math.min(c.max ?? Infinity, amount),
        actualDelta: -Math.min(c.max ?? Infinity, amount),
        count: 0,
      });
    if (
      options.collect &&
      before > 0 &&
      total(s) === 0 &&
      amount <= 0 &&
      changes.length < 5000
    )
      changes.push({
        id: `${originId}-${entry.key}-cleared`,
        reason: "cleared",
        automatic,
        time,
        key: entry.key,
        name: entry.effect.name,
        source: entry.source,
        originId,
        originTime: time,
        delta: -before,
        actualDelta: -before,
        count: 0,
      });
    if (
      !initial &&
      c.kind.endsWith("Periodic") &&
      t.delta !== 0 &&
      (amount > 0 || t.delta > 0)
    ) {
      if (!(t.interval > 0) || !Number.isFinite(t.interval))
        throw new Error("层数变化间隔必须大于0");
      s.tick = 1;
      s.next = time + t.interval;
      if (
        t.activeFor != null &&
        t.interval - t.activeFor > epsilon(t.interval, t.activeFor)
      )
        s.next = undefined;
      if (
        s.next !== undefined &&
        shared(s) &&
        s.sharedEnd !== null &&
        due(s.sharedEnd, s.next)
      )
        s.next = undefined;
    }
  };
  for (const entry of entries) {
    const c = entry.effect.realtime!;
    if (c.kind !== "fixed" && c.initial > 0)
      apply(
        entry,
        { ...eventTiming(entry.effect), count: c.initial },
        0,
        "initial",
        true,
      );
  }
  const triggerEvent = (event: TimelineEvent) => {
    if (event.kind === "effectTrigger") {
      const entry = definitions.get(event.effectKey);
      if (entry)
        apply(
          entry,
          eventTiming(entry.effect, event.timing, event.usePreset !== false),
          event.time,
          event.id,
        );
    } else if (event.kind === "skill") {
      if (event.repeat) return;
      for (const entry of skillBoundEffects(p, event.skillId)) {
        if (!definitions.has(entry.key)) continue;
        const own = entry.kind === "skill" && entry.ownerId === event.skillId;
        const t =
          event.effectTimings?.[entry.key] ??
          (own ? event.effectTimings?.[entry.effect.id] : undefined);
        const preset =
          event.effectUsePresets?.[entry.key] ??
          (own ? event.effectUsePresets?.[entry.effect.id] : undefined);
        apply(
          entry,
          eventTiming(entry.effect, t, preset !== false),
          event.time,
          event.id,
          false,
          !!event.generatedBy,
        );
      }
    }
  };
  for (let i = 0; i < Math.min(index + 1, ordered.length); i++) {
    const event = ordered[i];
    advance(event.time);
    statuses.set(event.id, snapshot(event.time));
    if (i === index && (options.before || event.kind !== "skill")) break;
    triggerEvent(event);
  }
  advance(now);
  const active: ActiveEffect[] = [...states.values()]
    .filter((s) => total(s) > 0)
    .map((s) => ({
      key: s.entry.key,
      effect: { ...s.entry.effect, duration: s.timing.duration },
      start: s.start,
      source: s.entry.source,
      stacks: s.entry.effect.realtime!.kind === "fixed" ? undefined : total(s),
      stackBatches: s.batches,
      nextStackChange: s.next,
    }));
  // Show known expiries beyond the last action without extending DPS duration.
  // An ongoing independent timer may refresh its layers; don't predict those expiries.
  if (options.collect && options.eventId === undefined) {
    const finiteEnds = [...states.values()].flatMap((s) =>
      s.next === undefined
        ? []
        : shared(s) && s.sharedEnd !== null
          ? [s.sharedEnd]
          : s.timing.activeFor != null
            ? [s.originTime + s.timing.activeFor]
            : s.timing.delta < 0
              ? [
                  s.originTime +
                    (s.tick - 1 + Math.ceil(total(s) / -s.timing.delta)) *
                      s.timing.interval,
                ]
              : [],
    );
    if (finiteEnds.length) advance(Math.max(now, ...finiteEnds));
    for (const s of states.values()) {
      if (s.next !== undefined && !shared(s)) continue;
      const ends = s.batches.flatMap((b) => (b.end === null ? [] : [b.end]));
      if (ends.length) expireWithEvents(s, Math.max(...ends));
    }
  }
  return {
    active,
    statuses,
    changes: changes.sort((a, b) => a.time - b.time),
    truncated,
    transitions: transitions.sort((a, b) => a.time - b.time),
  };
}
