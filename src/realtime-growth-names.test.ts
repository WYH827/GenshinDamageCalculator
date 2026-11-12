import { describe, it, expect } from "vitest";
import { newProject, effect, skill, type TimelineEvent } from "./model";
import { effectCatalog, defaultTiming } from "./effect-catalog";
import {
  syncEffectNames,
  defaultEffectName,
  namedEffect,
} from "./effect-names";
import { calculateProject } from "./damage-engine";
import { activeEffectsAt } from "./effect-state";
import { parseProject } from "./storage";

function fixture() {
  const p = newProject(),
    [attacker, source] = p.characters;
  attacker.name = "桑多涅";
  attacker.atk = 1689;
  attacker.critRate = 0;
  source.name = "奥黛塔";
  const e = {
    ...effect(source.id),
    category: "realtime" as const,
    realtimeKind: "stacking" as const,
    type: "星月增伤" as const,
    value: 15,
    timingPreset: {
      mode: "periodic" as const,
      count: 0,
      duration: null,
      limit: "capped" as const,
      max: 4,
      interval: 1,
      delta: 1,
    },
  };
  p.talents = [
    {
      id: "huacai",
      name: "华彩（队友）",
      characterId: source.id,
      effects: [e],
    },
  ];
  const hit = skill(attacker.id);
  hit.damage.special = "星超导";
  hit.damage.element = "冰";
  p.skills = [hit];
  const key = `talent-huacai-${e.id}`;
  p.timeline = [
    {
      id: "trigger",
      time: 0.3,
      kind: "effectTrigger",
      effectKey: key,
      timing: defaultTiming(e),
      usePreset: true,
    },
    ...[0.2, 0.3, 1.2, 1.3, 1.5, 1.8, 2.3, 4.3, 10].map(
      (time): TimelineEvent => ({
        id: `hit${time}`,
        time,
        kind: "skill",
        skillId: hit.id,
      }),
    ),
  ];
  return { p, key, e };
}
describe("periodic realtime damage effects starting from zero", () => {
  it("enters the actual astral formula at the first tick and caps growth", () => {
    const { p, key } = fixture();
    const result = calculateProject(parseProject(p));
    expect(result.failed).toBe(0);
    const levels = [0, 0, 0, 1, 1, 1, 2, 4, 4];
    result.rows.forEach((r, i) => {
      expect(r.breakdown?.astralBonus).toBe(levels[i] * 15);
      expect(r.expected).toBeCloseTo(2000 * (1 + levels[i] * 0.15) * 0.9);
      expect(r.effects.find((e) => e.key === key)?.stacks ?? 0).toBe(levels[i]);
    });
    expect(
      activeEffectsAt(parseProject(p), "hit1.5").find((r) => r.key === key)
        ?.effect.name,
    ).toBe("奥黛塔天赋/命座华彩（队友）");
  });
  it("zero/negative deltas never grow, duration expires, and a direct zero clears a schedule", () => {
    const { p } = fixture();
    const trigger = p.timeline[0];
    if (trigger.kind !== "effectTrigger") throw new Error();
    for (const delta of [0, -1]) {
      trigger.timing.delta = delta;
      expect(
        calculateProject(p).rows.every((r) => r.breakdown?.astralBonus === 0),
      ).toBe(true);
    }
    trigger.timing.delta = 1;
    trigger.timing.duration = 2;
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.astralBonus),
    ).toEqual([0, 0, 0, 15, 15, 15, 0, 0, 0]);
    trigger.timing.duration = null;
    p.timeline.push({
      ...trigger,
      id: "clear",
      time: 1.6,
      timing: { ...trigger.timing, mode: "direct", count: 0 },
    });
    expect(
      calculateProject(p).rows.map((r) => r.breakdown?.astralBonus),
    ).toEqual([0, 0, 0, 15, 15, 0, 0, 0, 0]);
  });
});
describe("automatic effect names", () => {
  it("uses character + source type + source name for all owned effects", () => {
    const { p, e } = fixture();
    p.weapons[1].name = "星锋剑";
    p.weapons[1].effects = [{ ...e }];
    p.artifacts[1].name = "测试套装";
    p.artifacts[1].effects = [{ ...e }];
    p.skills[0].name = "测试E";
    p.skills[0].effects = [{ ...e }];
    const next = syncEffectNames(p);
    expect(effectCatalog(next).map((r) => r.effect.name)).toEqual([
      "奥黛塔武器星锋剑",
      "奥黛塔圣遗物测试套装",
      "奥黛塔天赋/命座华彩（队友）",
      "桑多涅技能测试E",
    ]);
    const saved = parseProject(JSON.parse(JSON.stringify(next)));
    expect(effectCatalog(saved).map((r) => r.effect.name)).toEqual(
      effectCatalog(next).map((r) => r.effect.name),
    );
    expect(parseProject(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });
  it("updates auto names on owner edits, preserves custom names and allows restoring defaults", () => {
    const { p, e } = fixture();
    p.talents[0].effects.push(
      { ...e, id: "custom", name: "手动名称", nameMode: "custom" },
      { ...e, id: "legacy", name: "旧名称" },
    );
    const next = syncEffectNames(p);
    next.characters[1].name = "新角色";
    next.talents[0].name = "新天赋";
    const renamed = syncEffectNames(next);
    expect(renamed.talents[0].effects.map((e) => e.name)).toEqual([
      "新角色天赋/命座新天赋",
      "手动名称",
      "旧名称",
    ]);
    const defaultName = defaultEffectName(
      renamed.characters,
      renamed.characters[1].id,
      "天赋/命座",
      "新天赋",
    );
    expect(
      namedEffect({ ...e, nameMode: "auto", name: "old" }, defaultName).name,
    ).toBe("新角色天赋/命座新天赋");
    expect(
      namedEffect({ ...e, nameMode: "custom", name: "" }, defaultName).name,
    ).toBe("");
    expect(renamed.timeline).toEqual(p.timeline);
    expect(renamed.talents[0].effects[0].id).toBe(e.id);
  });
});
