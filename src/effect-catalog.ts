import {
  charName,
  sortedEquipment,
  uid,
  type Effect,
  type EffectTiming,
  type EffectTimingPreset,
  type Project,
  type TimelineEvent,
  type RealtimeConfig,
} from "./model";
import {
  defaultEffectName,
  namedEffect,
  syncEffectNames,
} from "./effect-names";
import { boundedActiveFor } from "./schedule";

export const EFFECT_SOURCE_LABELS = {
  weapon: "武器",
  artifact: "圣遗物",
  talent: "天赋/命座",
  skill: "技能",
  global: "环境/元素共鸣",
  custom: "独立效果",
} as const;
export type EffectSourceKind = keyof typeof EFFECT_SOURCE_LABELS;
export type CatalogEffect = {
  key: string;
  kind: EffectSourceKind;
  ownerId?: string;
  effect: Effect;
  source: string;
  automatic: boolean;
  defaultName: string;
};
export const isGlobalEffect = (e: Effect, environment = false) =>
  e.category ? e.category === "global" : environment || e.global;
export const isStackingEffect = (e: Effect) =>
  e.realtime
    ? e.realtime.kind !== "fixed"
    : e.realtimeKind
      ? e.realtimeKind === "stacking"
      : !!e.stacks?.enabled ||
        !!(
          e.timingPreset &&
          (e.timingPreset.count !== 1 || e.timingPreset.limit !== "none")
        );
export function environmentEffect(e: Effect): Effect {
  return {
    ...e,
    sourceId: "",
    target: e.target === "self" ? (e.sourceId ? "custom" : "team") : e.target,
    targetIds: e.target === "self" && e.sourceId ? [e.sourceId] : e.targetIds,
  };
}
export function effectCatalog(p: Project): CatalogEffect[] {
  const rows: CatalogEffect[] = [];
  const character = (id: string) => {
    const i = p.characters.findIndex((c) => c.id === id);
    return i < 0 ? "未知角色" : charName(p.characters[i], i);
  };
  for (const [kind, owners] of [
    ["weapon", p.weapons],
    ["artifact", p.artifacts],
    ["talent", p.talents],
    ["skill", p.skills],
  ] as const)
    for (const owner of sortedEquipment(owners, p.characters))
      for (const e of owner.effects)
        rows.push({
          key: `${kind}-${owner.id}-${e.id}`,
          kind,
          ownerId: owner.id,
          effect: namedEffect(
            { ...e, sourceId: owner.characterId },
            defaultEffectName(
              p.characters,
              owner.characterId,
              EFFECT_SOURCE_LABELS[kind],
              owner.name,
            ),
          ),
          defaultName: defaultEffectName(
            p.characters,
            owner.characterId,
            EFFECT_SOURCE_LABELS[kind],
            owner.name,
          ),
          source: `${character(owner.characterId)} · ${EFFECT_SOURCE_LABELS[kind]}「${owner.name || "未命名"}」`,
          automatic: isGlobalEffect(e),
        });
  for (const [kind, effects] of [
    ["global", p.globals],
    ["custom", p.customEffects ?? []],
  ] as const)
    for (const e of [...effects].sort(
      (a, b) =>
        p.characters.findIndex((c) => c.id === a.sourceId) -
        p.characters.findIndex((c) => c.id === b.sourceId),
    ))
      rows.push({
        key: `${kind}-${e.id}`,
        kind,
        effect: namedEffect(
          kind === "global" ? environmentEffect(e) : e,
          defaultEffectName(
            p.characters,
            kind === "global" ? "" : e.sourceId,
            EFFECT_SOURCE_LABELS[kind],
          ),
        ),
        defaultName: defaultEffectName(
          p.characters,
          kind === "global" ? "" : e.sourceId,
          EFFECT_SOURCE_LABELS[kind],
        ),
        source:
          kind === "global"
            ? EFFECT_SOURCE_LABELS[kind]
            : `${e.sourceId ? character(e.sourceId) : "无对象"} · ${EFFECT_SOURCE_LABELS[kind]}`,
        automatic: isGlobalEffect(e, kind === "global"),
      });
  return rows;
}
export function timingPreset(e: Effect): EffectTimingPreset {
  if (e.realtime) {
    const c = e.realtime;
    return {
      activeFor: boundedActiveFor(c.kind, c.duration, c.activeFor),
      mode:
        c.kind === "independent"
          ? "independent"
          : c.kind.endsWith("Periodic")
            ? "periodic"
            : "direct",
      count: c.kind === "fixed" ? 1 : c.initial,
      duration: c.duration,
      limit: c.max === null ? "unlimited" : "capped",
      max: c.max ?? 5,
      interval: c.interval,
      delta: c.delta,
    };
  }
  return (
    e.timingPreset ?? {
      count: e.stacks?.initial ?? 1,
      duration: e.stacks?.enabled ? e.stacks.duration : e.duration,
      limit: e.stacks?.limit ?? "none",
      max: e.stacks?.max ?? 5,
      interval: e.stacks?.interval ?? 1,
      delta: e.stacks?.delta ?? 1,
    }
  );
}
export const defaultTiming = (e: Effect): EffectTiming => ({
  ...timingPreset(e),
  ...(e.realtime ? { count: 1 } : {}),
  mode: timingPreset(e).mode ?? "direct",
});
export function effectiveTiming(e: Effect, t: EffectTiming): EffectTiming {
  if (e.realtime)
    return {
      ...t,
      activeFor: boundedActiveFor(e.realtime.kind, t.duration, t.activeFor),
      mode: defaultTiming(e).mode,
      limit: e.realtime.max === null ? "unlimited" : "capped",
      max: e.realtime.max ?? 5,
      ...(e.realtime.kind === "fixed"
        ? { count: 1, mode: "direct" as const, limit: "none" as const }
        : {}),
    };
  return isStackingEffect(e)
    ? t
    : { ...t, mode: "direct", count: 1, limit: "none", max: 1, delta: 0 };
}
export function realtimeConfig(e: Effect): RealtimeConfig {
  if (e.realtime)
    return {
      ...e.realtime,
      activeFor: boundedActiveFor(
        e.realtime.kind,
        e.realtime.duration,
        e.realtime.activeFor,
      ),
    };
  const t = timingPreset(e);
  const mode = t.mode ?? e.stacks?.mode ?? "direct";
  return {
    kind: !isStackingEffect(e)
      ? "fixed"
      : mode === "independent"
        ? "independent"
        : mode === "periodic"
          ? "sharedPeriodic"
          : "shared",
    max: !isStackingEffect(e)
      ? 5
      : t.limit === "unlimited"
        ? null
        : t.limit === "none"
          ? 1
          : t.max,
    initial: 0,
    activeFor: null,
    duration: t.duration,
    interval: t.interval,
    delta: t.delta,
  };
}
/** Upgrade editing projects once; old per-event values remain explicit overrides. */
export function upgradeRealtimeProject(project: Project): Project {
  let p = project;
  for (const entry of effectCatalog(p)) {
    if (entry.automatic || entry.effect.realtime) continue;
    const timings = p.timeline.flatMap((event) =>
      event.kind === "effectTrigger" && event.effectKey === entry.key
        ? [event.timing]
        : event.kind === "skill" &&
            entry.kind === "skill" &&
            event.skillId === entry.ownerId &&
            event.effectTimings?.[entry.effect.id]
          ? [event.effectTimings[entry.effect.id]]
          : [],
    );
    const config = realtimeConfig(entry.effect);
    if (isStackingEffect(entry.effect) && timings.length) {
      const t = timings[0];
      config.kind =
        t.mode === "independent"
          ? "independent"
          : t.mode === "periodic"
            ? "sharedPeriodic"
            : "shared";
      config.max =
        t.limit === "unlimited" ? null : t.limit === "none" ? 1 : t.max;
    }
    p = updateCatalogEffect(p, entry.key, {
      ...entry.effect,
      realtime: config,
      boundSkillIds:
        entry.effect.boundSkillIds ??
        (entry.kind === "skill" &&
        p.skills.find((s) => s.id === entry.ownerId)?.kind !== "damage"
          ? [entry.ownerId!]
          : []),
    });
    p = {
      ...p,
      timeline: p.timeline.map((event) =>
        event.kind === "effectTrigger" && event.effectKey === entry.key
          ? { ...event, usePreset: false }
          : event.kind === "skill" &&
              entry.kind === "skill" &&
              event.skillId === entry.ownerId &&
              event.effectTimings?.[entry.effect.id]
            ? {
                ...event,
                effectUsePresets: {
                  ...event.effectUsePresets,
                  [entry.effect.id]: false,
                },
              }
            : event,
      ),
    };
  }
  return p;
}
export function skillBoundEffects(
  p: Project,
  skillId: string,
): CatalogEffect[] {
  const s = p.skills.find((s) => s.id === skillId);
  if (!s) return [];
  return effectCatalog(p).filter(
    (r) =>
      !r.automatic &&
      (r.effect.boundSkillIds !== undefined
        ? r.effect.boundSkillIds.includes(skillId)
        : r.kind === "skill" && r.ownerId === skillId && s.kind !== "damage"),
  );
}
// Presets control time only; event layer changes always remain editable.
export function eventTiming(
  e: Effect,
  t?: EffectTiming,
  usePreset = true,
): EffectTiming {
  const saved = t ?? defaultTiming(e);
  if (!e.realtime) return effectiveTiming(e, saved);
  const c = e.realtime;
  return effectiveTiming(e, {
    ...saved,
    ...(usePreset
      ? {
          duration: c.duration,
          interval: c.interval,
          delta: c.delta,
          activeFor: c.activeFor ?? null,
        }
      : {}),
  });
}
export function legacyTiming(e: Effect, count?: number): EffectTiming {
  return {
    ...timingPreset(e),
    mode: e.stacks?.enabled ? e.stacks.mode : "direct",
    count: count ?? timingPreset(e).count,
    ...(e.stacks?.enabled && e.stacks.mode === "periodic"
      ? { duration: null }
      : {}),
  };
}
export function updateCatalogEffect(
  p: Project,
  key: string,
  value: Effect,
): Project {
  const entry = effectCatalog(p).find((e) => e.key === key);
  if (!entry) return p;
  const next = { ...value, id: entry.effect.id };
  if (entry.kind === "global")
    return {
      ...p,
      globals: p.globals.map((e) =>
        e.id === next.id ? environmentEffect(next) : e,
      ),
    };
  if (entry.kind === "custom")
    return {
      ...p,
      customEffects: (p.customEffects ?? []).map((e) =>
        e.id === next.id ? next : e,
      ),
    };
  const field = {
    weapon: "weapons",
    artifact: "artifacts",
    talent: "talents",
    skill: "skills",
  } as const;
  const name = field[entry.kind];
  return {
    ...p,
    [name]: p[name].map((owner) =>
      owner.id === entry.ownerId
        ? {
            ...owner,
            effects: owner.effects.map((e) =>
              e.id === next.id ? { ...next, sourceId: owner.characterId } : e,
            ),
          }
        : owner,
    ),
  };
}

// Legacy embedded effects become independent definitions; events only retain timing.
export function migrateEffectEvents(project: Project): Project {
  const p = { ...project, customEffects: [...(project.customEffects ?? [])] };
  const legacyKeys = new Map<string, string>();
  const embeddedKeys = new Map<string, string>();
  for (const event of p.timeline) {
    if (event.kind !== "effect") continue;
    const signature = JSON.stringify(event.effect);
    let key = embeddedKeys.get(signature);
    if (!key) {
      const e = { ...event.effect, id: uid(), global: false };
      p.customEffects.push(e);
      key = `custom-${e.id}`;
      embeddedKeys.set(signature, key);
    }
    const legacy = `timeline-${event.effect.sourceId}-${event.effect.id}`;
    if (!legacyKeys.has(legacy)) legacyKeys.set(legacy, key);
  }
  const catalog = effectCatalog(p);
  const byKey = new Map(catalog.map((e) => [e.key, e]));
  const eventFor = (
    event: TimelineEvent,
    key: string,
    e: Effect,
    id = event.id,
  ): TimelineEvent => ({
    id,
    time: event.time,
    enabled: event.enabled,
    kind: "effectTrigger",
    effectKey: key,
    timing: legacyTiming(e, event.stackCounts?.[e.id]),
  });
  p.timeline = p.timeline.flatMap((event): TimelineEvent[] => {
    if (event.kind === "effect")
      return [
        eventFor(
          event,
          embeddedKeys.get(JSON.stringify(event.effect))!,
          event.effect,
        ),
      ];
    if (event.kind === "trigger")
      return catalog
        .filter(
          (e) =>
            e.kind === event.sourceKind &&
            e.ownerId === event.sourceId &&
            !e.automatic,
        )
        .map((entry, i) =>
          eventFor(event, entry.key, entry.effect, i === 0 ? event.id : uid()),
        );
    if (event.kind === "stacks") {
      const key = legacyKeys.get(event.effectKey) ?? event.effectKey;
      const entry = byKey.get(key);
      if (!entry)
        return [
          {
            id: event.id,
            time: event.time,
            kind: "effectTrigger",
            effectKey: key,
            timing: {
              mode: "direct",
              count: event.count,
              duration: null,
              limit: "unlimited",
              max: 5,
              interval: 1,
              delta: 1,
            },
          },
        ];
      return [
        {
          ...eventFor(event, key, entry.effect),
          kind: "effectTrigger",
          effectKey: key,
          timing: legacyTiming(entry.effect, event.count),
        },
      ];
    }
    if (event.kind === "skill" && !event.effectTimings) {
      const s = p.skills.find(
        (s) => s.id === event.skillId && s.kind === "effect",
      );
      if (s)
        return [
          {
            ...event,
            effectTimings: Object.fromEntries(
              s.effects.map((e) => [
                e.id,
                e.realtime
                  ? defaultTiming(e)
                  : legacyTiming(e, event.stackCounts?.[e.id]),
              ]),
            ),
          },
        ];
    }
    return [event];
  });
  // Retain existing per-event settings as explicit overrides; new events opt into presets.
  p.timeline = p.timeline.map((event) =>
    event.kind === "effectTrigger"
      ? { ...event, usePreset: event.usePreset ?? false }
      : event.kind === "skill"
        ? {
            ...event,
            effectUsePresets:
              event.effectUsePresets ??
              Object.fromEntries(
                Object.keys(event.effectTimings ?? {}).map((id) => [id, false]),
              ),
          }
        : event,
  );
  p.globals = p.globals.map((e) => ({
    ...environmentEffect(e),
    category: isGlobalEffect(e, true) ? "global" : "realtime",
  }));
  // Old events could enable stacks even when the definition had no stack preset.
  for (const entry of effectCatalog(p)) {
    if (entry.effect.realtimeKind || entry.automatic) continue;
    const timings = p.timeline.flatMap((event) =>
      event.kind === "effectTrigger" && event.effectKey === entry.key
        ? [event.timing]
        : event.kind === "skill" &&
            entry.kind === "skill" &&
            event.skillId === entry.ownerId &&
            event.effectTimings?.[entry.effect.id]
          ? [event.effectTimings[entry.effect.id]]
          : [],
    );
    if (
      timings.some(
        (t) => t.mode !== "direct" || t.count !== 1 || t.limit !== "none",
      )
    ) {
      const next = updateCatalogEffect(p, entry.key, {
        ...entry.effect,
        realtimeKind: "stacking",
      });
      Object.assign(p, next);
    }
  }
  return syncEffectNames(removeGlobalTriggers(p));
}
export function removeGlobalTriggers(p: Project): Project {
  const globalKeys = new Set(
    effectCatalog(p)
      .filter((e) => e.automatic)
      .map((e) => e.key),
  );
  const timeline = p.timeline.filter(
    (e) =>
      (e.kind !== "effectTrigger" && e.kind !== "stacks") ||
      !globalKeys.has(e.effectKey),
  );
  return timeline.length === p.timeline.length ? p : { ...p, timeline };
}
