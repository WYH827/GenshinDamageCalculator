import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { STORAGE_KEY, PRESETS_KEY, RESET_BACKUP_KEY } from "../src/model";

test("reset confirmation cancels safely, exports before resetting and retains presets", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByLabel("方案名称", { exact: true }).fill("重置保存测试");
  await page.getByLabel("角色名称", { exact: true }).fill("木偶");
  await page.getByRole("button", { name: "保存预设", exact: true }).click();
  await page.getByRole("button", { name: "保存到预设库" }).click();
  await page.getByRole("button", { name: "重置方案", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(
    modal.getByRole("button", { name: "取消", exact: true }),
  ).toBeVisible();
  await expect(
    modal.getByRole("button", { name: "保存当前方案并重置", exact: true }),
  ).toBeVisible();
  await expect(
    modal.getByRole("button", { name: "直接重置", exact: true }),
  ).toHaveClass(/danger-btn/);
  await modal.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue(
    "木偶",
  );
  await page.getByRole("button", { name: "重置方案", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await modal
    .getByRole("button", { name: "保存当前方案并重置", exact: true })
    .click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("重置保存测试.json");
  const target = testInfo.outputPath("before-reset.json");
  await download.saveAs(target);
  const data = JSON.parse(await readFile(target, "utf8"));
  expect(data.characters[0].name).toBe("木偶");
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("方案名称", { exact: true })).toHaveValue(
    "未命名方案",
  );
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).length,
      PRESETS_KEY,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).characters[0].name,
      RESET_BACKUP_KEY,
    ),
  ).toBe("木偶");
  await page.reload();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "重置方案", exact: true }).click();
  await expect(
    modal.getByRole("button", { name: "导出上次重置前备份" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("reset-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("direct reset clears all project state and pending skill drafts without exporting", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("方案名称", { exact: true }).fill("丢弃测试");
  await page.getByLabel("角色名称", { exact: true }).fill("旧角色");
  await page.locator("nav").getByRole("button", { name: "技能" }).click();
  await page
    .getByRole("button", { name: "添加技能", exact: true })
    .first()
    .click();
  await page.getByLabel("技能名称", { exact: true }).fill("未完成草稿");
  await page.getByRole("button", { name: "重置方案", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("还有未完成的技能草稿");
  const downloads: string[] = [];
  page.on("download", (d) => downloads.push(d.suggestedFilename()));
  await page.getByRole("button", { name: "直接重置", exact: true }).click();
  await expect(page.getByLabel("方案名称", { exact: true })).toHaveValue(
    "未命名方案",
  );
  const p = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    STORAGE_KEY,
  );
  expect(p.characters.every((c: { name: string }) => c.name === "")).toBe(true);
  expect(p.skills).toEqual([]);
  expect(p.talents).toEqual([]);
  expect(p.globals).toEqual([]);
  expect(p.timeline).toEqual([]);
  expect(p.enemy.level).toBe(100);
  expect(Object.values(p.enemy.resistance)).toEqual(Array(8).fill(10));
  await page.locator("nav").getByRole("button", { name: "技能" }).click();
  await expect(page.locator("#new-skill")).toHaveCount(0);
  expect(downloads).toEqual([]);
});
