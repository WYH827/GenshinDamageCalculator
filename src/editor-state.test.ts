import { describe, expect, it } from "vitest";
import {
  ALL_STATS,
  BONUS_STATS,
  SANDS_STATS,
  GOBLET_STATS,
  CIRCLET_STATS,
  MAIN_STAT_VALUES,
  assignEquipment,
  effect,
  effectTargetIds,
  effectTargetValid,
  foregroundAt,
  newProject,
  resultTeamName,
  skill,
  statValue,
} from "./model";
import { parseProject, parsePreset } from "./storage";
import { damageEvents } from "./results";

describe("new team naming and foreground state", () => {
  it("formats each character as constellation + weapon + short with spaces between characters", () => {
    const p = newProject();
    p.characters.forEach((c, i) => {
      c.short = ["偶", "芙", "菈", "希"][i];
      c.constellation = "0";
      c.level = i === 0 ? 95 : 90;
      c.stars = i === 0 ? 1 : 0;
      p.weapons[i].short = i === 0 ? "0精5狼末" : "1";
    });
    expect(resultTeamName(p)).toBe("95级00精5狼末偶 01芙 01菈 01希");
    p.characters.reverse();
    expect(resultTeamName(p)).toBe("01希 01菈 01芙 95级00精5狼末偶");
  });
  it("keeps initial foreground by ID and applies switches only before the event in stable time order", () => {
    const p = newProject(),
      [a, b, c] = p.characters;
    p.initialCharacterId = b.id;
    const hit = skill(a.id);
    p.skills = [hit];
    p.timeline = [
      { id: "late", kind: "switch", time: 10, characterId: c.id },
      { id: "before", kind: "skill", time: 2, skillId: hit.id },
      { id: "switch", kind: "switch", time: 2, characterId: a.id },
      { id: "after", kind: "skill", time: 2, skillId: hit.id },
      { id: "last", kind: "skill", time: 11, skillId: hit.id },
    ];
    expect(foregroundAt(p, "before")).toBe(b.id);
    expect(foregroundAt(p, "after")).toBe(a.id);
    expect(foregroundAt(p, "last")).toBe(c.id);
    p.characters.reverse();
    expect(foregroundAt(p, "before")).toBe(b.id);
    expect(damageEvents(p).map((x) => x.event.id)).toEqual([
      "before",
      "after",
      "last",
    ]);
    p.timeline = p.timeline.filter((e) => e.id !== "switch");
    expect(foregroundAt(p, "after")).toBe(b.id);
  });
  it("resolves element/foreground targets dynamically while enemy resistance never targets characters", () => {
    const p = newProject();
    p.characters[0].element = "火";
    p.characters[1].element = "水";
    p.characters[2].element = "冰";
    p.characters[3].element = "水";
    const e = {
      ...effect(p.characters[0].id),
      target: "elements" as const,
      targetElements: ["火", "水"] as ("火" | "水")[],
    };
    expect(effectTargetIds(p, e, "end")).toEqual([
      p.characters[0].id,
      p.characters[1].id,
      p.characters[3].id,
    ]);
    expect(effectTargetValid({ ...e, targetElements: [] })).toBe(false);
    p.timeline = [
      {
        id: "switch",
        kind: "switch",
        time: 1,
        characterId: p.characters[2].id,
      },
    ];
    expect(effectTargetIds(p, { ...e, target: "foreground" }, "end")).toEqual([
      p.characters[2].id,
    ]);
    const enemy = { ...e, type: "敌方抗性" as const, targetElements: [] };
    expect(effectTargetValid(enemy)).toBe(true);
    expect(effectTargetIds(p, enemy, "end")).toEqual([]);
  });
});
describe("main stats, ignored stats, and imports", () => {
  it("matches every allowed main stat and fixed flower/feather value", () => {
    expect(MAIN_STAT_VALUES.hp).toBe(4780);
    expect(MAIN_STAT_VALUES.atk).toBe(311);
    expect(SANDS_STATS).toEqual([
      "atkPercent",
      "hpPercent",
      "defPercent",
      "mastery",
      "notImportant",
    ]);
    const common = SANDS_STATS.filter((s) => s !== "notImportant");
    expect(CIRCLET_STATS).toEqual([
      ...common,
      "critRate",
      "critDamage",
      "notImportant",
    ]);
    expect(GOBLET_STATS).toEqual([
      ...common,
      ...Object.keys(BONUS_STATS),
      "notImportant",
    ]);
    expect(MAIN_STAT_VALUES).toMatchObject({
      atkPercent: 46.6,
      hpPercent: 46.6,
      defPercent: 58.3,
      mastery: 187,
      critRate: 31.1,
      critDamage: 62.2,
      physicalBonus: 58.3,
    });
    for (const key of Object.keys(BONUS_STATS) as (keyof typeof BONUS_STATS)[])
      expect(MAIN_STAT_VALUES[key]).toBe(key === "physicalBonus" ? 58.3 : 46.6);
  });
  it("stores direct weapon bonuses without inventing roll averages; ignored stats contribute zero", () => {
    for (const key of Object.keys(
      BONUS_STATS,
    ) as (keyof typeof BONUS_STATS)[]) {
      expect(ALL_STATS[key].average).toBeNull();
      expect(
        statValue({ id: key, type: key, mode: "direct", value: 58.3 }),
      ).toBe(58.3);
    }
    expect(
      statValue({
        id: "ignored",
        type: "notImportant",
        mode: "direct",
        value: 9999,
      }),
    ).toBe(0);
  });
  it("roundtrips target filters, critical effects, mainstats and switching", () => {
    const p = newProject();
    p.characters[0].physicalBonus = 58.3;
    p.artifacts[0].mainStats = {
      flower: "hp",
      feather: "atk",
      sands: "mastery",
      goblet: "hydroBonus",
      circlet: "critDamage",
    };
    p.weapons[0].substats = [
      { id: "w", type: "pyroBonus", mode: "direct", value: 46.6 },
    ];
    p.artifacts[0].substats = [
      { id: "a", type: "notImportant", mode: "direct", value: 0 },
    ];
    p.globals = [
      {
        ...effect(p.characters[0].id),
        type: "暴击率",
        target: "elements",
        targetElements: ["水", "冰"],
      },
      { ...effect(p.characters[1].id), type: "暴击伤害", target: "foreground" },
    ];
    p.timeline = [
      { id: "s", time: 2.5, kind: "switch", characterId: p.characters[2].id },
    ];
    const migrated = parseProject(JSON.parse(JSON.stringify(p)));
    expect(migrated.globals.every((e) => e.sourceId === "")).toBe(true);
    expect(parseProject(JSON.parse(JSON.stringify(migrated)))).toEqual(
      migrated,
    );
    const swap = assignEquipment(
      p.artifacts,
      p.artifacts[0].id,
      p.characters[1].id,
    );
    expect(swap[0].mainStats.goblet).toBe("hydroBonus");
    expect(swap[0].characterId).toBe(p.characters[1].id);
  });
  it("migrates old saves and preserves physical bonus with a visible element review flag", () => {
    const old = JSON.parse(JSON.stringify(newProject()));
    delete old.initialCharacterId;
    old.characters.forEach(
      (c: Record<string, unknown>) => delete c.physicalBonus,
    );
    old.characters[0].element = "物理";
    old.characters[0].bonus = 34.5;
    old.artifacts.forEach((a: Record<string, unknown>) => delete a.mainStats);
    old.globals = [effect(old.characters[0].id)];
    delete old.globals[0].targetElements;
    const p = parseProject(old);
    expect(p.initialCharacterId).toBe(p.characters[0].id);
    expect(p.characters[0]).toMatchObject({
      element: "火",
      elementNeedsReview: true,
      bonus: 0,
      physicalBonus: 0,
      ascension: { type: "physicalBonus", value: 34.5 },
    });
    expect(p.artifacts[0].mainStats).toEqual({
      flower: "hp",
      feather: "atk",
      sands: "notImportant",
      goblet: "notImportant",
      circlet: "notImportant",
    });
    expect(p.globals[0].targetElements).toEqual([]);
    expect(
      parsePreset({
        id: "old",
        name: "旧角色",
        kind: "character",
        data: old.characters[0],
      }).data,
    ).toHaveProperty("ascension", { type: "physicalBonus", value: 34.5 });
  });
  it("rejects invalid foreground references, mainstat slots, duplicate element targets, and weapon roll bonuses", () => {
    const p = newProject();
    expect(() =>
      parseProject({ ...p, initialCharacterId: "missing" }),
    ).toThrow();
    expect(() =>
      parseProject({
        ...p,
        timeline: [
          { id: "s", time: 0, kind: "switch", characterId: "missing" },
        ],
      }),
    ).toThrow();
    const bad = JSON.parse(JSON.stringify(p));
    bad.artifacts[0].mainStats.flower = "notImportant";
    expect(() => parseProject(bad)).toThrow();
    bad.artifacts[0].mainStats.flower = "hp";
    bad.artifacts[0].mainStats.sands = "critRate";
    expect(() => parseProject(bad)).toThrow();
    expect(() =>
      parseProject({
        ...p,
        globals: [
          { ...effect(p.characters[0].id), targetElements: ["火", "火"] },
        ],
      }),
    ).toThrow();
    p.weapons[0].substats = [
      { id: "bonus", type: "pyroBonus", mode: "rolls", value: 1 },
    ];
    expect(() => parseProject(p)).toThrow();
  });
});
