import { describe, expect, it } from "vitest";
import {
  newProject,
  effect,
  skill,
  starSuperconduct,
  effectUnit,
  type Effect,
} from "./model";
import { staticPanels, createPanelResolver } from "./panels";
import { calculateProject } from "./damage-engine";
import { parseProject, parsePreset } from "./storage";

describe("absolute outputs for attribute variables", () => {
  it.each(["生命值", "攻击力", "防御力", "元素精通"] as const)(
    "%s variables add the result directly in every mode and advanced formulas",
    (stat) => {
      for (const mode of ["base", "outside", "live"] as const)
        for (const advanced of [false, true]) {
          const p = newProject(),
            c = p.characters[0];
          Object.assign(c, { atk: 1000, hp: 12000, def: 800, mastery: 300 });
          const s = skill(c.id);
          p.skills = [s];
          p.timeline = [{ id: "hit", kind: "skill", skillId: s.id, time: 1 }];
          const e: Effect = {
            ...effect(c.id, true),
            type: stat,
            target: "self",
            valueMode: mode,
            unit: "percent",
            variableCharacterId: p.characters[1].id,
            variableStat: "攻击力",
            coefficient: 0.1,
            advanced,
            formulas: [{ id: "f", condition: "", formula: "x*0.1" }],
          };
          p.characters[1].atk = 2000;
          p.globals = [e];
          const source = staticPanels(p, p.characters[1].id)[
            mode === "base" ? "base" : "outside"
          ]["攻击力"];
          expect(
            createPanelResolver(p, "hit").resolve(c.id, stat, "live"),
          ).toBeCloseTo(staticPanels(p, c.id).outside[stat] + source * 0.1);
          expect(effectUnit(e)).toBe("flat");
          expect(parseProject(p).globals[0].unit).toBe("flat");
        }
    },
  );
  it("preserves literal percent buffs and percent-valued crit/bonus variables", () => {
    const p = newProject();
    const e = effect(p.characters[0].id);
    expect(
      effectUnit({
        ...e,
        type: "攻击力",
        valueMode: "number",
        unit: "percent",
      }),
    ).toBe("percent");
    expect(
      effectUnit({ ...e, type: "暴击率", valueMode: "base", unit: "percent" }),
    ).toBe("percent");
    p.weapons[0].effects = [
      { ...e, type: "生命值", valueMode: "base", unit: "percent" },
    ];
    expect(
      parsePreset({ id: "p", name: "p", kind: "weapon", data: p.weapons[0] })
        .data,
    ).toHaveProperty("effects.0.unit", "flat");
  });
});

describe("star superconduct stacks from the supplied table", () => {
  it.each([
    [0, 20, 1],
    [1, 29, 1.45],
    [2, 30, 1.5],
    [3, 31, 1.55],
    [4, 32, 1.6],
    [5, 33, 1.65],
    [6, 34, 1.7],
    [7, 35, 1.75],
    [8, 36, 1.8],
    [9, 37, 1.85],
    [10, 38, 1.9],
    [11, 39, 1.95],
    [12, 40, 2],
  ])("maps %s stacks to %s%% and %s", (stacks, bonus, coefficient) =>
    expect(starSuperconduct(stacks + 1)).toEqual({
      stacks: stacks + 1,
      energy: stacks,
      bonus,
      coefficient,
    }),
  );
  it("only applies the normal cryo/electro bonus to the selected event and keeps astral multiplication separate", () => {
    const p = newProject(),
      c = p.characters[0];
    c.atk = 1000;
    c.critRate = 0;
    c.critDamage = 0;
    p.enemy.level = 90;
    const s = skill(c.id);
    s.damage.element = "冰";
    p.skills = [s];
    p.timeline = [
      { id: "none", kind: "skill", skillId: s.id, time: 1 },
      { id: "zero", kind: "skill", skillId: s.id, time: 2, starStacks: 1 },
      { id: "full", kind: "skill", skillId: s.id, time: 3, starStacks: 13 },
      { id: "after", kind: "skill", skillId: s.id, time: 4 },
    ];
    let rows = calculateProject(p).rows;
    expect(rows[1].expected).toBeCloseTo(rows[0].expected! * 1.2);
    expect(rows[2].expected).toBeCloseTo(rows[0].expected! * 1.4);
    expect(rows[3].expected).toBe(rows[0].expected);
    s.damage.element = "火";
    rows = calculateProject(p).rows;
    expect(rows[2].expected).toBe(rows[0].expected);
    s.damage.element = "雷";
    s.damage.special = "星超导";
    rows = calculateProject(p).rows;
    expect(rows[2].expected).toBe(rows[0].expected! * 2);
    expect(rows[2].breakdown?.starElementBonus).toBe(0);
  });
  it("migrates exact coefficients, keeps unknown values actionable, and rejects invalid stack counts", () => {
    const p = newProject(),
      s = skill(p.characters[0].id);
    s.damage.special = "星超导";
    p.skills = [s];
    const raw = JSON.parse(JSON.stringify(p));
    raw.timeline = [
      {
        id: "exact",
        kind: "skill",
        skillId: s.id,
        time: 1,
        starCoefficient: 1.8,
      },
      {
        id: "unknown",
        kind: "skill",
        skillId: s.id,
        time: 2,
        starCoefficient: 1.7 + 0.01,
      },
    ];
    const migrated = parseProject(raw);
    expect(migrated.timeline[0]).toHaveProperty("starStacks", 9);
    expect(migrated.timeline[0]).not.toHaveProperty("starCoefficient");
    expect(calculateProject(migrated).rows[1].error).toContain("无法对应");
    expect(parseProject(migrated)).toEqual(migrated);
    for (const stacks of [-1, 0, 1.5, 14])
      expect(() => starSuperconduct(stacks)).toThrow();
  });
});

it("charged attacks only match charged-specific damage effects", () => {
  const p = newProject(),
    c = p.characters[0];
  c.atk = 1000;
  c.critRate = 0;
  const normal = skill(c.id),
    charged = skill(c.id);
  normal.damage.attack = "普攻";
  charged.damage.attack = "重击";
  p.skills = [normal, charged];
  p.timeline = [
    { id: "n", kind: "skill", time: 1, skillId: normal.id },
    { id: "c", kind: "skill", time: 2, skillId: charged.id },
  ];
  p.globals = [
    {
      ...effect(c.id, true),
      type: "增伤区",
      value: 50,
      damage: { ...effect(c.id).damage, attack: "重击" },
    },
  ];
  const rows = calculateProject(p).rows;
  expect(rows[1].expected).toBeCloseTo(rows[0].expected! * 1.5);
  expect(parseProject(p).skills[1].damage.attack).toBe("重击");
});
