import {
  charName,
  emptySkillEffectKeys,
  sortedTimeline,
  triggerSource,
  type Effect,
  type Project,
  type EffectTiming,
} from "./model";
import {
  effectCatalog,
  defaultTiming,
  effectiveTiming,
  isGlobalEffect,
  isStackingEffect,
} from "./effect-catalog";
import {
  stackEffectSources,
  standaloneStackKey,
  triggerStacks,
  stackSnapshot,
  type StackState,
  type StackBatch,
} from "./stack-state";
import { realtimeTimeline } from "./realtime-state";
export type ActiveEffect = {
  key: string;
  effect: Effect;
  start: number;
  source: string;
  ownerKind?: "weapon" | "artifact" | "talent";
  ownerId?: string;
  stacks?: number;
  stackBatches?: StackBatch[];
  nextStackChange?: number;
};
export function globalEffects(p: Project): ActiveEffect[] {
  return effectCatalog(p)
    .filter((e) => e.automatic && e.effect.enabled !== false)
    .map((e) => ({
      key: e.key,
      effect: { ...e.effect, duration: null, stacks: undefined },
      start: 0,
      source: e.source,
      ownerKind:
        e.kind === "weapon" || e.kind === "artifact" || e.kind === "talent"
          ? e.kind
          : undefined,
      ownerId: e.ownerId,
    }));
}
export function activeEffectsAt(p: Project, eventId: string): ActiveEffect[] {
  if (!sortedTimeline(p.timeline).some((e) => e.id === eventId)) return [];
  return [
    ...legacyActiveEffectsAt(p, eventId),
    ...realtimeTimeline(p, { eventId }).active,
  ];
}
function legacyActiveEffectsAt(p: Project, eventId: string): ActiveEffect[] {
  const ordered = sortedTimeline(p.timeline),
    index = ordered.findIndex((e) => e.id === eventId);
  if (index < 0) return [];
  const now = ordered[index].time;
  const active = (e: Effect, start: number) =>
    e.duration === null || now < start + e.duration;
  const name = (id: string) =>
    charName(
      p.characters.find((c) => c.id === id)!,
      p.characters.findIndex((c) => c.id === id),
    );
  const labels = {
    weapon: "武器",
    artifact: "圣遗物",
    talent: "天赋/命座",
    skill: "技能",
    global: "全局效果",
  };
  const automatic = globalEffects(p);
  const result: ActiveEffect[] = [...automatic];
  const triggered = new Map<string, ActiveEffect>();
  const layered = new Map<string, { row: ActiveEffect; state: StackState }>();
  const catalog = new Map(stackEffectSources(p).map((s) => [s.key, s]));
  const definitions = new Map(effectCatalog(p).map((s) => [s.key, s]));
  const disabledKeys = emptySkillEffectKeys(p);
  const applyStacks = (key: string, row: ActiveEffect, count?: number) => {
    const state = triggerStacks(
      layered.get(key)?.state,
      row.effect,
      row.start,
      count ?? row.effect.stacks!.initial,
    );
    layered.set(key, { row: { ...row, key }, state });
  };
  const applyTiming = (
    key: string,
    row: ActiveEffect,
    timing: EffectTiming,
  ) => {
    timing = effectiveTiming(row.effect, timing);
    if (!isStackingEffect(row.effect)) {
      triggered.set(key, {
        ...row,
        key,
        effect: { ...row.effect, stacks: undefined, duration: timing.duration },
      });
      return;
    }
    const e = {
      ...row.effect,
      duration: timing.duration,
      stacks: {
        enabled: true,
        mode: timing.mode,
        initial: timing.count,
        duration: timing.duration,
        limit: timing.limit,
        max: timing.max,
        interval: timing.interval,
        delta: timing.delta,
      },
    };
    applyStacks(key, { ...row, effect: e }, timing.count);
  };
  // Globals are evaluated afresh at every hit, outside all trigger/stack state.
  for (const event of ordered.slice(0, index)) {
    if (event.kind === "effectTrigger") {
      if (disabledKeys.has(event.effectKey)) continue;
      const entry = definitions.get(event.effectKey);
      if (!entry)
        throw new Error("触发事件引用的效果不存在，请重新选择效果来源");
      if (entry.automatic || entry.effect.enabled === false) continue;
      if (entry.effect.realtime) continue;
      applyTiming(
        entry.key,
        {
          key: entry.key,
          effect: entry.effect,
          start: event.time,
          source: entry.source,
        },
        event.timing,
      );
    } else if (event.kind === "stacks") {
      if (disabledKeys.has(event.effectKey)) continue;
      if (
        definitions.get(event.effectKey)?.automatic ||
        definitions.get(event.effectKey)?.effect.enabled === false
      )
        continue;
      const entry = catalog.get(event.effectKey);
      if (!entry) throw new Error("层数事件引用的效果不存在或未启用多层效果");
      const source = `${name(entry.effect.sourceId)} · ${entry.source}`;
      applyStacks(
        entry.key,
        { key: entry.key, effect: entry.effect, start: event.time, source },
        event.count,
      );
    } else if (
      event.kind === "effect" &&
      event.effect.enabled !== false &&
      (event.effect.stacks?.enabled || active(event.effect, event.time))
    ) {
      const e = event.effect;
      const row = {
        key: event.id,
        effect: e,
        start: event.time,
        source: `${name(e.sourceId)} · ${e.origin ? `${labels[e.origin.kind]}「${e.origin.name || "未命名"}」` : "独立效果事件"}`,
      };
      if (e.stacks?.enabled)
        applyStacks(standaloneStackKey(e), row, event.stackCounts?.[e.id]);
      else result.push(row);
    } else if (event.kind === "skill") {
      if (event.repeat) continue;
      const s = p.skills.find((s) => s.id === event.skillId);
      if (s && s.kind !== "damage")
        for (const e of s.effects)
          if (
            e.enabled !== false &&
            !event.disabledEffectKeys?.includes(`skill-${s.id}-${e.id}`) &&
            !isGlobalEffect(e) &&
            !e.realtime &&
            (event.effectTimings || e.stacks?.enabled || active(e, event.time))
          ) {
            const row = {
              key: `${event.id}-${e.id}`,
              effect: { ...e, sourceId: s.characterId },
              start: event.time,
              source: `${name(s.characterId)} · 技能「${s.name || "未命名技能"}」`,
            };
            if (event.effectTimings)
              applyTiming(
                `skill-${s.id}-${e.id}`,
                row,
                event.effectTimings[e.id] ?? defaultTiming(e),
              );
            else if (e.stacks?.enabled)
              applyStacks(
                `skill-${s.id}-${e.id}`,
                row,
                event.stackCounts?.[e.id],
              );
            else result.push(row);
          }
    } else if (event.kind === "trigger") {
      const owner = triggerSource(p, event);
      if (!owner) continue;
      for (const e of owner.effects.filter(
        (e) => e.enabled !== false && !isGlobalEffect(e) && !e.realtime,
      )) {
        const key = `${event.sourceKind}-${owner.id}-${e.id}`;
        const row = {
          key: `${event.id}-${e.id}`,
          effect: { ...e, sourceId: owner.characterId },
          start: event.time,
          source: `${name(owner.characterId)} · ${labels[event.sourceKind]}「${owner.name || "未命名"}」`,
        };
        if (e.stacks?.enabled) applyStacks(key, row, event.stackCounts?.[e.id]);
        else triggered.set(key, row);
      }
    }
  }
  return [
    ...result,
    ...[...triggered.values()].filter((x) => active(x.effect, x.start)),
    ...[...layered.values()].flatMap(({ row, state }) => {
      const snapshot = stackSnapshot(state, now);
      return snapshot.count > 0
        ? [
            {
              ...row,
              stacks: snapshot.count,
              stackBatches: snapshot.batches,
              nextStackChange: snapshot.nextChange,
            },
          ]
        : [];
    }),
  ];
}
