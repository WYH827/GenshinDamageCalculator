import { test, expect, type Page } from "@playwright/test";
import {
  effect,
  newProject,
  skill,
  STORAGE_KEY,
  type Project,
} from "../src/model";

async function load(page: Page, p: Project) {
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "stacks.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
}
async function nav(page: Page, name: string) {
  await page.locator("nav").getByRole("button", { name }).click();
}

test("formula preset converts attack to mastery and survives saving and reload", async ({
  page,
}) => {
  const p = newProject(),
    c = p.characters[0];
  c.name = "桑多涅";
  c.atk = 1689;
  const hit = skill(c.id);
  hit.name = "测试伤害";
  p.skills = [hit];
  p.timeline = [{ id: "hit", kind: "skill", time: 1, skillId: hit.id }];
  p.globals = [
    {
      ...effect(c.id, true),
      name: "攻击转精通",
      type: "元素精通",
      valueMode: "live",
      advanced: true,
      formulas: [{ id: "f", condition: "", formula: "x" }],
    },
  ];
  await load(page, p);
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page.getByRole("button", { name: "编辑效果 攻击转精通" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "使用公式预设" }).click();
  await dialog.getByLabel("变量超过", { exact: true }).fill("0");
  await dialog.getByLabel("每多少变量数值", { exact: true }).fill("100");
  await dialog.getByLabel("每档元素精通（点）变化", { exact: true }).fill("8");
  await dialog
    .getByLabel("最多变化数值（绝对值）", { exact: true })
    .fill("160");
  await dialog.getByRole("button", { name: "生成并替换公式" }).click();
  await dialog.getByLabel("试算 x", { exact: true }).fill("3000");
  await expect(dialog.locator("output")).toContainText("结果 = 160");
  await dialog.getByRole("button", { name: "保存效果", exact: true }).click();
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await page.locator(".damage-event summary").click();
  await expect(page.locator(".active-effects")).toContainText("x = 2,000");
  await expect(page.locator(".active-effects")).toContainText("效果数值：160");
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).globals[0].formulaPreset?.cap,
        STORAGE_KEY,
      ),
    )
    .toBe(160);
  await page.reload();
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page.getByRole("button", { name: "编辑效果 攻击转精通" }).click();
  await dialog.getByRole("button", { name: "使用公式预设" }).click();
  await expect(
    dialog.getByLabel("每多少变量数值", { exact: true }),
  ).toHaveValue("100");
});

test("stack editors, individual triggers and worker details apply both modes", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const p = newProject(),
    c = p.characters[0];
  c.name = "测试角色";
  c.atk = 1689;
  c.critRate = 0;
  p.enemy.level = 90;
  const hit = skill(c.id);
  hit.name = "测试伤害";
  p.skills = [hit];
  const e = {
    ...effect(c.id),
    name: "叠层攻击",
    type: "攻击力" as const,
    unit: "flat" as const,
    value: 100,
  };
  p.weapons[0].effects = [e];
  p.timeline = [0, 2, 5, 7].map((time) => ({
    id: `hit-${time}`,
    kind: "skill",
    time,
    skillId: hit.id,
  }));
  await load(page, p);
  await nav(page, "武器");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  const editor = page.locator(".effect-form").first();
  await editor
    .getByRole("combobox", { name: "实时效果类型", exact: true })
    .selectOption("independent");
  await editor.getByLabel("最大层数", { exact: false }).fill("3");
  await editor.getByLabel("默认每层持续时间", { exact: false }).fill("5");
  await expect(editor.getByLabel("每层效果数值", { exact: false })).toHaveValue(
    "100",
  );
  await nav(page, "时间轴");
  await page.getByRole("button", { name: "触发效果", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("使用预设", { exact: true }).uncheck();
  await dialog.getByLabel("起始时间", { exact: false }).fill("1");
  await dialog.getByLabel("本次增减层数", { exact: false }).fill("2");
  await dialog.getByRole("button", { name: "保存触发事件" }).click();
  await page.getByRole("button", { name: "触发效果", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("使用预设", { exact: true }).uncheck();
  await dialog.getByLabel("起始时间", { exact: false }).fill("3");
  await dialog.getByLabel("本次增减层数", { exact: false }).fill("2");
  await dialog.getByRole("button", { name: "保存触发事件" }).click();
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await page.locator(".damage-event summary").nth(2).click();
  await expect(page.locator(".active-effects")).toContainText("当前层数：3 层");
  await expect(page.locator(".active-effects")).toContainText("效果数值：300");
  await expect(page.locator(".active-effects")).toContainText(
    "1 层：6.00s 到期",
  );
  await expect(page.locator(".active-effects")).toContainText(
    "2 层：8.00s 到期",
  );
  await page.screenshot({
    path: testInfo.outputPath("independent-stack-details.png"),
    fullPage: true,
  });
  await nav(page, "武器");
  await page.locator(".effect-details > summary").first().click();
  await page
    .getByRole("combobox", { name: "实时效果类型", exact: true })
    .selectOption("sharedPeriodic");
  await nav(page, "时间轴");
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "编辑事件 触发效果：叠层攻击", exact: true })
      .nth(i)
      .click();
    await dialog.locator(".periodic-settings > summary").click();
    await dialog.getByLabel("本次变化间隔", { exact: false }).fill("2");
    await dialog.getByLabel("本次每次变化层数", { exact: false }).fill("-1");
    await dialog
      .getByRole("button", { name: "保存触发事件", exact: true })
      .click();
  }
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await page.locator(".damage-event summary").nth(2).click();
  await expect(page.locator(".active-effects")).toContainText("当前层数：1 层");
  await expect(page.locator(".active-effects")).toContainText("效果数值：100");
  await page.locator(".damage-event summary").nth(3).click();
  await expect(page.locator(".no-active-effects")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).timeline.find(
            (e: any) => e.kind === "effectTrigger",
          ).timing.mode,
        STORAGE_KEY,
      ),
    )
    .toBe("periodic");
  await page.reload();
  await nav(page, "时间轴");
  await expect(page.locator(".timeline-panel")).toContainText("设为 2层");
  expect(errors).toEqual([]);
});
