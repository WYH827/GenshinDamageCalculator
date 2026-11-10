import { describe, expect, it } from "vitest";
import { effect, newProject, skill, type Effect } from "./model";
import { createPanelResolver } from "./panels";
import { calculateProject } from "./damage-engine";
import { effectCatalog } from "./effect-catalog";
import { defaultTiming } from "./effect-catalog";
import { activeEffectsAt } from "./effect-state";
import { parseProject, parsePreset } from "./storage";

function fixture() {
  const p = newProject(),
    c = p.characters[0],
    s = skill(c.id);
  c.atk = 1000;
  c.mastery = 100;
  c.critRate = 0;
  p.weapons[0].atk = 689;
  p.enemy.level = 90;
  p.skills = [s];
  p.timeline = [{ id: "hit", kind: "skill", skillId: s.id, time: 10 }];
  const buff = (patch: Partial<Effect> = {}): Effect => ({
    ...effect(c.id),
    category: "global",
    outsideActive: true,
    target: "self",
    type: "攻击力",
    value: 20,
    ...patch,
  });
  return { p, c, s, buff };
}

describe("outside-enabled globals", () => {
  it("defaults off, counts flat and percentage globals once, and keeps base unchanged", () => {
    const { p, c, buff } = fixture();
    const e = buff({ outsideActive: false });
    p.weapons[0].effects = [e];
    let r = createPanelResolver(p, "hit");
    expect(r.resolve(c.id, "攻击力", "base")).toBe(1689);
    expect(r.resolve(c.id, "攻击力", "outside")).toBe(2000);
    expect(r.resolve(c.id, "攻击力", "live")).toBeCloseTo(2337.8);
    e.outsideActive = true;
    p.artifacts[0].effects = [buff({ unit: "flat", value: 100 })];
    r = createPanelResolver(p, "hit");
    expect(r.resolve(c.id, "攻击力", "base")).toBe(1689);
    expect(r.resolve(c.id, "攻击力", "outside")).toBeCloseTo(2437.8);
    expect(r.resolve(c.id, "攻击力", "live")).toBeCloseTo(2437.8);
    expect(effect(c.id).outsideActive).toBe(false);
  });

  it("resolves cross-character variable formulas in their context without leaking realtime buffs outside", () => {
    const { p, c, s, buff } = fixture();
    const teammate = p.characters[1];
    const convert = buff({
      type: "元素精通",
      target: "custom",
      targetIds: [teammate.id],
      valueMode: "live",
      variableStat: "攻击力",
      advanced: true,
      formulas: [
        {
          id: "rule",
          condition: "x > 2000",
          formula: "min((x-2000)/100*8,160)",
        },
      ],
    });
    p.weapons[0].effects = [buff({ value: 100, unit: "flat" }), convert];
    p.globals = [
      buff({ outsideActive: false, value: 200, unit: "flat", target: "team" }),
    ];
    p.timeline.unshift({
      id: "buff",
      kind: "effect",
      time: 0,
      effect: buff({
        category: "realtime",
        global: false,
        value: 500,
        unit: "flat",
        duration: null,
      }),
    });
    p.timeline.push({ id: "later", kind: "skill", skillId: s.id, time: 11 });
    const r = createPanelResolver(p, "hit");
    expect(r.resolve(c.id, "攻击力", "outside")).toBe(2100);
    expect(r.resolve(c.id, "攻击力", "live")).toBe(2800);
    expect(r.resolve(teammate.id, "元素精通", "outside")).toBe(8);
    expect(r.resolve(teammate.id, "元素精通", "live")).toBe(64);
    convert.valueMode = "outside";
    expect(
      createPanelResolver(p, "hit").resolve(teammate.id, "元素精通", "live"),
    ).toBe(8);
  });

  it("uses only checked globals of all sources, regardless of hidden layer and duration presets", () => {
    const { p, c, buff } = fixture();
    const b = () => buff({ value: 10, unit: "flat", duration: 0 });
    p.weapons[0].effects = [b()];
    p.artifacts[0].effects = [b()];
    p.talents = [
      { id: "talent", name: "T", characterId: c.id, effects: [b()] },
    ];
    p.skills.push({ ...skill(c.id), kind: "effect", effects: [b()] });
    p.globals = [b()];
    p.customEffects = [b(), buff({ category: "realtime", value: 500 })];
    expect(
      createPanelResolver(p, "hit").resolve(c.id, "攻击力", "outside"),
    ).toBe(2060);
  });

  it("keeps outside foreground at the initial character while live foreground follows switches", () => {
    const { p, c, buff } = fixture();
    p.weapons[0].effects = [
      buff({ target: "foreground", unit: "flat", value: 100 }),
    ];
    p.timeline.unshift({
      id: "switch",
      kind: "switch",
      time: 0,
      characterId: p.characters[1].id,
    });
    const r = createPanelResolver(p, "hit");
    expect(r.resolve(c.id, "攻击力", "outside")).toBe(2100);
    expect(r.resolve(c.id, "攻击力", "live")).toBe(2000);
    expect(r.resolve(p.characters[1].id, "攻击力", "live")).toBe(411);
  });

  it("reports outside cycles without recursion or contaminating base and unrelated stats", () => {
    const { p, c, buff } = fixture();
    p.weapons[0].effects = [
      buff({ valueMode: "outside", variableStat: "攻击力" }),
    ];
    const r = createPanelResolver(p, "hit");
    expect(() => r.resolve(c.id, "攻击力", "outside")).toThrow("循环引用");
    expect(r.resolve(c.id, "攻击力", "base")).toBe(1689);
    expect(r.resolve(c.id, "元素精通", "outside")).toBe(100);
  });

  it("uses the enriched outside panel in damage scaling and effect variables", () => {
    const { p, s, buff } = fixture();
    s.scalingMode = "outside";
    p.weapons[0].effects = [
      buff({ value: 100, unit: "flat" }),
      buff({
        type: "增伤区",
        valueMode: "outside",
        variableStat: "攻击力",
        coefficient: 0.01,
      }),
    ];
    const r = calculateProject(p).rows[0];
    expect(r.error).toBeUndefined();
    expect(r.breakdown?.scaling).toBe(2100);
    expect(r.breakdown?.ordinaryBonus).toBe(21);
    expect(r.expected).toBeCloseTo(2100 * 1.21 * 0.9 * 0.5);
  });

  it("persists the option in projects and weapon presets and migrates missing fields off", () => {
    const { p, buff } = fixture();
    const old = buff();
    delete old.outsideActive;
    p.weapons[0].effects = [buff(), old];
    const restored = parseProject(JSON.parse(JSON.stringify(p)));
    expect(restored.weapons[0].effects.map((e) => e.outsideActive)).toEqual([
      true,
      false,
    ]);
    const preset = parsePreset({
      id: "preset",
      name: "weapon",
      kind: "weapon",
      data: p.weapons[0],
    });
    expect(
      preset.kind === "weapon" && preset.data.effects[0].outsideActive,
    ).toBe(true);
  });
});

describe("non-damaging skills", () => {
  it("keeps explicit effects and counts their events in duration", () => {
    const { p, c, buff } = fixture();
    const e = buff({ category: "realtime" });
    const note = { ...skill(c.id), kind: "empty" as const, effects: [e] };
    p.skills.push(note);
    p.timeline.unshift({
      id: "trigger",
      kind: "effectTrigger",
      time: 0,
      effectKey: `skill-${note.id}-${e.id}`,
      timing: defaultTiming(e),
    });
    p.timeline.push({
      id: "late-trigger",
      kind: "effectTrigger",
      time: 100,
      effectKey: `skill-${note.id}-${e.id}`,
      timing: defaultTiming(e),
    });
    const next = parseProject(JSON.parse(JSON.stringify(p)));
    expect(calculateProject(next)).toMatchObject({
      failed: 0,
      total: 900,
      time: 100,
      dps: 9,
    });
    expect(activeEffectsAt(next, "hit")).toHaveLength(0);
  });
  it("does not deal damage but counts duration and allows effects", () => {
    const { p, c, buff } = fixture();
    const before = calculateProject(p);
    const note = {
      ...skill(c.id),
      kind: "empty" as const,
      name: "等待动画",
      effects: [buff()],
    };
    p.skills.push(note);
    p.timeline.unshift({
      id: "note0",
      kind: "skill",
      skillId: note.id,
      time: 0,
      amplification: "融化",
    });
    p.timeline.push({
      id: "note100",
      kind: "skill",
      skillId: note.id,
      time: 100,
    });
    const next = parseProject(JSON.parse(JSON.stringify(p)));
    const after = calculateProject(next);
    expect(after.total).toBeGreaterThan(before.total);
    expect(after.dps).toBeCloseTo(after.total / 100);
    expect(after.time).toBe(100);
    expect(after.rows).toHaveLength(1);
    expect(effectCatalog(next)).toHaveLength(1);
    expect(activeEffectsAt(next, "hit")).toHaveLength(1);
    expect(next.timeline[0]).not.toHaveProperty("amplification");
    expect(next.skills[1].name).toBe("等待动画");
    next.skills = [next.skills[1]];
    next.timeline = next.timeline.filter((e) => e.id !== "hit");
    expect(calculateProject(next)).toMatchObject({
      time: 100,
      dps: 0,
      total: 0,
      rows: [],
    });
  });
});
