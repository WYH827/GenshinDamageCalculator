import { describe, expect, it } from "vitest";
import { calculateProject } from "./damage-engine";
import { createPanelResolver } from "./panels";
import { effect, newProject, skill, type TimelineEvent } from "./model";

function fixture() {
  const p = newProject(),
    [source, attacker] = p.characters;
  source.mastery = 100;
  Object.assign(attacker, { atk: 1689, critRate: 50, critDamage: 100 });
  p.enemy.level = 90;
  const hit = skill(attacker.id);
  p.skills = [hit];
  const at = (time: number): TimelineEvent => ({
    id: `hit-${time}`,
    kind: "skill",
    time,
    skillId: hit.id,
  });
  const temporary = {
    ...effect(source.id),
    name: "临时精通",
    target: "self" as const,
    type: "元素精通" as const,
    unit: "flat" as const,
    value: 300,
    duration: 3,
  };
  const global = {
    ...effect(source.id, true),
    name: "精通转增伤",
    target: "custom" as const,
    targetIds: [attacker.id],
    type: "增伤区" as const,
    valueMode: "live" as const,
    variableStat: "元素精通",
    coefficient: 0.1,
  };
  p.globals = [global];
  // Deliberately unsorted: future buffs must not leak into earlier hits.
  p.timeline = [
    at(5),
    at(0),
    at(3),
    { id: "temporary", kind: "effect", time: 2, effect: temporary },
    at(1),
  ];
  return { p, source, attacker, global, temporary };
}

describe("global effects read live variables at each damage event", () => {
  it.each(["global", "weapon", "artifact", "talent"] as const)(
    "%s effects follow a teammate's buff and its expiration instead of snapshotting at zero",
    (kind) => {
      const { p, source, global } = fixture();
      if (kind !== "global") {
        p.globals = [];
        const effects = [{ ...global, global: true, duration: 1 }];
        if (kind === "weapon") p.weapons[0].effects = effects;
        else if (kind === "artifact") p.artifacts[0].effects = effects;
        else
          p.talents = [
            { id: "talent", name: "天赋", characterId: source.id, effects },
          ];
      }
      const result = calculateProject(p);
      expect(result.failed).toBe(0);
      expect(result.rows.map((row) => row.event.time)).toEqual([0, 1, 3, 5]);
      for (const [index, x] of [100, 100, 400, 100].entries()) {
        const row = result.rows[index];
        expect(row.effects.find((e) => e.name === global.name)).toMatchObject({
          status: "applied",
          mode: "角色实时数值",
          x,
          value: x * 0.1,
        });
        // 2000 ATK, 100% skill, 10% resistance, equal levels, 50/100 crit.
        expect(row.expected).toBeCloseTo(
          2000 * (1 + x / 1000) * 0.9 * 0.5 * 1.5,
        );
      }
      // Reopening event details in a different order must give the same x.
      for (const index of [2, 0, 3, 1]) {
        const row = result.rows[index];
        const resolver = createPanelResolver(p, row.event.id);
        const active = resolver.active.find((e) => e.effect.id === global.id)!;
        expect(resolver.trace(active.effect).x).toBe(index === 2 ? 400 : 100);
      }
    },
  );

  it("reevaluates conditional formulas for star/lunar direct damage", () => {
    const { p, global } = fixture();
    p.skills[0].damage.special = "月感电";
    p.globals = [
      {
        ...global,
        type: "星月增伤",
        advanced: true,
        formulas: [
          { id: "high", condition: "x>200", formula: "x*0.2" },
          { id: "fallback", condition: "", formula: "x*0.1" },
        ],
      },
    ];
    const result = calculateProject(p);
    expect(result.failed).toBe(0);
    for (const [index, bonus] of [10, 10, 80, 10].entries()) {
      const row = result.rows[index];
      expect(row.effects.find((e) => e.name === global.name)).toMatchObject({
        x: index === 2 ? 400 : 100,
        value: bonus,
      });
      expect(row.expected).toBeCloseTo(
        3 * 2000 * (1 + bonus / 100) * 0.9 * 1.5,
      );
    }
  });

  it("resolves chained global attribute variables before calculating damage", () => {
    const { p, source, attacker, global } = fixture();
    const attackBuff = {
      ...global,
      id: "attack-buff",
      name: "精通转攻击",
      type: "攻击力" as const,
    };
    p.globals = [
      {
        ...global,
        variableCharacterId: attacker.id,
        variableStat: "攻击力",
        coefficient: 0.01,
      },
      attackBuff,
    ];
    const result = calculateProject(p);
    expect(result.failed).toBe(0);
    for (const [index, mastery] of [100, 100, 400, 100].entries()) {
      const row = result.rows[index],
        attack = 2000 + mastery * 0.1;
      expect(row.breakdown?.scaling).toBe(attack);
      expect(row.effects.find((e) => e.name === global.name)).toMatchObject({
        x: attack,
        value: attack * 0.01,
      });
      expect(row.expected).toBeCloseTo(
        attack * (1 + attack / 10000) * 0.9 * 0.5 * 1.5,
      );
      const resolver = createPanelResolver(p, row.event.id);
      expect(resolver.resolve(source.id, "元素精通", "live")).toBe(mastery);
      expect(resolver.trace(attackBuff)).toMatchObject({
        x: mastery,
        value: mastery * 0.1,
      });
    }
  });

  it.each(["base", "outside", "live"] as const)(
    "keeps %s variable semantics distinct when equipment and a temporary buff add stats",
    (mode) => {
      const { p, global } = fixture();
      p.weapons[0].substats = [
        { id: "mastery", type: "mastery", mode: "direct", value: 50 },
      ];
      p.globals = [{ ...global, valueMode: mode }];
      const result = calculateProject(p);
      expect(result.failed).toBe(0);
      const expected =
        mode === "base"
          ? [100, 100, 100, 100]
          : mode === "outside"
            ? [150, 150, 150, 150]
            : [150, 150, 450, 150];
      expect(
        result.rows.map(
          (row) => row.effects.find((e) => e.name === global.name)?.x,
        ),
      ).toEqual(expected);
    },
  );

  it("honors same-time event order and the current foreground character", () => {
    const { p, source, attacker, temporary, global } = fixture();
    const hit = (id: string): TimelineEvent => ({
      id,
      time: 2,
      kind: "skill",
      skillId: p.skills[0].id,
    });
    p.initialCharacterId = attacker.id;
    p.timeline = [
      hit("before"),
      {
        id: "foreground-buff",
        time: 2,
        kind: "effect",
        effect: { ...temporary, target: "foreground" },
      },
      hit("before-switch"),
      { id: "switch", time: 2, kind: "switch", characterId: source.id },
      hit("after-switch"),
      { id: "switch-back", time: 2, kind: "switch", characterId: attacker.id },
      hit("after-switch-back"),
    ];
    const result = calculateProject(p);
    expect(result.failed).toBe(0);
    expect(
      result.rows.map(
        (row) => row.effects.find((e) => e.name === global.name)?.x,
      ),
    ).toEqual([100, 100, 400, 100]);
  });
});
