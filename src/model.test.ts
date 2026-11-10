import { describe, expect, it } from "vitest";
import {
  assignEquipment,
  damage,
  deleteSkill,
  effect,
  endTime,
  moveSkill,
  newProject,
  resultTeamName,
  skill,
  sortedEquipment,
  sortedTimeline,
  statValue,
  teamCosts,
  uid,
  type Project,
  type StatKey,
} from "./model";
import { activeEffectsAt, damageEvents, damageLabel } from "./results";
import {
  applyCharacterPreset,
  applyWeaponPreset,
  parseProject,
  parsePreset,
} from "./storage";

describe("parameter model", () => {
  it.each<[StatKey, number]>([
    ["critRate", 3.3],
    ["critDamage", 6.6],
    ["atkPercent", 5],
    ["hpPercent", 5],
    ["defPercent", 6.2],
    ["recharge", 5.5],
    ["mastery", 20],
    ["atk", 17],
    ["hp", 254],
    ["def", 20],
  ])("uses the specified average for %s", (type, average) => {
    expect(statValue({ id: uid(), type, mode: "rolls", value: 1 })).toBe(
      average,
    );
    expect(statValue({ id: uid(), type, mode: "direct", value: 12.345 })).toBe(
      12.345,
    );
  });
  it("supports fractional rolls without display rounding artifacts", () =>
    expect(
      statValue({ id: uid(), type: "mastery", mode: "rolls", value: 1.9 }),
    ).toBe(38));
  it("keeps exactly one piece of equipment per character when swapping and reordering", () => {
    const p = newProject(),
      [first, second] = p.characters;
    const next = assignEquipment(p.weapons, p.weapons[0].id, second.id);
    expect(next[1].characterId).toBe(first.id);
    expect(new Set(next.map((x) => x.characterId)).size).toBe(4);
    expect(
      sortedEquipment(next, [second, first, ...p.characters.slice(2)])[0].id,
    ).toBe(p.weapons[0].id);
  });
  it("moves skills only within their owner and removes timeline references on deletion", () => {
    const p = newProject(),
      a = skill(p.characters[0].id),
      b = skill(p.characters[1].id),
      c = skill(p.characters[0].id);
    p.skills = [a, b, c];
    p.timeline = [{ id: uid(), kind: "skill", skillId: a.id, time: 3 }];
    expect(moveSkill(p, a.id, 1).skills.map((s) => s.id)).toEqual([
      c.id,
      b.id,
      a.id,
    ]);
    expect(deleteSkill(p, a.id).timeline).toHaveLength(0);
  });
  it("uses character order for exact result naming and sums both equipment and character costs", () => {
    const p = newProject();
    ["偶", "芙", "菈", "希"].forEach((short, i) => {
      p.characters[i].short = short;
      p.characters[i].gold = 2;
      p.characters[i].limitedGold = 1;
      p.weapons[i].short = ["1", "5", "0精5狼末", "0精5极霸剑"][i];
      p.weapons[i].gold = 1;
      p.weapons[i].limitedGold = 0.5;
    });
    expect(resultTeamName(p)).toBe("01偶 05芙 00精5狼末菈 00精5极霸剑希");
    expect(teamCosts(p)).toEqual({ gold: 12, limitedGold: 6 });
    p.characters.reverse();
    expect(resultTeamName(p)).toBe("00精5极霸剑希 00精5狼末菈 05芙 01偶");
  });
});
describe("project import and preset safety", () => {
  it("roundtrips effects, variables, cost fields, and character IDs", () => {
    const p = newProject();
    p.characters[0].limitedGold = 3;
    p.weapons[0].short = "0精5狼末";
    p.weapons[0].limitedGold = 1;
    p.artifacts[0].effects = [
      {
        ...effect(p.characters[0].id),
        type: "敌方抗性",
        value: -40,
        target: "custom",
        targetIds: [p.characters[1].id, p.characters[3].id],
        valueMode: "live",
        coefficient: -0.1,
      },
    ];
    const next = parseProject(JSON.parse(JSON.stringify(p)));
    expect(next.artifacts[0].effects[0]).toMatchObject({
      name: "角色 01圣遗物",
      nameMode: "auto",
    });
    expect(parseProject(JSON.parse(JSON.stringify(next)))).toEqual(next);
  });
  it("migrates earlier parameter-only saves and presets", () => {
    const old = JSON.parse(JSON.stringify(newProject()));
    old.characters.forEach(
      (c: Record<string, unknown>) => delete c.limitedGold,
    );
    old.weapons.forEach((w: Record<string, unknown>) => {
      delete w.short;
      delete w.gold;
      delete w.limitedGold;
    });
    old.artifacts.forEach((a: Record<string, unknown>) => delete a.effects);
    const migrated = parseProject(old);
    expect(migrated.characters[0].limitedGold).toBe(0);
    expect(migrated.weapons[0].short).toBe("");
    expect(migrated.artifacts[0].effects).toEqual([]);
    expect(
      parsePreset({
        id: uid(),
        name: "旧武器",
        kind: "weapon",
        data: old.weapons[0],
      }).data,
    ).toHaveProperty("limitedGold", 0);
  });
  it.each([
    (p: Project) => {
      p.characters[0].stars = 2 as never;
    },
    (p: Project) => {
      p.weapons[0].substats = Array.from({ length: 2 }, () => ({
        id: uid(),
        type: "atk",
        mode: "direct",
        value: 20,
      }));
    },
    (p: Project) => {
      p.weapons[0].characterId = p.weapons[1].characterId;
    },
    (p: Project) => {
      p.timeline.push({
        id: uid(),
        kind: "skill",
        skillId: "missing",
        time: 3,
      });
    },
    (p: Project) => {
      p.globals.push({ ...effect("missing") });
    },
    (p: Project) => {
      p.artifacts[0].effects.push({
        ...effect(p.characters[0].id),
        targetIds: ["missing"],
      });
    },
    (p: Project) => {
      p.timeline.push({
        id: uid(),
        kind: "effect",
        effect: effect(p.characters[0].id),
        time: -1,
      });
    },
  ])(
    "rejects invalid shapes and references without mutating the source",
    (mutate) => {
      const p = newProject();
      mutate(p);
      const before = JSON.stringify(p);
      expect(() => parseProject(p)).toThrow();
      expect(JSON.stringify(p)).toBe(before);
    },
  );
  it("retains the target slot ID and remaps portable weapon effect references", () => {
    const p = newProject(),
      imported = newProject();
    imported.weapons[0].effects = [
      {
        ...effect(imported.characters[0].id),
        target: "custom",
        targetIds: [imported.characters[0].id],
      },
    ];
    expect(
      applyCharacterPreset(imported.characters[0], p.characters[2]).id,
    ).toBe(p.characters[2].id);
    const w = applyWeaponPreset(
      imported.weapons[0],
      p.weapons[2],
      p.characters,
    );
    expect(w.characterId).toBe(p.characters[2].id);
    expect(w.effects[0].variableCharacterId).toBe(p.characters[2].id);
    expect(w.effects[0].targetIds).toEqual([p.characters[2].id]);
  });
});
describe("timeline and damage detail", () => {
  it("sorts stably, uses the last start time and excludes support events from damage detail", () => {
    const p = newProject(),
      hit = skill(p.characters[0].id),
      buff = { ...skill(p.characters[1].id), kind: "effect" as const };
    p.skills = [hit, buff];
    p.timeline = [
      { id: "a", kind: "skill", skillId: hit.id, time: 10 },
      {
        id: "b",
        kind: "effect",
        effect: { ...effect(p.characters[0].id), duration: 100 },
        time: 1,
      },
      { id: "c", kind: "skill", skillId: hit.id, time: 1 },
      { id: "d", kind: "skill", skillId: buff.id, time: 15 },
    ];
    expect(sortedTimeline(p.timeline).map((e) => e.id)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(endTime(p)).toBe(15);
    expect(damageEvents(p).map((x) => x.event.id)).toEqual(["c", "a"]);
  });
  it("labels only advanced property and element with physical handled separately", () => {
    expect(damageLabel({ ...damage(), element: "水", special: "月感电" })).toBe(
      "月感电水元素",
    );
    expect(damageLabel({ ...damage(), element: "水" })).toBe("水元素");
    expect(damageLabel({ ...damage(), element: "物理" })).toBe("物理属性");
  });
  it("tracks active effects, exclusive end boundaries, equal-time ordering and source names", () => {
    const p = newProject(),
      hit = skill(p.characters[0].id),
      buff = {
        ...skill(p.characters[1].id),
        name: "辅助Q",
        kind: "effect" as const,
        effects: [{ ...effect(p.characters[1].id), duration: 3 }],
      };
    p.characters[0].name = "木偶";
    p.characters[1].name = "芙宁娜";
    p.skills = [hit, buff];
    p.globals = [
      { ...effect(p.characters[0].id, true), name: "全局常驻" },
      { ...effect(p.characters[0].id), duration: 5, name: "到期" },
    ];
    p.timeline = [
      { id: "buff", kind: "skill", skillId: buff.id, time: 3 },
      {
        id: "artifact",
        kind: "effect",
        effect: {
          ...effect(p.characters[0].id),
          name: "套装增益",
          origin: { kind: "artifact", name: "测试套装" },
          duration: 20,
        },
        time: 5,
      },
      { id: "hit", kind: "skill", skillId: hit.id, time: 5 },
      {
        id: "late",
        kind: "effect",
        effect: effect(p.characters[0].id),
        time: 5,
      },
      { id: "hit2", kind: "skill", skillId: hit.id, time: 6 },
    ];
    const active = activeEffectsAt(p, "hit");
    expect(active).toHaveLength(4);
    expect(active.some((e) => e.effect.name === "全局常驻")).toBe(true);
    expect(
      active.some(
        (e) => e.effect.name === "到期" && e.effect.duration === null,
      ),
    ).toBe(true);
    expect(active.some((e) => e.source === "芙宁娜 · 技能「辅助Q」")).toBe(
      true,
    );
    expect(active.some((e) => e.source.includes("圣遗物「测试套装」"))).toBe(
      true,
    );
    expect(
      activeEffectsAt(p, "hit2").some((e) => e.source.includes("辅助Q")),
    ).toBe(false);
  });
});
