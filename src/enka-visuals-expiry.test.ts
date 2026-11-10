import { describe, it, expect } from "vitest";
import fixture from "../tests/fixtures/enka-equipment.json";
import reference from "./data/import-reference.json";
import {
  parseEnkaImport,
  parseGoodImport,
  applyBatchQuickImport,
  defaultImportOptions,
} from "./quick-import";
import {
  effect,
  newProject,
  skill,
  type TimelineEvent,
  type RealtimeConfig,
} from "./model";
import { realtimeTimeline } from "./realtime-state";
import { defaultTiming, eventTiming } from "./effect-catalog";
import { parseProject, parsePreset } from "./storage";
import { boundedActiveFor } from "./schedule";
describe("verified Enka data and batch import", () => {
  it("uses raw base HP/DEF and subtracts precise weapon attack, not final panel attack", () => {
    const account = parseEnkaImport(fixture);
    expect(account.characters).toHaveLength(4);
    const c = account.characters[0],
      raw = fixture.avatarInfoList[0];
    expect(c.baseStats?.hp).toBe(raw.fightPropMap["1"]);
    expect(c.baseStats?.def).toBe(raw.fightPropMap["7"]);
    const w = reference.enkaWeaponBases["3933622347"];
    const curves = reference.curves as Record<string, number[]>;
    const weapon = w.base * curves[w.curve][89] + w.promote[6];
    expect(c.baseStats?.atk).toBeCloseTo(raw.fightPropMap["4"] - weapon, 8);
    expect(c.baseStats!.atk).toBeGreaterThan(220);
    expect(c.baseStats!.atk).toBeLessThan(225);
    expect(c.avatarUrl).toContain("UI_AvatarIcon_Side_Ambor");
    expect(c.weapon?.iconUrl).toContain("UI_EquipIcon");
    expect(account.characters[1].artifacts?.name).toContain("4件套");
    const pair = account.characters.find((c) =>
      c.artifacts?.name?.includes("2+2"),
    )!;
    expect(pair).toBeDefined();
    expect(pair.artifacts?.iconUrls).toHaveLength(2);
    expect(pair.artifacts?.iconUrls?.every((u) => u.endsWith("_4.png"))).toBe(
      true,
    );
    const p = newProject();
    const mapped = account.characters.map((c, i) => ({
      targetId: p.characters[i].id,
      sourceKey: c.key,
    }));
    const next = applyBatchQuickImport(p, account, mapped);
    expect(next.characters.map((c) => c.name)).toEqual(
      account.characters.map((c) => c.name),
    );
    expect(next.characters[0].atk).toBe(c.baseStats?.atk);
    expect(next.weapons[0].iconUrl).toBe(c.weapon?.iconUrl);
    expect(next.artifacts[0].iconUrls).toEqual(c.artifacts?.iconUrls);
    const saved = parseProject(next);
    expect(parseProject(saved)).toEqual(saved);
    expect(saved.characters[0].avatarUrl).toBe(c.avatarUrl);
    expect(
      parsePreset({
        id: "p",
        kind: "weapon",
        name: "w",
        data: next.weapons[0],
      }),
    ).toMatchObject({ data: { iconUrl: c.weapon?.iconUrl } });
    expect(() =>
      applyBatchQuickImport(p, account, [
        mapped[0],
        { ...mapped[1], sourceKey: mapped[0].sourceKey },
      ]),
    ).toThrow("匹配一次");
    expect(p.characters[0].name).toBe("");
  });
  it("does not invent missing base stats; GOOD resolves portraits/equipment icons and allows skipping slots", () => {
    const missing = parseEnkaImport({
      avatarInfoList: [{ avatarId: 10000114, equipList: [] }],
    }).characters[0];
    expect(missing.avatarUrl).toBe(
      "https://enka.network/ui/UI_AvatarIcon_Side_SkirkNew.png",
    );
    expect(missing.baseStats).toBeUndefined();
    expect(defaultImportOptions(missing).characterBase).toBe(false);
    const account = parseGoodImport({
      format: "GOOD",
      version: 1,
      characters: [{ key: "Amber", level: 90 }],
      weapons: [{ key: "AmosBow", location: "Amber", level: 90, ascension: 6 }],
    });
    expect(account.characters[0].avatarUrl).toContain("Ambor");
    expect(account.characters[0].weapon?.iconUrl).toContain("Bow_Amos");
    const p = newProject(),
      next = applyBatchQuickImport(
        p,
        account,
        [
          {
            targetId: p.characters[0].id,
            sourceKey: account.characters[0].key,
          },
          { targetId: p.characters[1].id, sourceKey: "" },
        ],
        { characterName: false },
      );
    expect(next.characters[0].name).toBe("");
    expect(next.characters[1]).toEqual(p.characters[1]);
    expect(next.characters[0].avatarUrl).toContain("Ambor");
  });
});
describe("expiry events and shared range constraint", () => {
  function setup(kind: RealtimeConfig["kind"] = "fixed") {
    const p = newProject(),
      c = p.characters[0],
      s = skill(c.id);
    p.skills = [s];
    const e = {
      ...effect(c.id),
      name: "效果",
      realtime: {
        kind,
        max: 3,
        initial: 0,
        duration: 3,
        interval: 1,
        delta: 1,
        activeFor: 2,
      },
    };
    p.weapons[0].effects = [e];
    const key = `weapon-${p.weapons[0].id}-${e.id}`;
    const trigger = (id: string, time: number, count = 1): TimelineEvent => ({
      id,
      time,
      kind: "effectTrigger",
      effectKey: key,
      timing: { ...defaultTiming(e), count },
      usePreset: true,
    });
    return { p, e, trigger };
  }
  it("shows a single refreshed fixed expiry beyond timeline without changing end time", () => {
    const { p, trigger } = setup();
    p.timeline = [trigger("a", 0), trigger("b", 2)];
    const changes = realtimeTimeline(p, { collect: true }).changes;
    expect(changes.map((c) => [c.reason, c.time, c.count])).toEqual([
      ["expiry", 5, 0],
    ]);
    expect(p.timeline).toHaveLength(2);
  });
  it("shows per-batch expiry, final end, and explicit clearing", () => {
    const { p, trigger } = setup("independent");
    p.timeline = [trigger("a", 0, 2), trigger("b", 1, 1)];
    expect(
      realtimeTimeline(p, { collect: true }).changes.map((c) => [
        c.time,
        c.delta,
        c.count,
      ]),
    ).toEqual([
      [3, -2, 1],
      [4, -1, 0],
    ]);
    p.timeline.push(trigger("clear", 2, -3));
    expect(
      realtimeTimeline(p, { collect: true }).changes.map((c) => [
        c.time,
        c.reason,
        c.count,
      ]),
    ).toEqual([[2, "cleared", 0]]);
  });
  it("finishes a finite periodic schedule after last action and shows its eventual end", () => {
    const { p, trigger } = setup("independentPeriodic");
    p.timeline = [trigger("a", 0, 0)];
    expect(
      realtimeTimeline(p, { collect: true }).changes.map((c) => [
        c.time,
        c.reason ?? "tick",
        c.count,
      ]),
    ).toEqual([
      [1, "tick", 1],
      [2, "tick", 2],
      [4, "expiry", 1],
      [5, "expiry", 0],
    ]);
  });
  it("clamps shared periodic range for defaults and overrides including permanent ranges", () => {
    const { e } = setup("sharedPeriodic");
    e.realtime.activeFor = 9;
    expect(defaultTiming(e).activeFor).toBe(3);
    expect(
      eventTiming(
        e,
        { ...defaultTiming(e), duration: 1, activeFor: null },
        false,
      ).activeFor,
    ).toBe(1);
    expect(boundedActiveFor("sharedPeriodic", null, null)).toBeNull();
    expect(boundedActiveFor("independentPeriodic", 3, 9)).toBe(9);
  });
});
