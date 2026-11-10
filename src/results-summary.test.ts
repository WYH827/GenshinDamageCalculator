import { describe, expect, it } from "vitest";
import { effect, newProject, skill, starSuperconduct } from "./model";
import { parseProject } from "./storage";
import { calculateProject } from "./damage-engine";
import { summarizeDamage } from "./damage-summary";
import { calculateOutsidePanels } from "./panels";

function fixture() {
  const p = newProject();
  p.characters[0].atk = 1689;
  p.characters[0].critRate = 50;
  p.characters[0].critDamage = 100;
  p.characters[1].atk = 1689;
  p.characters[1].critRate = 0;
  p.characters[1].critDamage = 200;
  p.enemy.level = 90;
  p.skills = p.characters.slice(0, 2).map((c) => skill(c.id));
  p.timeline = p.skills.map((s, i) => ({
    id: `hit${i}`,
    kind: "skill",
    skillId: s.id,
    time: i + 1,
  }));
  return p;
}
describe("result display modes and shares", () => {
  it.each([
    ["expected", 2250, [1350, 900], [60, 40]],
    ["crit", 4500, [1800, 2700], [40, 60]],
    ["nonCrit", 1800, [900, 900], [50, 50]],
  ] as const)(
    "%s sums all events and four characters",
    (mode, total, amounts, shares) => {
      const p = fixture(),
        rows = calculateProject(p).rows;
      const summary = summarizeDamage(
        rows,
        p.characters.map((c) => c.id),
        2,
        mode,
      );
      expect(summary.total).toBeCloseTo(total);
      expect(summary.dps).toBeCloseTo(total / 2);
      expect(summary.characters.map((c) => c.damage)).toEqual([
        ...amounts,
        0,
        0,
      ]);
      expect(summary.characters.map((c) => c.percent)).toEqual([
        ...shares,
        0,
        0,
      ]);
      expect(
        summarizeDamage(
          rows,
          p.characters.map((c) => c.id),
          0,
          mode,
        ).dps,
      ).toBeNull();
    },
  );
  it("does not present failed or overflowing aggregates as complete, and handles zero damage", () => {
    const p = fixture(),
      rows = calculateProject(p).rows,
      ids = p.characters.map((c) => c.id);
    rows[0].error = "invalid";
    expect(summarizeDamage(rows, ids, 2, "crit")).toMatchObject({
      total: null,
      partial: 2700,
      dps: null,
      failed: 1,
    });
    expect(
      summarizeDamage(rows, ids, 2, "crit").characters[0].damage,
    ).toBeNull();
    delete rows[0].error;
    rows.forEach((r) => (r.crit = Number.MAX_VALUE));
    expect(summarizeDamage(rows, ids, 2, "crit")).toMatchObject({
      total: null,
      partial: null,
      overflow: true,
    });
    rows.forEach((r) => (r.crit = 0));
    expect(
      summarizeDamage(rows, ids, 2, "crit").characters.every(
        (c) => c.percent === 0,
      ),
    ).toBe(true);
  });
  it("outside panels include opted-in globals and exclude every timeline buff even on non-damage characters", () => {
    const p = fixture(),
      id = p.characters[3].id;
    p.globals = [
      {
        ...effect(id),
        category: "global",
        outsideActive: true,
        target: "custom",
        targetIds: [id],
        value: 100,
        unit: "flat",
      },
    ];
    p.timeline.unshift({
      id: "buff",
      kind: "effect",
      time: 0,
      effect: { ...effect(id), target: "self", value: 500, unit: "flat" },
    });
    const rows = calculateOutsidePanels(p)[3].rows;
    expect(rows.find((r) => r.stat === "攻击力")?.value).toBe(411);
    expect(rows.filter((r) => r.stat.includes("伤害加成"))).toHaveLength(8);
  });
});
describe("one-based star layers and migration", () => {
  it("maps layers 1/2/13 and rejects zero", () => {
    expect(starSuperconduct(1)).toMatchObject({
      energy: 0,
      bonus: 20,
      coefficient: 1,
    });
    expect(starSuperconduct(2)).toMatchObject({
      energy: 1,
      bonus: 29,
      coefficient: 1.45,
    });
    expect(starSuperconduct(13)).toMatchObject({
      energy: 12,
      bonus: 40,
      coefficient: 2,
    });
    expect(() => starSuperconduct(0)).toThrow();
  });
  it("migrates old 0–12 values exactly once and keeps their original coefficients", () => {
    const p = fixture();
    delete p.starStackVersion;
    p.skills[0].damage.special = "星超导";
    p.timeline = Array.from({ length: 13 }, (_, energy) => ({
      id: `old${energy}`,
      kind: "skill",
      time: energy,
      skillId: p.skills[0].id,
      starStacks: energy,
    }));
    const next = parseProject(JSON.parse(JSON.stringify(p)));
    expect(next.starStackVersion).toBe(2);
    expect(
      next.timeline.map((e) => (e.kind === "skill" ? e.starStacks : null)),
    ).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect(
      calculateProject(next).rows.map((r) => r.breakdown?.astralCoefficient),
    ).toEqual([
      1, 1.45, 1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95, 2,
    ]);
    expect(parseProject(JSON.parse(JSON.stringify(next)))).toEqual(next);
    if (next.timeline[0].kind === "skill") next.timeline[0].starStacks = 0;
    expect(() => parseProject(next)).toThrow("1～13");
  });
});
