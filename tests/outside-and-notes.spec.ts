import { test, expect, type Page } from "@playwright/test";
import {
  effect,
  newProject,
  skill,
  STORAGE_KEY,
  type Project,
} from "../src/model";

const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name }).click();
async function importProject(page: Page, project: Project) {
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "outside.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
}

test("outside toggle syncs from source to library, survives reload, and appears in calculated panels", async ({
  page,
}) => {
  const p = newProject(),
    c = p.characters[0];
  c.name = "测试";
  c.atk = 1689;
  c.critRate = 0;
  p.enemy.level = 90;
  const hit = {
    ...skill(c.id),
    name: "局外攻击",
    scalingMode: "outside" as const,
  };
  p.skills = [hit];
  p.timeline = [{ id: "hit", kind: "skill", time: 10, skillId: hit.id }];
  p.weapons[0].effects = [
    {
      ...effect(c.id),
      name: "攻击加100",
      category: "global",
      value: 100,
      unit: "flat",
    },
  ];
  p.artifacts[0].effects = [{ ...effect(c.id), name: "套装测试" }];
  p.talents = [
    {
      id: "talent",
      name: "天赋测试",
      characterId: c.id,
      effects: [{ ...effect(c.id), name: "天赋效果" }],
    },
  ];
  p.globals = [
    { ...effect(c.id), name: "环境测试", category: "global", value: 0 },
  ];
  await importProject(page, p);
  await nav(page, "武器");
  await expect(page.locator(".effect-form")).toBeHidden();
  await page.locator(".effect-details > summary").click();
  await expect(page.getByLabel("局外生效", { exact: true })).not.toBeChecked();
  await page.getByLabel("局外生效", { exact: true }).check();
  const fold = page.locator(".effect-details").first();
  await fold.locator("summary").click();
  await expect(fold.locator(".effect-form")).toBeHidden();
  await page.getByLabel("武器名称", { exact: true }).fill("新武器");
  await expect(fold.locator(".effect-form")).toBeHidden();
  await fold.locator("summary").click();
  await expect(page.getByLabel("局外生效", { exact: true })).toBeChecked();
  await nav(page, "效果列表");
  await page
    .getByRole("button", { name: "编辑汇总效果 攻击加100", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("局外生效", { exact: true }),
  ).toBeChecked();
  await page
    .getByRole("dialog")
    .getByLabel("效果数值", { exact: false })
    .fill("200");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "完成编辑", exact: true })
    .click();
  await nav(page, "武器");
  await expect(page.locator(".effect-form")).toBeHidden();
  await page.locator(".effect-details > summary").click();
  await expect(page.getByLabel("效果数值", { exact: false })).toHaveValue(
    "200",
  );
  await nav(page, "圣遗物");
  await expect(page.locator(".effect-form")).toBeHidden();
  await nav(page, "天赋");
  await page
    .getByRole("button", { name: "编辑天赋 天赋测试", exact: true })
    .click();
  await expect(page.locator(".effect-form")).toBeHidden();
  await nav(page, "环境/元素共鸣");
  await expect(page.locator(".global-card")).toBeHidden();
  await page.reload();
  await nav(page, "武器");
  await expect(page.locator(".effect-form")).toBeHidden();
  await page.locator(".effect-details > summary").click();
  await expect(page.getByLabel("局外生效", { exact: true })).toBeChecked();
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await expect(page.locator(".damage-value")).toContainText("990");
  await page.locator(".damage-details details > summary").click();
  await expect(page.locator(".snapshot-character").first()).toContainText(
    "1,689 / 2,200 / 2,200",
  );
});

test("non-damaging skills survive export/import and count toward DPS duration", async ({
  page,
}) => {
  const p = newProject(),
    c = p.characters[0];
  c.name = "测试";
  c.atk = 1689;
  c.critRate = 0;
  p.enemy.level = 90;
  const hit = { ...skill(c.id), name: "伤害" };
  p.skills = [hit];
  p.timeline = [{ id: "hit", kind: "skill", time: 10, skillId: hit.id }];
  await importProject(page, p);
  await nav(page, "技能");
  await page.getByRole("button", { name: "添加技能", exact: true }).click();
  await page.getByLabel("技能名称", { exact: true }).fill("等待动画");
  await page.getByRole("button", { name: "不造成伤害", exact: true }).click();
  await expect(page.getByLabel("技能倍率", { exact: false })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "添加效果", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await nav(page, "时间轴");
  await page.getByRole("button", { name: "添加技能事件", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").selectOption({ label: "等待动画" });
  await dialog.getByLabel("起始时间", { exact: false }).fill("100");
  await dialog
    .getByRole("button", { name: "添加到时间轴", exact: true })
    .click();
  const row = page.locator(".timeline-row:not(.global-event)").last();
  await expect(row).toContainText("不造成伤害 · 计入统计时长");
  await expect(row.getByLabel("是增幅反应伤害", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".timeline-overview")).toContainText("100.00");
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).skills.at(-1).kind,
        STORAGE_KEY,
      ),
    )
    .toBe("empty");
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).timeline.length,
        STORAGE_KEY,
      ),
    )
    .toBe(2);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
  await importProject(page, saved);
  await nav(page, "时间轴");
  await expect(
    page.locator(".timeline-row:not(.global-event)").last(),
  ).toContainText("不造成伤害 · 计入统计时长");
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await expect(page.locator(".damage-value")).toHaveCount(1);
  await expect(page.locator(".damage-value")).toContainText("900");
  await expect(page.getByTestId("total-dps")).toHaveText("9");
});
