import { describe, expect, it } from "vitest";
import { calculateProject } from "./damage-engine";
import {
  effect,
  newProject,
  skill,
  normalizeAmplification,
  type AmplificationReaction,
  type Element,
  type TimelineEvent,
  SPECIALS,
} from "./model";
import { parseProject } from "./storage";
import { defaultTiming } from "./effect-catalog";

function fixture(
  element: Element = "火",
  amplification: AmplificationReaction = "蒸发",
) {
  const p = newProject(),
    c = p.characters[0],
    s = skill(c.id);
  Object.assign(c, { atk: 1689, critRate: 50, critDamage: 100, mastery: 400 });
  p.enemy.level = 90;
  s.damage.element = element;
  s.multiplier = 200;
  p.skills = [s];
  const event: Extract<TimelineEvent, { kind: "skill" }> = {
    id: "hit",
    kind: "skill",
    time: 5,
    skillId: s.id,
    amplification,
  };
  p.timeline = [event];
  return { p, c, s, event };
}
describe("per-hit vaporize and melt", () => {
  it.each([
    ["水", "蒸发", 2],
    ["火", "融化", 2],
    ["火", "蒸发", 1.5],
    ["冰", "融化", 1.5],
  ] as const)(
    "%s %s uses base %s and applies to noncrit, crit, expectation and DPS",
    (element, reaction, base) => {
      const { p } = fixture(element, reaction),
        result = calculateProject(p),
        r = result.rows[0];
      const factor = base * (1 + (2.78 * 400) / 1800);
      expect(r.error).toBeUndefined();
      expect(r.breakdown).toMatchObject({
        amplification: reaction,
        amplificationBase: base,
        amplificationMastery: 400,
        amplificationBonus: 0,
      });
      expect(r.breakdown?.amplificationFactor).toBeCloseTo(factor);
      expect(r.nonCrit).toBeCloseTo(4000 * 0.9 * 0.5 * factor);
      expect(r.crit).toBeCloseTo(r.nonCrit! * 2);
      expect(r.expected).toBeCloseTo(r.nonCrit! * 1.5);
      expect(result.total).toBe(r.expected);
      expect(result.dps).toBeCloseTo(r.expected! / 5);
    },
  );
  it("matches the documented EM400 +15% weak reaction benchmark, with ordinary bonus separate", () => {
    const { p, c } = fixture();
    p.globals = [
      { ...effect(c.id, true), type: "增幅反应增伤", value: 15 },
      { ...effect(c.id, true), type: "增伤区", value: 20 },
      { ...effect(c.id, true), type: "基础值加成", value: 100, unit: "flat" },
    ];
    const r = calculateProject(p).rows[0];
    expect(r.breakdown?.amplificationFactor).toBeCloseTo(
      2.6516666666666664,
      10,
    );
    expect(r.expected).toBeCloseTo(
      4100 * 1.2 * 0.9 * 0.5 * 1.5 * 2.6516666666666664,
    );
  });
  it("reads the triggering attacker's live mastery including temporary effects even with base scaling", () => {
    const { p, c, s, event } = fixture();
    c.mastery = 0;
    p.characters[1].mastery = 3000;
    s.scalingMode = "base";
    p.customEffects = [
      {
        ...effect(c.id),
        name: "精通",
        type: "元素精通",
        unit: "flat",
        value: 400,
        category: "realtime",
        realtimeKind: "fixed",
      },
    ];
    const buff = p.customEffects[0];
    p.timeline = [
      { ...event, id: "before", time: 1 },
      {
        id: "buff",
        kind: "effectTrigger",
        time: 2,
        effectKey: `custom-${buff.id}`,
        timing: { ...defaultTiming(buff), duration: 2 },
        usePreset: false,
      },
      { ...event, id: "during", time: 3 },
      { ...event, id: "expired", time: 4 },
    ];
    const rows = calculateProject(p).rows;
    expect(rows.map((r) => r.breakdown?.amplificationMastery)).toEqual([
      0, 400, 0,
    ]);
    expect(rows[1].expected).toBeCloseTo(
      1689 * 2 * 0.9 * 0.5 * 1.5 * 1.5 * (1 + (2.78 * 400) / 1800),
    );
  });
  it("sums eligible global and realtime reaction bonuses, filtering source, damage and reaction", () => {
    const { p, c, event } = fixture();
    p.globals = [
      { ...effect(c.id, true), type: "增幅反应增伤", value: 10 },
      {
        ...effect(c.id, true),
        type: "增幅反应增伤",
        value: 999,
        amplificationReaction: "融化",
      },
      {
        ...effect(c.id, true),
        type: "增幅反应增伤",
        value: 999,
        target: "custom",
        targetIds: [p.characters[1].id],
      },
      {
        ...effect(c.id, true),
        type: "增幅反应增伤",
        value: 999,
        damage: { ...effect(c.id).damage, attack: "大招" },
      },
    ];
    const buff = {
      ...effect(c.id),
      type: "增幅反应增伤" as const,
      amplificationReaction: "蒸发" as const,
      valueMode: "live" as const,
      variableStat: "元素精通",
      coefficient: 0.0125,
      category: "realtime" as const,
      realtimeKind: "stacking" as const,
    };
    p.customEffects = [buff];
    p.timeline = [
      {
        id: "b",
        kind: "effectTrigger",
        time: 1,
        effectKey: `custom-${buff.id}`,
        timing: {
          ...defaultTiming(buff),
          count: 2,
          limit: "capped",
          max: 3,
          duration: 5,
        },
      },
      event,
    ];
    const r = calculateProject(p).rows[0];
    expect(r.breakdown?.amplificationBonus).toBe(20);
    expect(r.effects.filter((x) => x.status === "applied")).toHaveLength(2);
    expect(r.effects.find((x) => x.key === `custom-${buff.id}`)).toMatchObject({
      value: 10,
      x: 400,
      stacks: 2,
    });
  });
  it("unmarked hits do not inherit reactions or evaluate unrelated reaction formulas", () => {
    const { p, c, event } = fixture();
    p.globals = [
      {
        ...effect(c.id, true),
        type: "增幅反应增伤",
        valueMode: "live",
        advanced: true,
        formulas: [{ id: "f", condition: "", formula: "1/0" }],
      },
    ];
    p.timeline = [
      { ...event, id: "normal", amplification: undefined },
      { ...event, id: "react", time: 6 },
    ];
    const rows = calculateProject(p).rows;
    expect(rows[0].error).toBeUndefined();
    expect(rows[0].breakdown?.amplificationFactor).toBe(1);
    expect(rows[1].error).toBeDefined();
  });
  it.each(SPECIALS)(
    "%s never applies amplification, including stale imported flags",
    (special) => {
      const { p, s } = fixture();
      s.damage.special = special;
      const withFlag = calculateProject(p).rows[0];
      expect(withFlag.error).toBeUndefined();
      expect(withFlag.breakdown?.amplification).toBeNull();
      expect(withFlag.breakdown?.amplificationFactor).toBe(1);
      expect(parseProject(p).timeline[0]).not.toHaveProperty("amplification");
    },
  );
  it("locks water/ice, clears ineligible flags after skill edits, and persists independent events", () => {
    const { p, s, event } = fixture("水", "融化");
    expect(calculateProject(p).rows[0].breakdown?.amplification).toBe("蒸发");
    let next = parseProject(p);
    expect(next.timeline[0]).toHaveProperty("amplification", "蒸发");
    s.damage.element = "冰";
    expect(normalizeAmplification(p).timeline[0]).toHaveProperty(
      "amplification",
      "融化",
    );
    for (const el of ["雷", "风", "草", "岩", "物理"] as const) {
      s.damage.element = el;
      expect(normalizeAmplification(p).timeline[0]).not.toHaveProperty(
        "amplification",
      );
      expect(calculateProject(p).rows[0].breakdown?.amplificationFactor).toBe(
        1,
      );
    }
    s.damage.element = "火";
    p.timeline.push({
      ...event,
      id: "unmarked",
      time: 6,
      amplification: undefined,
    });
    next = parseProject(p);
    expect(parseProject(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(
      next.timeline[1].kind === "skill" && next.timeline[1].amplification,
    ).toBeUndefined();
  });
});
