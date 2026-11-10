import { describe, it, expect } from "vitest";
import {
  effect,
  newProject,
  skill,
  type EffectTiming,
  type TimelineEvent,
} from "./model";
import {
  defaultTiming,
  effectCatalog,
  effectiveTiming,
  removeGlobalTriggers,
} from "./effect-catalog";
import { activeEffectsAt } from "./effect-state";
import { calculateProject } from "./damage-engine";
import { parseProject } from "./storage";

function fixture() {
  const p = newProject(),
    c = p.characters[0],
    hit = skill(c.id);
  c.atk = 1689;
  c.critRate = 0;
  c.mastery = 100;
  p.enemy.level = 90;
  p.skills = [hit];
  const e = {
    ...effect(c.id),
    name: "效果",
    category: "realtime" as const,
    realtimeKind: "fixed" as const,
    type: "增伤区" as const,
    value: 10,
  };
  p.weapons[0].effects = [e];
  const key = `weapon-${p.weapons[0].id}-${e.id}`;
  const trigger = (
    id: string,
    time: number,
    timing: Partial<EffectTiming> = {},
  ): TimelineEvent => ({
    id,
    kind: "effectTrigger",
    time,
    effectKey: key,
    timing: { ...defaultTiming(e), ...timing },
    usePreset: true,
  });
  const damage = (id: string, time: number): TimelineEvent => ({
    id,
    kind: "skill",
    time,
    skillId: hit.id,
  });
  return { p, c, e, key, trigger, damage };
}
describe("global/realtime classification", () => {
  it("globals ignore all trigger changes, durations and layer presets, but read current variables", () => {
    const { p, c, e, trigger, damage } = fixture();
    p.weapons[0].effects = [
      {
        ...e,
        category: "global",
        valueMode: "live",
        variableStat: "元素精通",
        coefficient: 0.1,
        timingPreset: {
          count: 5,
          duration: 0,
          mode: "periodic",
          limit: "capped",
          max: 10,
          interval: 1,
          delta: 5,
        },
      },
    ];
    p.timeline = [
      damage("h0", 0),
      trigger("clear", 1, { count: 0, duration: 0 }),
      {
        id: "em",
        kind: "effect",
        time: 2,
        effect: {
          ...effect(c.id),
          type: "元素精通",
          unit: "flat",
          value: 100,
          duration: 1,
        },
      },
      damage("h2", 2),
      damage("h4", 4),
    ];
    const rows = calculateProject(p).rows;
    expect(rows.map((r) => r.breakdown?.ordinaryBonus)).toEqual([10, 20, 10]);
    expect(
      activeEffectsAt(p, "h4").find((r) => r.effect.id === e.id)?.stacks,
    ).toBeUndefined();
    expect(removeGlobalTriggers(p).timeline.some((r) => r.id === "clear")).toBe(
      false,
    );
    expect(parseProject(p).timeline.some((r) => r.id === "clear")).toBe(false);
  });
  it("fixed effects only use duration, even if a stale override contains stack fields", () => {
    const { p, trigger, damage } = fixture();
    p.timeline = [
      trigger("a", 0, {
        mode: "periodic",
        count: 5,
        limit: "unlimited",
        delta: 5,
        duration: 3,
      }),
      damage("h1", 1),
      trigger("b", 2, { duration: 2 }),
      damage("h3", 3),
      damage("h4", 4),
    ];
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([10, 10, 0]);
    expect(activeEffectsAt(p, "h3")[0].stacks).toBeUndefined();
  });
  it("variable-layer presets support every mode and remain snapshots for saved events", () => {
    const { p, e, trigger, damage } = fixture();
    const stacking = {
      ...e,
      realtimeKind: "stacking" as const,
      timingPreset: {
        count: 3,
        duration: null,
        mode: "periodic" as const,
        limit: "capped" as const,
        max: 5,
        interval: 1,
        delta: -1,
      },
    };
    p.weapons[0].effects = [stacking];
    p.timeline = [
      trigger("a", 0, defaultTiming(stacking)),
      damage("h1", 1),
      damage("h3", 3),
    ];
    stacking.timingPreset.count = 5;
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([20, 0]);
    const next = parseProject(JSON.parse(JSON.stringify(p)));
    expect(next.timeline[0]).toMatchObject({
      usePreset: true,
      timing: { count: 3, mode: "periodic" },
    });
    expect(defaultTiming(next.weapons[0].effects[0]).count).toBe(5);
  });
  it("environment has no actor, keeps variable source, and migrates self to explicit old target", () => {
    const { p, c, e } = fixture();
    p.globals = [
      { ...e, category: "global", target: "self", variableCharacterId: c.id },
    ];
    const next = parseProject(p);
    expect(next.globals[0]).toMatchObject({
      sourceId: "",
      target: "custom",
      targetIds: [c.id],
      variableCharacterId: c.id,
    });
    expect(effectCatalog(next).find((r) => r.kind === "global")?.source).toBe(
      "环境/元素共鸣",
    );
    expect(parseProject(JSON.parse(JSON.stringify(next)))).toEqual(next);
  });
  it("environment may be realtime and category overrides the legacy global flag", () => {
    const { p, c, e, damage } = fixture();
    p.weapons[0].effects = [];
    p.globals = [{ ...e, category: "realtime", sourceId: "", global: true }];
    const key = `global-${e.id}`;
    p.timeline = [
      damage("h0", 0),
      {
        id: "env",
        kind: "effectTrigger",
        time: 1,
        effectKey: key,
        usePreset: false,
        timing: { ...defaultTiming(e), duration: 1 },
      },
      damage("h1", 1),
      damage("h2", 2),
    ];
    expect(
      calculateProject(parseProject(p)).rows.map(
        (r) => r.breakdown?.ordinaryBonus,
      ),
    ).toEqual([0, 10, 0]);
    expect(c.id).toBe(e.variableCharacterId);
  });
  it("legacy stack overrides migrate to variable-layer realtime effects", () => {
    const { p, e, trigger, damage } = fixture();
    delete (e as Partial<typeof e>).realtimeKind;
    p.timeline = [
      trigger("a", 0, { count: 3, limit: "capped", max: 5 }),
      damage("hit", 1),
    ];
    const next = parseProject(p);
    expect(next.weapons[0].effects[0].realtimeKind).toBe("stacking");
    expect(calculateProject(next).rows[0].breakdown?.ordinaryBonus).toBe(30);
    expect(
      effectiveTiming({ ...e, realtimeKind: "fixed" }, defaultTiming(e)).count,
    ).toBe(1);
  });
});
