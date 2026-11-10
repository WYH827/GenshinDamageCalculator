import { test, expect, type Page } from "@playwright/test";
import { newProject, skill, STORAGE_KEY, type Project } from "../src/model";
const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name }).click();
async function load(page: Page, p: Project) {
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "test.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
}

test("empty skill uses compact note icon, stays aligned on desktop and mobile, and ignored options are last", async ({
  page,
}, info) => {
  const p = newProject(),
    c = p.characters[0];
  c.name = "测试角色";
  p.skills = [
    { ...skill(c.id), name: "普通技能" },
    { ...skill(c.id), kind: "empty", name: "等待动画结束" },
  ];
  await load(page, p);
  await nav(page, "技能");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    const icon = page.locator(".skill-kind-empty");
    await expect(icon.locator(".lucide-message-square")).toHaveCount(1);
    expect(
      await icon.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop)),
    ).toBe(0);
    const box = await icon.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(40);
    expect(box!.height).toBeLessThanOrEqual(40);
    const headers = await page
      .locator(".skill-card-header")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(Math.abs(headers[0] - headers[1])).toBeLessThan(2);
    await page
      .getByRole("button", { name: "编辑技能 等待动画结束", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "不造成伤害", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`note-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  }
  await nav(page, "圣遗物");
  for (const slot of ["沙", "杯", "头"])
    await expect(
      page.getByLabel(`${slot}主词条`).locator("option").last(),
    ).toHaveText("NOT IMPORTANT");
  for (const slot of ["花", "毛"])
    await expect(
      page.getByLabel(`${slot}主词条`).locator('option[value="notImportant"]'),
    ).toHaveCount(0);
  await page.getByRole("button", { name: "添加词条", exact: true }).click();
  await expect(page.getByLabel("词条类别").locator("option").last()).toHaveText(
    "NOT IMPORTANT",
  );
  await nav(page, "武器");
  await page.getByRole("button", { name: "添加词条", exact: true }).click();
  await expect(page.getByLabel("词条类别").locator("option").last()).toHaveText(
    "NOT IMPORTANT",
  );
});

test("custom draft cancels cleanly, confirms once, supports no actor and factors, and computes via worker", async ({
  page,
}, info) => {
  const p = newProject(),
    c = p.characters[0];
  Object.assign(c, { name: "测试", atk: 1689, critRate: 0 });
  p.enemy.level = 90;
  p.skills = [{ ...skill(c.id), name: "伤害" }];
  p.timeline = [
    { id: "hit", kind: "skill", skillId: p.skills[0].id, time: 10 },
  ];
  await load(page, p);
  await nav(page, "效果列表");
  await page.getByRole("button", { name: "添加独立效果", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const count = () =>
    page.evaluate(
      (key) =>
        (JSON.parse(localStorage.getItem(key)!).customEffects ?? []).length,
      STORAGE_KEY,
    );
  await dialog.getByLabel("效果名称", { exact: true }).fill("取消的效果");
  expect(await count()).toBe(0);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  expect(await count()).toBe(0);
  await page.getByRole("button", { name: "添加独立效果", exact: true }).click();
  await dialog.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  expect(await count()).toBe(0);
  await page.getByRole("button", { name: "添加独立效果", exact: true }).click();
  const type = dialog.getByRole("combobox", { name: "效果类型", exact: true });
  await expect(type.locator('option[value="增伤区"]')).toHaveText(
    "基础增伤 【造成的伤害提升 X%】",
  );
  await expect(type.locator('option[value="倍率区"]')).toHaveText("改变倍率");
  await expect(type.locator('option[value="星月额外提升"]')).toHaveCount(0);
  await expect(type.locator('option[value="基础值加成"]')).toHaveText(
    "基础值加成 / 星月额外提升 【造成的伤害提高 X】",
  );
  for (const [key, note] of [
    ["星月增伤", "【造成的伤害提升 X%】"],
    ["增幅反应增伤", "【造成的伤害提升 X%】"],
    ["易伤", "【目标受到的伤害提升 X%】"],
    ["减伤", "【目标受到的伤害降低 X%】"],
    ["星月基础提升", "【造成的XXX反应的基础伤害提升 X%】"],
  ])
    await expect(type.locator(`option[value="${key}"]`)).toContainText(note);
  await dialog
    .getByRole("combobox", { name: "生效对象", exact: true })
    .selectOption("self");
  await dialog
    .getByRole("combobox", { name: "来源角色", exact: true })
    .selectOption("");
  await expect(
    dialog.getByRole("combobox", { name: "生效对象", exact: true }),
  ).toHaveValue("team");
  await expect(dialog.locator('option[value="self"]')).toHaveCount(0);
  await type.selectOption("独立乘区");
  await expect(dialog.getByLabel("效果数值", { exact: false })).toHaveValue(
    "1",
  );
  await expect(
    dialog.getByRole("combobox", { name: "数值单位", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("效果名称", { exact: true }).fill("独立系数");
  await dialog.getByLabel("效果数值", { exact: false }).fill("1.2");
  expect(await count()).toBe(0);
  await page.screenshot({
    path: info.outputPath("independent-draft.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "确认添加", exact: true }).click();
  await expect.poll(count).toBe(1);
  await page.reload();
  await nav(page, "效果列表");
  await page
    .getByRole("button", { name: "编辑汇总效果 独立系数", exact: true })
    .click();
  await expect(
    dialog.getByRole("combobox", { name: "来源角色", exact: true }),
  ).toHaveValue("");
  await expect(dialog.getByLabel("效果数值", { exact: false })).toHaveValue(
    "1.2",
  );
  await dialog.getByRole("button", { name: "完成编辑", exact: true }).click();
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await expect(page.getByTestId("total-damage")).toHaveText("1,080");
  await page.locator(".damage-details details > summary").click();
  await expect(page.locator(".factor-list")).toContainText(
    "独立乘区系数1.2 = 1.2",
  );
  await expect(page.locator(".final-formula")).toContainText("× 1.2");
  await nav(page, "效果列表");
  await page
    .getByRole("button", { name: "编辑汇总效果 独立系数", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "效果分类", exact: true })
    .selectOption("realtime");
  await dialog
    .getByRole("combobox", { name: "实时效果类型", exact: true })
    .selectOption("independentPeriodic");
  await expect(
    dialog.getByLabel("默认变化间隔", { exact: false }),
  ).toBeVisible();
  await expect(dialog.getByLabel("最大层数", { exact: false })).toBeVisible();
  await expect(dialog.getByLabel("预设更改方式", { exact: true })).toHaveCount(
    0,
  );
});
