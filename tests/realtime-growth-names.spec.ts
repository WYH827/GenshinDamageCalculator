import { test, expect, type Page } from "@playwright/test";
import { effect, newProject, skill, STORAGE_KEY } from "../src/model";
import { defaultTiming } from "../src/effect-catalog";
const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name }).click();

test("zero-start realtime stacks appear in worker damage and detail", async ({
  page,
}) => {
  const p = newProject(),
    [attacker, source] = p.characters;
  attacker.name = "桑多涅";
  attacker.atk = 1689;
  attacker.critRate = 0;
  source.name = "奥黛塔";
  const buff = {
    ...effect(source.id),
    category: "realtime" as const,
    realtimeKind: "stacking" as const,
    type: "星月增伤" as const,
    value: 15,
    timingPreset: {
      mode: "periodic" as const,
      count: 0,
      duration: null,
      limit: "capped" as const,
      max: 4,
      interval: 1,
      delta: 1,
    },
  };
  p.talents = [
    {
      id: "talent",
      name: "华彩（队友）",
      characterId: source.id,
      effects: [buff],
    },
  ];
  const hit = skill(attacker.id);
  hit.name = "星超导命中";
  hit.damage.element = "冰";
  hit.damage.special = "星超导";
  p.skills = [hit];
  p.timeline = [
    {
      id: "trigger",
      time: 0.3,
      kind: "effectTrigger",
      effectKey: `talent-talent-${buff.id}`,
      timing: defaultTiming(buff),
      usePreset: true,
    },
    ...[1.2, 1.5, 1.8].map((time) => ({
      id: `h${time}`,
      kind: "skill" as const,
      time,
      skillId: hit.id,
    })),
  ];
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "growth.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "计算结果");
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".calculation-status")).toContainText("已完成计算");
  await expect(page.locator(".damage-value").first()).toContainText("1,800");
  await expect(page.locator(".damage-value").nth(1)).toContainText("2,070");
  await expect(page.locator(".damage-value").nth(2)).toContainText("2,070");
  await page.locator(".damage-event summary").nth(1).click();
  await expect(page.locator(".active-effects")).toContainText(
    "奥黛塔天赋/命座华彩（队友）",
  );
  await expect(page.locator(".active-effects")).toContainText("当前层数：1 层");
  await expect(page.locator(".active-effects")).toContainText("效果数值：15%");
  await expect(page.locator(".active-effects")).toContainText("参与伤害");
});

test("new effect names follow character, type and owner, with custom and reset behavior", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("角色名称", { exact: true }).fill("桑多涅");
  for (const [tab, label, ownerName, expected] of [
    ["武器", "武器名称", "极霸剑", "桑多涅武器极霸剑"],
    ["圣遗物", "套装名字", "测试套装", "桑多涅圣遗物测试套装"],
  ]) {
    await nav(page, tab);
    await page.getByLabel(label, { exact: true }).fill(ownerName);
    await page.getByRole("button", { name: "添加效果", exact: true }).click();
    await page
      .locator(".effect-details")
      .last()
      .locator(":scope > summary")
      .click();
    await expect(page.getByLabel("效果名称", { exact: true })).toHaveValue(
      expected,
    );
  }
  await nav(page, "天赋/命座");
  await page.getByRole("button", { name: "添加天赋/命座", exact: true }).click();
  await page.getByLabel("天赋/命座名称", { exact: true }).fill("攻击转精通");
  await page.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  await expect(page.getByLabel("效果名称", { exact: true })).toHaveValue(
    "桑多涅天赋/命座攻击转精通",
  );
  await page.getByLabel("天赋/命座名称", { exact: true }).fill("新的天赋");
  await expect(page.getByLabel("效果名称", { exact: true })).toHaveValue(
    "桑多涅天赋/命座新的天赋",
  );
  await page.getByLabel("效果名称", { exact: true }).fill("自定义名称");
  await page.getByLabel("天赋/命座名称", { exact: true }).fill("最终天赋");
  await expect(page.getByLabel("效果名称", { exact: true })).toHaveValue(
    "自定义名称",
  );
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await nav(page, "技能");
  await page
    .getByRole("button", { name: "添加技能", exact: true })
    .first()
    .click();
  await page.getByLabel("技能名称", { exact: true }).fill("辅助E");
  await page.getByRole("button", { name: "提供效果", exact: true }).click();
  await page.getByRole("button", { name: "添加效果", exact: true }).click();
  await page
    .locator(".effect-details")
    .last()
    .locator(":scope > summary")
    .click();
  await expect(page.getByLabel("效果名称", { exact: true })).toHaveValue(
    "桑多涅技能辅助E",
  );
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await nav(page, "角色");
  await page.getByLabel("角色名称", { exact: true }).fill("新角色");
  await nav(page, "效果列表");
  await page.getByRole("tab", { name: /实时效果/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("新角色武器极霸剑");
  await expect(page.getByRole("tabpanel")).toContainText("新角色技能辅助E");
  await page
    .getByRole("button", { name: "编辑汇总效果 自定义名称", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "恢复默认名称", exact: true })
    .click();
  await expect(dialog.getByLabel("效果名称", { exact: true })).toHaveValue(
    "新角色天赋/命座最终天赋",
  );
  await dialog.getByRole("button", { name: "完成编辑", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).talents[0].effects[0].name,
        STORAGE_KEY,
      ),
    )
    .toBe("新角色天赋/命座最终天赋");
  await page.reload();
  await nav(page, "效果列表");
  await page.getByRole("tab", { name: /实时效果/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("新角色天赋/命座最终天赋");
});
