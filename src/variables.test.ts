import { describe, expect, it } from "vitest";
import {
  evaluateFormula,
  evaluateCondition,
  evaluateRules,
  rulesError,
  evaluateEffectValue,
} from "./formulas";
import { activeEffectsAt, globalEffects } from "./effect-state";
import { staticPanels, createPanelResolver } from "./panels";
import { newProject, effect, skill, deleteTalent } from "./model";
import { parseProject } from "./storage";

describe("conditional arithmetic", () => {
  it.each([
    ["(x - 2000) * 0.04", 2500, 20],
    ["min(x * 0.1, 100)", 2500, 100],
    ["max(0, x - 2000)", 1500, 0],
    ["2^3^2", 0, 512],
    ["-x^2", 3, -9],
    ["sqrt(abs(-x)) + floor(1.9) + ceil(1.1) + round(1.5)", 9, 8],
    ["1e-2 * x", 2000, 20],
    ["（x－2000）×0.04", 2500, 20],
  ])("evaluates %s", (f, x, answer) =>
    expect(evaluateFormula(f, x)).toBe(answer),
  );
  it("uses first match, boundary comparisons, compound conditions and a fallback", () => {
    const rules = [
      { id: "high", condition: "x＞2000", formula: "(x-2000)*0.04" },
      { id: "mid", condition: "x >= 1000 && x <= 2000", formula: "10" },
      { id: "fallback", condition: "", formula: "0" },
    ];
    expect(evaluateRules(rules, 2500)).toEqual({ value: 20, ruleId: "high" });
    expect(evaluateRules(rules, 2000).value).toBe(10);
    expect(evaluateRules(rules, 500).value).toBe(0);
    expect(evaluateCondition("x ≥ 2 或 x = 1", 1)).toBe(true);
    expect(evaluateCondition("!(x > 2)", 1)).toBe(true);
  });
  it.each([
    "window.alert(1)",
    "x.constructor",
    "globalThis",
    "[1,2]",
    "x; 1",
    "Math.max(x,2)",
    "2x",
    "x ? 1 : 2",
    "1 / 0",
    "sqrt(-1)",
    "10 ^ 999",
  ])("rejects invalid expressions %s", (f) =>
    expect(() => evaluateFormula(f, 1)).toThrow(),
  );
  it("reports bad rule structures, nonboolean conditions and missing matches", () => {
    expect(
      rulesError([
        { id: "a", condition: "", formula: "x" },
        { id: "b", condition: "x>1", formula: "2" },
      ]),
    ).toContain("最后");
    expect(rulesError([{ id: "a", condition: "x+1", formula: "1" }])).toContain(
      "比较",
    );
    expect(() =>
      evaluateRules([{ id: "a", condition: "x>2000", formula: "x" }], 1),
    ).toThrow("未匹配");
    expect(() => evaluateCondition("sqrt(-1) > 0", 1)).toThrow();
  });
  it("advanced formulas replace rather than multiply the simple coefficient", () => {
    const e = {
      ...effect("c"),
      valueMode: "base" as const,
      coefficient: 100,
      advanced: true,
      formulas: [{ id: "a", condition: "", formula: "x/100" }],
    };
    expect(evaluateEffectValue(e, 2000)).toBe(20);
  });
});

describe("automatic and triggered effects", () => {
  it("globally enables marked artifact/talent effects once, and refreshes non-global effects", () => {
    const p = newProject(),
      id = p.characters[0].id,
      hit = skill(id);
    p.skills = [hit];
    p.artifacts[0].effects = [
      { ...effect(id), name: "global artifact", global: true, duration: 1 },
      { ...effect(id), name: "temporary artifact", duration: 5 },
    ];
    p.talents = [
      {
        id: "talent",
        name: "Talent",
        characterId: id,
        effects: [
          { ...effect(id), name: "global talent", global: true, duration: 0 },
          { ...effect(id), name: "temporary talent", duration: 3 },
        ],
      },
    ];
    p.timeline = [
      { id: "hit0", kind: "skill", time: 0, skillId: hit.id },
      {
        id: "a1",
        kind: "trigger",
        time: 1,
        sourceKind: "artifact",
        sourceId: p.artifacts[0].id,
      },
      {
        id: "a2",
        kind: "trigger",
        time: 3,
        sourceKind: "artifact",
        sourceId: p.artifacts[0].id,
      },
      {
        id: "t1",
        kind: "trigger",
        time: 3,
        sourceKind: "talent",
        sourceId: "talent",
      },
      { id: "hit5", kind: "skill", time: 5, skillId: hit.id },
      { id: "hit6", kind: "skill", time: 6, skillId: hit.id },
      { id: "hit8", kind: "skill", time: 8, skillId: hit.id },
    ];
    expect(globalEffects(p)).toHaveLength(2);
    expect(activeEffectsAt(p, "hit0")).toHaveLength(2);
    const at5 = activeEffectsAt(p, "hit5");
    expect(at5).toHaveLength(4);
    expect(
      at5.filter((x) => x.effect.name === "temporary artifact"),
    ).toHaveLength(1);
    expect(at5.find((x) => x.effect.name === "temporary artifact")?.start).toBe(
      3,
    );
    expect(
      at5.find((x) => x.effect.name === "global artifact")?.effect.duration,
    ).toBeNull();
    expect(activeEffectsAt(p, "hit6")).toHaveLength(3);
    expect(activeEffectsAt(p, "hit8")).toHaveLength(2);
    expect(deleteTalent(p, "talent").timeline.some((e) => e.id === "t1")).toBe(
      false,
    );
    p.artifacts[0].effects[0].global = false;
    expect(globalEffects(p)).toHaveLength(1);
    expect(activeEffectsAt(p, "hit0")).toHaveLength(1);
  });
  it("migrates previous variables to live and preserves invalid draft formulas without executing them", () => {
    const raw = JSON.parse(JSON.stringify(newProject()));
    delete raw.talents;
    delete raw.enemy;
    const e = effect(raw.characters[0].id);
    raw.globals = [{ ...e, valueMode: "variable" }];
    delete raw.globals[0].advanced;
    delete raw.globals[0].formulas;
    delete raw.globals[0].global;
    const p = parseProject(raw);
    expect(p.globals[0].valueMode).toBe("live");
    expect(p.enemy.level).toBe(100);
    expect(Object.values(p.enemy.resistance)).toEqual(Array(8).fill(10));
    expect(p.talents).toEqual([]);
    p.globals[0].advanced = true;
    p.globals[0].formulas = [{ id: "draft", condition: "x>", formula: "(" }];
    expect(parseProject(p).globals[0].formulas[0].formula).toBe("(");
    expect(() =>
      parseProject({ ...p, enemy: { ...p.enemy, level: -1 } }),
    ).toThrow();
    expect(() =>
      parseProject({
        ...p,
        timeline: [
          {
            id: "bad",
            kind: "trigger",
            time: 0,
            sourceKind: "talent",
            sourceId: "missing",
          },
        ],
      }),
    ).toThrow();
  });
});

describe("base, outside and live variable inputs", () => {
  function fixture() {
    const p = newProject(),
      c = p.characters[0];
    c.atk = 300;
    c.hp = 10000;
    c.mastery = 100;
    p.weapons[0].atk = 600;
    p.weapons[0].substats = [
      { id: "w", type: "atkPercent", mode: "direct", value: 20 },
    ];
    p.artifacts[0].mainStats.sands = "atkPercent";
    p.artifacts[0].substats = [
      { id: "s", type: "atk", mode: "direct", value: 50 },
    ];
    const hit = skill(c.id);
    p.skills = [hit];
    p.timeline = [{ id: "hit", kind: "skill", time: 5, skillId: hit.id }];
    return p;
  }
  it("only includes equipment main/substats outside, and effects only live", () => {
    const p = fixture(),
      id = p.characters[0].id;
    p.globals = [
      {
        ...effect(id, true),
        target: "self",
        type: "攻击力",
        unit: "percent",
        value: 20,
      },
      {
        ...effect(id, true),
        target: "self",
        type: "攻击力",
        unit: "flat",
        value: 200,
      },
    ];
    const { base, outside } = staticPanels(p, id);
    expect(base["攻击力"]).toBe(900);
    expect(base["生命值"]).toBe(10000);
    expect(outside["攻击力"]).toBeCloseTo(900 * 1.666 + 311 + 50);
    expect(outside["生命值"]).toBe(14780);
    const r = createPanelResolver(p, "hit");
    expect(r.resolve(id, "攻击力", "live")).toBeCloseTo(
      outside["攻击力"] + 180 + 200,
    );
    expect(r.resolve(id, "攻击力", "base")).toBe(900);
    expect(r.resolve(id, "攻击力", "outside")).toBe(outside["攻击力"]);
  });
  it("evaluates live dependencies by attribute and supplies conditional x values", () => {
    const p = fixture(),
      [c, d] = p.characters;
    p.globals = [
      {
        ...effect(c.id, true),
        type: "元素精通",
        unit: "flat",
        value: 300,
        target: "self",
      },
      {
        ...effect(d.id, true),
        type: "暴击率",
        unit: "percent",
        target: "self",
        valueMode: "live",
        variableCharacterId: c.id,
        variableStat: "元素精通",
        advanced: true,
        formulas: [
          { id: "high", condition: "x>200", formula: "x/10" },
          { id: "fallback", condition: "", formula: "0" },
        ],
      },
    ];
    const r = createPanelResolver(p, "hit");
    expect(r.resolve(d.id, "暴击率", "live")).toBe(45);
    expect(r.trace(p.globals[1])).toMatchObject({ value: 40, x: 400 });
  });
  it("detects cyclic real-time references without recursive overflow", () => {
    const p = fixture(),
      id = p.characters[0].id;
    p.globals = [
      {
        ...effect(id, true),
        target: "self",
        type: "攻击力",
        valueMode: "live",
        variableCharacterId: id,
        variableStat: "攻击力",
      },
    ];
    const r = createPanelResolver(p, "hit");
    expect(r.trace(p.globals[0]).error).toContain("循环");
    expect(r.resolve(id, "攻击力", "base")).toBe(900);
  });
});
