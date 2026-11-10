import { describe, expect, it } from "vitest";
import {
  calculateProject,
  defenseFactor,
  resistanceFactor,
} from "./damage-engine";
import { effect, skill, newProject, type Effect, type Project } from "./model";
import { parseProject, parsePreset } from "./storage";

function fixture() {
  const p = newProject(),
    c = p.characters[0];
  Object.assign(c, {
    name: "测试角色",
    atk: 1000,
    critRate: 50,
    critDamage: 100,
    bonus: 50,
    hp: 10000,
    def: 800,
    mastery: 400,
  });
  p.weapons[0].atk = 689; // 1000 + 689 + fixed feather311 = 2000 outside ATK.
  p.enemy.level = 90;
  const s = skill(c.id);
  s.name = "E";
  s.multiplier = 200;
  p.skills = [s];
  p.timeline = [{ id: "hit", time: 10, kind: "skill", skillId: s.id }];
  return p;
}
function buff(p: Project, patch: Partial<Effect>): Effect {
  return { ...effect(p.characters[0].id, true), ...patch };
}
const result = (p: Project) => calculateProject(p).rows[0];

describe("resistance, defense and ordinary direct damage", () => {
  it.each([
    [-0.2, 1.1],
    [0, 1],
    [0.1, 0.9],
    [0.75, 0.25],
    [1, 0.2],
  ])("resistance %s → %s", (r, f) =>
    expect(resistanceFactor(r)).toBeCloseTo(f, 12),
  );
  it("uses character level, independently caps reduction and ignore, and stays continuous", () => {
    expect(defenseFactor(90, 90)).toBe(0.5);
    expect(defenseFactor(95, 100)).toBeCloseTo(195 / 395);
    expect(defenseFactor(90, 90, 0.2, 0.3)).toBeCloseTo(1 / 1.56);
    expect(defenseFactor(90, 90, 2, 0)).toBeCloseTo(1 / 1.1);
    expect(defenseFactor(1, 100, 0, 1)).toBe(1);
    expect(resistanceFactor(0.75 - 1e-10)).toBeCloseTo(
      resistanceFactor(0.75 + 1e-10),
      8,
    );
  });
  it("reproduces the independent normal formula benchmark and aggregate DPS", () => {
    const p = fixture();
    p.globals = [buff(p, { type: "基础值加成", unit: "flat", value: 100 })];
    const r = result(p);
    expect(r.error).toBeUndefined();
    expect(r.breakdown?.scaling).toBe(2000);
    expect(r.nonCrit).toBe(2767.5);
    expect(r.crit).toBe(5535);
    expect(r.expected).toBe(4151.25);
    expect(calculateProject(p).dps).toBe(415.125);
  });
  it("adds ordinary bonus and vulnerability in one bracket, uses actual element resistance", () => {
    const p = fixture();
    p.globals = [
      buff(p, { type: "增伤区", value: 20 }),
      buff(p, { type: "易伤", value: 30 }),
      buff(p, { type: "减伤", value: 10 }),
      buff(p, { type: "敌方抗性", value: -40 }),
    ];
    expect(result(p).expected).toBeCloseTo(4000 * 1.9 * 1.15 * 0.5 * 1.5);
    p.skills[0].damage.element = "物理";
    p.characters[0].physicalBonus = 58.3;
    p.globals[3].damage.element = "火";
    expect(result(p).breakdown?.resistance).toBe(10);
    expect(result(p).breakdown?.ordinaryBonus).toBe(78.3);
  });
  it("filters damage buffs by every dimension once, validates units, and differentiates multiplier meanings", () => {
    const p = fixture(),
      hit = p.skills[0].damage;
    p.globals = [
      buff(p, {
        type: "倍率区",
        value: 20,
        multiplierMode: "add",
        damage: { ...hit },
      }),
      buff(p, { type: "倍率区", value: 20, multiplierMode: "scale" }),
      buff(p, {
        type: "增伤区",
        value: 999,
        damage: { ...hit, attack: "大招" },
      }),
      buff(p, {
        type: "增伤区",
        value: 999,
        damage: { ...hit, special: "月绽放" },
      }),
    ];
    const r = result(p);
    expect(r.breakdown?.multiplier).toBeCloseTo(2.64);
    expect(r.breakdown?.ordinaryBonus).toBe(50);
    expect(r.effects.filter((e) => e.status === "applied")).toHaveLength(2);
    p.globals[0].multiplierMode = "unconfirmed";
    expect(result(p).error).toContain("倍率");
    expect(calculateProject(p).total).toBeNull();
    p.globals[0].multiplierMode = "add";
    p.globals[0].unit = "flat";
    expect(result(p).error).toContain("百分比");
  });
  it.each(["生命值", "攻击力", "防御力", "元素精通"] as const)(
    "supports %s scaling and static reading modes",
    (scaling) => {
      const p = fixture();
      p.skills[0].damage.scaling = scaling;
      p.skills[0].scalingMode = "base";
      const expected = {
        生命值: 10000,
        攻击力: 1689,
        防御力: 800,
        元素精通: 400,
      }[scaling];
      expect(result(p).breakdown?.scaling).toBe(expected);
      p.skills[0].scalingMode = "outside";
      if (scaling === "攻击力") expect(result(p).breakdown?.scaling).toBe(2000);
    },
  );
  it("clamps crit probability but keeps raw stats, rejects negative crit damage and numeric overflow", () => {
    const p = fixture();
    p.characters[0].critRate = 150;
    expect(result(p).expected).toBe(result(p).crit);
    expect(result(p).breakdown?.critRate).toBe(150);
    p.characters[0].critRate = -10;
    expect(result(p).expected).toBe(result(p).nonCrit);
    p.characters[0].critDamage = -1;
    expect(result(p).error).toContain("暴击伤害");
    p.characters[0].critDamage = 100;
    p.skills[0].multiplier = Number.MAX_VALUE;
    expect(result(p).error).toBeDefined();
  });
});

describe("five astral direct damage families", () => {
  it.each([
    ["月感电", 3],
    ["月结晶", 1.6],
    ["月绽放", 1],
    ["星扩散", 1],
    ["星超导", 1.8],
  ] as const)(
    "computes %s with its independent coefficient",
    (special, coefficient) => {
      const p = fixture();
      p.skills[0].damage.special = special;
      if (p.timeline[0].kind === "skill") p.timeline[0].starStacks = 9;
      p.globals = [
        buff(p, { type: "星月基础提升", value: 20 }),
        buff(p, { type: "星月增伤", value: 30 }),
        buff(p, { type: "星月额外提升", unit: "flat", value: 500 }),
        buff(p, { type: "擢升", value: 10 }),
        buff(p, { type: "增伤区", value: 999 }),
        buff(p, { type: "降低防御", value: 90 }),
      ];
      const r = result(p);
      expect(r.error).toBeUndefined();
      expect(r.expected).toBeCloseTo(
        (coefficient * 2000 * 2 * 1.2 * 2.3 + 500) * 0.9 * 1.5 * 1.1,
        8,
      );
      expect(r.breakdown?.defenseFactor).toBe(1);
      expect(r.breakdown?.ordinaryBonus).toBe(0);
      if (special === "月感电") expect(r.expected).toBeCloseTo(49925.7, 8);
      p.enemy.level = 999;
      expect(result(p).expected).toBe(r.expected);
    },
  );
  it("matches astral buffs without amplifying extra flat damage by earlier factors", () => {
    const p = fixture();
    p.skills[0].damage.special = "月结晶";
    p.characters[0].mastery = 0;
    p.globals = [
      buff(p, { type: "星月基础提升", value: 20 }),
      buff(p, { type: "星月增伤", value: 30 }),
      buff(p, { type: "星月额外提升", unit: "flat", value: 500 }),
      buff(p, { type: "擢升", unit: "percent", value: 10 }),
    ];
    expect(result(p).expected).toBeCloseTo(
      (1.6 * 2000 * 2 * 1.2 * 1.3 + 500) * 0.9 * 1.5 * 1.1,
    );
    p.globals.push(buff(p, { type: "擢升", value: 5 }));
    expect(result(p).breakdown?.uplift).toBe(1.15);
    expect(result(p).expected).toBeCloseTo(
      (1.6 * 2000 * 2 * 1.2 * 1.3 + 500) * 0.9 * 1.5 * 1.15,
    );
  });
  it("takes star-superconduct coefficient from each timeline instance", () => {
    const p = fixture();
    p.skills[0].damage.special = "星超导";
    p.timeline = [
      {
        id: "first",
        time: 1,
        kind: "skill",
        skillId: p.skills[0].id,
        starStacks: 1,
      },
      {
        id: "second",
        time: 5,
        kind: "skill",
        skillId: p.skills[0].id,
        starStacks: 13,
      },
    ];
    const r = calculateProject(p).rows;
    expect(r[1].expected).toBe(2 * r[0].expected!);
    p.skills[0].damage.scaling = "生命值";
    expect(result(p).error).toContain("攻击力乘区");
  });
  it("does not generate reactions, and uses the manually configured damage element", () => {
    const p = fixture();
    p.skills[0].damage.special = "月感电";
    p.skills[0].damage.element = "水";
    p.enemy.resistance.水 = 75;
    const r = calculateProject(p);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].breakdown?.resistanceFactor).toBe(0.25);
    expect(r.rows[0].effects).toHaveLength(0);
  });
});

describe("per-event state, variables, migration and incomplete results", () => {
  it("honors same-time switches, expiration and effect targets before each hit", () => {
    const p = fixture(),
      s = p.skills[0],
      e = buff(p, {
        type: "攻击力",
        unit: "flat",
        value: 100,
        target: "foreground",
        duration: 3,
      });
    p.timeline = [
      { id: "effect", time: 1, kind: "effect", effect: e },
      { id: "before", time: 2, kind: "skill", skillId: s.id },
      {
        id: "switch",
        time: 2,
        kind: "switch",
        characterId: p.characters[1].id,
      },
      { id: "after", time: 2, kind: "skill", skillId: s.id },
      { id: "expired", time: 4, kind: "skill", skillId: s.id },
    ];
    const r = calculateProject(p);
    expect(r.rows.map((x) => x.breakdown?.scaling)).toEqual([2100, 2000, 2000]);
    expect(r.time).toBe(4);
  });
  it("uses variable formulas and transitive live stats but does not fail unrelated invalid effects", () => {
    const p = fixture();
    p.globals = [
      buff(p, {
        type: "增伤区",
        valueMode: "base",
        variableStat: "攻击力",
        advanced: true,
        formulas: [{ id: "f", condition: "x>1000", formula: "x/100" }],
      }),
      buff(p, {
        type: "元素精通",
        target: "self",
        valueMode: "live",
        variableStat: "元素精通",
      }),
    ];
    expect(result(p).error).toBeUndefined();
    expect(result(p).breakdown?.ordinaryBonus).toBeCloseTo(66.89);
    p.skills[0].damage.special = "月绽放";
    expect(result(p).error).toContain("循环");
    expect(calculateProject(p).total).toBeNull();
  });
  it("keeps zero duration DPS undefined and counts a final effect/switch as duration", () => {
    const p = fixture();
    p.timeline[0].time = 0;
    expect(calculateProject(p).dps).toBeNull();
    expect(calculateProject(p).total).toBeGreaterThan(0);
    p.timeline.push({
      id: "end",
      time: 20,
      kind: "switch",
      characterId: p.characters[0].id,
    });
    const r = calculateProject(p);
    expect(r.dps).toBe(r.total! / 20);
  });
  it("migrates legacy levels/notes, maps stars and does not guess ambiguous multipliers", () => {
    const raw = JSON.parse(JSON.stringify(fixture()));
    delete raw.characters[0].level;
    raw.characters[0].constellation = "95级2";
    delete raw.skills[0].scalingMode;
    delete raw.skills[0].astral;
    raw.globals = [buff(raw, { type: "倍率区" })];
    delete raw.globals[0].multiplierMode;
    const p = parseProject(raw);
    expect(p.characters[0]).toMatchObject({
      level: 95,
      stars: 1,
      constellation: "2",
    });
    expect(p.skills[0].scalingMode).toBe("live");
    expect(p.globals[0].multiplierMode).toBe("unconfirmed");
    expect(
      parsePreset({
        id: "p",
        kind: "character",
        name: "旧预设",
        data: raw.characters[0],
      }).data,
    ).toHaveProperty("level", 95);
    p.characters[0].level = 100;
    expect(parseProject(p).characters[0].stars).toBe(3);
    for (const level of [0, 91, 94, 96, 99, 101, 1.5])
      expect(() =>
        parseProject({
          ...p,
          characters: p.characters.map((c, i) => (i ? c : { ...c, level })),
        }),
      ).toThrow();
  });
});
