import { describe, it, expect } from "vitest";
import { batchSkills, transformEvents } from "./timeline-batch";
import { scheduledCount } from "./schedule";
import {
  effect,
  newProject,
  skill,
  sortedTimeline,
  endTime,
  type TimelineEvent,
} from "./model";
import { defaultTiming } from "./effect-catalog";
import { calculateProject } from "./damage-engine";
import { realtimeTimeline } from "./realtime-state";
import { parseProject } from "./storage";
import {
  parseGoodImport,
  parseEnkaImport,
  defaultImportOptions,
  applyQuickImport,
  artifactSetName,
} from "./quick-import";

describe("bounded periodic changes", () => {
  it("stops generating at the inclusive range endpoint, while existing independent layers retain expiry", () => {
    const p = newProject(),
      c = p.characters[0],
      hit = skill(c.id);
    const e = {
      ...effect(c.id),
      name: "buff",
      type: "增伤区" as const,
      value: 10,
      realtime: {
        kind: "independentPeriodic" as const,
        max: 5,
        initial: 0,
        duration: 2,
        interval: 1,
        delta: 1,
        activeFor: 2,
      },
    };
    p.weapons[0].effects = [e];
    p.skills = [hit];
    p.timeline = [
      {
        id: "trigger",
        time: 0,
        kind: "effectTrigger",
        effectKey: `weapon-${p.weapons[0].id}-${e.id}`,
        timing: { ...defaultTiming(e), count: 0 },
        usePreset: true,
      },
      ...[1, 2, 3, 4].map((time): TimelineEvent => ({
        id: `h${time}`,
        kind: "skill",
        time,
        skillId: hit.id,
      })),
    ];
    expect(
      realtimeTimeline(p, { collect: true })
        .changes.filter((c) => !c.reason)
        .map((e) => e.time),
    ).toEqual([1, 2]);
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.ordinaryBonus),
    ).toEqual([10, 20, 10, 0]);
    e.realtime.activeFor = 3;
    expect(
      realtimeTimeline(p, { collect: true })
        .changes.filter((c) => !c.reason)
        .map((e) => e.time),
    ).toEqual([1, 2, 3]);
    const first = p.timeline[0];
    if (first.kind !== "effectTrigger") throw Error();
    first.usePreset = false;
    expect(
      realtimeTimeline(p, { collect: true })
        .changes.filter((c) => !c.reason)
        .map((e) => e.time),
    ).toEqual([1, 2]);
    expect(parseProject(parseProject(p))).toEqual(parseProject(p));
  });
  it("shared expiry and zero range stop the timer without extending shared duration", () => {
    const p = newProject(),
      c = p.characters[0],
      hit = skill(c.id);
    const e = {
      ...effect(c.id),
      realtime: {
        kind: "sharedPeriodic" as const,
        max: 5,
        initial: 0,
        duration: 2,
        interval: 1,
        delta: 1,
        activeFor: 10,
      },
    };
    p.weapons[0].effects = [e];
    p.skills = [hit];
    p.timeline = [
      {
        id: "t",
        kind: "effectTrigger",
        time: 0,
        effectKey: `weapon-${p.weapons[0].id}-${e.id}`,
        timing: defaultTiming(e),
        usePreset: true,
      },
      { id: "h", kind: "skill", time: 5, skillId: hit.id },
    ];
    expect(
      realtimeTimeline(p, { collect: true })
        .changes.filter((c) => !c.reason)
        .map((e) => e.time),
    ).toEqual([1]);
    e.realtime.activeFor = 0;
    expect(
      realtimeTimeline(p, { collect: true }).changes.filter((c) => !c.reason),
    ).toEqual([]);
  });
});
describe("batch skill scheduling and selection transforms", () => {
  it("counts decimal boundaries and produces individually editable finite events", () => {
    expect(scheduledCount(0.3, 0.1)).toBe(3);
    expect(scheduledCount(null, 1)).toBe(Infinity);
    expect(scheduledCount(0, 1)).toBe(0);
    const events = batchSkills("s", 0.1, 0.1, 0.3);
    expect(events.map((e) => e.time)).toEqual([0.2, 0.3, 0.4]);
    expect(events.every((e) => !("repeat" in e))).toBe(true);
    expect(() => batchSkills("s", 0, 0.000001, 100)).toThrow("10000");
  });
  it("infinite rules expand only through the horizon, produce damage and bound effects, and survive import", () => {
    const p = newProject(),
      c = p.characters[0],
      s = skill(c.id);
    c.atk = 1689;
    c.critRate = 0;
    p.enemy.level = 90;
    p.skills = [s];
    const e = {
      ...effect(c.id),
      name: "绑定",
      type: "增伤区" as const,
      value: 10,
      boundSkillIds: [s.id],
      realtime: {
        kind: "fixed" as const,
        max: 1,
        initial: 0,
        duration: 1,
        interval: 1,
        delta: 1,
      },
    };
    p.weapons[0].effects = [e];
    p.timeline = [
      ...batchSkills(s.id, 0, 1, null),
      { id: "end", kind: "switch", time: 3, characterId: c.id },
    ];
    const rows = calculateProject(p);
    expect(rows.time).toBe(3);
    expect(rows.rows).toHaveLength(3);
    expect(rows.failed).toBe(0);
    expect(rows.total).toBeCloseTo(2970);
    expect(
      sortedTimeline(p.timeline)
        .filter((e) => e.kind === "skill" && e.generatedBy)
        .map((e) => e.time),
    ).toEqual([1, 2, 3]);
    const next = parseProject(p);
    expect(next.timeline).toHaveLength(2);
    expect(calculateProject(next).rows).toHaveLength(3);
    expect(parseProject(next)).toEqual(next);
    p.timeline = p.timeline.slice(0, 1);
    expect(calculateProject(p).rows).toHaveLength(0);
    expect(endTime(p)).toBe(0);
  });
  it("preserves offsets, timing overrides and bindings when copying, moves whole groups, and rejects negative time", () => {
    const p = newProject(),
      c = p.characters[0];
    const e: TimelineEvent = {
      id: "a",
      kind: "skill",
      skillId: "s",
      time: 2,
      effectUsePresets: { fx: false },
    };
    const events: TimelineEvent[] = [
      e,
      { id: "b", kind: "switch", time: 4, characterId: c.id },
      { id: "c", kind: "switch", time: 8, characterId: c.id },
    ];
    const ids = new Set(["a", "b"]);
    expect(
      transformEvents(events, ids, "move", "at", 10).map((e) => e.time),
    ).toEqual([10, 12, 8]);
    const copies = transformEvents(events, ids, "copy", "before", 1);
    expect(copies.map((e) => e.time)).toEqual([2, 4, 8, 1, 3]);
    expect(copies[3].id).not.toBe("a");
    expect(copies[3].effectUsePresets).toEqual({ fx: false });
    expect(() => transformEvents(events, ids, "move", "before", 3)).toThrow(
      "0.00",
    );
    expect(transformEvents(events, ids, "delete").map((e) => e.id)).toEqual([
      "c",
    ]);
  });
});
describe("quick import defaults and set names", () => {
  it("recognizes 4+1 and 2+2 sets, defaults all available fields on and imports name without changing stats", () => {
    const sets = [
      "GladiatorsFinale",
      "GladiatorsFinale",
      "GladiatorsFinale",
      "GladiatorsFinale",
      "WanderersTroupe",
    ];
    const raw = {
      format: "GOOD",
      version: 1,
      characters: [{ key: "Amber", level: 90, constellation: 2 }],
      artifacts: ["flower", "plume", "sands", "goblet", "circlet"].map(
        (slotKey, i) => ({
          slotKey,
          setKey: sets[i],
          mainStatKey: ["hp", "atk", "atk_", "pyro_dmg_", "critRate_"][i],
          level: 20,
          rarity: 5,
          location: "Amber",
          substats: [],
        }),
      ),
      weapons: [{ key: "AmosBow", location: "Amber", level: 90, ascension: 6 }],
    };
    const source = parseGoodImport(raw).characters[0];
    expect(source.artifacts?.name).toBe("角斗士的终幕礼（4件套）");
    expect(
      Object.entries(defaultImportOptions(source))
        .filter(([k]) => k !== "characterBase")
        .every(([, v]) => v),
    ).toBe(true);
    raw.artifacts[2].setKey = raw.artifacts[3].setKey = "WanderersTroupe";
    raw.artifacts[4].setKey = "NoblesseOblige";
    const pair = parseGoodImport(raw).characters[0];
    expect(pair.artifacts?.name).toContain("（2+2）");
    expect(pair.artifacts?.name).toContain("流浪大地的乐团");
    const p = newProject(),
      next = applyQuickImport(p, source, p.characters[0].id, {
        artifactName: true,
      });
    expect(next.artifacts[0].name).toBe(source.artifacts!.name);
    expect(next.artifacts[0].mainStats).toEqual(p.artifacts[0].mainStats);
    expect(artifactSetName(["a", "b", "c", "d", "e"])).toBe("散件");
    expect(artifactSetName([])).toBeUndefined();
  });
  it("Enka uses set-name hash and only marks level20 AND rarity5 as full", () => {
    const piece = (
      equipType: string,
      mainPropId: string,
      statValue: number,
      rankLevel: number,
    ) => ({
      reliquary: { level: 21 },
      flat: {
        itemType: "ITEM_RELIQUARY",
        equipType,
        rankLevel,
        setNameTextMapHash: 1312582827,
        reliquaryMainstat: { mainPropId, statValue },
      },
    });
    const source = parseEnkaImport({
      avatarInfoList: [
        {
          avatarId: 10000021,
          equipList: [
            piece("EQUIP_BRACER", "FIGHT_PROP_HP", 4780, 4),
            piece("EQUIP_NECKLACE", "FIGHT_PROP_ATTACK", 311, 5),
          ],
        },
      ],
    }).characters[0];
    expect(source.artifacts?.mainStat20.flower).toBe(false);
    expect(source.artifacts?.mainStat20.feather).toBe(true);
    expect(source.artifacts?.name).toBe("角斗士的终幕礼（2件套）");
  });
});
