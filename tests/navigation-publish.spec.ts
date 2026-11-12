import { test, expect, type Page } from "@playwright/test";
import { newProject, skill } from "../src/model";
const nav = (p: Page, name: string) =>
  p.locator("nav").getByRole("button", { name }).click();
test("persistent selection toolbar, top batch entry and adaptive damage reference axis", async ({
  page,
}, info) => {
  const p = newProject(),
    c = p.characters[0];
  c.atk = 1689;
  c.name = "测试";
  const s = { ...skill(c.id), name: "测试E" };
  p.skills = [s];
  p.timeline = Array.from({ length: 25 }, (_, i) => ({
    id: `h${i}`,
    kind: "skill" as const,
    skillId: s.id,
    time: i + 1,
  }));
  await page.goto("/");
  await page
    .getByLabel("导入方案文件", { exact: true })
    .setInputFiles({
      name: "p.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(p)),
    });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "时间轴");
  const toolbar = page.locator(".timeline-batch-toolbar");
  await expect(toolbar.getByRole("button")).toHaveCount(5);
  await expect(
    toolbar.getByRole("button", { name: "多选", exact: true }),
  ).toBeVisible();
  const batch = await page
      .getByRole("button", { name: "批量添加技能", exact: true })
      .boundingBox(),
    single = await page
      .getByRole("button", { name: "添加技能事件", exact: true })
      .boundingBox();
  expect(batch!.x).toBeLessThan(single!.x);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 850 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const check = async () => {
      const b = await toolbar.boundingBox();
      expect(b!.y).toBeGreaterThan(0);
      expect(b!.y + b!.height).toBeLessThanOrEqual(851);
      expect(b!.x).toBeGreaterThanOrEqual(0);
      expect(b!.x + b!.width).toBeLessThanOrEqual(width);
    };
    await check();
    await toolbar.getByRole("button", { name: "多选", exact: true }).click();
    await toolbar.getByLabel("全选可编辑事件", { exact: true }).check();
    await check();
    for (const name of ["退出多选", "批量移动", "批量复制", "批量删除"])
      await expect(
        toolbar.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`selection-${width}.png`),
      fullPage: false,
    });
    await toolbar
      .getByRole("button", { name: "退出多选", exact: true })
      .click();
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  const ticks = page.locator(".axis-y-tick");
  await expect(ticks.first()).toHaveText("0");
  const before = await ticks.last().textContent();
  await page.getByRole("tab", { name: "暴击", exact: true }).click();
  await expect(ticks.last()).not.toHaveText(before!);
  await page
    .locator(".combat-axis")
    .screenshot({ path: info.outputPath("y-axis.png") });
});
test("detailed guide, author links, supplied portrait and mobile about access", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByRole("button", { name: "使用说明", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("四人批量导入");
  await expect(dialog).toContainText("共用计时");
  await expect(dialog.locator(".usage-guide section")).toHaveCount(8);
  await dialog
    .getByRole("button", { name: "06 · 时间轴与批量操作", exact: true })
    .click();
  await page.screenshot({
    path: info.outputPath("usage-guide.png"),
    fullPage: false,
  });
  await dialog.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await page.getByRole("button", { name: "关于&作者", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByAltText("WYH827 的头像")).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "GitHub · @WYH827", exact: true }),
  ).toHaveAttribute("href", "https://github.com/WYH827");
  await expect(dialog.getByRole("link", { name: /哔哩哔哩/ })).toHaveAttribute(
    "href",
    "https://space.bilibili.com/544854596",
  );
  await expect(dialog).toContainText("尚未创建仓库或发布网站");
  await expect(dialog).toContainText("ISC");
  await page.screenshot({
    path: info.outputPath("about.png"),
    fullPage: false,
  });
  await dialog.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 850 });
  await page.getByRole("button", { name: "关于&作者", exact: true }).click();
  await expect(dialog.getByAltText("WYH827 的头像")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("about-mobile.png"),
    fullPage: false,
  });
  expect(errors).toEqual([]);
});
