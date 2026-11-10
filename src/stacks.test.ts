import { describe, expect, it } from "vitest";
import {
  effect,
  newProject,
  skill,
  defaultEffectStacks,
  type Effect,
  type EffectStacks,
  type TimelineEvent,
} from "./model";
import { activeEffectsAt } from "./effect-state";
import {
  stackSnapshot,
  triggerStacks,
  stackEffectSources,
} from "./stack-state";
import { calculateProject } from "./damage-engine";
import { createPanelResolver } from "./panels";
import { evaluateFormula, presetFormula } from "./formulas";
import { parseProject, parsePreset } from "./storage";

function fixture(patch: Partial<EffectStacks> = {}) {
  const p = newProject(),
    c = p.characters[0],
    hit = skill(c.id);
  c.atk = 1689;
  c.critRate = 0;
  p.enemy.level = 90;
  p.skills = [hit];
  const e: Effect = {
    ...effect(c.id),
    name: "叠层增伤",
    type: "增伤区",
    value: 10,
    stacks: { ...defaultEffectStacks(), max: 3, duration: 5, ...patch },
  };
  p.weapons[0].effects = [e];
  const trigger = (id: string, time: number, count: number): TimelineEvent => ({
    id,
    time,
    kind: "trigger",
    sourceKind: "weapon",
    sourceId: p.weapons[0].id,
    stackCounts: { [e.id]: count },
  });
  const damage = (id: string, time: number): TimelineEvent => ({
    id,
    time,
    kind: "skill",
    skillId: hit.id,
  });
  return { p, c, hit, e, trigger, damage };
}
const counts = (p: ReturnType<typeof newProject>) =>
  calculateProject(p).rows.map((r) => {
    expect(r.error).toBeUndefined();
    return r.effects.find((e) => e.name === "叠层增伤")?.stacks ?? 0;
  });

describe("independent effect stacks", () => {
  it("expires batches separately and refreshes the earliest expiry when full", () => {
    const { p, trigger, damage } = fixture();
    p.timeline = [
      trigger("a", 0, 2),
      damage("h0", 0),
      trigger("b", 2, 1),
      trigger("c", 3, 1),
      damage("h3", 3),
      damage("h5", 5),
      damage("h7", 7),
      damage("h8", 8),
    ];
    expect(counts(p)).toEqual([2, 3, 2, 1, 0]);
    const at3 = activeEffectsAt(p, "h3")[0];
    expect(at3.stackBatches).toEqual([
      { count: 1, end: 5 },
      { count: 1, end: 7 },
      { count: 1, end: 8 },
    ]);
    calculateProject(p).rows.forEach((r, i) =>
      expect(r.expected).toBeCloseTo(900 * (1 + [2, 3, 2, 1, 0][i] * 0.1)),
    );
  });
  it("refreshes one nonstackable layer and caps oversized grants without per-layer allocation", () => {
    const { e } = fixture({ limit: "none" });
    let state = triggerStacks(undefined, e, 0, 1000000000);
    state = triggerStacks(state, e, 3, 1000000000);
    expect(stackSnapshot(state, 5).count).toBe(1);
    expect(stackSnapshot(state, 8).count).toBe(0);
    expect(state.batches).toHaveLength(1);
  });
  it("supports unlimited permanent stacks and zero grants", () => {
    const { e } = fixture({ limit: "unlimited", duration: null });
    let state = triggerStacks(undefined, e, 0, 1e9);
    state = triggerStacks(state, e, 10, 1e9);
    state = triggerStacks(state, e, 20, 0);
    expect(stackSnapshot(state, 1e12).count).toBe(2e9);
    expect(state.batches).toEqual([{ count: 2e9, end: null }]);
  });
  it("handles zero durations and decimal expiry boundaries", () => {
    const { e } = fixture({ duration: 0 });
    expect(stackSnapshot(triggerStacks(undefined, e, 0, 2), 0).count).toBe(0);
    e.stacks!.duration = 0.2;
    const state = triggerStacks(undefined, e, 0.1, 2);
    expect(stackSnapshot(state, 0.299).count).toBe(2);
    expect(stackSnapshot(state, 0.3).count).toBe(0);
  });
  it("does not share caps between different effects or sources", () => {
    const { p, e, trigger, damage } = fixture({ max: 2 });
    p.weapons[1].effects = [{ ...e, sourceId: p.characters[1].id }];
    p.timeline = [
      trigger("a", 0, 2),
      {
        ...trigger("b", 0, 2),
        kind: "trigger",
        sourceKind: "weapon",
        sourceId: p.weapons[1].id,
      },
      damage("hit", 1),
    ];
    expect(activeEffectsAt(p, "hit").map((e) => e.stacks)).toEqual([2, 2]);
    expect(calculateProject(p).rows[0].expected).toBeCloseTo(900 * 1.4);
  });
});

describe("periodic effect stacks", () => {
  it("increments on interval boundaries, clamps at the cap, and resets the timer on retrigger", () => {
    const { p, trigger, damage } = fixture({
      mode: "periodic",
      duration: null,
      max: 5,
      interval: 2,
      delta: 2,
    });
    p.timeline = [
      trigger("a", 1, 1),
      damage("h1", 1),
      damage("h2", 2.999),
      damage("h3", 3),
      trigger("b", 4, 2),
      damage("h5", 5),
      damage("h6", 6),
      damage("h8", 8),
      damage("far", 1e12),
    ];
    expect(counts(p)).toEqual([1, 1, 3, 2, 4, 5, 5]);
    expect(activeEffectsAt(p, "h5")[0].nextStackChange).toBe(6);
    expect(activeEffectsAt(p, "h8")[0].nextStackChange).toBeUndefined();
  });
  it("decrements to zero without negatives and can start again on retrigger", () => {
    const { p, trigger, damage } = fixture({
      mode: "periodic",
      duration: null,
      max: 5,
      interval: 1,
      delta: -2,
    });
    p.timeline = [
      trigger("a", 0, 5),
      damage("h0", 0),
      damage("h1", 1),
      damage("h2", 2),
      damage("h3", 3),
      trigger("b", 5, 3),
      damage("h5", 5),
      damage("h6", 6),
      trigger("clear", 7, 0),
      damage("h7", 7),
    ];
    expect(counts(p)).toEqual([5, 3, 1, 0, 3, 1, 0]);
  });
  it("grows from zero, supports unlimited growth, and handles decimal ticks", () => {
    const { e } = fixture({
      mode: "periodic",
      duration: null,
      limit: "unlimited",
      interval: 0.1,
      delta: 1,
    });
    expect(stackSnapshot(triggerStacks(undefined, e, 0.1, 0), 1e6).count).toBe(
      9999999,
    );
    const state = triggerStacks(undefined, e, 0.1, 1);
    expect(stackSnapshot(state, 0.299).count).toBe(2);
    expect(stackSnapshot(state, 0.3).count).toBe(3);
    expect(stackSnapshot(state, 1000000.1).count).toBe(10000001);
  });
});

describe("stack sources, variable evaluation and persistence", () => {
  it.each([
    "weapon",
    "artifact",
    "talent",
    "skill",
    "standalone",
    "global",
  ] as const)(
    "supports %s effects and explicit stack events using the same stack pool",
    (kind) => {
      const { p, c, e, damage } = fixture();
      p.weapons[0].effects = [];
      let first: TimelineEvent[] = [];
      if (kind === "global")
        p.globals = [{ ...e, stacks: { ...e.stacks!, initial: 2 } }];
      else if (kind === "standalone")
        first = [
          {
            id: "start",
            time: 0,
            kind: "effect",
            effect: e,
            stackCounts: { [e.id]: 2 },
          },
        ];
      else if (kind === "skill") {
        const s = { ...skill(c.id), kind: "effect" as const, effects: [e] };
        p.skills.push(s);
        first = [
          {
            id: "start",
            time: 0,
            kind: "skill",
            skillId: s.id,
            stackCounts: { [e.id]: 2 },
          },
        ];
      } else {
        const owner =
          kind === "weapon"
            ? p.weapons[0]
            : kind === "artifact"
              ? p.artifacts[0]
              : { id: "talent", characterId: c.id, name: "天赋", effects: [e] };
        owner.effects = [e];
        if (kind === "talent") p.talents = [owner];
        first = [
          {
            id: "start",
            time: 0,
            kind: "trigger",
            sourceKind: kind,
            sourceId: owner.id,
            stackCounts: { [e.id]: 2 },
          },
        ];
      }
      p.timeline = first;
      const key = stackEffectSources(p)[0].key;
      p.timeline.push(
        damage("before", 1),
        { id: "again", time: 2, kind: "stacks", effectKey: key, count: 2 },
        damage("after", 2),
        damage("expiry", 5),
      );
      expect(counts(p)).toEqual(kind === "global" ? [0, 0, 0] : [2, 3, 2]);
      expect(counts(parseProject(JSON.parse(JSON.stringify(p))))).toEqual(
        kind === "global" ? [0, 0, 0] : [2, 3, 2],
      );
    },
  );
  it.each(["weapon", "artifact", "talent"] as const)(
    "automatically starts global %s stacks at zero",
    (kind) => {
      const { p, c, e, damage } = fixture({ mode: "periodic", initial: 1 });
      p.weapons[0].effects = [];
      const owner =
        kind === "weapon"
          ? p.weapons[0]
          : kind === "artifact"
            ? p.artifacts[0]
            : {
                id: "t",
                name: "t",
                characterId: c.id,
                effects: [] as Effect[],
              };
      owner.effects = [{ ...e, global: true }];
      if (kind === "talent") p.talents = [owner];
      p.timeline = [damage("start", 0), damage("later", 2)];
      expect(counts(p)).toEqual([0, 0]);
      expect(
        calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
      ).toEqual([10, 10]);
    },
  );
  it("uses the event's live variable per layer in both damage and attribute effects", () => {
    const { p, c, e, trigger, damage } = fixture();
    c.mastery = 100;
    e.valueMode = "live";
    e.variableStat = "元素精通";
    e.coefficient = 0.1;
    p.timeline = [
      trigger("start", 0, 2),
      damage("before", 1),
      {
        id: "em",
        kind: "effect",
        time: 2,
        effect: { ...effect(c.id), type: "元素精通", unit: "flat", value: 300 },
      },
      damage("after", 3),
    ];
    const rows = calculateProject(p).rows;
    expect(
      rows.map((r) => r.effects.find((x) => x.name === e.name)?.value),
    ).toEqual([20, 80]);
    expect(rows[1].expected).toBeCloseTo(900 * 1.8);
    e.type = "攻击力";
    expect(calculateProject(p).rows.map((r) => r.breakdown?.scaling)).toEqual([
      2020, 2080,
    ]);
    const active = activeEffectsAt(p, "after").find(
      (x) => x.effect.id === e.id,
    )!;
    expect(
      createPanelResolver(p, "after").trace(e, active.stacks),
    ).toMatchObject({ x: 400, perStack: 40, value: 80 });
  });
  it("applies layered astral uplift additively, and excludes expired stacks", () => {
    const { p, hit, e, trigger, damage } = fixture();
    hit.damage.special = "月感电";
    e.type = "擢升";
    p.timeline = [trigger("t", 0, 2), damage("h1", 1), damage("h5", 5)];
    const rows = calculateProject(p).rows;
    expect(rows[0].breakdown?.uplift).toBe(1.2);
    expect(rows[0].expected).toBeCloseTo(rows[1].expected! * 1.2);
  });
  it("preserves same-time ordering, and reports disabled or deleted sources", () => {
    const { p, e, damage } = fixture();
    const key = stackEffectSources(p)[0].key;
    p.timeline = [
      damage("before", 1),
      { id: "stack", kind: "stacks", time: 1, effectKey: key, count: 2 },
      damage("after", 1),
    ];
    expect(counts(p)).toEqual([0, 2]);
    e.stacks!.enabled = false;
    expect(calculateProject(p).rows[1].error).toContain("未启用多层效果");
  });
  it("preserves weapon preset settings and rejects malformed layer input", () => {
    const { p, e, trigger } = fixture();
    const preset = {
      id: "preset",
      name: "p",
      kind: "weapon",
      data: p.weapons[0],
    };
    expect(parsePreset(preset)).toMatchObject({
      data: { effects: [{ stacks: e.stacks }] },
    });
    p.timeline = [trigger("bad", 1, 1.5)];
    expect(() => parseProject(p)).toThrow();
    p.timeline = [];
    e.stacks!.interval = 0;
    expect(() => parseProject(p)).toThrow();
  });
});

describe("threshold conversion formula preset", () => {
  it("reproduces the given 100 attack to 8 mastery with a 160 cap", () => {
    const formula = presetFormula({
      threshold: 0,
      step: 100,
      change: 8,
      cap: 160,
      wholeSteps: false,
    });
    expect(
      [0, 100, 1900, 2000, 3000].map((x) => evaluateFormula(formula, x)),
    ).toEqual([0, 8, 152, 160, 160]);
  });
  it("supports excess thresholds, whole steps, negative changes and no cap", () => {
    const p = {
      threshold: 2000,
      step: 100,
      change: -8,
      cap: 160,
      wholeSteps: true,
    };
    expect(
      [1900, 2099, 2100, 4100].map((x) => evaluateFormula(presetFormula(p), x)),
    ).toEqual([-0, -0, -8, -160]);
    expect(
      evaluateFormula(
        presetFormula({ ...p, cap: null, wholeSteps: false }),
        2050,
      ),
    ).toBe(-4);
    expect(() => presetFormula({ ...p, step: 0 })).toThrow();
  });
});
