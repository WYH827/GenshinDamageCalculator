import { expect, test, type Page } from "@playwright/test";
import { newProject, skill, effect, STORAGE_KEY, uid } from "../src/model";

const nav = async (page: Page, name: string) => {
  await page.locator("nav").getByRole("button", { name }).click();
  if (name === "计算结果") {
    await page.getByRole("button", { name: "开始计算", exact: true }).click();
    await expect(page.locator(".calculation-status")).toContainText(
      "已完成计算",
    );
  }
};
const state = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "{}"),
    STORAGE_KEY,
  );

test("complete editor workflow, equipment effects, result expansion, and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("方案名称", { exact: true }).fill("月感电测试");
  await page.getByLabel("角色名称", { exact: true }).fill("木偶");
  await page.getByLabel("角色简写", { exact: false }).fill("偶");
  await page.getByLabel("金数", { exact: true }).fill("2");
  await page.getByLabel("限定金数", { exact: true }).fill("1");
  await page.getByLabel("基础生命值", { exact: true }).fill("13000");
  await nav(page, "武器");
  const firstWeapon = page.locator(".equipment-panel").first();
  await firstWeapon.getByLabel("武器名称", { exact: true }).fill("测试专武");
  await firstWeapon.getByLabel("武器简写", { exact: false }).fill("1");
  await firstWeapon.getByLabel("金数", { exact: true }).fill("1");
  await firstWeapon.getByLabel("限定金数", { exact: true }).fill("1");
  await firstWeapon.getByRole("button", { name: "添加词条" }).click();
  await expect(
    firstWeapon.getByRole("button", { name: "添加词条" }),
  ).toBeDisabled();
  await firstWeapon.getByLabel("词条类别").selectOption("mastery");
  await firstWeapon.getByLabel("词条数值", { exact: true }).fill("1.9");
  await expect(firstWeapon.locator(".stat-result")).toHaveText("38 元素精通");
  await firstWeapon.getByLabel("词条输入方式").selectOption("direct");
  await expect(firstWeapon.getByLabel("词条数值", { exact: true })).toHaveValue(
    "38",
  );
  await firstWeapon.getByRole("button", { name: "保存武器预设 1" }).click();
  await page.getByRole("button", { name: "保存到预设库" }).click();
  await firstWeapon.getByLabel("武器简写", { exact: false }).fill("0精5狼末");
  await firstWeapon.getByRole("button", { name: "导入武器预设 1" }).click();
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(
    firstWeapon.getByLabel("武器简写", { exact: false }),
  ).toHaveValue("1");
  await nav(page, "圣遗物");
  const firstSet = page.locator(".equipment-panel").first();
  await firstSet.getByLabel("套装名字").fill("月光套装");
  await firstSet.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  await firstSet.getByLabel("效果名称", { exact: true }).fill("套装攻击提升");
  await firstSet.getByLabel("效果数值", { exact: false }).fill("20");
  await firstSet.getByLabel("默认永久").check();
  await firstSet.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  await expect(firstSet.locator(".effect-details")).toHaveCount(2);
  await firstSet
    .getByRole("button", { name: "删除效果", exact: true })
    .last()
    .click();
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "添加技能", exact: true })
    .first()
    .click();
  await page.getByLabel("技能名称", { exact: true }).fill("木偶E");
  await page
    .getByRole("combobox", { name: "属性", exact: true })
    .selectOption("水");
  await page.getByLabel("月感电伤害", { exact: true }).check();
  await page.getByLabel("星扩散伤害", { exact: true }).check();
  await expect(
    page.getByLabel("月感电伤害", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("月感电伤害", { exact: true }).check();
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("button", { name: "添加环境/共鸣效果", exact: true })
    .first()
    .click();
  await page.getByLabel("效果名称", { exact: true }).fill("全队天赋");
  await expect(page.getByLabel("默认永久")).toHaveCount(0);
  await page.getByRole("button", { name: "保存效果", exact: true }).click();
  await nav(page, "时间轴");
  await expect(page.locator(".global-event")).toContainText("全队天赋");
  await page.getByRole("button", { name: "触发效果", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "效果来源", exact: true })
    .selectOption("artifact");
  await page.getByRole("button", { name: "保存触发事件", exact: true }).click();
  await page.getByRole("button", { name: "添加技能事件", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("起始时间", { exact: false })
    .fill("8.25");
  await page.getByRole("button", { name: "添加到时间轴", exact: true }).click();
  await nav(page, "计算结果");
  await expect(page.locator(".result-teamline")).toContainText("01偶");
  await expect(page.locator(".result-teamline")).toContainText("金数：3");
  await expect(page.locator(".result-teamline")).toContainText("限定金数：2");
  await expect(page.locator(".result-secondary")).toContainText("8.25");
  await expect(page.locator(".damage-event")).toHaveCount(1);
  await expect(page.locator(".damage-attribute")).toHaveText("月感电水元素");
  await page.locator(".damage-event>summary").click();
  await expect(page.locator(".snapshot-character")).toHaveCount(4);
  await expect(page.locator(".active-effects")).toContainText(
    "圣遗物「月光套装」",
  );
  await expect(page.locator(".active-effects")).toContainText("全队天赋");
  await expect.poll(async () => (await state(page)).timeline?.length).toBe(2);
  await page.reload();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue(
    "木偶",
  );
  await expect(page.getByLabel("限定金数", { exact: true })).toHaveValue("1");
  expect(errors).toEqual([]);
});

test("keyboard decimals, negative effects, selected teammates and variables survive saving", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "圣遗物");
  const firstSet = page.locator(".equipment-panel").first();
  await firstSet.getByRole("button", { name: "添加词条" }).click();
  await firstSet.getByLabel("词条类别").selectOption("mastery");
  const rolls = firstSet.getByLabel("词条数值", { exact: true });
  await rolls.fill("");
  await rolls.pressSequentially("1.9");
  await rolls.press("Tab");
  await expect(firstSet.locator(".stat-result")).toHaveText("38 元素精通");
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("button", { name: "添加环境/共鸣效果", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("效果名称", { exact: true }).fill("自选减抗");
  await dialog
    .getByRole("combobox", { name: "生效对象", exact: true })
    .selectOption("custom");
  await expect(dialog.getByRole("button", { name: "保存效果" })).toBeDisabled();
  await dialog
    .getByRole("checkbox", { name: "1 · 角色 01", exact: true })
    .check();
  await dialog
    .getByRole("checkbox", { name: "3 · 角色 03", exact: true })
    .check();
  await dialog
    .getByRole("combobox", { name: "效果类型", exact: true })
    .selectOption("敌方抗性");
  const input = dialog.getByLabel("效果数值", { exact: false });
  await input.fill("");
  await input.pressSequentially("-12.5");
  await input.press("Tab");
  await expect(input).toHaveValue("-12.5");
  await dialog.getByRole("button", { name: "保存效果" }).click();
  await expect(page.locator(".effect-details")).toHaveAttribute("open", "");
  await page
    .getByRole("button", { name: "编辑效果 自选减抗", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "数值方式", exact: true })
    .selectOption("live");
  await dialog
    .getByRole("combobox", { name: "变量来源", exact: true })
    .selectOption({ index: 2 });
  await dialog
    .getByRole("combobox", { name: "角色属性", exact: true })
    .selectOption("元素精通");
  await dialog.getByLabel("系数", { exact: false }).fill("-0.1");
  await dialog.getByRole("button", { name: "保存效果" }).click();
  await expect
    .poll(async () => (await state(page)).globals?.[0]?.coefficient)
    .toBe(-0.1);
  const p = await state(page);
  expect(p.globals[0].targetIds).toEqual([
    p.characters[0].id,
    p.characters[2].id,
  ]);
  expect(p.globals[0].variableCharacterId).toBe(p.characters[2].id);
  expect(p.globals[0].value).toBe(-12.5);
});

test("preset library, portable preset export, import rejection and whole project restore", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("角色名称", { exact: true }).fill("预设角色");
  await page.getByRole("button", { name: "保存预设", exact: true }).click();
  await page.getByLabel("预设名称").fill("我的角色预设");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出文件" }).click();
  expect((await download).suggestedFilename()).toBe("我的角色预设.preset.json");
  await page.getByRole("button", { name: "保存到预设库" }).click();
  await page.getByLabel("角色名称", { exact: true }).fill("已修改");
  await page.getByRole("button", { name: "导入预设", exact: true }).click();
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue(
    "预设角色",
  );
  await page.locator('input[aria-label="导入方案文件"]').setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"characters":[]}'),
  });
  await expect(page.getByRole("status")).toContainText("导入失败");
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue(
    "预设角色",
  );
  const p = newProject();
  p.name = "导入完整方案";
  p.characters[0].name = "导入角色";
  p.characters[0].limitedGold = 4;
  p.weapons[0].short = "0精5狼末";
  await page.locator('input[aria-label="导入方案文件"]').setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue(
    "导入角色",
  );
  await expect(page.getByLabel("限定金数", { exact: true })).toHaveValue("4");
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出方案", exact: true }).click();
  expect((await exported).suggestedFilename()).toBe("导入完整方案.json");
});

test("timeline sorting, character order, reference cleanup, and responsive screenshots", async ({
  page,
}, testInfo) => {
  const p = newProject();
  ["木偶", "芙宁娜", "菈乌玛", "希诺宁"].forEach((name, i) => {
    Object.assign(p.characters[i], {
      name,
      short: ["偶", "芙", "菈", "希"][i],
      element: ["雷", "水", "草", "岩"][i],
      hp: 13000 + i * 1100,
      atk: 330,
      def: 850,
      gold: 2,
      limitedGold: 2,
    });
    p.weapons[i].short = "1";
    p.weapons[i].gold = 1;
    p.weapons[i].limitedGold = 1;
  });
  const s = {
    ...skill(p.characters[0].id),
    name: "木偶E",
    damage: {
      ...skill(p.characters[0].id).damage,
      element: "水" as const,
      special: "月感电" as const,
    },
  };
  p.skills = [s];
  p.globals = [
    {
      ...effect(p.characters[1].id, true),
      name: "全队伤害提升",
      type: "增伤区",
      value: 30,
    },
  ];
  p.timeline = [
    { id: uid(), kind: "skill", skillId: s.id, time: 12.5 },
    { id: uid(), kind: "skill", skillId: s.id, time: 2.1 },
  ];
  await page.addInitScript(
    ({ p, key }) => localStorage.setItem(key, JSON.stringify(p)),
    { p, key: STORAGE_KEY },
  );
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("characters-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "角色后移", exact: true }).click();
  await nav(page, "武器");
  await expect(
    page.locator(".equipment-panel").first().locator("h3"),
  ).toHaveText("芙宁娜");
  await nav(page, "时间轴");
  await expect(
    page
      .locator(".timeline-row:not(.global-event)")
      .first()
      .getByRole("spinbutton"),
  ).toHaveValue("2.1");
  await page
    .locator(".timeline-row:not(.global-event)")
    .first()
    .getByRole("spinbutton")
    .fill("20");
  await expect(
    page
      .locator(".timeline-row:not(.global-event)")
      .first()
      .getByRole("spinbutton"),
  ).toHaveValue("12.5");
  await nav(page, "计算结果");
  await expect(page.locator(".result-teamline")).toContainText(
    "01芙 01偶 01菈 01希",
  );
  await page.locator(".damage-event>summary").first().click();
  await page.screenshot({
    path: testInfo.outputPath("results-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("results-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await nav(page, "角色");
  await page.screenshot({
    path: testInfo.outputPath("characters-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "删除技能 木偶E", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("2 个事件");
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "计算结果");
  await expect(page.locator(".damage-event")).toHaveCount(0);
});
