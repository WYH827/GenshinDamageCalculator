import { test, expect } from "@playwright/test";
import { newProject, effect, skill, STORAGE_KEY } from "../src/model";
import { defaultTiming, effectCatalog } from "../src/effect-catalog";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(readFileSync("tests/fixtures/enka-equipment.json", "utf8"));

test("persistent creation controls, enabled states, source defaults and filtered critical effects", async ({
  page,
}, info) => {
  const p = newProject(),
    c = p.characters[0];
  c.name = "芙宁娜";
  c.atk = 1000;
  const s = skill(c.id);
  s.name = "芙宁娜Q";
  p.skills = [s];
  p.globals = [
    { ...effect(c.id), name: "环境增益", category: "global", value: 50 },
  ];
  const e = {
    ...effect(c.id),
    name: "冰暴伤",
    type: "暴击伤害" as const,
    value: 50,
    realtime: {
      kind: "fixed" as const,
      initial: 0,
      max: 1,
      duration: 10,
      interval: 1,
      delta: 1,
    },
    boundSkillIds: [s.id],
  };
  p.weapons[0].effects = [e];
  const key = effectCatalog(p).find((r) => r.kind === "weapon")!.key;
  p.timeline = [
    {
      id: "trigger",
      kind: "effectTrigger",
      time: 0,
      effectKey: key,
      timing: defaultTiming(e),
      usePreset: true,
    },
    { id: "hit", kind: "skill", time: 5, skillId: s.id },
    { id: "swap", kind: "switch", time: 8, characterId: p.characters[1].id },
  ];
  await page.goto("/");
  await page
    .getByLabel("导入方案文件", { exact: true })
    .setInputFiles({
      name: "p.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(p)),
    });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  const nav = (name: string) =>
    page.locator("nav").getByRole("button", { name }).click();
  await nav("环境/元素共鸣");
  await expect(page.locator(".effect-details")).toHaveAttribute("open", "");
  await nav("天赋/命座");
  await expect(
    page.getByRole("heading", { name: "角色天赋/命座" }),
  ).toBeVisible();
  await nav("技能");
  await page
    .getByRole("button", { name: "添加技能", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("技能名称", { exact: true })).toHaveValue(
    "芙宁娜",
  );
  await page.getByLabel("技能名称", { exact: true }).fill("芙宁娜E");
  await page.getByRole("button", { name: "提供效果", exact: true }).click();
  await page.getByRole("button", { name: "添加效果", exact: true }).click();
  await expect(page.locator(".effect-fold-title")).toContainText("芙宁娜技能E");
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await nav("效果列表");
  await page.getByRole("tab", { name: /实时效果/ }).click();
  await page
    .getByRole("button", { name: "编辑汇总效果 冰暴伤", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("属性", { exact: true })
    .selectOption("冰");
  await page.getByRole("button", { name: "完成编辑", exact: true }).click();
  await page
    .getByRole("button", { name: "禁用效果 冰暴伤", exact: true })
    .click();
  await expect(
    page.locator(".global-card").filter({ hasText: "冰暴伤" }),
  ).toHaveClass(/is-disabled/);
  await page
    .getByRole("button", { name: "开启效果 冰暴伤", exact: true })
    .click();
  await nav("圣遗物");
  await page.getByLabel("沙主词条", { exact: true }).selectOption("recharge");
  await expect(page.getByLabel("沙主词条数值", { exact: false })).toHaveValue(
    "51.8",
  );
  await expect(
    page
      .getByLabel("杯主词条", { exact: true })
      .locator('option[value="recharge"]'),
  ).toHaveCount(0);
  await nav("时间轴");
  const bar = page.locator(".timeline-batch-toolbar");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 850 });
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    for (const name of [
      "触发效果",
      "切换角色",
      "批量添加技能",
      "添加技能事件",
      "多选",
    ]) {
      const b = await bar
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(b!.y).toBeGreaterThan(0);
      expect(b!.y + b!.height).toBeLessThanOrEqual(850);
      expect(b!.x).toBeGreaterThanOrEqual(0);
      expect(b!.x + b!.width).toBeLessThanOrEqual(width);
    }
    await bar.getByRole("button", { name: "多选", exact: true }).click();
    await expect(
      bar.getByRole("button", { name: "触发效果", exact: true }),
    ).toHaveCount(0);
    await bar.getByRole("button", { name: "退出多选", exact: true }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page
    .getByRole("button", { name: "禁用事件 芙宁娜Q 5s", exact: true })
    .click();
  await expect(
    page
      .locator(".timeline-row.is-disabled")
      .filter({ has: page.locator(".event-skill-select") }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: /禁用事件 切换角色：.*8s/, exact: true })
    .click();
  await page
    .getByRole("button", { name: "禁用事件 触发效果：冰暴伤 0s", exact: true })
    .click();
  await page
    .getByRole("button", { name: "编辑事件 触发效果：冰暴伤", exact: true })
    .click();
  await page.getByRole("button", { name: "保存触发事件", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "开启事件 触发效果：冰暴伤 0s",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await nav("时间轴");
  await expect(
    page.getByRole("button", { name: "开启事件 芙宁娜Q 5s", exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    STORAGE_KEY,
  );
  expect(
    stored.timeline.every((e: { enabled: boolean }) => e.enabled === false),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("disabled-timeline.png"),
    fullPage: true,
  });
});

test("official Enka paste fallback rejects wrong UID and preserves the preview/apply boundary", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await page.getByRole("tab", { name: "Enka UID" }).click();
  await page.getByLabel("原神UID", { exact: true }).fill("618285856");
  await page.locator(".official-enka-fallback summary").click();
  await expect(
    page.getByRole("link", { name: "打开此UID的Enka官方JSON" }),
  ).toHaveAttribute("href", "https://enka.network/api/uid/618285856/");
  await page
    .getByLabel("Enka官方JSON内容", { exact: true })
    .fill(JSON.stringify({ ...fixture, uid: "123456789" }));
  await page.getByRole("button", { name: "预览官方JSON", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("UID不一致");
  await page
    .getByLabel("Enka官方JSON内容", { exact: true })
    .fill(JSON.stringify({ ...fixture, uid: "618285856" }));
  await page.getByRole("button", { name: "预览官方JSON", exact: true }).click();
  await expect(page.getByLabel("来源角色", { exact: true })).toContainText(
    "安柏",
  );
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue(
    "安柏",
  );
});
