import { test, expect, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../src/model";
import { chooseEnkaProvider } from "./enka-provider";
const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name }).click();
const good = {
  format: "GOOD",
  version: 3,
  source: "yas-GOODScanner",
  characters: [
    { key: "Amber", level: 90 },
    { key: "Bennett", level: 80 },
  ],
  weapons: [
    {
      key: "UltimateOverlordsMegaMagicSword",
      level: 90,
      ascension: 6,
      location: "Amber",
    },
  ],
  artifacts: [
    {
      slotKey: "flower",
      mainStatKey: "hp",
      level: 0,
      rarity: 4,
      location: "Amber",
      substats: [{ key: "critRate_", value: 3.1 }],
    },
    {
      slotKey: "sands",
      mainStatKey: "atk_",
      level: 20,
      rarity: 5,
      location: "Amber",
      substats: [{ key: "atk_", value: 5.8 }],
    },
  ],
};
const loadFile = async (page: Page, data: unknown = good) => {
  await page.getByRole("tab", { name: "GGScanner JSON", exact: true }).click();
  await page.getByLabel("快速导入JSON").setInputFiles({
    name: "GGScanner.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
};
const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);

test("GOOD preview, independent checkboxes, target slots, cancel, exact artifact values and manual replacement", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("角色名称", { exact: true }).fill("目标一");
  await nav(page, "武器");
  await page.getByLabel("武器基础攻击力", { exact: true }).fill("111");
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await loadFile(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("来源角色", { exact: true })).toContainText(
    "安柏",
  );
  await expect(dialog.locator(".quick-import-preview")).toContainText("645");
  await expect(dialog.locator(".quick-import-preview")).toContainText("46.6%");
  await expect(dialog.locator(".quick-import-preview")).toContainText(
    "564.7837244",
  );
  await dialog.getByLabel("来源角色", { exact: true }).selectOption("Bennett");
  await expect(
    dialog.getByLabel("导入武器主词条", { exact: true }),
  ).toBeDisabled();
  await expect(dialog.locator(".quick-import-preview")).toContainText("未装备");
  await dialog.getByLabel("来源角色", { exact: true }).selectOption("Amber");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByLabel("武器基础攻击力", { exact: true })).toHaveValue(
    "111",
  );
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await loadFile(page);
  await dialog.getByLabel("导入武器主词条", { exact: true }).uncheck();
  await page.screenshot({
    path: info.outputPath("good-preview.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(page.getByLabel("武器基础攻击力", { exact: true })).toHaveValue(
    "111",
  );
  await nav(page, "圣遗物");
  await expect(page.getByLabel("花主词条数值", { exact: false })).toHaveValue(
    "645",
  );
  await expect(page.getByLabel("花为20级5星圣遗物")).not.toBeChecked();
  await expect(page.getByLabel("毛主词条", { exact: true })).toHaveValue("atk");
  await expect(page.getByLabel("沙主词条", { exact: true })).toHaveValue(
    "atkPercent",
  );
  await expect(page.getByLabel("沙主词条数值", { exact: false })).toHaveValue(
    "46.6",
  );
  await expect
    .poll(async () => (await saved(page)).artifacts[0].mainStatValues?.sands)
    .toBe(46.6);
  await page.reload();
  await nav(page, "圣遗物");
  await expect(page.getByLabel("沙主词条", { exact: true })).toHaveValue(
    "atkPercent",
  );
  await page.getByLabel("沙主词条", { exact: true }).selectOption("mastery");
  await expect(page.getByLabel("沙主词条", { exact: true })).toHaveValue(
    "mastery",
  );
  await expect
    .poll(async () => (await saved(page)).artifacts[0].mainStats.sands)
    .toBe("mastery");
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await loadFile(page);
  const before = await saved(page),
    target = before.characters[1].id;
  await dialog
    .getByLabel("导入到计算器角色", { exact: true })
    .selectOption(target);
  await dialog
    .getByLabel("导入圣遗物主词条与副词条", { exact: true })
    .uncheck();
  await dialog.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).weapons[1].atk)
    .toBeCloseTo(564.7837244, 8);
  const after = await saved(page);
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.weapons[0].atk).toBe(111);
  expect(after.characters[1].name).toBe("安柏");
  expect(after.characters.filter((_: unknown, i: number) => i !== 1)).toEqual(
    before.characters.filter((_: unknown, i: number) => i !== 1),
  );
});

test("Enka UID response, hidden showcase and HTTP failures, invalid JSON and cancellation are safe", async ({
  page,
}, info) => {
  const response = {
    playerInfo: { nickname: "测试账号" },
    avatarInfoList: [
      {
        avatarId: 10000021,
        propMap: { "4001": { val: "90" } },
        equipList: [
          {
            weapon: { level: 90 },
            flat: {
              itemType: "ITEM_WEAPON",
              weaponStats: [
                { appendPropId: "FIGHT_PROP_BASE_ATTACK", statValue: 674 },
              ],
            },
          },
          {
            reliquary: { level: 21 },
            flat: {
              itemType: "ITEM_RELIQUARY",
              equipType: "EQUIP_DRESS",
              rankLevel: 5,
              reliquaryMainstat: {
                mainPropId: "FIGHT_PROP_CRITICAL_HURT",
                statValue: 62.2,
              },
              reliquarySubstats: [
                { appendPropId: "FIGHT_PROP_ELEMENT_MASTERY", statValue: 23 },
              ],
            },
          },
        ],
      },
    ],
  };
  await page.route("**/api/enka/**", (route) =>
    route.fulfill({ json: response }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await loadFile(page, { invalid: true });
  await expect(page.getByRole("alert")).toContainText("GOOD");
  await page.getByRole("tab", { name: "Enka UID" }).click();
  await chooseEnkaProvider(page, "cloudflare");
  await page.getByLabel("原神UID", { exact: true }).fill("abc");
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("9或10位");
  await page.getByLabel("原神UID", { exact: true }).fill("618285856");
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  await expect(page.getByLabel("来源角色", { exact: true })).toContainText(
    "安柏",
  );
  await expect(page.locator(".quick-import-preview")).toContainText("674");
  await expect(page.locator(".quick-import-preview")).toContainText("62.2%");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("enka-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect.poll(async () => (await saved(page)).weapons[0].atk).toBe(674);
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await page.getByRole("tab", { name: "Enka UID" }).click();
  await chooseEnkaProvider(page, "cloudflare");
  await page.getByLabel("原神UID", { exact: true }).fill("618285856");
  await page.route("**/api/enka/**", (route) =>
    route.fulfill({ json: { playerInfo: { nickname: "hidden" } } }),
  );
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("显示角色详情");
  await page.route("**/api/enka/**", (route) =>
    route.fulfill({ status: 429, json: { error: "Enka请求过快，请稍后重试" } }),
  );
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("查询过于频繁");
  await expect(
    page.getByRole("button", { name: "确认导入", exact: true }),
  ).toBeDisabled();
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/enka/**", async (route) => {
    await gate;
    await route.fulfill({ json: response }).catch(() => {});
  });
  await page.getByLabel("原神UID", { exact: true }).fill("618285857");
  const requested = page.waitForRequest("**/api/enka/**");
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  await requested;
  await page.getByRole("button", { name: "取消", exact: true }).click();
  release!();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await saved(page)).weapons[0].atk).toBe(674);
});

test("source effect editors start folded, including newly added effects", async ({
  page,
}) => {
  await page.goto("/");
  for (const tab of ["武器", "圣遗物"]) {
    await nav(page, tab);
    await page.getByRole("button", { name: "添加效果", exact: true }).click();
    await expect(page.locator(".effect-details")).not.toHaveAttribute(
      "open",
      "",
    );
    await expect(page.locator(".effect-form")).toBeHidden();
    await page.locator(".effect-details > summary").click();
    await expect(page.locator(".effect-form")).toBeVisible();
  }
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "添加技能", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "提供效果", exact: true }).click();
  await page.getByRole("button", { name: "添加效果", exact: true }).click();
  await expect(page.locator(".effect-form")).toBeHidden();
  await nav(page, "天赋/命座");
  await page
    .getByRole("button", { name: "添加天赋/命座", exact: true })
    .click();
  await page.getByRole("button", { name: "添加效果", exact: true }).click();
  await expect(page.locator(".effect-form")).toBeHidden();
});

test("UID starts first, provider labels render cleanly and switching clears the preview and cancels old requests", async ({
  page,
}, info) => {
  const response = {
    uid: "618285856",
    playerInfo: { nickname: "MicroGG" },
    avatarInfoList: [
      { avatarId: 10000021, propMap: { "4001": { val: "90" } }, equipList: [] },
    ],
  };
  await page.route("https://profile.microgg.cn/api/uid/*", (route) =>
    route.fulfill({ json: response }),
  );
  await page.route("**/api/enka/**", (route) =>
    route.fulfill({
      json: { ...response, playerInfo: { nickname: "Cloudflare" } },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveText([
    "Enka UID",
    "GGScanner JSON",
  ]);
  await expect(page.getByRole("tab", { name: "Enka UID" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("快速导入JSON")).toHaveCount(0);
  const providers = page.getByRole("combobox", {
    name: "UID查询接口",
    exact: true,
  });
  await expect(providers).toHaveAttribute("data-value", "cloudflare-page");
  await providers.click();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(6);
  const rows = await page
    .getByRole("listbox")
    .getByRole("option")
    .evaluateAll((options) =>
      options.map((option) => ({
        value: (option as HTMLElement).dataset.value,
        text: option.textContent,
        struck:
          getComputedStyle(option.querySelector("span")!).textDecorationLine ===
          "line-through",
        disabled: option.getAttribute("aria-disabled") === "true",
      })),
    );
  expect(rows.filter((row) => row.struck).map((row) => row.value)).toEqual([
    "cloudflare-microgg",
    "microgg",
    "enka",
    "page",
  ]);
  expect(rows.every((row) => !row.disabled)).toBe(true);
  expect(rows.every((row) => !/[\u0336\ufffd]/.test(row.text!))).toBe(true);
  await page
    .getByRole("dialog")
    .screenshot({ path: info.outputPath("uid-provider-desktop.png") });
  // Closing the popup must keep the import dialog open.
  await providers.press("Escape");
  await expect(providers).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("dialog")).toBeVisible();
  for (const row of rows) {
    await providers.click();
    await page
      .locator(`.enka-provider-option[data-value="${row.value}"]`)
      .click();
    await expect(providers).toHaveAttribute("data-value", row.value!);
  }
  await providers.focus();
  await providers.press("Home");
  await providers.press("ArrowDown");
  await providers.press("Enter");
  await expect(providers).toHaveAttribute("data-value", "cloudflare");
  await page.setViewportSize({ width: 390, height: 844 });
  await providers.click();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(6);
  const bounds = await page.getByRole("listbox").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page
    .getByRole("dialog")
    .screenshot({ path: info.outputPath("uid-provider-mobile.png") });
  await page.getByRole("heading", { name: "快速导入装备" }).click();
  await expect(providers).toHaveAttribute("aria-expanded", "false");
  await chooseEnkaProvider(page, "microgg");
  await page.getByLabel("原神UID", { exact: true }).fill("618285856");
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("MicroGG · 1个角色");
  await chooseEnkaProvider(page, "cloudflare");
  await expect(page.getByLabel("来源角色", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "确认导入", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Cloudflare · 1个角色");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/enka/**", async (route) => {
    await gate;
    await route.fulfill({ json: response }).catch(() => {});
  });
  const requested = page.waitForRequest("**/api/enka/**");
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  await requested;
  await chooseEnkaProvider(page, "microgg");
  release();
  await expect(page.getByLabel("来源角色", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "确认导入", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue("");
});
