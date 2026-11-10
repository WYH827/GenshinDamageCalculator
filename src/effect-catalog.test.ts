import { describe, it, expect } from "vitest";
import {
  effect,
  newProject,
  skill,
  type EffectTiming,
  type TimelineEvent,
} from "./model";
import {
  effectCatalog,
  defaultTiming,
  updateCatalogEffect,
} from "./effect-catalog";
import { calculateProject } from "./damage-engine";
import { activeEffectsAt } from "./effect-state";
import { parseProject } from "./storage";

function fixture() {
  const p = newProject(),
    c = p.characters[0],
    hit = skill(c.id);
  c.atk = 1689;
  c.critRate = 0;
  c.mastery = 100;
  p.enemy.level = 90;
  const e = {
    ...effect(c.id),
    name: "增伤",
    type: "增伤区" as const,
    value: 10,
    timingPreset: {
      count: 2,
      duration: 5,
      limit: "capped" as const,
      max: 5,
      interval: 1,
      delta: 1,
    },
  };
  p.weapons[0].effects = [e];
  p.skills = [hit];
  const key = effectCatalog(p)[0].key;
  const trigger = (
    id: string,
    time: number,
    patch: Partial<EffectTiming> = {},
  ): TimelineEvent => ({
    id,
    time,
    kind: "effectTrigger",
    effectKey: key,
    timing: { ...defaultTiming(e), ...patch },
  });
  const damage = (id: string, time: number): TimelineEvent => ({
    id,
    time,
    kind: "skill",
    skillId: hit.id,
  });
  return { p, c, e, key, trigger, damage };
}
describe("effect definitions and trigger timing", () => {
  it("edits the same source definition and leaves saved timing untouched", () => {
    const { p, e, key, trigger, damage } = fixture();
    p.timeline = [trigger("start", 0), damage("hit", 1), damage("end", 5)];
    const next = updateCatalogEffect(p, key, {
      ...e,
      value: 20,
      timingPreset: { ...e.timingPreset, count: 4, duration: 100 },
    });
    expect(next.weapons[0].effects[0].value).toBe(20);
    expect(next.timeline).toEqual(p.timeline);
    expect(calculateProject(next).rows.map((r) => r.expected)).toEqual([
      1260, 900,
    ]);
    expect(defaultTiming(effectCatalog(next)[0].effect)).toMatchObject({
      mode: "direct",
      count: 4,
      duration: 100,
    });
    next.weapons[0].effects[0].value = 30;
    expect(effectCatalog(next)[0].effect.value).toBe(30);
  });
  it("sorts by category, character and original effect order", () => {
    const { p, e } = fixture();
    p.weapons[1].effects = [{ ...e, id: "second" }];
    p.artifacts[0].effects = [{ ...e, id: "artifact" }];
    p.talents = [
      {
        id: "t",
        characterId: p.characters[0].id,
        name: "t",
        effects: [{ ...e, id: "talent" }],
      },
    ];
    p.globals = [{ ...e, id: "g" }];
    [p.characters[0], p.characters[1]] = [p.characters[1], p.characters[0]];
    expect(effectCatalog(p).map((r) => r.effect.id)).toEqual([
      "second",
      e.id,
      "artifact",
      "talent",
      "g",
    ]);
  });
  it("direct changes replace counts, preserve event ordering, clear at zero and expire", () => {
    const { p, trigger, damage } = fixture();
    p.timeline = [
      trigger("a", 0),
      damage("h1", 1),
      trigger("b", 2, { count: 4, duration: 1 }),
      damage("h2", 2),
      damage("h3", 3),
      trigger("c", 4),
      trigger("clear", 4, { count: 0 }),
      damage("h4", 4),
    ];
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([20, 40, 0, 0]);
  });
  it("independent triggers preserve old expiry with per-event duration overrides", () => {
    const { p, trigger, damage } = fixture();
    p.timeline = [
      trigger("a", 0, { mode: "independent", count: 2, max: 3, duration: 10 }),
      trigger("b", 2, { mode: "independent", count: 2, max: 3, duration: 2 }),
      damage("h3", 3),
      damage("h4", 4),
      damage("h10", 10),
    ];
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([30, 10, 0]);
    expect(activeEffectsAt(p, "h3")[0].stackBatches).toEqual([
      { count: 1, end: 10 },
      { count: 2, end: 4 },
    ]);
  });
  it("periodic events reset schedules and stop at their own duration", () => {
    const { p, trigger, damage } = fixture();
    p.timeline = [
      trigger("a", 0, {
        mode: "periodic",
        count: 1,
        duration: 3,
        interval: 1,
        delta: 2,
      }),
      damage("h0", 0),
      damage("h1", 1),
      damage("h3", 3),
      trigger("b", 4, {
        mode: "periodic",
        count: 4,
        duration: null,
        interval: 2,
        delta: -1,
      }),
      damage("h5", 5),
      damage("h6", 6),
      damage("h12", 12),
    ];
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([10, 30, 0, 40, 30, 0]);
  });
  it("switches modes in one stack pool and preserves existing remaining duration in mode1", () => {
    const { p, trigger, damage } = fixture();
    p.timeline = [
      trigger("direct", 0, { count: 2, duration: 10 }),
      trigger("independent", 2, { mode: "independent", count: 1, duration: 3 }),
      damage("h3", 3),
      damage("h5", 5),
      trigger("periodic", 6, {
        mode: "periodic",
        count: 4,
        duration: null,
        delta: -2,
      }),
      damage("h7", 7),
      trigger("replace", 8, { count: 1, duration: null }),
      damage("h20", 20),
    ];
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([30, 20, 20, 10]);
  });
  it("global effects are independent of timeline layers and resolve live variables at each hit", () => {
    const { p, c, e, damage } = fixture();
    e.global = true;
    e.valueMode = "live";
    e.variableStat = "元素精通";
    e.coefficient = 0.1;
    e.timingPreset.duration = 1;
    p.timeline = [
      damage("before", 2),
      {
        id: "em",
        kind: "effect",
        time: 3,
        effect: {
          ...effect(c.id),
          type: "元素精通",
          unit: "flat",
          value: 100,
          duration: 2,
        },
      },
      damage("during", 4),
      damage("after", 20),
    ];
    const rows = calculateProject(p).rows;
    expect(
      rows.map((r) => r.effects.find((fx) => fx.name === "增伤")?.x),
    ).toEqual([100, 200, 100]);
    expect(rows.map((r) => r.breakdown?.ordinaryBonus)).toEqual([10, 20, 10]);
  });
  it("migrates each old source effect separately, removes inline values and preserves ordering on reload", () => {
    const { p, e, damage } = fixture();
    p.weapons[0].effects.push({ ...e, id: "other", value: 20 });
    p.timeline = [
      {
        id: "old",
        time: 1,
        kind: "trigger",
        sourceKind: "weapon",
        sourceId: p.weapons[0].id,
      },
      damage("hit", 1),
      {
        id: "inline",
        time: 2,
        kind: "effect",
        effect: { ...effect(p.characters[0].id), name: "独立" },
      },
    ];
    const next = parseProject(p);
    expect(next.timeline.map((e) => e.kind)).toEqual([
      "effectTrigger",
      "effectTrigger",
      "skill",
      "effectTrigger",
    ]);
    expect(next.customEffects).toHaveLength(1);
    expect(next.timeline[0]).not.toHaveProperty("effect");
    expect(parseProject(JSON.parse(JSON.stringify(next)))).toEqual(next);
  });
  it("new trigger schema discards attempted value overrides", () => {
    const { p, trigger } = fixture();
    p.timeline = [trigger("t", 0)];
    const raw = JSON.parse(JSON.stringify(p));
    raw.timeline[0].value = 999;
    raw.timeline[0].timing.value = 999;
    const next = parseProject(raw);
    expect(next.timeline[0]).not.toHaveProperty("value");
    expect(next.timeline[0]).not.toHaveProperty("timing.value");
  });
});
