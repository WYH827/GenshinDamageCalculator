import { describe, expect, it } from "vitest";
import { calculateProject } from "./damage-engine";
import { effect, newProject, skill, type Effect, type Project } from "./model";
import { parseProject, parsePreset, parsePresets } from "./storage";
import { evaluateEffectValue } from "./formulas";

function fixture() {
  const p = newProject(),
    c = p.characters[0];
  Object.assign(c, {
    name: "A",
    atk: 1000,
    critRate: 0,
    critDamage: 0,
    mastery: 0,
  });
  p.weapons[0].atk = 689;
  const s = skill(c.id);
  s.name = "月感电E";
  s.damage.special = "月感电";
  s.multiplier = 100;
  p.skills = [s];
  p.timeline = [{ id: "hit", time: 3, kind: "skill", skillId: s.id }];
  return p;
}
function make(p: Project, patch: Partial<Effect>): Effect {
  return { ...effect(p.characters[0].id, true), ...patch };
}

describe("astral effects are summed from active sources", () => {
  it("sums flat, percentage, base/outside/live formula values from talent, weapon, artifact and global sources", () => {
    const p = fixture(),
      id = p.characters[0].id;
    p.talents = [
      {
        id: "t",
        name: "天赋",
        characterId: id,
        effects: [
          make(p, { global: true, type: "擢升", value: 10 }),
          make(p, { global: true, type: "星月基础提升", value: 10 }),
        ],
      },
    ];
    p.weapons[0].effects = [
      make(p, { global: true, type: "擢升", value: 5 }),
      make(p, { global: true, type: "星月基础提升", value: 5 }),
    ];
    p.artifacts[0].effects = [
      make(p, { global: true, type: "星月增伤", value: 20 }),
      make(p, { global: true, type: "星月额外提升", unit: "flat", value: 100 }),
    ];
    p.globals = [
      make(p, { type: "星月增伤", value: 30 }),
      make(p, { type: "星月额外提升", unit: "flat", value: 200 }),
    ];
    const r = calculateProject(p).rows[0];
    expect(r.breakdown).toMatchObject({
      baseBoost: 15,
      astralBonus: 50,
      astralExtra: 300,
      upliftPercent: 15,
      uplift: 1.15,
    });
    expect(r.expected).toBeCloseTo((3 * 2000 * 1.15 * 1.5 + 300) * 0.9 * 1.15);
    // Every variable mode still supplies an ordinary percent result.
    for (const mode of ["base", "outside", "live"] as const) {
      p.weapons[0].effects[0] = {
        ...p.weapons[0].effects[0],
        valueMode: mode,
        variableStat: "攻击力",
        advanced: true,
        formulas: [
          { id: "f", condition: "x>1000", formula: "5" },
          { id: "otherwise", condition: "", formula: "0" },
        ],
      };
      expect(calculateProject(p).rows[0].breakdown?.uplift).toBe(1.15);
    }
  });
  it("excludes expired, mismatched and off-field contributions instead of applying all effect values", () => {
    const p = fixture(),
      hit = p.skills[0];
    p.globals = [
      make(p, { type: "擢升", value: 10 }),

      make(p, {
        type: "擢升",
        value: 200,
        target: "custom",
        targetIds: [p.characters[1].id],
      }),
      make(p, {
        type: "擢升",
        value: 200,
        damage: { ...hit.damage, element: "水" },
      }),
    ];
    p.timeline.unshift({
      id: "expired",
      kind: "effect",
      time: 0,
      effect: make(p, { type: "擢升", value: 200, duration: 2 }),
    });
    p.timeline.unshift({
      id: "buff",
      time: 1,
      kind: "effect",
      effect: make(p, {
        type: "擢升",
        value: 5,
        duration: 3,
        target: "foreground",
      }),
    });
    expect(calculateProject(p).rows[0].breakdown?.uplift).toBe(1.15);
    p.timeline.unshift({
      id: "switch",
      time: 2,
      kind: "switch",
      characterId: p.characters[1].id,
    });
    expect(calculateProject(p).rows[0].breakdown?.uplift).toBe(1.1);
    p.skills[0].damage.special = "";
    expect(calculateProject(p).rows[0].breakdown?.uplift).toBe(1);
  });
  it("does not read obsolete skill-local fields even when present in memory", () => {
    const p = fixture();
    Object.assign(p.skills[0], {
      astral: {
        coefficient: 2,
        baseBoost: 999,
        bonus: 999,
        extra: 999,
        uplift: 999,
      },
    });
    expect(calculateProject(p).rows[0].expected).toBeCloseTo(3 * 2000 * 0.9);
    p.skills[0].damage.special = "星超导";
    expect(calculateProject(p).rows[0].breakdown?.astralCoefficient).toBe(1);
  });
});

describe("backward-compatible astral and uplift migration", () => {
  it("moves old skill bonuses to scoped global effects, fills event coefficients and is idempotent", () => {
    const raw = JSON.parse(JSON.stringify(fixture()));
    raw.skills[0].damage.special = "星超导";
    raw.skills[0].astral = {
      coefficient: 1.8,
      baseBoost: 20,
      bonus: 30,
      extra: 500,
      uplift: 1.1,
    };
    const second = {
      ...skill(raw.characters[0].id),
      name: "另一技能",
      damage: { ...raw.skills[0].damage },
    };
    raw.skills.push(second);
    raw.timeline.push(
      { id: "second", time: 4, kind: "skill", skillId: second.id },
      {
        id: "override",
        time: 5,
        kind: "skill",
        skillId: raw.skills[0].id,
        starCoefficient: 2,
      },
    );
    const p = parseProject(raw);
    expect(p.skills[0]).not.toHaveProperty("astral");
    expect(p.globals).toHaveLength(4);
    expect(p.globals.every((e) => e.skillFilter?.id === p.skills[0].id)).toBe(
      true,
    );
    expect(p.globals.find((e) => e.type === "擢升")).toMatchObject({
      value: 10,
      unit: "percent",
    });
    expect(p.timeline[0]).toHaveProperty("starStacks", 9);
    expect(p.timeline[2]).toHaveProperty("starStacks", 13);
    const r = calculateProject(p).rows;
    expect(r[0].expected).toBeCloseTo(
      (1.8 * 2000 * 1.2 * 1.3 + 500) * 0.9 * 1.1,
    );
    expect(r[1].breakdown).toMatchObject({
      baseBoost: 0,
      astralBonus: 0,
      astralExtra: 0,
      uplift: 1,
    });
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("migrates legacy multiplier effects in global, talent, weapon, artifact, skill and event scopes", () => {
    const p = fixture(),
      old = () => make(p, { type: "擢升", unit: "flat", value: 1.1 });
    p.globals = [old()];
    p.weapons[0].effects = [old()];
    p.artifacts[0].effects = [old()];
    p.skills[0].effects = [old()];
    p.talents = [
      { id: "t", name: "t", characterId: p.characters[0].id, effects: [old()] },
    ];
    p.timeline.push({ id: "e", kind: "effect", time: 0, effect: old() });
    const next = parseProject(p);
    const all = [
      ...next.globals,
      ...next.weapons[0].effects,
      ...next.artifacts[0].effects,
      ...next.skills[0].effects,
      ...next.talents[0].effects,
      ...(next.customEffects ?? []),
    ];
    expect(all).toHaveLength(6);
    expect(all.every((e) => e.value === 10 && e.unit === "percent")).toBe(true);
    const preset = {
      id: "p",
      kind: "weapon" as const,
      name: "p",
      data: p.weapons[0],
    };
    expect(parsePreset(preset).data).toHaveProperty("effects.0.value", 10);
    expect(parsePresets([preset])[0].data).toHaveProperty(
      "effects.0.unit",
      "percent",
    );
  });
  it("preserves variable and conditional multiplier expressions by converting their output to percentages", () => {
    const p = fixture();
    p.globals = [
      make(p, {
        type: "擢升",
        unit: "flat",
        valueMode: "outside",
        coefficient: 0.001,
      }),
      make(p, {
        type: "擢升",
        unit: "flat",
        valueMode: "live",
        advanced: true,
        formulas: [
          { id: "a", condition: "x>2000", formula: "1.15" },
          { id: "b", condition: "", formula: "1.05" },
        ],
      }),
    ];
    const next = parseProject(p);
    expect(evaluateEffectValue(next.globals[0], 1100)).toBeCloseTo(10);
    expect(evaluateEffectValue(next.globals[1], 2500)).toBeCloseTo(15);
    expect(evaluateEffectValue(next.globals[1], 500)).toBeCloseTo(5);
    expect(parseProject(next)).toEqual(next);
  });
});
