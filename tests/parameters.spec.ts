import { test, expect, type Page } from "@playwright/test";
import { newProject, skill, effect, STORAGE_KEY } from "../src/model";
const nav = async (page: Page, name: string) => {
  await page.locator("nav").getByRole("button", { name }).click();
  if (name === "计算结果") {
    await page.getByRole("button", { name: "开始计算", exact: true }).click();
    await expect(page.locator(".calculation-status")).toContainText(
      "已完成计算",
    );
  }
};

test("mainstats, physical bonus, weapon elemental stats and ignored options persist", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const elements = page.getByRole("combobox", {
    name: "角色属性",
    exact: true,
  });
  await expect(elements.locator("option")).toHaveCount(7);
  await elements.selectOption("水");
  await page.getByLabel("角色名称", { exact: true }).fill("木偶");
  await page.getByLabel("角色简写", { exact: false }).fill("偶");
  await page.getByLabel("命座", { exact: true }).fill("0");
  await page
    .getByLabel("突破属性类型", { exact: true })
    .selectOption("physicalBonus");
  await page.getByLabel("突破属性数值", { exact: false }).fill("34.5");
  await page
    .getByRole("combobox", { name: "角色等级", exact: true })
    .selectOption("95");
  await nav(page, "武器");
  const w = page.locator(".equipment-panel").first();
  await w.getByLabel("武器简写", { exact: false }).fill("0精5狼末");
  await w.getByRole("button", { name: "添加词条", exact: true }).click();
  for (const [type, label] of [
    ["pyroBonus", "火"],
    ["cryoBonus", "冰"],
    ["electroBonus", "雷"],
    ["dendroBonus", "草"],
    ["geoBonus", "岩"],
    ["anemoBonus", "风"],
    ["hydroBonus", "水"],
    ["physicalBonus", "物理"],
  ]) {
    await w.getByLabel("词条类别").selectOption(type);
    await w.getByLabel("词条数值", { exact: true }).fill("46.6");
    await expect(w.getByLabel("词条输入方式")).toBeDisabled();
    await expect(w.locator(".stat-result")).toContainText(label);
  }
  await w.getByLabel("词条类别").selectOption("notImportant");
  await expect(w.getByLabel("词条数值", { exact: true })).toBeDisabled();
  await expect(w.locator(".stat-caption")).toContainText("不影响伤害");
  await w.getByLabel("词条类别").selectOption("hydroBonus");
  await w.getByLabel("词条数值", { exact: true }).fill("46.6");
  await nav(page, "圣遗物");
  const a = page.locator(".equipment-panel").first();
  await expect(a.getByLabel("花主词条", { exact: true })).toBeDisabled();
  await expect(a.getByLabel("花主词条数值", { exact: false })).toHaveValue(
    "4780",
  );
  await expect(a.getByLabel("毛主词条", { exact: true })).toBeDisabled();
  await expect(a.getByLabel("毛主词条数值", { exact: false })).toHaveValue(
    "311",
  );
  await expect(
    a.getByLabel("花主词条", { exact: true }).locator("option"),
  ).toHaveCount(1);
  await expect(
    a.getByLabel("沙主词条", { exact: true }).locator("option"),
  ).toHaveCount(6);
  await expect(
    a.getByLabel("杯主词条", { exact: true }).locator("option"),
  ).toHaveCount(13);
  await expect(
    a.getByLabel("头主词条", { exact: true }).locator("option"),
  ).toHaveCount(7);
  await a.getByLabel("沙主词条", { exact: true }).selectOption("mastery");
  await a.getByLabel("杯主词条", { exact: true }).selectOption("physicalBonus");
  await a.getByLabel("头主词条", { exact: true }).selectOption("critDamage");
  await a.getByRole("button", { name: "添加词条", exact: true }).click();
  await a.getByLabel("词条类别").selectOption("notImportant");
  await expect(a.getByLabel("词条数值", { exact: true })).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("artifact-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("artifact-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await nav(page, "计算结果");
  await expect(page.locator(".result-teamline")).toContainText(
    "95级00精5狼末偶",
  );
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).artifacts[0].mainStats.goblet,
        STORAGE_KEY,
      ),
    )
    .toBe("physicalBonus");
  await page.reload();
  await expect(page.getByLabel("突破属性数值", { exact: false })).toHaveValue(
    "34.5",
  );
  await nav(page, "圣遗物");
  await expect(a.getByLabel("沙主词条", { exact: true })).toHaveValue(
    "mastery",
  );
  await expect(a.getByLabel("杯主词条", { exact: true })).toHaveValue(
    "physicalBonus",
  );
  await expect(a.getByLabel("头主词条", { exact: true })).toHaveValue(
    "critDamage",
  );
  await expect(a.getByLabel("词条类别")).toHaveValue("notImportant");
});

test("foreground switches, elemental selection and enemy resistance work across effect editors", async ({
  page,
}, testInfo) => {
  const p = newProject();
  ["木偶", "芙宁娜", "菈乌玛", "希诺宁"].forEach((name, i) => {
    p.characters[i].name = name;
    p.characters[i].element = (["雷", "水", "草", "岩"] as const)[i];
  });
  const hit = skill(p.characters[0].id);
  hit.name = "木偶E";
  p.skills = [hit];
  p.globals = [
    {
      ...effect(p.characters[0].id, true),
      name: "前台暴击",
      type: "暴击率",
      target: "foreground",
      value: 20,
    },
  ];
  p.timeline = [{ id: "hit", time: 5, kind: "skill", skillId: hit.id }];
  await page.goto("/");
  await page.locator('input[aria-label="导入方案文件"]').setInputFiles({
    name: "foreground.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "时间轴");
  await page
    .getByRole("combobox", { name: "初始场上角色", exact: true })
    .selectOption(p.characters[1].id);
  await expect(page.locator(".global-event")).toContainText("前台暴击");
  await page.getByRole("button", { name: "切换角色", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "切换到角色", exact: true })
    .selectOption(p.characters[2].id);
  await dialog
    .getByRole("spinbutton", { name: "起始时间", exact: false })
    .fill("2");
  await dialog
    .getByRole("button", { name: "添加切换事件", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("foreground-timeline.png"),
    fullPage: true,
  });
  await nav(page, "计算结果");
  await expect(page.locator(".damage-event")).toHaveCount(1);
  await page.locator(".damage-event>summary").click();
  await expect(page.locator(".foreground-summary")).toContainText("菈乌玛");
  await expect(page.locator(".active-effects")).toContainText(
    "前台角色 · 菈乌玛",
  );
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("button", { name: "添加环境/共鸣效果", exact: true })
    .click();
  await dialog.getByLabel("效果名称", { exact: true }).fill("水雷暴伤");
  await dialog
    .getByRole("combobox", { name: "效果类型", exact: true })
    .selectOption("暴击伤害");
  await dialog
    .getByRole("combobox", { name: "生效对象", exact: true })
    .selectOption("elements");
  await expect(dialog.getByRole("button", { name: "保存效果" })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "水角色", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "雷角色", exact: true }).check();
  await dialog.getByRole("button", { name: "保存效果" }).click();
  await nav(page, "计算结果");
  await page.locator(".damage-event>summary").click();
  await expect(
    page.locator(".active-effect").filter({ hasText: "水雷暴伤" }),
  ).toContainText("对象：木偶、芙宁娜");
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("button", { name: "编辑效果 水雷暴伤", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "生效对象", exact: true })
    .selectOption("custom");
  await expect(dialog.getByRole("button", { name: "保存效果" })).toBeDisabled();
  await dialog
    .getByRole("combobox", { name: "效果类型", exact: true })
    .selectOption("敌方抗性");
  await expect(
    dialog.getByRole("combobox", { name: "生效对象", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "保存效果" })).toBeEnabled();
  await dialog
    .getByRole("combobox", { name: "抗性属性", exact: true })
    .selectOption("物理");
  await dialog.getByRole("button", { name: "保存效果" }).click();
  await nav(page, "计算结果");
  await page.locator(".damage-event>summary").click();
  await expect(
    page.locator(".active-effect").filter({ hasText: "水雷暴伤" }),
  ).toContainText("对象：敌方");
  await nav(page, "时间轴");
  await page
    .getByRole("button", { name: "删除事件 切换角色：菈乌玛", exact: true })
    .click();
  await nav(page, "计算结果");
  await page.locator(".damage-event>summary").click();
  await expect(page.locator(".foreground-summary")).toContainText("芙宁娜");
  // The shared editor exposes the same effect types in equipment panels.
  for (const section of ["武器", "圣遗物"]) {
    await nav(page, section);
    const panel = page.locator(".equipment-panel").first();
    await panel.getByRole("button", { name: "添加效果", exact: true }).click();
    await page
      .locator(".effect-details")
      .last()
      .locator(":scope > summary")
      .click();
    const type = panel.getByRole("combobox", { name: "效果类型", exact: true });
    await type.selectOption("暴击率");
    await expect(type).toHaveValue("暴击率");
    await type.selectOption("暴击伤害");
    await expect(type).toHaveValue("暴击伤害");
  }
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).initialCharacterId,
        STORAGE_KEY,
      ),
    )
    .toBe(p.characters[1].id);
  await page.reload();
  await nav(page, "时间轴");
  await expect(
    page.getByRole("combobox", { name: "初始场上角色", exact: true }),
  ).toHaveValue(p.characters[1].id);
});
