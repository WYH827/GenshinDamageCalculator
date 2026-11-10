import { test, expect } from "@playwright/test";
import { effect, newProject, skill, STORAGE_KEY } from "../src/model";

test("per-event amplification locks elements, excludes astral hits, computes and persists", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const p = newProject(),
    c = p.characters[0];
  c.name = "测试";
  c.atk = 1689;
  c.critRate = 0;
  p.enemy.level = 90;
  const skills = (["火", "水", "冰", "雷", "火"] as const).map(
    (element, i) => ({
      ...skill(c.id),
      name: `技能${i}`,
      damage: {
        ...skill(c.id).damage,
        element,
        special: i === 4 ? ("月感电" as const) : ("" as const),
      },
    }),
  );
  p.skills = skills;
  p.timeline = skills.map((s, i) => ({
    id: `hit${i}`,
    kind: "skill",
    skillId: s.id,
    time: i + 1,
  }));
  const buff = {
    ...effect(c.id),
    name: "蒸发提高",
    type: "增幅反应增伤" as const,
    value: 10,
    amplificationReaction: "蒸发" as const,
  };
  p.globals = [buff];
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "amp.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  const nav = (name: string) =>
    page.locator("nav").getByRole("button", { name }).click();
  await nav("时间轴");
  const rows = page.locator(".timeline-row:not(.global-event)");
  await expect(page.getByLabel("是增幅反应伤害", { exact: true })).toHaveCount(
    3,
  );
  const reaction = (i: number) =>
    rows.nth(i).getByRole("combobox", { name: "本次增幅反应", exact: true });
  for (const i of [0, 1, 2])
    await rows.nth(i).getByLabel("是增幅反应伤害", { exact: true }).check();
  await expect(reaction(0)).toBeEnabled();
  await reaction(0).selectOption("融化");
  await expect(reaction(1)).toHaveValue("蒸发");
  await expect(reaction(1)).toBeDisabled();
  await expect(reaction(2)).toHaveValue("融化");
  await expect(reaction(2)).toBeDisabled();
  await rows
    .nth(0)
    .getByRole("button", { name: "复制事件 技能0", exact: true })
    .click();
  await expect(page.getByLabel("是增幅反应伤害", { exact: true })).toHaveCount(
    4,
  );
  await rows.nth(1).getByLabel("是增幅反应伤害", { exact: true }).uncheck();
  await expect(
    rows.nth(0).getByLabel("是增幅反应伤害", { exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: info.outputPath("timeline.png"),
    fullPage: true,
  });
  await nav("计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  const amounts = page.locator(".damage-value");
  for (const [i, expected] of [
    "1,800",
    "900",
    "1,980",
    "1,350",
    "900",
    "5,400",
  ].entries())
    await expect(amounts.nth(i)).toContainText(expected);
  await page.locator(".damage-event summary").nth(2).click();
  await expect(page.locator(".factor-list")).toContainText(
    "蒸发 · 水 → 火 · 基础系数 2",
  );
  await expect(page.locator(".factor-list")).toContainText("2.2");
  await expect(page.locator(".active-effects")).toContainText("蒸发提高");
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).timeline.find(
            (e: { id: string }) => e.id === "hit1",
          ).amplification,
        STORAGE_KEY,
      ),
    )
    .toBe("蒸发");
  await page.reload();
  await nav("时间轴");
  await expect(
    rows.nth(2).getByRole("combobox", { name: "本次增幅反应", exact: true }),
  ).toHaveValue("蒸发");
  await rows
    .nth(0)
    .getByRole("combobox", { name: "时间轴技能", exact: true })
    .selectOption(skills[4].id);
  await expect(
    rows.nth(0).getByLabel("是增幅反应伤害", { exact: true }),
  ).toHaveCount(0);
  await rows
    .nth(0)
    .getByRole("combobox", { name: "时间轴技能", exact: true })
    .selectOption(skills[0].id);
  await expect(
    rows.nth(0).getByLabel("是增幅反应伤害", { exact: true }),
  ).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
