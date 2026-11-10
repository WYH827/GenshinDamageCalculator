import { test, expect, type Page } from "@playwright/test";
import { newProject, effect, skill, STORAGE_KEY } from "../src/model";
const nav = async (page: Page, name: string) => {
  await page.locator("nav").getByRole("button", { name }).click();
  if (name === "计算结果") {
    await page.getByRole("button", { name: "开始计算", exact: true }).click();
    await expect(page.locator(".calculation-status")).toContainText(
      "已完成计算",
    );
  }
};

test("calculates ordinary damage, exposes formula and updates levels, constellation naming and DPS", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("角色名称", { exact: true }).fill("木偶");
  await page.getByLabel("角色简写", { exact: false }).fill("偶");
  await page.getByLabel("命座", { exact: true }).fill("2");
  const levels = page.getByRole("combobox", { name: "角色等级", exact: true });
  await expect(levels).toHaveValue("90");
  await expect(levels.locator("option")).toHaveCount(3);
  await expect(levels.locator('option[value="91"]')).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "命星数", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("基础攻击力", { exact: true }).fill("1000");
  await expect(page.getByLabel("基础暴击率", { exact: false })).toBeDisabled();
  await expect(
    page.getByLabel("基础暴击伤害", { exact: false }),
  ).toBeDisabled();
  // Legacy imports preserve mixed character bonuses while the new base controls stay locked.
  const seed = newProject();
  Object.assign(seed.characters[0], {
    name: "木偶",
    short: "偶",
    constellation: "2",
    atk: 1000,
    critRate: 50,
    critDamage: 100,
    bonus: 50,
  });
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(seed)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "武器");
  const w = page.locator(".equipment-panel").first();
  await w.getByLabel("武器基础攻击力", { exact: true }).fill("689");
  await w.getByLabel("武器简写", { exact: false }).fill("1");
  await nav(page, "敌方属性");
  await page
    .getByRole("spinbutton", { name: "怪物等级", exact: false })
    .fill("90");
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("button", { name: "添加环境/共鸣效果", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("效果名称", { exact: true }).fill("基础提高100");
  await dialog
    .getByRole("combobox", { name: "效果类型", exact: true })
    .selectOption("基础值加成");
  await expect(
    dialog.getByRole("combobox", { name: "数值单位", exact: true }),
  ).toHaveValue("flat");
  await dialog
    .getByRole("spinbutton", { name: "效果数值", exact: false })
    .fill("100");
  await dialog.getByRole("button", { name: "保存效果" }).click();
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "添加技能", exact: true })
    .first()
    .click();
  await page.getByLabel("技能名称", { exact: true }).fill("木偶E");
  await page
    .getByRole("spinbutton", { name: "技能倍率", exact: false })
    .fill("200");
  await page.getByRole("button", { name: "完成编辑" }).click();
  await nav(page, "时间轴");
  await page.getByRole("button", { name: "添加技能事件" }).click();
  await dialog
    .getByRole("spinbutton", { name: "起始时间", exact: false })
    .fill("10");
  await page.getByRole("button", { name: "添加到时间轴" }).click();
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("4,151.25");
  await expect(page.getByTestId("total-dps")).toHaveText("415.125");
  await expect(page.locator(".damage-value")).toContainText("4,151.25");
  await page.locator(".damage-event>summary").click();
  await expect(page.locator(".hit-outcomes")).toContainText("2,767.5");
  await expect(page.locator(".hit-outcomes")).toContainText("5,535");
  await expect(page.locator(".factor-list")).toContainText(
    "角色90级 / 敌人90级",
  );
  await expect(page.locator(".effect-usage.applied")).toContainText("参与伤害");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("damage-desktop.png"),
    fullPage: true,
  });
  await nav(page, "角色");
  await levels.selectOption("95");
  await expect(page.locator(".character-card").first()).toContainText("1 命星");
  await nav(page, "计算结果");
  await expect(page.locator(".result-teamline")).toContainText("95级21偶");
  await expect(page.getByTestId("total-damage")).not.toHaveText("4,151.25");
  await nav(page, "角色");
  await levels.selectOption("100");
  await expect(page.locator(".character-card").first()).toContainText("3 命星");
  await expect(page.locator(".summary-team")).toContainText("100级21偶");
  await page.getByRole("button", { name: "展开 1–89 级", exact: true }).click();
  await page.getByRole("button", { name: "选择 1 级", exact: true }).click();
  await expect(page.locator(".summary-team")).toContainText("21偶");
  await expect(page.locator(".summary-team")).not.toContainText("1级");
  await levels.selectOption("90");
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).characters[0].level,
        STORAGE_KEY,
      ),
    )
    .toBe(90);
  await page.reload();
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("4,151.25");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".damage-event>summary").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("damage-mobile.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("astral effects sum while the coefficient is provided per event", async ({
  page,
}) => {
  const p = newProject(),
    c = p.characters[0];
  Object.assign(c, {
    name: "木偶",
    short: "偶",
    atk: 1000,
    critRate: 50,
    critDamage: 100,
    mastery: 400,
    level: 95,
    stars: 1,
    constellation: "2",
  });
  p.weapons[0].atk = 689;
  const s = skill(c.id);
  s.name = "星超导直伤";
  s.damage.special = "星超导";
  s.multiplier = 200;
  p.skills = [s];
  p.globals = [
    {
      ...effect(c.id, true),
      name: "基础提升",
      type: "星月基础提升",
      value: 20,
    },
    { ...effect(c.id, true), name: "专属增伤", type: "星月增伤", value: 30 },
    {
      ...effect(c.id, true),
      name: "额外提升",
      type: "星月额外提升",
      unit: "flat",
      value: 500,
    },
    { ...effect(c.id, true), name: "天赋擢升", type: "擢升", value: 10 },
    {
      ...effect(c.id, true),
      name: "普通增伤不参与星月",
      type: "增伤区",
      value: 999,
    },
  ];
  p.timeline = [{ id: "hit", time: 5, kind: "skill", skillId: s.id }];
  await page.goto("/");
  await page.locator('input[aria-label="导入方案文件"]').setInputFiles({
    name: "astral.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "编辑技能 星超导直伤", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "星月基础提升 %", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("spinbutton", { name: "擢升最终乘数", exact: false }),
  ).toHaveCount(0);
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("17,136.9");
  await page.locator(".damage-event>summary").click();
  await expect(page.locator(".effect-usage.excluded")).toContainText(
    "星月直伤不使用",
  );
  await nav(page, "时间轴");
  await page
    .getByRole("combobox", { name: "本次星超导层数", exact: true })
    .selectOption("13");
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("33,531.3");
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("button", { name: "编辑效果 普通增伤不参与星月" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "效果类型", exact: true })
    .selectOption("擢升");
  await dialog
    .getByRole("spinbutton", { name: "效果数值", exact: false })
    .fill("5");
  await dialog.getByRole("button", { name: "保存效果" }).click();
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("35,055.45");
  await expect(page.getByTestId("total-dps")).toHaveText("7,011.09");
  await page.locator(".damage-event>summary").click();
  await expect(page.locator(".factor-list")).toContainText(
    "15% → 1 + 15% = 1.15",
  );
});
