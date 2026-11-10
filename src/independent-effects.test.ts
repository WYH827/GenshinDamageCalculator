import { describe, it, expect } from "vitest";
import { effect, skill, newProject, type Effect, SPECIALS } from "./model";
import { calculateProject } from "./damage-engine";
import { parseProject, parsePreset } from "./storage";
import { defaultTiming, effectCatalog } from "./effect-catalog";
import { createPanelResolver } from "./panels";

function fixture() {
  const p = newProject(),
    c = p.characters[0],
    s = skill(c.id);
  Object.assign(c, { atk: 1000, mastery: 400, critRate: 50, critDamage: 100 });
  p.weapons[0].atk = 689;
  p.enemy.level = 90;
  p.skills = [s];
  p.timeline = [{ id: "hit", kind: "skill", skillId: s.id, time: 10 }];
  const buff = (patch: Partial<Effect>): Effect => ({
    ...effect(c.id),
    category: "global",
    ...patch,
  });
  return { p, c, s, buff };
}

describe("independent multiplier and shared additive damage", () => {
  it.each(["", ...SPECIALS] as const)(
    "multiplies all outcomes once for %s",
    (special) => {
      const { p, s, buff } = fixture();
      s.damage.special = special;
      const baseline = calculateProject(p).rows[0];
      p.globals = [
        buff({ type: "独立乘区", value: 1.2, unit: "flat" }),
        buff({ type: "独立乘区", value: 1.3, unit: "flat" }),
      ];
      const r = calculateProject(p).rows[0];
      expect(r.error).toBeUndefined();
      expect(r.breakdown?.independentFactors).toEqual([1.2, 1.3]);
      expect(r.nonCrit).toBeCloseTo(baseline.nonCrit! * 1.56);
      expect(r.crit).toBeCloseTo(baseline.crit! * 1.56);
      expect(r.expected).toBeCloseTo(baseline.expected! * 1.56);
      expect(calculateProject(p).dps).toBeCloseTo(
        (baseline.expected! * 1.56) / 10,
      );
    },
  );

  it("uses the live formula result as a factor and applies element/target restrictions", () => {
    const { p, c, buff } = fixture();
    p.globals = [
      buff({ type: "元素精通", value: 100, unit: "flat" }),
      buff({
        type: "独立乘区",
        valueMode: "live",
        variableStat: "元素精通",
        advanced: true,
        formulas: [{ id: "f", condition: "", formula: "1+x/1000" }],
      }),
      buff({
        type: "独立乘区",
        value: 999,
        target: "custom",
        targetIds: [p.characters[1].id],
      }),
      buff({
        type: "独立乘区",
        value: 999,
        damage: { ...effect(c.id).damage, element: "冰" },
      }),
    ];
    const r = calculateProject(p).rows[0];
    expect(r.error).toBeUndefined();
    expect(r.breakdown?.independentFactors).toEqual([1.5]);
    expect(r.effects.filter((e) => e.status === "excluded")).toHaveLength(2);
  });

  it("multiplies per layer and stops when realtime duration ends", () => {
    const { p, s, buff } = fixture();
    const e = buff({
      type: "独立乘区",
      category: "realtime",
      realtimeKind: "stacking",
      value: 1.2,
    });
    p.customEffects = [e];
    p.timeline = [
      {
        id: "trigger",
        kind: "effectTrigger",
        effectKey: `custom-${e.id}`,
        time: 0,
        timing: {
          ...defaultTiming(e),
          count: 3,
          limit: "capped",
          max: 5,
          duration: 2,
        },
      },
      { id: "hit", kind: "skill", skillId: s.id, time: 1 },
      { id: "expired", kind: "skill", skillId: s.id, time: 2 },
    ];
    const rows = calculateProject(p).rows;
    expect(rows[0].error).toBeUndefined();
    expect(rows[0].breakdown?.independentFactor).toBeCloseTo(1.2 ** 3);
    expect(rows[1].breakdown?.independentFactor).toBe(1);
    expect(rows[0].expected).toBeCloseTo(rows[1].expected! * 1.2 ** 3);
  });

  it.each(["", ...SPECIALS] as const)(
    "adds merged fixed damage in the correct position for %s",
    (special) => {
      const { p, s, buff } = fixture();
      s.damage.special = special;
      p.globals = [
        buff({ type: "增伤区", value: 40 }),
        buff({ type: "星月基础提升", value: 20 }),
        buff({ type: "星月增伤", value: 30 }),
        buff({ type: "擢升", value: 10 }),
        buff({ type: "独立乘区", value: 1.2 }),
      ];
      const before = calculateProject(p).rows[0];
      p.globals.push(buff({ type: "基础值加成", unit: "flat", value: 100 }));
      const after = calculateProject(p).rows[0];
      expect(after.error).toBeUndefined();
      expect(after.breakdown?.baseAdd).toBe(100);
      const increment = special
        ? 100 * 0.9 * 1.1 * 1.2
        : 100 * 1.4 * 0.9 * 0.5 * 1.2;
      expect(after.nonCrit! - before.nonCrit!).toBeCloseTo(increment);
      expect(after.expected! - before.expected!).toBeCloseTo(increment * 1.5);
    },
  );

  it("amplifies the merged addition, then multiplies the independent factor", () => {
    const { p, buff } = fixture();
    p.timeline[0] = {
      ...p.timeline[0],
      kind: "skill",
      skillId: p.skills[0].id,
      amplification: "蒸发",
    };
    p.globals = [
      buff({ type: "基础值加成", value: 100, unit: "flat" }),
      buff({ type: "独立乘区", value: 1.2 }),
    ];
    const r = calculateProject(p).rows[0];
    expect(r.error).toBeUndefined();
    expect(r.nonCrit).toBeCloseTo(
      2100 * 0.9 * 0.5 * (1.5 * (1 + (2.78 * 400) / 1800)) * 1.2,
    );
  });

  it("accepts zero factors and rejects negatives, including even numbers of layers", () => {
    const { p, buff } = fixture();
    const e = buff({ type: "独立乘区", value: 0 });
    p.globals = [e];
    expect(calculateProject(p).total).toBe(0);
    e.value = -1;
    expect(calculateProject(p).rows[0].error).toContain("不能为负数");
    expect(createPanelResolver(p, "hit").trace(e, 2).error).toContain(
      "不能为负数",
    );
  });

  it("normalizes old additive effects and new labels consistently across project/preset reloads", () => {
    const { p, buff } = fixture();
    p.weapons[0].effects = [
      buff({ type: "星月额外提升", value: 100, unit: "flat" }),
    ];
    const raw = JSON.parse(JSON.stringify(p));
    raw.globals = [
      buff({ type: "增伤区", value: 20 }),
      buff({ type: "倍率区", value: 10 }),
    ];
    raw.globals[0].type = "基础增伤";
    raw.globals[1].type = "改变倍率";
    const restored = parseProject(raw);
    expect(restored.weapons[0].effects[0].type).toBe("基础值加成");
    expect(restored.globals.map((e) => e.type)).toEqual(["增伤区", "倍率区"]);
    expect(parseProject(JSON.parse(JSON.stringify(restored)))).toEqual(
      restored,
    );
    const preset = parsePreset({
      id: "p",
      name: "W",
      kind: "weapon",
      data: p.weapons[0],
    });
    expect(preset.kind === "weapon" && preset.data.effects[0].type).toBe(
      "基础值加成",
    );
  });

  it("allows unowned custom effects, preserves variable owner, and makes self impossible", () => {
    const { p, c, buff } = fixture();
    p.customEffects = [
      buff({ sourceId: "", target: "self", type: "独立乘区", value: 1.2 }),
    ];
    const next = parseProject(JSON.parse(JSON.stringify(p)));
    expect(next.customEffects![0]).toMatchObject({
      sourceId: "",
      target: "team",
      variableCharacterId: c.id,
    });
    expect(effectCatalog(next)[0].source).toBe("无对象 · 独立效果");
    expect(calculateProject(next).rows[0].breakdown?.independentFactor).toBe(
      1.2,
    );
    expect(parseProject(JSON.parse(JSON.stringify(next)))).toEqual(next);
  });
});
