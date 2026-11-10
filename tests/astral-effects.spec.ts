import { expect, test, type Page } from "@playwright/test";
import { effect, newProject, skill, STORAGE_KEY } from "../src/model";
const nav = async (page: Page, name: string) => {
  await page.locator("nav").getByRole("button", { name }).click();
  if (name === "计算结果") {
    await page.getByRole("button", { name: "开始计算", exact: true }).click();
    await expect(page.locator(".calculation-status")).toContainText(
      "已完成计算",
    );
  }
};

test("level 1–89 is collapsed, expandable, keyboard reachable and keeps the selected low level", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const levels = page.getByRole("combobox", { name: "角色等级", exact: true });
  await expect(levels.locator("option")).toHaveText([
    "90 级",
    "95 级",
    "100 级",
  ]);
  const toggle = page.getByRole("button", {
    name: "展开 1–89 级",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await page.keyboard.press("Enter");
  const group = page.getByRole("group", { name: "1–89级", exact: true });
  await expect(group.getByRole("button")).toHaveCount(89);
  await page.screenshot({
    path: testInfo.outputPath("levels-open.png"),
    fullPage: true,
  });
  await group.getByRole("button", { name: "选择 89 级", exact: true }).click();
  await expect(group).toHaveCount(0);
  await expect(levels).toHaveValue("89");
  await expect(page.locator(".character-card").first()).toContainText(
    "等待加入队伍",
  );
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).characters[0].level,
        STORAGE_KEY,
      ),
    )
    .toBe(89);
  await page.reload();
  await expect(levels).toHaveValue("89");
  await expect(group).toHaveCount(0);
  await levels.selectOption("100");
  await expect(levels.locator("option")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await toggle.click();
  await expect(group).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("skill inputs removed and talent plus weapon uplift sum to 15 percent", async ({
  page,
}) => {
  const p = newProject(),
    c = p.characters[0];
  c.name = "A";
  c.atk = 1000;
  c.critRate = 0;
  c.critDamage = 0;
  p.weapons[0].atk = 689;
  const s = skill(c.id);
  s.name = "星超导E";
  s.damage.special = "星超导";
  p.skills = [s];
  p.timeline = [{ id: "hit", time: 5, kind: "skill", skillId: s.id }];
  p.talents = [
    {
      id: "talent",
      name: "A天赋",
      characterId: c.id,
      effects: [
        {
          ...effect(c.id),
          name: "天赋擢升",
          global: true,
          type: "擢升",
          value: 10,
        },
      ],
    },
  ];
  await page.goto("/");
  await page.locator('input[aria-label="导入方案文件"]').setInputFiles({
    name: "test.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "编辑技能 星超导E", exact: true })
    .click();
  for (const name of [
    "星超导系数",
    "星月基础提升",
    "星月专属增伤",
    "星月额外提升",
    "擢升最终乘数",
  ])
    await expect(
      page.getByRole("spinbutton", { name, exact: false }),
    ).toHaveCount(0);
  await nav(page, "武器");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  const w = page.locator(".equipment-panel").first();
  await w.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  await w.getByLabel("效果名称", { exact: true }).fill("B武器擢升");
  await w
    .getByRole("combobox", { name: "效果类型", exact: true })
    .selectOption("擢升");
  await expect(
    w.getByRole("combobox", { name: "数值单位", exact: true }),
  ).toBeDisabled();
  await expect(
    w.getByRole("combobox", { name: "数值单位", exact: true }),
  ).toHaveValue("percent");
  await w.getByLabel("效果数值", { exact: false }).fill("5");
  await w
    .getByRole("combobox", { name: "效果分类", exact: true })
    .selectOption("global");
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("2,070");
  await page.locator(".damage-event>summary").click();
  await expect(page.locator(".factor-list")).toContainText(
    "15% → 1 + 15% = 1.15",
  );
  await nav(page, "时间轴");
  await page
    .getByRole("combobox", { name: "本次星超导层数", exact: true })
    .selectOption("13");
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("4,140");
  await nav(page, "武器");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await w
    .getByRole("combobox", { name: "数值方式", exact: true })
    .selectOption("outside");
  await w.getByLabel("高级公式", { exact: true }).check();
  await w.getByLabel("公式 1", { exact: true }).fill("x / 400");
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("4,140");
  await page.locator(".damage-event>summary").click();
  await expect(
    page.locator(".active-effect").filter({ hasText: "B武器擢升" }),
  ).toContainText("效果数值：5%");
});
