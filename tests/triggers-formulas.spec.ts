import { expect, test, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../src/model";
const nav = async (page: Page, name: string) => {
  await page.locator("nav").getByRole("button", { name }).click();
  if (name === "计算结果") {
    await page.getByRole("button", { name: "开始计算", exact: true }).click();
    await expect(page.locator(".calculation-status")).toContainText(
      "已完成计算",
    );
  }
};

test("artifact and talent global/trigger workflows, enemy fields and formula variables", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("角色名称", { exact: true }).fill("木偶");
  await page.getByLabel("基础攻击力", { exact: true }).fill("300");
  await nav(page, "武器");
  const weapon = page.locator(".equipment-panel").first();
  await weapon.getByLabel("武器基础攻击力", { exact: true }).fill("600");
  await nav(page, "圣遗物");
  const artifact = page.locator(".equipment-panel").first();
  await artifact.getByLabel("套装名字").fill("测试套装");
  await artifact.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  let ed = artifact.locator(".effect-form").first();
  await ed.getByLabel("效果名称", { exact: true }).fill("常驻套装");
  await ed
    .getByRole("combobox", { name: "效果分类", exact: true })
    .selectOption("global");
  await expect(ed.getByLabel("默认永久", { exact: true })).toHaveCount(0);
  await expect(
    ed.getByRole("spinbutton", { name: "默认持续时间", exact: false }),
  ).toHaveCount(0);
  await ed
    .getByRole("combobox", { name: "效果分类", exact: true })
    .selectOption("realtime");
  await expect(
    ed.getByRole("spinbutton", { name: "默认持续时间", exact: false }),
  ).toHaveValue("10");
  await ed
    .getByRole("combobox", { name: "效果分类", exact: true })
    .selectOption("global");
  await artifact.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  ed = artifact.locator(".effect-form").last();
  await ed.getByLabel("效果名称", { exact: true }).fill("套装触发");
  await ed
    .getByRole("combobox", { name: "数值方式", exact: true })
    .selectOption("base");
  await ed.getByLabel("系数", { exact: false }).fill("0.1");
  await nav(page, "天赋");
  await expect(
    page.getByRole("heading", { name: "角色天赋", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "添加天赋", exact: true }).click();
  const talent = page.locator(".talent-panel, .talent-draft");
  await talent.getByLabel("天赋名称", { exact: true }).fill("测试天赋");
  await talent.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  ed = talent.locator(".effect-form").first();
  await ed.getByLabel("效果名称", { exact: true }).fill("常驻天赋");
  await ed
    .getByRole("combobox", { name: "效果分类", exact: true })
    .selectOption("global");
  await talent.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  ed = talent.locator(".effect-form").last();
  await ed.getByLabel("效果名称", { exact: true }).fill("天赋触发");
  await ed
    .getByRole("combobox", { name: "效果类型", exact: true })
    .selectOption("暴击率");
  await ed
    .getByRole("combobox", { name: "数值方式", exact: true })
    .selectOption("outside");
  await ed.getByLabel("高级公式", { exact: true }).check();
  await ed.getByLabel("条件 1", { exact: true }).fill("x＞2000");
  await ed.getByLabel("公式 1", { exact: true }).fill("(x - 2000) * 0.04");
  await ed.getByRole("button", { name: "添加公式", exact: true }).click();
  await ed.getByLabel("公式 2", { exact: true }).fill("10");
  await ed.getByLabel("试算 x", { exact: true }).fill("2500");
  await expect(ed.locator("output")).toContainText("结果 = 20");
  await ed.getByLabel("试算 x", { exact: true }).fill("2000");
  await expect(ed.locator("output")).toContainText("第 2 条匹配，结果 = 10");
  await page.screenshot({
    path: testInfo.outputPath("talent-formula.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await nav(page, "敌方属性");
  await expect(
    page.getByRole("spinbutton", { name: "怪物等级", exact: false }),
  ).toHaveValue("100");
  for (const el of ["火", "冰", "雷", "草", "岩", "风", "水", "物理"])
    await expect(
      page.getByRole("spinbutton", {
        name: `${el}${el === "物理" ? "伤害" : "元素"}抗性 %`,
        exact: true,
      }),
    ).toHaveValue("10");
  await page
    .getByRole("spinbutton", { name: "怪物等级", exact: false })
    .fill("95");
  await page
    .getByRole("spinbutton", { name: "水元素抗性 %", exact: true })
    .fill("-20");
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "添加技能", exact: true })
    .first()
    .click();
  await page.getByLabel("技能名称", { exact: true }).fill("木偶E");
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await nav(page, "时间轴");
  await expect(page.locator(".global-event")).toHaveCount(2);
  await expect(
    page.locator(".global-event").filter({ hasText: "常驻套装" }),
  ).toContainText("圣遗物");
  await expect(
    page.locator(".global-event").filter({ hasText: "常驻天赋" }),
  ).toContainText("天赋");
  for (const [kind, index] of [
    ["artifact", 0],
    ["talent", 0],
  ] as const) {
    await page.getByRole("button", { name: "触发效果", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("combobox", { name: "效果来源", exact: true })
      .selectOption(kind);
    await page
      .getByRole("dialog")
      .getByRole("combobox", { name: "详细效果", exact: true })
      .selectOption({ index });
    await page
      .getByRole("dialog")
      .getByRole("spinbutton", { name: "起始时间", exact: false })
      .fill("1");
    await page
      .getByRole("button", { name: "保存触发事件", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "添加技能事件", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("spinbutton", { name: "起始时间", exact: false })
    .fill("2");
  await page.getByRole("button", { name: "添加到时间轴", exact: true }).click();
  await expect(
    page.locator(".timeline-event-group > .timeline-row"),
  ).toHaveCount(3);
  await page.screenshot({
    path: testInfo.outputPath("trigger-timeline.png"),
    fullPage: true,
  });
  await nav(page, "计算结果");
  await page.locator(".damage-event>summary").click();
  await expect(page.locator(".damage-event")).toHaveCount(1);
  await expect(page.locator(".active-effect")).toHaveCount(4);
  await expect(
    page.locator(".active-effect").filter({ hasText: "套装触发" }),
  ).toContainText("x = 900");
  await expect(
    page.locator(".active-effect").filter({ hasText: "套装触发" }),
  ).toContainText("效果数值：90");
  await expect(
    page.locator(".active-effect").filter({ hasText: "天赋触发" }),
  ).toContainText("x = 1,211");
  await expect(
    page.locator(".active-effect").filter({ hasText: "天赋触发" }),
  ).toContainText("效果数值：10%");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("variables-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).talents.length,
        STORAGE_KEY,
      ),
    )
    .toBe(1);
  await page.reload();
  await nav(page, "敌方属性");
  await expect(
    page.getByRole("spinbutton", { name: "怪物等级", exact: false }),
  ).toHaveValue("95");
  await expect(
    page.getByRole("spinbutton", { name: "水元素抗性 %", exact: true }),
  ).toHaveValue("-20");
  await nav(page, "天赋");
  await page
    .getByRole("button", { name: "编辑天赋 测试天赋", exact: true })
    .click();
  await expect(talent.getByLabel("公式 1", { exact: true })).toHaveValue(
    "(x - 2000) * 0.04",
  );
  await talent
    .getByRole("button", { name: "删除天赋 测试天赋", exact: true })
    .click();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "时间轴");
  await expect(page.locator(".global-event")).toHaveCount(1);
  await expect(
    page.locator(".timeline-event-group > .timeline-row"),
  ).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("advanced formula validation, source modes and matching rules in independent effects", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("button", { name: "添加环境/共鸣效果", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog"),
    mode = dialog.getByRole("combobox", { name: "数值方式", exact: true });
  await expect(mode.locator("option")).toHaveText([
    "固定数值",
    "角色基础数值",
    "角色局外数值",
    "角色实时数值",
  ]);
  await mode.selectOption("live");
  await dialog.getByLabel("高级公式", { exact: true }).check();
  await dialog.getByLabel("公式 1", { exact: true }).fill("window.alert(x)");
  await expect(dialog.getByRole("button", { name: "保存效果" })).toBeDisabled();
  await dialog.getByLabel("条件 1", { exact: true }).fill("x>2000");
  await dialog.getByLabel("公式 1", { exact: true }).fill("min(x / 100, 30)");
  await dialog.getByLabel("试算 x", { exact: true }).fill("1000");
  await expect(dialog.locator("output")).toContainText("未匹配");
  await dialog.getByRole("button", { name: "添加公式", exact: true }).click();
  await dialog.getByLabel("公式 2", { exact: true }).fill("0");
  await expect(dialog.locator("output")).toContainText("结果 = 0");
  await dialog.getByRole("button", { name: "保存效果" }).click();
  await expect(page.locator(".global-card")).toContainText("角色实时数值");
});

test("weapon effects support global mode, explicit triggers, refresh and preset persistence", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "武器");
  const w = page.locator(".equipment-panel").first();
  await w.getByLabel("武器名称", { exact: true }).fill("测试武器");
  await w.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  const first = w.locator(".effect-form").first();
  await first.getByLabel("效果名称", { exact: true }).fill("武器常驻");
  await first
    .getByRole("combobox", { name: "效果分类", exact: true })
    .selectOption("global");
  await expect(first.getByLabel("默认永久", { exact: true })).toHaveCount(0);
  await expect(
    first.getByRole("spinbutton", { name: "默认持续时间", exact: false }),
  ).toHaveCount(0);
  await w.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  const second = w.locator(".effect-form").last();
  await second.getByLabel("效果名称", { exact: true }).fill("武器触发");
  await second
    .getByRole("spinbutton", { name: "默认持续时间", exact: false })
    .fill("5");
  await w.getByRole("button", { name: "保存武器预设 1", exact: true }).click();
  await page.getByRole("button", { name: "保存到预设库" }).click();
  await first
    .getByRole("combobox", { name: "效果分类", exact: true })
    .selectOption("realtime");
  await w.getByRole("button", { name: "导入武器预设 1", exact: true }).click();
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(
    first.getByRole("combobox", { name: "效果分类", exact: true }),
  ).toHaveValue("global");
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "添加技能", exact: true })
    .first()
    .click();
  await page.getByLabel("技能名称", { exact: true }).fill("E");
  await page.getByRole("button", { name: "完成编辑" }).click();
  await nav(page, "时间轴");
  await expect(page.locator(".global-event")).toContainText("武器常驻");
  for (const t of ["1", "3"]) {
    await page.getByRole("button", { name: "触发效果", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("combobox", { name: "详细效果", exact: true })
      .selectOption({ index: 0 });
    await page
      .getByRole("dialog")
      .getByRole("spinbutton", { name: "起始时间", exact: false })
      .fill(t);
    await page
      .getByRole("button", { name: "保存触发事件", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "添加技能事件", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("spinbutton", { name: "起始时间", exact: false })
    .fill("7");
  await page.getByRole("button", { name: "添加到时间轴" }).click();
  await nav(page, "计算结果");
  await page.locator(".damage-event>summary").click();
  await expect(page.locator(".active-effect")).toHaveCount(2);
  await expect(
    page.locator(".active-effect").filter({ hasText: "武器触发" }),
  ).toContainText("3.00s — 8.00s");
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).timeline.filter(
            (e: { kind: string }) => e.kind === "effectTrigger",
          ).length,
        STORAGE_KEY,
      ),
    )
    .toBe(2);
  await page.reload();
  await nav(page, "时间轴");
  await expect(page.locator(".global-event")).toContainText("武器常驻");
  await expect(
    page.locator(".timeline-row").filter({ hasText: "触发效果：武器触发" }),
  ).toHaveCount(2);
});
