import { expect, it, describe } from "vitest";
import {
  ASCENSION_STATS,
  artifactMainStat,
  effect,
  newProject,
  type AscensionStat,
} from "./model";
import { parseProject } from "./storage";
import { staticPanels, createPanelResolver } from "./panels";
import {
  applyQuickImport,
  parseGoodImport,
  parseEnkaImport,
} from "./quick-import";

describe("ascension and custom artifact mains", () => {
  it.each<AscensionStat["type"]>([...ASCENSION_STATS])(
    "applies %s without changing fixed base crit or duplicating equipment",
    (type) => {
      const p = newProject(),
        c = p.characters[0];
      Object.assign(c, {
        atk: 1000,
        hp: 10000,
        def: 500,
        ascension: { type, value: 20 },
      });
      p.weapons[0].atk = 500;
      const result = staticPanels(p, c.id);
      expect(result.base["暴击率"]).toBe(5);
      expect(result.base["暴击伤害"]).toBe(50);
      if (type === "atkPercent")
        expect(result.outside["攻击力"]).toBe(1500 * 1.2 + 311);
      if (type === "hpPercent")
        expect(result.outside["生命值"]).toBe(10000 * 1.2 + 4780);
      if (type === "defPercent") expect(result.outside["防御力"]).toBe(600);
      if (type === "critRate") expect(result.outside["暴击率"]).toBe(25);
      if (type === "critDamage") expect(result.outside["暴击伤害"]).toBe(70);
      if (type === "mastery") expect(result.outside["元素精通"]).toBe(20);
      if (type === "recharge") expect(result.outside["元素充能效率"]).toBe(120);
      if (type === "healingBonus") expect(result.outside["治疗加成"]).toBe(20);
      expect(parseProject(parseProject(p))).toEqual(parseProject(p));
    },
  );
  it("keeps old character bonuses exactly once on outside/live and exposes surplus legacy bonuses", () => {
    const p = newProject(),
      c = p.characters[0];
    Object.assign(c, {
      critRate: 24.2,
      critDamage: 88.4,
      mastery: 100,
      bonus: 12,
      physicalBonus: 30,
    });
    const before = staticPanels(p, c.id).outside,
      next = parseProject(p);
    expect(next.characters[0].critRate).toBe(5);
    expect(next.characters[0].critDamage).toBe(50);
    expect(next.characters[0].ascension).toEqual({
      type: "critRate",
      value: 19.2,
    });
    expect(next.characters[0].legacyAscension).toHaveLength(4);
    expect(staticPanels(next, c.id).outside).toEqual(before);
    expect(parseProject(next)).toEqual(next);
  });
  it("percentage ascension does not inflate the base used by other percentage effects", () => {
    const p = newProject(),
      c = p.characters[0];
    c.atk = 1000;
    c.ascension = { type: "atkPercent", value: 20 };
    p.timeline = [{ id: "t", kind: "switch", characterId: c.id, time: 0 }];
    p.globals = [{ ...effect(c.id), type: "攻击力", value: 50 }];
    expect(createPanelResolver(p, "t").resolve(c.id, "攻击力", "live")).toBe(
      2011,
    );
  });
  it("full mains ignore saved custom numbers and non-full mains use them even on flower and feather", () => {
    const p = newProject(),
      a = p.artifacts[0];
    a.mainStats = {
      flower: "hp",
      feather: "atk",
      sands: "mastery",
      goblet: "physicalBonus",
      circlet: "critDamage",
    };
    a.mainStatValues = {
      flower: 1234,
      feather: 42,
      sands: 123.4,
      goblet: 21,
      circlet: 25,
    };
    expect(artifactMainStat(a, "sands").value).toBe(187);
    a.mainStat20 = {
      flower: false,
      feather: false,
      sands: false,
      goblet: false,
      circlet: false,
    };
    const panel = staticPanels(parseProject(p), p.characters[0].id).outside;
    expect(panel["生命值"]).toBe(1234);
    expect(panel["攻击力"]).toBe(42);
    expect(panel["元素精通"]).toBe(123.4);
    expect(panel["暴击伤害"]).toBe(75);
    a.mainStats.sands = "notImportant";
    expect(artifactMainStat(a, "sands").value).toBe(0);
  });
});
describe("expanded import options", () => {
  const good = {
    format: "GOOD",
    version: 3,
    characters: [{ key: "Amber", level: 95, constellation: 4 }],
    weapons: [
      {
        key: "UltimateOverlordsMegaMagicSword",
        location: "Amber",
        level: 90,
        ascension: 6,
      },
    ],
    artifacts: [
      {
        slotKey: "sands",
        mainStatKey: "eleMas",
        rarity: 5,
        level: 20,
        location: "Amber",
        substats: [],
      },
      {
        slotKey: "flower",
        mainStatKey: "hp",
        rarity: 4,
        level: 0,
        location: "Amber",
        substats: [],
      },
    ],
  };
  it("extracts GOOD metadata, grows weapon substat and sets per-piece 20-level flags", () => {
    const c = parseGoodImport(good).characters[0];
    expect(c).toMatchObject({ name: "安柏", level: 95, constellation: 4 });
    expect(c.weapon?.substats?.[0]).toMatchObject({
      type: "recharge",
      value: 30.6,
    });
    expect(c.artifacts?.mainStat20).toMatchObject({
      sands: true,
      flower: false,
      feather: false,
    });
    expect(c.artifacts?.importedMainStats.sands?.value).toBe(187);
    const p = newProject();
    const next = applyQuickImport(p, c, p.characters[1].id, {
      characterName: true,
      characterLevel: true,
      characterConstellation: true,
      weaponName: true,
      weaponSubstats: true,
    });
    expect(next.characters[1]).toMatchObject({
      name: "安柏",
      level: 95,
      stars: 1,
      constellation: "4",
      atk: 0,
    });
    expect(next.weapons[1]).toMatchObject({
      name: "「究极霸王超级魔剑」",
      atk: 0,
    });
    expect(next.weapons[1].substats).toHaveLength(1);
    expect(next.artifacts).toEqual(p.artifacts);
    const only = applyQuickImport(p, c, p.characters[0].id, {
      characterName: true,
    });
    expect(only.characters[0].name).toBe("安柏");
    expect(only.characters[0].level).toBe(90);
    expect(only.weapons).toEqual(p.weapons);
  });
  it("extracts Enka constellation and substat, supports explicit no-substat weapons", () => {
    const c = parseEnkaImport({
      avatarInfoList: [
        {
          avatarId: 10000021,
          talentIdList: [1, 2, 3],
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
          ],
        },
      ],
    }).characters[0];
    expect(c.constellation).toBe(3);
    expect(c.weapon?.substats?.[0]).toMatchObject({
      type: "critRate",
      value: 22.1,
    });
  });
});
