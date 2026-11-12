import { expect, it } from "vitest";
import {
  effect,
  skill,
  newProject,
  foregroundAt,
  sortedTimeline,
  endTime,
  type Effect,
} from "./model";
import { calculateProject } from "./damage-engine";
import { createPanelResolver } from "./panels";
import { parseProject } from "./storage";
import { defaultTiming, effectCatalog } from "./effect-catalog";
import { realtimeTimeline } from "./realtime-state";
import { buildCombatAxis } from "./combat-axis";
import { defaultEffectName } from "./effect-names";
import { copyTimelineEvent } from "./timeline-batch";

function fixture() {
  const p = newProject(),
    c = p.characters[0];
  Object.assign(c, { name: "芙宁娜", atk: 1000 });
  const s = skill(c.id);
  s.name = "芙宁娜Q";
  s.damage.element = "冰";
  p.skills = [s];
  p.timeline = [{ id: "hit", kind: "skill", skillId: s.id, time: 5 }];
  return p;
}
it("disabled events are preserved but do not deal damage, change the foreground or extend DPS", () => {
  const p = fixture();
  p.timeline.unshift({
    id: "switch",
    kind: "switch",
    characterId: p.characters[1].id,
    time: 1,
    enabled: false,
  });
  p.timeline.push({
    id: "off",
    kind: "skill",
    skillId: p.skills[0].id,
    time: 20,
    enabled: false,
  });
  const next = parseProject(p);
  expect(next.timeline).toHaveLength(3);
  expect(endTime(next)).toBe(5);
  expect(foregroundAt(next, "hit")).toBe(next.characters[0].id);
  expect(calculateProject(next).rows.map((r) => r.event.id)).toEqual(["hit"]);
  next.timeline[2].enabled = true;
  expect(endTime(next)).toBe(20);
});
it("global, triggered and bound effect switches remove every contribution including layer traces", () => {
  const p = fixture(),
    id = p.characters[0].id;
  const e: Effect = {
    ...effect(id),
    name: "buff",
    type: "攻击力",
    unit: "flat",
    value: 500,
    realtime: {
      kind: "sharedPeriodic",
      initial: 1,
      max: 3,
      duration: 8,
      interval: 1,
      delta: 1,
    },
    boundSkillIds: [p.skills[0].id],
  };
  p.weapons[0].effects = [e];
  const key = effectCatalog(p)[0].key;
  p.timeline.unshift({
    id: "trigger",
    kind: "effectTrigger",
    time: 0,
    effectKey: key,
    timing: defaultTiming(e),
    enabled: false,
  });
  p.timeline[1].disabledEffectKeys = [key];
  const baseline = calculateProject(p).total!;
  e.enabled = false;
  expect(calculateProject(p).total!).toBeLessThan(baseline);
  expect(realtimeTimeline(p, { collect: true }).changes).toEqual([]);
  expect(buildCombatAxis(p).tracks).toEqual([]);
  e.category = "global";
  e.outsideActive = true;
  expect(buildCombatAxis(p).globalKeys).toEqual([]);
  const resolver = createPanelResolver(parseProject(p), "hit");
  expect(resolver.resolve(id, "攻击力", "outside")).toBe(1311);
  e.enabled = true;
  expect(createPanelResolver(p, "hit").resolve(id, "攻击力", "outside")).toBe(
    1811,
  );
});
it("generated occurrences can be switched off independently and the rule can be disabled", () => {
  const p = fixture();
  p.timeline = [
    {
      ...p.timeline[0],
      time: 0,
      kind: "skill",
      skillId: p.skills[0].id,
      repeat: { interval: 1, duration: 3 },
      disabledOccurrences: ["hit~2"],
    },
  ];
  const restored = parseProject(p);
  expect(calculateProject(restored).rows.map((r) => r.event.time)).toEqual([
    1, 3,
  ]);
  expect(sortedTimeline(restored.timeline, true)).toHaveLength(4);
  const copied = copyTimelineEvent(restored.timeline[0]);
  expect(
    calculateProject({ ...restored, timeline: [copied] }).rows.map(
      (r) => r.event.time,
    ),
  ).toEqual([1, 3]);
  restored.timeline[0].enabled = false;
  expect(calculateProject(restored).rows).toEqual([]);
});
it("element and action filtered crit affect only matching hits, not the universal panel", () => {
  const p = fixture(),
    id = p.characters[0].id;
  const e: Effect = {
    ...effect(id, true),
    category: "global",
    type: "暴击伤害",
    value: 50,
    damage: { element: "冰", attack: "全部", scaling: "全部", special: "" },
  };
  const rate = { ...e, id: "rate", type: "暴击率" as const, value: 95 };
  p.globals = [e, rate];
  const fire = {
    ...p.skills[0],
    id: "fire",
    damage: { ...p.skills[0].damage, element: "火" as const },
  };
  p.skills.push(fire);
  p.timeline.push({ id: "fireHit", kind: "skill", skillId: fire.id, time: 5 });
  const result = calculateProject(parseProject(p));
  expect(result.failed).toBe(0);
  expect(result.rows[0].breakdown).toMatchObject({
    critRate: 100,
    critDamage: 100,
  });
  expect(result.rows[1].breakdown).toMatchObject({
    critRate: 5,
    critDamage: 50,
  });
  expect(result.rows[0].expected).toBe(result.rows[0].crit);
  expect(createPanelResolver(p, "hit").resolve(id, "暴击伤害", "live")).toBe(
    50,
  );
  e.damage.attack = "大招";
  expect(calculateProject(p).rows[0].breakdown?.critDamage).toBe(50);
});
it("skill effect defaults remove only the leading owner name", () => {
  const p = fixture(),
    id = p.characters[0].id;
  expect(defaultEffectName(p.characters, id, "技能", "芙宁娜Q")).toBe(
    "芙宁娜技能Q",
  );
  expect(defaultEffectName(p.characters, id, "技能", "Q芙宁娜")).toBe(
    "芙宁娜技能Q芙宁娜",
  );
});
