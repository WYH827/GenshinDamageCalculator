import { test, expect, type Page } from "@playwright/test";
import {
  newProject,
  skill,
  effect,
  STORAGE_KEY,
  type Project,
} from "../src/model";
const nav = (p: Page, name: string) =>
  p.locator("nav").getByRole("button", { name }).click();
async function load(page: Page, p: Project) {
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "test.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
}
test("batch scheduling, opt-in multiselect, group transforms, wheel guard and readonly repeating damage", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const p = newProject(),
    c = p.characters[0];
  c.name = "测试";
  c.atk = 1689;
  p.enemy.level = 90;
  const s = { ...skill(c.id), name: "测试技能" };
  p.skills = [s];
  p.weapons[0].effects = [
    {
      ...effect(c.id),
      name: "绑定增伤",
      type: "增伤区",
      value: 10,
      boundSkillIds: [s.id],
      realtime: {
        kind: "independentPeriodic",
        max: 5,
        initial: 0,
        duration: 5,
        interval: 1,
        delta: 1,
        activeFor: 2,
      },
    },
  ];
  p.timeline = [{ id: "end", kind: "switch", time: 10, characterId: c.id }];
  await load(page, p);
  await nav(page, "时间轴");
  await expect(page.locator(".event-selection")).toHaveCount(0);
  await expect(page.getByLabel("全选可编辑事件", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "批量添加技能", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("起始时间", { exact: false }).fill("0");
  await dialog.getByLabel("每隔", { exact: false }).fill("2");
  await dialog.getByLabel("在接下来的", { exact: true }).fill("6");
  await expect(dialog.locator(".schedule-estimate")).toHaveText(
    "预计触发 3 次",
  );
  await dialog
    .getByRole("button", { name: "添加批量事件", exact: true })
    .click();
  await expect(page.locator(".bound-effects-children")).toHaveCount(3);
  const time = page.getByLabel("起始时间 测试技能", { exact: true }).first();
  await time.focus();
  await time.hover();
  await page.mouse.wheel(0, 100);
  await expect(time).toHaveValue("2");
  await page.getByRole("button", { name: "多选", exact: true }).click();
  await expect(page.locator(".event-selection")).toHaveCount(4);
  await page.getByLabel("选择事件 测试技能 2s", { exact: true }).check();
  await page.getByLabel("选择事件 测试技能 4s", { exact: true }).check();
  await page.getByRole("button", { name: "批量移动", exact: true }).click();
  await dialog.getByLabel("目标位置", { exact: true }).selectOption("at");
  await dialog.getByLabel("秒数", { exact: false }).fill("1");
  await dialog.getByRole("button", { name: "确认移动", exact: true }).click();
  await expect(
    page.getByLabel("起始时间 测试技能", { exact: true }),
  ).toHaveCount(3);
  await expect(time).toHaveValue("1");
  await page.getByLabel("选择事件 测试技能 1s", { exact: true }).check();
  await page.getByLabel("选择事件 测试技能 3s", { exact: true }).check();
  await page.getByRole("button", { name: "批量复制", exact: true }).click();
  await dialog.getByLabel("目标位置", { exact: true }).selectOption("after");
  await dialog.getByLabel("秒数", { exact: false }).fill("1");
  await dialog.getByRole("button", { name: "确认复制", exact: true }).click();
  await expect(page.locator(".event-selection")).toHaveCount(6);
  await page.getByLabel("全选可编辑事件", { exact: true }).check();
  await page.getByRole("button", { name: "批量删除", exact: true }).click();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".event-selection")).toHaveCount(6);
  await page.getByRole("button", { name: "退出多选", exact: true }).click();
  await expect(page.locator(".event-selection")).toHaveCount(0);
  await page.getByRole("button", { name: "批量添加技能", exact: true }).click();
  await dialog.getByLabel("起始时间", { exact: false }).fill("0");
  await dialog.getByLabel("每隔", { exact: false }).fill("2");
  await dialog.getByLabel("定时范围永久", { exact: true }).check();
  await expect(dialog.locator(".schedule-estimate")).toContainText("∞");
  await dialog
    .getByRole("button", { name: "添加批量事件", exact: true })
    .click();
  await expect(page.locator(".generated-event-group")).toHaveCount(5);
  await expect(
    page.locator(".generated-event-group .event-selection"),
  ).toHaveCount(0);
  await expect(
    page.locator(".generated-event-group .event-skill-select").first(),
  ).toBeDisabled();
  await expect(
    page.locator(".event-skill.readonly-event").first(),
  ).toBeVisible();
  await expect(page.locator(".event-switch")).toBeVisible();
  await expect(page.locator(".periodic-event.event-effect")).not.toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("timeline-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("timeline-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await expect(page.locator(".damage-event")).toHaveCount(10);
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).timeline.length,
        STORAGE_KEY,
      ),
    )
    .toBe(7);
  await page.reload();
  await nav(page, "时间轴");
  await expect(page.locator(".generated-event-group")).toHaveCount(5);
  await page.getByRole("button", { name: "多选", exact: true }).click();
  await page.getByLabel("全选可编辑事件", { exact: true }).check();
  await page.getByRole("button", { name: "批量删除", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认删除", exact: true })
    .click();
  await expect(page.locator(".timeline-event-group")).toHaveCount(0);
  await expect(page.locator(".periodic-event")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("preset and per-event ranges show counts, import starts fully selected and set name is independent", async ({
  page,
}, info) => {
  const p = newProject(),
    c = p.characters[0];
  c.name = "测试";
  const s = { ...skill(c.id), name: "无伤害", kind: "empty" as const };
  p.skills = [s];
  p.weapons[0].effects = [
    {
      ...effect(c.id),
      name: "定时层数",
      boundSkillIds: [s.id],
      realtime: {
        kind: "independentPeriodic",
        max: 3,
        initial: 0,
        duration: 5,
        interval: 2,
        delta: 1,
        activeFor: 6,
      },
    },
  ];
  p.timeline = [
    { id: "s", kind: "skill", time: 0, skillId: s.id },
    { id: "end", kind: "switch", time: 10, characterId: c.id },
  ];
  await load(page, p);
  await nav(page, "武器");
  await page.locator(".effect-details > summary").click();
  await expect(page.locator(".schedule-estimate")).toHaveText("预计触发 3 次");
  await page.getByLabel("预设在接下来的", { exact: true }).fill("4");
  await expect(page.locator(".schedule-estimate")).toHaveText("预计触发 2 次");
  await nav(page, "时间轴");
  await expect(page.locator(".periodic-event")).toHaveCount(2);
  await expect(
    page.locator(".timeline-event-group > .event-skill"),
  ).toHaveCount(1);
  const child = page.locator(".bound-effect-row");
  await child.locator(".periodic-settings > summary").click();
  await expect(child.getByLabel("在接下来的", { exact: true })).toBeDisabled();
  await child.getByLabel("使用预设", { exact: true }).uncheck();
  await child.getByLabel("在接下来的", { exact: true }).fill("6");
  await expect(page.locator(".periodic-event")).toHaveCount(3);
  await child.getByLabel("定时范围永久", { exact: true }).check();
  await expect(child.locator(".schedule-estimate")).toContainText("∞");
  await expect(page.locator(".periodic-event")).toHaveCount(5);
  const guide = await page
    .locator(".timeline-event-group")
    .first()
    .evaluate((el) => {
      const a = el.getBoundingClientRect(),
        b = el
          .querySelector(".timeline-time .number-input")!
          .getBoundingClientRect();
      return Math.abs(
        parseFloat(getComputedStyle(el).getPropertyValue("--guide-x")) -
          (b.left + b.width / 2 - a.left),
      );
    });
  expect(guide).toBeLessThan(1);
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  const raw = {
    format: "GOOD",
    version: 1,
    characters: [{ key: "Amber", level: 90, constellation: 2 }],
    weapons: [{ key: "AmosBow", level: 90, ascension: 6, location: "Amber" }],
    artifacts: ["flower", "plume", "sands", "goblet", "circlet"].map(
      (slotKey, i) => ({
        slotKey,
        setKey: i < 4 ? "GladiatorsFinale" : "WanderersTroupe",
        level: 20,
        rarity: 5,
        mainStatKey: ["hp", "atk", "atk_", "pyro_dmg_", "critRate_"][i],
        location: "Amber",
        substats: [],
      }),
    ),
  };
  await page.getByLabel("快速导入JSON", { exact: true }).setInputFiles({
    name: "good.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(raw)),
  });
  const d = page.getByRole("dialog");
  for (const box of await d.locator(".quick-import-option input:enabled").all())
    await expect(box).toBeChecked();
  await expect(d).toContainText("角斗士的终幕礼（4件套）");
  await page.screenshot({
    path: info.outputPath("import-defaults.png"),
    fullPage: true,
  });
  await d.getByRole("button", { name: "确认导入", exact: true }).click();
  await nav(page, "圣遗物");
  await expect(page.getByLabel("套装名字", { exact: true })).toHaveValue(
    "角斗士的终幕礼（4件套）",
  );
  await expect(
    page.getByLabel("花为20级5星圣遗物", { exact: true }),
  ).toBeChecked();
});
