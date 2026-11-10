import { test, expect, type Page } from "@playwright/test";
import {
  newProject,
  effect,
  skill,
  STORAGE_KEY,
  type Project,
} from "../src/model";
const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name, exact: false }).click();
async function install(page: Page, p: Project) {
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "effects.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
}
function fixture() {
  const p = newProject(),
    c = p.characters[0];
  p.characters.forEach((c, i) => (c.name = `角色${i + 1}`));
  c.atk = 1689;
  c.critRate = 0;
  p.enemy.level = 90;
  p.weapons[0].name = "武器一";
  p.weapons[0].effects = [
    {
      ...effect(c.id),
      name: "武器增伤",
      type: "增伤区",
      value: 10,
      timingPreset: {
        count: 2,
        duration: 5,
        limit: "capped",
        max: 5,
        interval: 1,
        delta: -1,
      },
    },
  ];
  const s = skill(c.id);
  s.name = "测试伤害";
  p.skills = [s];
  p.timeline = [1, 3, 6, 8].map((time) => ({
    id: `hit-${time}`,
    time,
    kind: "skill",
    skillId: s.id,
  }));
  return p;
}
test("effect library syncs source edits and trigger timings remain local", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await install(page, fixture());
  await nav(page, "效果列表");
  await page.getByRole("tab", { name: /实时效果/ }).click();
  await expect(page.locator(".effect-source-group h3").first()).toHaveText(
    "武器",
  );
  await page.getByRole("button", { name: "编辑汇总效果 武器增伤" }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("层数更改方式")).toHaveCount(0);
  await expect(dialog.getByRole("combobox", { name: "层数模式" })).toHaveCount(
    0,
  );
  await expect(dialog.getByLabel("多层效果", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("每层效果数值", { exact: false }).fill("20");
  await dialog.getByRole("button", { name: "完成编辑" }).click();
  await nav(page, "武器");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await expect(page.locator(".equipment-panel")).toHaveCount(1);
  await expect(page.getByLabel("每层效果数值", { exact: false })).toHaveValue(
    "20",
  );
  await page.getByLabel("每层效果数值", { exact: false }).fill("30");
  await nav(page, "效果列表");
  await page.getByRole("tab", { name: /实时效果/ }).click();
  await expect(
    page.locator(".global-card").filter({ hasText: "武器增伤" }),
  ).toContainText("30%");
  await nav(page, "时间轴");
  for (const old of [
    "触发多层效果",
    "触发武器效果",
    "触发圣遗物",
    "触发天赋",
    "添加效果事件",
  ])
    await expect(
      page.getByRole("button", { name: old, exact: true }),
    ).toHaveCount(0);
  await page.getByRole("button", { name: "触发效果", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("每层效果数值", { exact: false })).toHaveCount(
    0,
  );
  await expect(dialog.getByLabel("数值方式", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("本次设为层数", { exact: false })).toHaveValue(
    "1",
  );
  await dialog.getByLabel("本次设为层数", { exact: true }).fill("2");
  await expect(dialog.getByLabel("本次共用持续时间", { exact: false })).toHaveValue(
    "5",
  );
  await dialog.getByLabel("起始时间", { exact: false }).fill("0");
  await dialog.getByLabel("使用预设", { exact: true }).uncheck();
  await dialog.getByLabel("本次共用持续时间", { exact: false }).fill("2");
  await dialog.getByRole("button", { name: "保存触发事件" }).click();
  await nav(page, "武器");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  await page.getByLabel("默认共用持续时间", { exact: false }).fill("20");
  await page.getByLabel("每层效果数值", { exact: false }).fill("40");
  await nav(page, "时间轴");
  await page
    .getByRole("button", { name: "编辑事件 触发效果：武器增伤" })
    .click();
  await expect(dialog.getByLabel("本次共用持续时间", { exact: false })).toHaveValue(
    "2",
  );
  await expect(dialog.locator(".info-strip")).toContainText("40%");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await expect(page.locator(".damage-value").first()).toContainText("1,620");
  await expect(page.locator(".damage-value").nth(1)).toContainText("900");
  await page.locator(".damage-event summary").first().click();
  await expect(page.locator(".active-effects")).toContainText("当前层数：2 层");
  await expect(page.locator(".active-effects")).toContainText("效果数值：80%");
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).timeline.find(
            (e: any) => e.kind === "effectTrigger",
          )?.timing.duration,
        STORAGE_KEY,
      ),
    )
    .toBe(2);
  await page.reload();
  await nav(page, "时间轴");
  await expect(page.locator(".timeline-panel")).toContainText(
    "设为 2层 · 2s（已更改）",
  );
  await page.screenshot({
    path: testInfo.outputPath("unified-timeline.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("effect source choices expose timing but never effect values, limits or mode", async ({
  page,
}) => {
  const p = fixture();
  p.artifacts[0].effects = [
    { ...effect(p.characters[0].id), name: "套装效果" },
  ];
  p.talents = [
    {
      id: "t",
      name: "天赋一",
      characterId: p.characters[0].id,
      effects: [{ ...effect(p.characters[0].id), name: "天赋效果" }],
    },
  ];
  await install(page, p);
  await nav(page, "时间轴");
  await page.getByRole("button", { name: "触发效果", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const [kind, name] of [
    ["artifact", "套装效果"],
    ["talent", "天赋效果"],
    ["weapon", "武器增伤"],
  ]) {
    await dialog
      .getByRole("combobox", { name: "效果来源", exact: true })
      .selectOption(kind);
    await expect(
      dialog.getByRole("combobox", { name: "详细效果", exact: true }),
    ).toContainText(name);
    await expect(
      dialog.getByLabel(/本次(共用)?持续时间/),
    ).toBeDisabled();
    await expect(
      dialog.getByLabel("层数更改方式", { exact: true }),
    ).toHaveCount(0);
    await expect(
      dialog.getByLabel("本次叠加上限", { exact: true }),
    ).toHaveCount(0);
    await expect(dialog.getByLabel("效果数值", { exact: false })).toHaveCount(
      0,
    );
  }
});

test("equipment uses a single character editor and talents use grouped expandable rows", async ({
  page,
}, testInfo) => {
  await install(page, fixture());
  for (const [tab, label] of [
    ["武器", "武器名称"],
    ["圣遗物", "套装名字"],
  ]) {
    await nav(page, tab);
    await expect(
      page.locator(".equipment-character-grid .character-card"),
    ).toHaveCount(4);
    await expect(page.locator(".equipment-panel")).toHaveCount(1);
    await page
      .locator(".equipment-character-grid .character-card")
      .nth(1)
      .click();
    await page.getByLabel(label, { exact: true }).fill(`${tab}第二位`);
    await page
      .locator(".equipment-character-grid .character-card")
      .nth(0)
      .click();
    await expect(page.getByLabel(label, { exact: true })).not.toHaveValue(
      `${tab}第二位`,
    );
    await page
      .locator(".equipment-character-grid .character-card")
      .nth(1)
      .click();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(
      `${tab}第二位`,
    );
  }
  await nav(page, "天赋");
  for (const name of ["天赋甲", "天赋乙"]) {
    await page.getByRole("button", { name: "添加天赋", exact: true }).click();
    await page.getByLabel("天赋名称", { exact: true }).fill(name);
    await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  }
  await expect(page.locator(".talent-group")).toHaveCount(1);
  await expect(page.locator(".talent-panel .panel-body")).toHaveCount(0);
  await page
    .getByRole("button", { name: "编辑天赋 天赋乙", exact: true })
    .click();
  await expect(page.getByLabel("天赋名称", { exact: true })).toHaveValue(
    "天赋乙",
  );
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await page
    .locator(".talent-panel")
    .nth(1)
    .getByRole("button", { name: "天赋上移", exact: true })
    .click();
  await expect(
    page.locator(".talent-panel .skill-label").first(),
  ).toContainText("天赋乙");
  await page.screenshot({
    path: testInfo.outputPath("talent-groups.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, "武器");
  while (await page.locator(".effect-details:not([open]) > summary").count())
    await page.locator(".effect-details:not([open]) > summary").first().click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("equipment-mobile.png"),
    fullPage: true,
  });
});
