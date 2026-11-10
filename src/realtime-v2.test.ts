import { describe, it, expect } from "vitest";
import {
  effect,
  newProject,
  skill,
  type EffectTiming,
  type RealtimeConfig,
  type TimelineEvent,
  deleteSkill,
} from "./model";
import {
  defaultTiming,
  effectCatalog,
  eventTiming,
  upgradeRealtimeProject,
} from "./effect-catalog";
import { realtimeTimeline } from "./realtime-state";
import { activeEffectsAt } from "./effect-state";
import { calculateProject } from "./damage-engine";
import { parseProject } from "./storage";
import { calculateOutsidePanels } from "./panels";

function fixture(
  kind: RealtimeConfig["kind"],
  patch: Partial<RealtimeConfig> = {},
) {
  const p = newProject(),
    c = p.characters[0],
    hit = skill(c.id),
    cast = { ...skill(c.id), kind: "empty" as const };
  c.atk = 1689;
  c.critRate = 0;
  p.enemy.level = 90;
  p.skills = [hit, cast];
  const e = {
    ...effect(c.id),
    name: "实时增伤",
    category: "realtime" as const,
    type: "增伤区" as const,
    value: 10,
    realtime: {
      kind,
      max: 3,
      initial: 0,
      duration: 5,
      interval: 1,
      delta: 1,
      ...patch,
    } as RealtimeConfig,
  };
  p.weapons[0].effects = [e];
  const key = effectCatalog(p)[0].key;
  const trigger = (
    id: string,
    time: number,
    count = 1,
    patch: Partial<EffectTiming> = {},
  ): TimelineEvent => ({
    id,
    time,
    kind: "effectTrigger",
    effectKey: key,
    usePreset: false,
    timing: { ...defaultTiming(e), count, ...patch },
  });
  const damage = (id: string, time: number): TimelineEvent => ({
    id,
    time,
    kind: "skill",
    skillId: hit.id,
  });
  const counts = () =>
    calculateProject(p).rows.map((r) => {
      expect(r.error).toBeUndefined();
      return r.effects.find((fx) => fx.name === e.name)?.stacks ?? 0;
    });
  return { p, c, hit, cast, e, key, trigger, damage, counts };
}
describe("five realtime effect types", () => {
  it("fixed effects refresh, expire exactly, and read changed presets only when checked", () => {
    const { p, e, trigger, damage } = fixture("fixed");
    p.timeline = [
      trigger("a", 0),
      damage("one", 1),
      trigger("b", 3, 999, { duration: 1 }),
      damage("four", 4),
    ];
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([10, 0]);
    const ev = p.timeline[2];
    if (ev.kind !== "effectTrigger") throw Error();
    ev.usePreset = true;
    e.realtime.duration = 2;
    expect(calculateProject(p).rows[1].breakdown?.ordinaryBonus).toBe(10);
    expect(eventTiming(e, { ...ev.timing, count: 20 }, true).count).toBe(1);
  });
  it("initial layers are active at zero, hidden from events and outside panel", () => {
    const { p, e, damage, counts } = fixture("independent", { initial: 2 });
    p.timeline = [damage("a", 0), damage("b", 5)];
    expect(counts()).toEqual([2, 0]);
    expect(
      realtimeTimeline(p, { collect: true }).changes.filter((c) => !c.reason),
    ).toEqual([]);
    e.type = "攻击力";
    e.unit = "flat";
    expect(
      calculateOutsidePanels(p)[0].rows.find((r) => r.stat === "攻击力")?.value,
    ).toBe(2000);
  });
  it("independent layers refresh earliest expiry, deduct earliest, and clamp below zero", () => {
    const { p, trigger, damage, counts } = fixture("independent");
    p.timeline = [
      trigger("a", 0, 2),
      trigger("b", 2, 2, { duration: 10 }),
      damage("h2", 2),
      trigger("remove", 3, -1),
      damage("h3", 3),
      damage("h5", 5),
      trigger("clear", 6, -9),
      damage("h6", 6),
    ];
    expect(counts()).toEqual([3, 2, 2, 0]);
    expect(activeEffectsAt(p, "h3")[0].stackBatches).toEqual([
      { count: 2, end: 12 },
    ]);
    expect(
      parseProject(JSON.parse(JSON.stringify(p))).timeline[3],
    ).toMatchObject({ timing: { count: -1 } });
  });
  it("periodic independent layers expire individually and refresh at cap forever", () => {
    const { p, trigger, damage, counts } = fixture("independentPeriodic", {
      duration: 3,
      max: 2,
    });
    p.timeline = [
      trigger("a", 0, 2),
      damage("h0", 0),
      damage("h2", 2),
      damage("h3", 3),
      damage("h5", 5),
    ];
    expect(counts()).toEqual([2, 2, 2, 2]);
    expect(activeEffectsAt(p, "h3")[0].stackBatches).toEqual([
      { count: 1, end: 5 },
      { count: 1, end: 6 },
    ]);
    expect(realtimeTimeline(p, { collect: true }).changes).toHaveLength(5);
  });
  it("periodic independent effects can grow from zero and reset the old schedule", () => {
    const { p, trigger, damage, counts } = fixture("independentPeriodic", {
      duration: 0.5,
      interval: 1,
    });
    p.timeline = [
      trigger("a", 0, 0),
      damage("h0", 0),
      damage("h1", 1),
      damage("h15", 1.5),
      trigger("reset", 1.7, 2, { interval: 2, duration: 10, delta: -1 }),
      damage("h2", 2),
      damage("h37", 3.7),
      damage("h57", 5.7),
    ];
    expect(counts()).toEqual([0, 1, 0, 2, 1, 0]);
    expect(
      realtimeTimeline(p, { collect: true })
        .changes.filter((c) => !c.reason)
        .map((r) => [r.time, r.originTime, r.count]),
    ).toEqual([
      [1, 0, 1],
      [3.7, 1.7, 1],
      [5.7, 1.7, 0],
    ]);
  });
  it("shared duration resets all layers and reports remaining duration before trigger", () => {
    const { p, key, trigger, damage, counts } = fixture("shared", {
      initial: 2,
    });
    p.timeline = [
      damage("h0", 0),
      trigger("replace", 2, 3, { duration: 2 }),
      damage("h3", 3),
      damage("h4", 4),
    ];
    expect(counts()).toEqual([2, 3, 0]);
    expect(realtimeTimeline(p).statuses.get("replace")?.[key]).toEqual({
      count: 2,
      remaining: 3,
    });
  });
  it("shared periodic expires as one effect, stops deductions at zero, resumes on trigger", () => {
    const { p, trigger, damage, counts } = fixture("sharedPeriodic", {
      duration: 3,
      delta: 2,
    });
    p.timeline = [
      trigger("a", 0, 0),
      damage("h1", 1),
      damage("h2", 2),
      damage("h3", 3),
      trigger("b", 4, 3, { duration: null, delta: -2 }),
      damage("h5", 5),
      damage("h6", 6),
      damage("h9", 9),
    ];
    expect(counts()).toEqual([2, 3, 0, 1, 0, 0]);
    expect(
      realtimeTimeline(p, { collect: true })
        .changes.filter((c) => !c.reason)
        .map((r) => r.time),
    ).toEqual([1, 2, 5, 6]);
  });
  it("decimal tick and expiry boundaries are stable", () => {
    const { p, trigger, damage, counts } = fixture("independentPeriodic", {
      duration: 0.2,
      interval: 0.1,
      max: 9,
    });
    p.timeline = [trigger("a", 0.1, 1), damage("h", 0.3)];
    expect(counts()).toEqual([2]);
  });
  it("separate effects never share layer pools and globals remain unconditional", () => {
    const { p, e, damage, counts } = fixture("shared", { initial: 2 });
    p.weapons[1].effects = [
      {
        ...e,
        id: "second",
        sourceId: p.characters[1].id,
        realtime: { ...e.realtime, initial: 3 },
      },
    ];
    p.globals = [{ ...e, id: "global", category: "global", value: 20 }];
    p.timeline = [damage("h", 0)];
    expect(counts()).toEqual([0]); // first matching named row is the unlayered global
    expect(calculateProject(p).rows[0].breakdown?.ordinaryBonus).toBe(70);
  });
});
describe("skill-bound realtime triggers", () => {
  it("skill-owned bindings can be disabled, deduplicate and are removed when deleting the skill", () => {
    const { p, e, cast, damage } = fixture("independent");
    cast.kind = "effect" as never;
    p.weapons[0].effects = [];
    cast.effects = [e];
    e.boundSkillIds = [cast.id];
    p.timeline = [
      { id: "cast", kind: "skill", time: 0, skillId: cast.id },
      damage("hit", 1),
    ];
    const parsed = parseProject(p);
    expect(calculateProject(parsed).rows[0].breakdown?.ordinaryBonus).toBe(10);
    expect(
      calculateProject(upgradeRealtimeProject(parsed)).rows[0].breakdown
        ?.ordinaryBonus,
    ).toBe(10);
    e.boundSkillIds = [];
    expect(calculateProject(p).rows[0].breakdown?.ordinaryBonus).toBe(0);
    p.weapons[0].effects = [{ ...e, boundSkillIds: [cast.id] }];
    expect(deleteSkill(p, cast.id).weapons[0].effects[0].boundSkillIds).toEqual(
      [],
    );
  });
  it("applies to the bound damage itself and does not duplicate its effect pool", () => {
    const { p, e, key, hit, damage } = fixture("independent");
    e.boundSkillIds = [hit.id];
    p.timeline = [damage("first", 0), damage("second", 2)];
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([10, 20]);
    expect(realtimeTimeline(p).statuses.get("second")?.[key].count).toBe(1);
    p.timeline[1].effectTimings = { [key]: { ...defaultTiming(e), count: -1 } };
    expect(calculateProject(p).rows[1].breakdown?.ordinaryBonus).toBe(0);
    const next = parseProject(JSON.parse(JSON.stringify(p)));
    expect(next.weapons[0].effects[0].boundSkillIds).toEqual([hit.id]);
    expect(parseProject(next)).toEqual(next);
  });
  it("non-damaging skills trigger bound effects, extend duration and create no damage rows", () => {
    const { p, e, cast, hit } = fixture("fixed");
    e.boundSkillIds = [cast.id];
    p.timeline = [
      { id: "a", time: 0, kind: "skill", skillId: cast.id },
      { id: "b", time: 1, kind: "skill", skillId: hit.id },
      { id: "c", time: 10, kind: "skill", skillId: cast.id },
    ];
    const result = calculateProject(p);
    expect(result.rows).toHaveLength(1);
    expect(result.time).toBe(10);
    expect(result.total).toBeCloseTo(990);
    expect(result.dps).toBeCloseTo(99);
  });
  it("honors same-time manual order and excludes bindings after unbinding", () => {
    const { p, e, hit, damage, trigger } = fixture("shared");
    p.timeline = [
      damage("before", 1),
      trigger("buff", 1, 2),
      damage("after", 1),
    ];
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([0, 20]);
    e.boundSkillIds = [hit.id];
    expect(calculateProject(p).rows[0].breakdown?.ordinaryBonus).toBe(10);
    e.boundSkillIds = [];
    expect(calculateProject(p).rows[0].breakdown?.ordinaryBonus).toBe(0);
  });
  it("live variables read damage-time stats rather than trigger-time stats", () => {
    const { p, c, e, damage, trigger } = fixture("fixed");
    c.mastery = 100;
    e.valueMode = "live";
    e.variableStat = "元素精通";
    e.coefficient = 0.1;
    p.timeline = [
      trigger("a", 0),
      damage("one", 1),
      {
        id: "em",
        time: 2,
        kind: "effect",
        effect: { ...effect(c.id), type: "元素精通", unit: "flat", value: 100 },
      },
      damage("three", 3),
    ];
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([10, 20]);
  });
  it("legacy editing upgrade is idempotent and preserves explicit trigger duration", () => {
    const { p, e, trigger, damage } = fixture("independent");
    p.timeline = [trigger("a", 0, 2, { duration: 8 }), damage("hit", 6)];
    delete (e as Partial<typeof e>).realtime;
    const next = upgradeRealtimeProject(parseProject(p));
    expect(next.weapons[0].effects[0].realtime?.initial).toBe(0);
    expect(calculateProject(next).rows[0].breakdown?.ordinaryBonus).toBe(20);
    expect(upgradeRealtimeProject(parseProject(next))).toEqual(next);
  });
});
