import { describe, it, expect } from "vitest";
import {
  parseGoodImport,
  parseEnkaImport,
  applyQuickImport,
} from "./quick-import";
import { newProject, effect, skill } from "./model";
import { parseProject } from "./storage";
import { staticPanels } from "./panels";

const artifact = (
  slotKey = "flower",
  mainStatKey = "hp",
  level = 20,
  rarity = 5,
) => ({
  slotKey,
  mainStatKey,
  level,
  rarity,
  setKey: "GladiatorsFinale",
  location: "Amber",
  substats: [
    { key: "critRate_", value: 3.9 },
    { key: "atk", value: 19 },
  ],
  unactivatedSubstats: [{ key: "critDMG_", value: 7.8 }],
});
function good() {
  return {
    format: "GOOD",
    version: 3,
    source: "yas-GOODScanner",
    characters: [
      { key: "Amber", level: 90 },
      { key: "Bennett", level: 80 },
    ],
    weapons: [
      {
        key: "UltimateOverlordsMegaMagicSword",
        level: 90,
        ascension: 6,
        refinement: 5,
        location: "Amber",
      },
    ],
    artifacts: [
      artifact(),
      artifact("plume", "atk"),
      artifact("sands", "enerRech_"),
      artifact("goblet", "pyro_dmg_"),
      artifact("circlet", "critDMG_"),
    ],
  };
}
function enka() {
  return {
    playerInfo: { nickname: "Test" },
    avatarInfoList: [
      {
        avatarId: 10000021,
        propMap: { "4001": { val: "90" } },
        fightPropMap: { "2001": 99999 },
        equipList: [
          {
            weapon: { level: 90 },
            flat: {
              itemType: "ITEM_WEAPON",
              weaponStats: [
                { appendPropId: "FIGHT_PROP_BASE_ATTACK", statValue: 674 },
                { appendPropId: "FIGHT_PROP_CRITICAL", statValue: 22.1 },
              ],
            },
          },
          {
            reliquary: { level: 17 },
            flat: {
              itemType: "ITEM_RELIQUARY",
              equipType: "EQUIP_BRACER",
              rankLevel: 4,
              reliquaryMainstat: {
                mainPropId: "FIGHT_PROP_HP",
                statValue: 3571,
              },
              reliquarySubstats: [
                { appendPropId: "FIGHT_PROP_CRITICAL", statValue: 6.2 },
              ],
            },
          },
        ],
      },
    ],
  };
}
describe("GGScanner and Enka quick import", () => {
  it("parses GOOD v3 equipped gear and sums substats without counting inactive rolls", () => {
    const raw = good();
    raw.artifacts.push({ ...artifact(), location: "" });
    const data = parseGoodImport(raw),
      c = data.characters[0];
    expect(c.name).toBe("安柏");
    expect(c.weapon?.atk).toBe(565);
    expect(
      c.artifacts?.substats.find((s) => s.type === "critRate")?.value,
    ).toBe(19.5);
    expect(c.artifacts?.substats.find((s) => s.type === "atk")?.value).toBe(95);
    expect(c.artifacts?.substats.some((s) => s.type === "critDamage")).toBe(
      false,
    );
    expect(c.artifacts?.importedMainStats.sands).toMatchObject({
      type: "notImportant",
      value: 0,
    });
    expect(c.artifacts?.importedMainStats.sands?.label).toContain("51.8%");
    expect(c.artifacts?.importedMainStats.goblet?.value).toBe(46.6);
    expect(data.characters[1].weapon).toBeUndefined();
  });
  it("respects low levels and rarity, empty slots are zero, healing is explicitly ignored", () => {
    const raw = good();
    raw.artifacts = [
      artifact("flower", "hp", 0, 4),
      artifact("circlet", "heal_", 16, 4),
    ];
    const c = parseGoodImport(raw).characters[0];
    expect(c.artifacts?.importedMainStats.flower?.value).toBe(645);
    expect(c.artifacts?.importedMainStats.feather?.value).toBe(0);
    expect(c.artifacts?.importedMainStats.circlet?.type).toBe("notImportant");
    expect(c.artifacts?.importedMainStats.circlet?.label).toContain("治疗加成");
  });
  it("rejects unknown weapons and duplicate artifacts independently without guessing", () => {
    const raw = good();
    raw.weapons[0].key = "Unknown";
    let c = parseGoodImport(raw).characters[0];
    expect(c.weapon).toBeUndefined();
    expect(c.artifacts).toBeDefined();
    raw.artifacts.push(artifact());
    c = parseGoodImport(raw).characters[0];
    expect(c.artifacts).toBeUndefined();
    expect(c.artifactError).toContain("多件");
    expect(() => parseGoodImport({})).toThrow();
    expect(() =>
      parseGoodImport({ format: "GOOD", version: 3, artifacts: [] }),
    ).toThrow("没有可导入角色");
  });
  it("weapon growth uses ascension separately at level caps", () => {
    const raw = good();
    raw.weapons[0].level = 20;
    raw.weapons[0].ascension = 0;
    const before = parseGoodImport(raw).characters[0].weapon!.atk;
    raw.weapons[0].ascension = 1;
    const after = parseGoodImport(raw).characters[0].weapon!.atk;
    expect(after - before).toBe(25);
    raw.weapons[0].level = 90;
    expect(parseGoodImport(raw).characters[0].weapon).toBeUndefined();
  });
  it("Enka uses weapon base ATK not total attack, and displayed percent units", () => {
    const c = parseEnkaImport(enka()).characters[0];
    expect(c.name).toBe("安柏");
    expect(c.level).toBe(90);
    expect(c.weapon?.atk).toBe(674);
    expect(c.artifacts?.importedMainStats.flower?.value).toBe(3571);
    expect(c.artifacts?.substats[0].value).toBe(6.2);
    expect(() =>
      parseEnkaImport({ playerInfo: { nickname: "Hidden" } }),
    ).toThrow("显示角色详情");
  });
  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])(
    "imports only selected categories (%s, %s), preserving effects and IDs",
    (artifacts, weapon) => {
      const p = newProject(),
        target = p.characters[2].id;
      p.characters[2].atk = 1000;
      p.artifacts[2].effects = [effect(target)];
      p.weapons[2].effects = [effect(target)];
      p.weapons[2].substats = [
        { id: "w", type: "critRate", value: 33.1, mode: "direct" },
      ];
      p.skills = [skill(target)];
      p.timeline = [
        { id: "hit", kind: "skill", time: 1, skillId: p.skills[0].id },
      ];
      const c = parseGoodImport(good()).characters[0];
      const next = applyQuickImport(p, c, target, artifacts, weapon);
      expect(next.characters).toEqual(p.characters);
      expect(next.timeline).toEqual(p.timeline);
      expect(next.artifacts[2].id).toBe(p.artifacts[2].id);
      expect(next.artifacts[2].effects).toEqual(p.artifacts[2].effects);
      expect(next.weapons[2].effects).toEqual(p.weapons[2].effects);
      expect(next.weapons[2].substats).toEqual(p.weapons[2].substats);
      expect(next.weapons[2].atk).toBe(weapon ? 565 : 0);
      expect(next.artifacts[2].mainStat20 !== undefined).toBe(artifacts);
      const restored = parseProject(JSON.parse(JSON.stringify(next)));
      expect(restored.artifacts[2].mainStats).toEqual(
        next.artifacts[2].mainStats,
      );
      expect(restored.artifacts[2].importedMainStats).toEqual(
        next.artifacts[2].importedMainStats,
      );
      expect(restored.artifacts[2].substats).toEqual(
        next.artifacts[2].substats,
      );
      if (artifacts) {
        const panel = staticPanels(restored, target).outside;
        expect(panel["元素充能效率"]).toBe(100);
        expect(panel["火元素伤害加成"]).toBe(46.6);
      }
      expect(p.artifacts[2].importedMainStats).toBeUndefined();
    },
  );
});
