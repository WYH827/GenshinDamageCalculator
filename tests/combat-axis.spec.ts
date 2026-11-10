import { test, expect, type Page } from "@playwright/test";
import { newProject, skill, effect, type Project } from "../src/model";
import { defaultTiming } from "../src/effect-catalog";
const nav = (p: Page, name: string) =>
  p.locator("nav").getByRole("button", { name }).click();
async function load(page: Page, p: Project) {
  await page.goto("/");
  await page
    .getByLabel("导入方案文件", { exact: true })
    .setInputFiles({
      name: "axis.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(p)),
    });
  await page.getByRole("button", { name: "确认", exact: true }).click();
}
test("axis hover, damage pagination jumps, exact stack interval navigation, globals and display modes", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const p = newProject(),
    c = p.characters[0];
  c.name = "测试";
  c.atk = 1689;
  p.enemy.level = 90;
  const s = { ...skill(c.id), name: "测试E" };
  p.skills = [s];
  const e = {
    ...effect(c.id),
    name: "定时增伤",
    type: "增伤区" as const,
    value: 10,
    realtime: {
      kind: "independentPeriodic" as const,
      max: 3,
      initial: 0,
      duration: 5,
      interval: 2,
      delta: 1,
      activeFor: 10,
    },
  };
  p.weapons[0].effects = [e];
  p.globals = [
    { ...effect(c.id), name: "全程攻击", category: "global", value: 10 },
  ];
  p.timeline = [
    {
      id: "trigger",
      kind: "effectTrigger",
      effectKey: `weapon-${p.weapons[0].id}-${e.id}`,
      time: 0,
      timing: { ...defaultTiming(e), count: 1 },
      usePreset: true,
    },
    ...Array.from({ length: 45 }, (_, i) => ({
      id: `hit${i}`,
      kind: "skill" as const,
      skillId: s.id,
      time: i + 1,
    })),
  ];
  await load(page, p);
  await nav(page, "计算结果");
  await expect(
    page.getByRole("region", { name: "伤害&效果轴", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  const axis = page.getByRole("region", { name: "伤害&效果轴", exact: true });
  await expect(axis.locator(".axis-damage-bar")).toHaveCount(45);
  const bar = axis.locator('[data-event-id="hit44"]');
  await bar.hover();
  await expect(page.getByRole("tooltip")).toContainText("45.00s");
  await expect(page.getByRole("tooltip")).toContainText("测试E");
  const oldLabel = await bar.getAttribute("aria-label");
  await bar.click();
  await expect(page.locator("#result-damage-hit44")).toHaveAttribute(
    "open",
    "",
  );
  await expect(
    page.locator(".snapshot-characters .snapshot-character"),
  ).toHaveCount(4);
  await expect(page.locator(".damage-details .damage-event")).toHaveCount(5);
  await page.getByRole("tab", { name: "暴击", exact: true }).click();
  await expect(bar).not.toHaveAttribute("aria-label", oldLabel!);
  const segments = axis.locator(".axis-buff-segment");
  await segments.nth(1).hover();
  await expect(page.getByRole("tooltip")).toContainText("2.00–4.00s");
  await segments.nth(1).click();
  const open = page.locator(".effect-history-event[open]");
  await expect(open).toContainText("定时层数变化");
  await expect(open).toContainText("2.00s");
  await expect(open).toContainText("1 → 2");
  await expect(axis.locator(".axis-global-effect")).toHaveCount(0);
  await axis.getByRole("button", { name: "展开全局效果", exact: true }).click();
  await expect(axis.locator(".axis-global-effect")).toHaveCount(1);
  await axis.locator(".axis-global-effect").hover();
  await expect(page.getByRole("tooltip")).toContainText("全程攻击");
  await axis.locator(".axis-global-effect").click();
  await expect(open).toContainText("全程攻击");
  await expect(open).toContainText("全程生效");
  await axis.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("combat-axis.png"),
    fullPage: true,
  });
  await nav(page, "角色");
  await page.getByLabel("基础攻击力", { exact: true }).fill("2000");
  await nav(page, "计算结果");
  await expect(page.locator(".calculation-status")).toContainText("参数已修改");
  await expect(axis.locator(".axis-damage-bar")).toHaveCount(45);
  await page.setViewportSize({ width: 390, height: 900 });
  await axis.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("combat-axis-mobile.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("manual and automatic effect endings use distinct badges", async ({
  page,
}) => {
  const p = newProject(),
    e = {
      ...effect(p.characters[0].id),
      name: "层数",
      realtime: {
        kind: "shared" as const,
        max: 3,
        initial: 0,
        duration: 2,
        interval: 1,
        delta: 1,
      },
    };
  p.weapons[0].effects = [e];
  const key = `weapon-${p.weapons[0].id}-${e.id}`;
  p.timeline = [
    {
      id: "a",
      kind: "effectTrigger",
      time: 0,
      effectKey: key,
      timing: { ...defaultTiming(e), count: 2 },
      usePreset: true,
    },
    {
      id: "b",
      kind: "effectTrigger",
      time: 1,
      effectKey: key,
      timing: { ...defaultTiming(e), count: 0 },
      usePreset: true,
    },
    {
      id: "c",
      kind: "effectTrigger",
      time: 3,
      effectKey: key,
      timing: defaultTiming(e),
      usePreset: true,
    },
  ];
  await load(page, p);
  await nav(page, "时间轴");
  await expect(
    page.locator(".event-kind-badge").filter({ hasText: /^效果·结束$/ }),
  ).not.toHaveCount(0);
  await expect(
    page.locator(".event-kind-badge").filter({ hasText: /^效果·自动·结束$/ }),
  ).toHaveCount(1);
});
