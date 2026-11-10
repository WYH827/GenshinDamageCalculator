import { test, expect, type Page } from "@playwright/test";
import { effect, newProject, skill, STORAGE_KEY } from "../src/model";
const nav = (p: Page, name: string) =>
  p.locator("nav").getByRole("button", { name }).click();
test("environment and two-level library, global independence, fixed/stacking presets and override locking", async ({
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
  const hit = skill(c.id);
  hit.name = "测试伤害";
  p.skills = [hit];
  p.timeline = [1, 3, 10].map((time) => ({
    id: `h${time}`,
    kind: "skill",
    time,
    skillId: hit.id,
  }));
  p.weapons[0].effects = [
    {
      ...effect(c.id),
      name: "固定增伤",
      category: "realtime",
      realtimeKind: "fixed",
      type: "增伤区",
      value: 10,
      duration: 5,
    },
  ];
  p.artifacts[0].effects = [
    {
      ...effect(c.id),
      name: "全局套装",
      category: "global",
      type: "增伤区",
      value: 20,
    },
  ];
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "class.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("button", { name: "添加环境/共鸣效果", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox").first()).toHaveAccessibleName(
    "效果分类",
  );
  await expect(dialog.getByLabel("来源角色", { exact: true })).toHaveCount(0);
  await expect(
    dialog
      .getByRole("combobox", { name: "生效对象", exact: true })
      .locator('option[value="self"]'),
  ).toHaveCount(0);
  await dialog.getByLabel("效果名称", { exact: true }).fill("环境加成");
  await dialog
    .getByRole("combobox", { name: "效果类型", exact: true })
    .selectOption("增伤区");
  await dialog.getByLabel("效果数值", { exact: false }).fill("5");
  await expect(dialog.locator(".timing-presets")).toHaveCount(0);
  await dialog.getByRole("button", { name: "保存效果", exact: true }).click();
  await nav(page, "效果列表");
  await expect(page.locator('[data-category="global"]')).toContainText(
    "全局套装",
  );
  await expect(page.locator('[data-category="global"]')).toContainText(
    "环境加成",
  );
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await page.getByRole("tab", { name: /实时效果/ }).click();
  await expect(page.locator('[data-category="global"]')).toHaveCount(0);
  await expect(page.locator('[data-category="realtime"]')).toContainText(
    "固定增伤",
  );
  await nav(page, "时间轴");
  await expect(page.locator(".global-event")).toHaveCount(2);
  await expect(page.locator(".global-event").first()).toBeHidden();
  await page.locator(".global-effects-fold > summary").click();
  await page.getByRole("button", { name: "触发效果", exact: true }).click();
  await expect(dialog.getByLabel("使用预设", { exact: true })).toBeChecked();
  await expect(
    dialog.getByLabel("本次持续时间", { exact: false }),
  ).toBeDisabled();
  await expect(dialog.getByLabel("层数更改方式", { exact: true })).toHaveCount(
    0,
  );
  await dialog
    .getByRole("combobox", { name: "效果来源", exact: true })
    .selectOption("artifact");
  await expect(
    dialog.getByRole("combobox", { name: "详细效果", exact: true }),
  ).not.toContainText("全局套装");
  await dialog
    .getByRole("combobox", { name: "效果来源", exact: true })
    .selectOption("weapon");
  await dialog.getByLabel("起始时间", { exact: false }).fill("0");
  await dialog.getByLabel("使用预设", { exact: true }).uncheck();
  await dialog.getByLabel("本次持续时间", { exact: false }).fill("2");
  await dialog
    .getByRole("button", { name: "保存触发事件", exact: true })
    .click();
  await expect(
    page.locator(".timeline-row").filter({ hasText: "触发效果：固定增伤" }),
  ).toContainText("（已更改）");
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await expect(page.locator(".damage-value").first()).toContainText("1,215");
  await expect(page.locator(".damage-value").nth(2)).toContainText("1,125");
  await nav(page, "武器");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("combobox", { name: "实时效果类型", exact: true })
    .selectOption("sharedPeriodic");
  await page.getByLabel("初始层数", { exact: false }).fill("3");
  await nav(page, "时间轴");
  await page.getByRole("button", { name: "触发效果", exact: true }).click();
  await expect(
    dialog.getByRole("combobox", { name: "层数更改方式", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByLabel("本次设为层数", { exact: true }),
  ).toBeEnabled();
  await expect(
    dialog.getByLabel("本次共用持续时间", { exact: false }),
  ).toBeDisabled();
  await dialog.getByLabel("本次设为层数", { exact: true }).fill("4");
  await dialog.getByLabel("使用预设", { exact: true }).uncheck();
  await dialog.getByLabel("使用预设", { exact: true }).check();
  await expect(dialog.getByLabel("本次设为层数", { exact: true })).toHaveValue(
    "4",
  );
  await dialog
    .getByRole("button", { name: "保存触发事件", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!)
            .timeline.filter((e: any) => e.kind === "effectTrigger")
            .map((e: any) => e.usePreset),
        STORAGE_KEY,
      ),
    )
    .toEqual([false, true]);
  await page.reload();
  await nav(page, "时间轴");
  await expect(
    page.locator(".timeline-row").filter({ hasText: "（已更改）" }),
  ).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("classified-timeline.png"),
    fullPage: true,
  });
  await nav(page, "效果列表");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("global-library.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: /实时效果/ }).click();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("realtime-library.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
