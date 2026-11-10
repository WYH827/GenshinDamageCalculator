import { describe, it, expect } from "vitest";
import {
  newProject,
  effect,
  skill,
  type TimelineEvent,
  type RealtimeConfig,
} from "./model";
import { defaultTiming } from "./effect-catalog";
import { buildCombatAxis, axisEventLabel } from "./combat-axis";
import { effectEventBadge } from "./realtime-state";
function setup(kind: RealtimeConfig["kind"] = "independent") {
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
      duration: 5,
      interval: 1,
      delta: 1,
      activeFor: null,
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
  const end = (time: number): TimelineEvent => ({
    id: "end",
    time,
    kind: "skill",
    skillId: s.id,
  });
  return { p, s, e, key, trigger, end };
}
describe("combat axis state trace", () => {
  it("splits independent expiry and grants, with each interval referring to the exact transition", () => {
    const { p, trigger, end } = setup();
    p.timeline = [trigger("a", 0, 2), trigger("b", 2, 1), end(8)];
    const axis = buildCombatAxis(p);
    expect(axis.error).toBeUndefined();
    expect(
      axis.tracks[0].segments.map((s) => [s.start, s.end, s.count]),
    ).toEqual([
      [0, 2, 2],
      [2, 5, 3],
      [5, 7, 1],
    ]);
    const events = new Map(axis.events.map((e) => [e.id, e]));
    expect(
      axis.tracks[0].segments.map((s) => events.get(s.transitionId)?.kind),
    ).toEqual(["trigger", "trigger", "expiry"]);
    expect(
      axis.tracks[0].segments.map((s) => events.get(s.transitionId)?.originId),
    ).toEqual(["a", "b", "b"]);
  });
  it("preserves full-stack refresh boundaries and shared reset gaps", () => {
    const { p, trigger, end } = setup("shared");
    p.timeline = [
      trigger("a", 0, 2),
      trigger("clear", 2, 0),
      trigger("b", 4, 3),
      trigger("refresh", 7, 3),
      end(14),
    ];
    const a = buildCombatAxis(p);
    expect(a.tracks[0].segments.map((s) => [s.start, s.end, s.count])).toEqual([
      [0, 2, 2],
      [4, 7, 3],
      [7, 12, 3],
    ]);
    expect(axisEventLabel(a.events.find((e) => e.originId === "clear")!)).toBe(
      "效果·结束",
    );
    expect(axisEventLabel(a.events.find((e) => e.time === 12)!)).toBe(
      "效果·自动·结束",
    );
  });
  it("periodic boundaries link to individual changes and clip at the DPS end", () => {
    const { p, e, trigger, end } = setup("independentPeriodic");
    e.realtime.delta = 1;
    e.realtime.duration = 20;
    p.timeline = [trigger("a", 0, 0), end(4)];
    const a = buildCombatAxis(p);
    expect(a.tracks[0].segments.map((s) => [s.start, s.end, s.count])).toEqual([
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 3],
    ]);
    expect(
      a.tracks[0].segments.every(
        (s) =>
          a.events.find((e) => e.id === s.transitionId)?.kind === "periodic",
      ),
    ).toBe(true);
    expect(a.events.every((e) => e.time <= 4)).toBe(true);
  });
  it("initial, permanent and global effects cover the correct horizon; same-time changes have no spurious width", () => {
    const { p, e, trigger, end } = setup("independent");
    e.realtime.initial = 2;
    e.realtime.duration = null;
    p.globals = [
      { ...effect(p.characters[0].id), name: "全局", category: "global" },
    ];
    p.timeline = [trigger("a", 1, 1), trigger("b", 1, -2), end(6)];
    const a = buildCombatAxis(p);
    expect(a.tracks[0].segments.map((s) => [s.start, s.end, s.count])).toEqual([
      [0, 1, 2],
      [1, 6, 1],
    ]);
    expect(a.events[0].kind).toBe("initial");
    expect(a.globalKeys).toHaveLength(1);
    expect(a.events.filter((e) => e.time === 1)).toHaveLength(2);
    p.timeline = [];
    expect(buildCombatAxis(p).tracks).toEqual([]);
  });
  it("skill bindings and generated repeats use the actual release as their source without duplicate triggers", () => {
    const { p, s, e, end } = setup("fixed");
    e.boundSkillIds = [s.id];
    p.timeline = [
      {
        id: "loop",
        kind: "skill",
        time: 0,
        skillId: s.id,
        repeat: { interval: 1, duration: null },
      },
      end(3),
    ];
    const a = buildCombatAxis(p);
    expect(
      a.events.filter((e) => e.kind === "trigger").map((e) => e.originId),
    ).toEqual(["loop~1", "loop~2", "loop~3", "end"]);
    expect(a.events.find((e) => e.originId === "loop~1")?.automatic).toBe(true);
    expect(a.tracks[0].segments.map((s) => [s.start, s.end])).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });
  it("fixed refreshes remain unlayered, legacy effects upgrade without changing input, badges distinguish endings", () => {
    const { p, e, trigger, end } = setup("fixed");
    p.timeline = [trigger("a", 0), trigger("b", 3), end(10)];
    const original = structuredClone(p);
    const a = buildCombatAxis(p);
    expect(a.tracks[0].stacking).toBe(false);
    expect(a.tracks[0].segments.map((s) => [s.start, s.end])).toEqual([
      [0, 3],
      [3, 8],
    ]);
    expect(p).toEqual(original);
    delete (e as Partial<typeof e>).realtime;
    expect(buildCombatAxis(p).tracks).toHaveLength(1);
    expect(effectEventBadge(true, false)).toBe("效果·结束");
    expect(effectEventBadge(true, true)).toBe("效果·自动·结束");
    expect(effectEventBadge(false, true)).toBe("效果·自动");
  });
});
