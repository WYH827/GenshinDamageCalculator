import { test, expect, type Page } from "@playwright/test";
import { newProject, skill, effect, STORAGE_KEY } from "../src/model";
const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name }).click();
async function install(page: Page, count = 1) {
  const p = newProject(),
    c = p.characters[0];
  c.name = "A";
  c.atk = 1000;
  c.critRate = 0;
  p.enemy.level = 90;
  const s = skill(c.id);
  s.name = "冰重击";
  s.damage.element = "冰";
  s.damage.attack = "重击";
  p.skills = [s];
  p.timeline = Array.from({ length: count }, (_, i) => ({
    id: `hit${i}`,
    kind: "skill" as const,
    skillId: s.id,
    time: i + 1,
  }));
  await page.goto("/");
  await page.locator('input[aria-label="导入方案文件"]').setInputFiles({
    name: "manual.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  return p;
}
async function countWorkers(page: Page) {
  await page.addInitScript(() => {
    const Native = window.Worker;
    (window as any).workerStats = {
      created: 0,
      calculate: 0,
      detail: 0,
      terminated: 0,
      hold: false,
    };
    window.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        (window as any).workerStats.created++;
      }
      postMessage(message: any) {
        (window as any).workerStats[message.kind]++;
        if (!(window as any).workerStats.hold) super.postMessage(message);
      }
      terminate() {
        (window as any).workerStats.terminated++;
        super.terminate();
      }
    } as typeof Worker;
  });
}
test("does no work until clicked, caches across tabs, marks stale, and loads details only when opened", async ({
  page,
}, testInfo) => {
  await countWorkers(page);
  await install(page, 45);
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("—");
  await expect(page.locator(".damage-event")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).workerStats.created)).toBe(
    0,
  );
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  expect(await page.evaluate(() => (window as any).workerStats.calculate)).toBe(
    1,
  );
  expect(await page.evaluate(() => (window as any).workerStats.detail)).toBe(0);
  await expect(page.locator(".damage-event")).toHaveCount(40);
  await expect(page.locator(".snapshot-character")).toHaveCount(0);
  const before = await page.getByTestId("total-damage").innerText();
  await page.locator(".damage-event>summary").first().click();
  await expect(page.locator(".snapshot-character")).toHaveCount(4);
  expect(await page.evaluate(() => (window as any).workerStats.detail)).toBe(1);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.locator(".damage-event")).toHaveCount(5);
  await nav(page, "角色");
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText(before);
  expect(await page.evaluate(() => (window as any).workerStats.calculate)).toBe(
    1,
  );
  await nav(page, "角色");
  await page.getByLabel("基础攻击力", { exact: true }).fill("2000");
  await nav(page, "计算结果");
  await expect(page.locator(".calculation-status")).toContainText("参数已修改");
  await expect(page.getByTestId("total-damage")).toHaveText(before);
  expect(await page.evaluate(() => (window as any).workerStats.calculate)).toBe(
    1,
  );
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await expect(page.getByTestId("total-damage")).not.toHaveText(before);
  expect(await page.evaluate(() => (window as any).workerStats.calculate)).toBe(
    2,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("manual-results.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("—");
  expect(await page.evaluate(() => (window as any).workerStats.created)).toBe(
    0,
  );
});
test("cancels a running request and stops work when input changes", async ({
  page,
}) => {
  await countWorkers(page);
  await install(page);
  await nav(page, "计算结果");
  await page.evaluate(() => ((window as any).workerStats.hold = true));
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "计算中…", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "取消计算", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "开始计算", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => (window as any).workerStats.terminated),
  ).toBe(1);
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await nav(page, "角色");
  await page.getByLabel("基础攻击力", { exact: true }).fill("3000");
  await expect
    .poll(() => page.evaluate(() => (window as any).workerStats.terminated))
    .toBe(2);
  await nav(page, "计算结果");
  await expect(page.getByTestId("total-damage")).toHaveText("—");
  await expect(
    page.getByRole("button", { name: "开始计算", exact: true }),
  ).toBeEnabled();
});
test("attribute variable units are absolute, charged attack is selectable, and star stacks affect only this event", async ({
  page,
}) => {
  await install(page, 2);
  await nav(page, "环境/元素共鸣");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page
    .getByRole("button", { name: "添加环境/共鸣效果", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "数值方式", exact: true })
    .selectOption("base");
  for (const type of ["生命值", "攻击力", "防御力", "元素精通"]) {
    await dialog
      .getByRole("combobox", { name: "效果类型", exact: true })
      .selectOption(type);
    await expect(
      dialog.getByRole("combobox", { name: "数值单位", exact: true }),
    ).toHaveValue("flat");
    await expect(
      dialog.getByRole("combobox", { name: "数值单位", exact: true }),
    ).toBeDisabled();
    await expect(dialog).toContainText(`结果直接作为${type}增加值`);
  }
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "编辑技能 冰重击", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "伤害类型", exact: true }),
  ).toHaveValue("重击");
  await nav(page, "时间轴");
  const stacks = page.getByRole("combobox", {
    name: "本次星超导层数",
    exact: true,
  });
  await expect(stacks.first()).toHaveValue("none");
  await stacks.first().selectOption("2");
  await expect(page.locator(".star-stacks").first()).toContainText(
    "冰雷增伤 29% · 星超导系数 1.45",
  );
  await expect(stacks.last()).toHaveValue("none");
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".damage-event")).toHaveCount(2);
  await page.locator(".damage-event>summary").first().click();
  await expect(page.locator(".factor-list")).toContainText("29%");
  await page.locator(".damage-event>summary").last().click();
  await expect(page.locator(".factor-list")).not.toContainText("星超导层数");
});
