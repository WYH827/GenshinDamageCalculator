import { test, expect, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../src/model";
const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name }).click();
const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);

test("fixed base crit, ascension choices and per-piece full/custom values persist and calculate", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByLabel("基础暴击率", { exact: false })).toHaveValue(
    "5",
  );
  await expect(page.getByLabel("基础暴击率", { exact: false })).toBeDisabled();
  await expect(page.getByLabel("基础暴击伤害", { exact: false })).toHaveValue(
    "50",
  );
  await expect(
    page.getByLabel("基础暴击伤害", { exact: false }),
  ).toBeDisabled();
  await expect(page.getByText("角色自身数值", { exact: true })).toHaveCount(0);
  const choice = page.getByLabel("突破属性类型", { exact: true });
  await expect(choice.locator("option")).toHaveCount(16);
  await expect(choice).toContainText("治疗加成");
  await page.getByLabel("基础攻击力", { exact: true }).fill("1000");
  await choice.selectOption("atkPercent");
  await page.getByLabel("突破属性数值", { exact: false }).fill("20");
  await nav(page, "圣遗物");
  for (const slot of ["花", "毛", "沙", "杯", "头"])
    await expect(page.getByLabel(`${slot}为20级5星圣遗物`)).toBeChecked();
  await page.getByLabel("沙主词条", { exact: true }).selectOption("mastery");
  await expect(page.getByLabel("沙主词条数值", { exact: false })).toHaveValue(
    "187",
  );
  await expect(
    page.getByLabel("沙主词条数值", { exact: false }),
  ).toBeDisabled();
  await page.getByLabel("沙为20级5星圣遗物").uncheck();
  await page.getByLabel("沙主词条数值", { exact: false }).fill("123.4");
  await page.getByLabel("花为20级5星圣遗物").uncheck();
  await page.getByLabel("花主词条数值", { exact: false }).fill("1000");
  await expect(page.getByLabel("花主词条", { exact: true })).toBeDisabled();
  await page.getByLabel("毛为20级5星圣遗物").uncheck();
  await page.getByLabel("毛主词条数值", { exact: false }).fill("42");
  await expect
    .poll(async () => (await saved(page)).artifacts[0].mainStatValues?.feather)
    .toBe(42);
  await page.reload();
  await nav(page, "圣遗物");
  await expect(page.getByLabel("沙为20级5星圣遗物")).not.toBeChecked();
  await expect(page.getByLabel("沙主词条数值", { exact: false })).toHaveValue(
    "123.4",
  );
  await page.getByLabel("沙为20级5星圣遗物").check();
  await expect(page.getByLabel("沙主词条数值", { exact: false })).toHaveValue(
    "187",
  );
  await page.getByLabel("沙为20级5星圣遗物").uncheck();
  await expect(page.getByLabel("沙主词条数值", { exact: false })).toHaveValue(
    "187",
  );
  await page.getByLabel("沙主词条数值", { exact: false }).fill("123.4");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("custom-mainstats-mobile.png"),
    fullPage: true,
  });
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await page.locator(".distribution-row").first().click();
  await expect(page.locator(".outside-panel-values")).toContainText("1,242");
  await expect(page.locator(".outside-panel-values")).toContainText("123.4");
});

test("all import flags are independent, metadata and weapon substats work, UID is remembered", async ({
  page,
}, info) => {
  const response = {
    playerInfo: { nickname: "账号" },
    avatarInfoList: [
      {
        avatarId: 10000021,
        talentIdList: [1, 2, 3],
        propMap: { "4001": { val: "95" } },
        equipList: [
          {
            weapon: { level: 90 },
            flat: {
              itemType: "ITEM_WEAPON",
              nameTextMapHash: "3933622347",
              weaponStats: [
                { appendPropId: "FIGHT_PROP_BASE_ATTACK", statValue: 674 },
                { appendPropId: "FIGHT_PROP_CRITICAL", statValue: 22.1 },
              ],
            },
          },
          {
            reliquary: { level: 21 },
            flat: {
              itemType: "ITEM_RELIQUARY",
              equipType: "EQUIP_SHOES",
              rankLevel: 5,
              reliquaryMainstat: {
                mainPropId: "FIGHT_PROP_ELEMENT_MASTERY",
                statValue: 186.5,
              },
            },
          },
          {
            reliquary: { level: 17 },
            flat: {
              itemType: "ITEM_RELIQUARY",
              equipType: "EQUIP_BRACER",
              rankLevel: 4,
              reliquaryMainstat: {
                mainPropId: "FIGHT_PROP_HP",
                statValue: 3571,
              },
            },
          },
        ],
      },
    ],
  };
  let requests = 0;
  await page.route("**/api/enka/**", (route) => {
    requests++;
    return route.fulfill({ json: response });
  });
  await page.goto("/");
  await page.getByLabel("角色名称", { exact: true }).fill("保留名称");
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await page.getByRole("tab", { name: "Enka UID" }).click();
  await page.getByLabel("原神UID", { exact: true }).fill("618285856");
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("导入角色命座", { exact: true }),
  ).toBeEnabled();
  for (const label of [
    "导入角色名称",
    "导入角色等级",
    "导入角色命座",
    "导入武器名称",
    "导入武器副词条",
  ])
    await dialog.getByLabel(label, { exact: true }).check();
  await dialog.getByLabel("导入武器主词条", { exact: true }).uncheck();
  await page.screenshot({
    path: info.outputPath("import-options.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue(
    "安柏",
  );
  await expect(page.getByLabel("命座", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("角色等级", { exact: true })).toHaveValue("95");
  await expect
    .poll(async () => (await saved(page)).weapons[0].name)
    .toBe("天空之翼");
  const p = await saved(page);
  expect(p.weapons[0].atk).toBe(0);
  expect(p.weapons[0].substats[0]).toMatchObject({
    type: "critRate",
    value: 22.1,
  });
  await nav(page, "圣遗物");
  await expect(page.getByLabel("沙为20级5星圣遗物")).toBeChecked();
  await expect(page.getByLabel("沙主词条数值", { exact: false })).toHaveValue(
    "187",
  );
  await expect(page.getByLabel("花为20级5星圣遗物")).not.toBeChecked();
  await expect(page.getByLabel("花主词条数值", { exact: false })).toHaveValue(
    "3571",
  );
  await expect(page.getByLabel("沙主词条", { exact: true })).not.toContainText(
    "导入：",
  );
  await page.reload();
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await page.getByRole("tab", { name: "Enka UID" }).click();
  await expect(page.getByLabel("原神UID", { exact: true })).toHaveValue(
    "618285856",
  );
  expect(requests).toBe(1);
});
