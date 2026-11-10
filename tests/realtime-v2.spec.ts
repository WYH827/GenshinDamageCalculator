import { test, expect, type Page } from "@playwright/test";
import {
  effect,
  skill,
  newProject,
  type Project,
  STORAGE_KEY,
} from "../src/model";
import { defaultTiming } from "../src/effect-catalog";
const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name }).click();
async function load(page: Page, p: Project) {
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "realtime.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
}
test("five types, skill bindings, editable layers, preset locks, gray ticks and non-damaging duration", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const p = newProject(),
    c = p.characters[0];
  c.name = "桑多涅";
  c.atk = 1689;
  p.enemy.level = 90;
  const hit = { ...skill(c.id), name: "输出" },
    cast = { ...skill(c.id), name: "不伤害释放", kind: "empty" as const };
  p.skills = [hit, cast];
  const e = {
    ...effect(c.id),
    name: "层数增伤",
    type: "增伤区" as const,
    value: 10,
    category: "realtime" as const,
    realtime: {
      kind: "independentPeriodic" as const,
      max: 3,
      initial: 0,
      duration: 5,
      interval: 1,
      delta: 1,
    },
    boundSkillIds: [cast.id],
  };
  p.weapons[0].effects = [e];
  p.timeline = [
    { id: "cast", kind: "skill", skillId: cast.id, time: 0 },
    { id: "hit", kind: "skill", skillId: hit.id, time: 2 },
    { id: "end", kind: "skill", skillId: cast.id, time: 5 },
  ];
  await load(page, p);
  await nav(page, "武器");
  await page.locator(".effect-details > summary").click();
  const type = page.getByRole("combobox", {
    name: "实时效果类型",
    exact: true,
  });
  await expect(type.locator("option")).toHaveCount(5);
  await expect(page.getByLabel("初始层数", { exact: false })).toHaveValue("0");
  await expect(page.getByLabel("预设更改方式", { exact: true })).toHaveCount(0);
  await page.locator(".skill-binding > summary").click();
  await expect(
    page.getByRole("checkbox", { name: "桑多涅 · 不伤害释放", exact: true }),
  ).toBeChecked();
  await nav(page, "时间轴");
  await expect(page.locator(".bound-effect-row")).toHaveCount(2);
  await expect(page.locator(".periodic-event")).toHaveCount(5);
  await expect(page.locator(".periodic-event").last()).toContainText(
    "来源：定时变化层数 · 0.00s",
  );
  const child = page.locator(".bound-effect-row").first();
  await expect(
    child.getByLabel("本次设为层数", { exact: false }),
  ).toBeEnabled();
  await expect(
    child.getByLabel("本次每层持续时间", { exact: false }),
  ).toBeDisabled();
  await child.getByLabel("本次设为层数", { exact: false }).fill("0");
  await expect(child).toContainText("当前无该效果");
  await child
    .getByRole("checkbox", { name: "使用预设", exact: true })
    .uncheck();
  await child.getByLabel("本次每层持续时间", { exact: false }).fill("4");
  await child.locator(".periodic-settings > summary").click();
  await child.getByLabel("本次变化间隔", { exact: false }).fill("2");
  await expect(page.locator(".periodic-event")).toHaveCount(2);
  await expect(child).toContainText("已更改");
  await child.getByRole("checkbox", { name: "使用预设", exact: true }).check();
  await expect(child.getByLabel("本次变化间隔", { exact: false })).toHaveValue(
    "1",
  );
  await expect(child.getByLabel("本次设为层数", { exact: false })).toHaveValue(
    "0",
  );
  await expect(page.locator(".periodic-event")).toHaveCount(5);
  await page.screenshot({
    path: info.outputPath("bound-timeline.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("bound-timeline-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await expect(page.locator(".damage-event")).toHaveCount(1);
  await page.locator(".damage-event > summary").click();
  await expect(page.locator(".active-effects")).toContainText("层数增伤");
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).timeline[0].effectTimings,
        STORAGE_KEY,
      ),
    )
    .not.toBeUndefined();
  await page.reload();
  await nav(page, "时间轴");
  await expect(
    page
      .locator(".bound-effect-row")
      .first()
      .getByLabel("本次设为层数", { exact: false }),
  ).toHaveValue("0");
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "编辑技能 不伤害释放", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "不造成伤害", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("manual independent deductions and shared remaining duration render inline; source preset edits sync", async ({
  page,
}) => {
  const p = newProject(),
    c = p.characters[0];
  c.name = "测试";
  const e = {
    ...effect(c.id),
    name: "独立层",
    category: "realtime" as const,
    realtime: {
      kind: "independent" as const,
      max: 5,
      initial: 3,
      duration: 10,
      interval: 1,
      delta: 1,
    },
  };
  const shared = {
    ...e,
    id: "shared",
    name: "共用层",
    realtime: { ...e.realtime, kind: "shared" as const },
  };
  p.artifacts[0].effects = [e, shared];
  p.timeline = [
    {
      id: "one",
      kind: "effectTrigger",
      time: 2,
      effectKey: `artifact-${p.artifacts[0].id}-${e.id}`,
      timing: { ...defaultTiming(e), count: -1 },
      usePreset: true,
    },
    {
      id: "two",
      kind: "effectTrigger",
      time: 3,
      effectKey: `artifact-${p.artifacts[0].id}-${shared.id}`,
      timing: defaultTiming(shared),
      usePreset: true,
    },
  ];
  await load(page, p);
  await nav(page, "时间轴");
  const row = page
    .locator(".timeline-row")
    .filter({ hasText: "触发效果：独立层" });
  await expect(row).toContainText("当前层数3");
  await expect(row.getByLabel("本次增减层数", { exact: true })).toHaveValue(
    "-1",
  );
  await expect(
    page.locator(".timeline-row").filter({ hasText: "触发效果：共用层" }),
  ).toContainText("当前层数3，剩余持续时间7s");
  await nav(page, "圣遗物");
  await page.locator(".effect-details > summary").first().click();
  await page.getByLabel("默认每层持续时间", { exact: false }).fill("20");
  await nav(page, "时间轴");
  await expect(
    row.getByLabel("本次每层持续时间", { exact: false }),
  ).toHaveValue("20");
  await row.getByRole("checkbox", { name: "使用预设", exact: true }).uncheck();
  await expect(
    row.getByLabel("本次每层持续时间", { exact: false }),
  ).toHaveValue("20");
  await row.getByLabel("本次每层持续时间", { exact: false }).fill("1");
  await expect(row).toContainText("已更改");
  await page.getByRole("button", { name: "触发效果", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "效果来源", exact: true })
    .selectOption("artifact");
  await expect(
    dialog.getByLabel("本次增减层数", { exact: true }),
  ).toBeEnabled();
  await expect(dialog).toContainText("当前层数2");
});
