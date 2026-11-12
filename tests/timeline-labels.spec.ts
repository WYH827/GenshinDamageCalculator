import { test, expect, type Page } from "@playwright/test";
import {
  effect,
  newProject,
  skill,
  STORAGE_KEY,
  type Project,
} from "../src/model";
import { defaultTiming } from "../src/effect-catalog";

async function install(page: Page, project: Project) {
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "timeline-labels.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await page.locator("nav").getByRole("button", { name: "时间轴" }).click();
}

function fixture() {
  const p = newProject(),
    [attacker, support] = p.characters;
  attacker.name = "桑多涅";
  support.name = "奥黛塔";
  attacker.atk = 1689;
  attacker.critRate = 0;
  p.enemy.level = 90;
  p.initialCharacterId = support.id;
  const buff = {
    ...effect(support.id),
    name: "",
    category: "realtime" as const,
    realtimeKind: "fixed" as const,
    type: "增伤区" as const,
    value: 15,
  };
  p.talents = [
    {
      id: "talent",
      name: "华彩（队友）",
      characterId: support.id,
      effects: [buff],
    },
  ];
  const hit = skill(attacker.id);
  hit.name = "测试伤害";
  p.skills = [hit];
  p.timeline = [
    {
      id: "buff",
      time: 0.3,
      kind: "effectTrigger",
      effectKey: `talent-talent-${buff.id}`,
      timing: defaultTiming(buff),
      usePreset: true,
    },
    { id: "switch", time: 0.9, kind: "switch", characterId: attacker.id },
    { id: "hit", time: 1.2, kind: "skill", skillId: hit.id },
  ];
  return p;
}

test("valid unnamed effects stay editable and contribute damage, missing references are distinct", async ({
  page,
}) => {
  const p = fixture();
  await install(page, p);
  await expect(page.locator(".timeline-panel")).not.toContainText("效果已删除");
  const row = page
    .locator(".timeline-row")
    .filter({ hasText: "触发效果：奥黛塔天赋/命座华彩（队友）" });
  await expect(row).toContainText("华彩（队友）");
  await row
    .getByRole("button", { name: "编辑事件 触发效果：奥黛塔天赋/命座华彩（队友）" })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("combobox", { name: "详细效果", exact: true }),
  ).toHaveValue(
    p.timeline[0].kind === "effectTrigger" ? p.timeline[0].effectKey : "",
  );
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.locator("nav").getByRole("button", { name: "计算结果" }).click();
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.locator(".damage-value")).toContainText("1,035");
  await page.locator(".damage-event summary").click();
  await expect(page.locator(".active-effects")).toContainText("华彩（队友）");
  await expect(page.locator(".active-effects")).toContainText("效果数值：15%");

  const missing = structuredClone(p);
  if (missing.timeline[0].kind === "effectTrigger")
    missing.timeline[0].effectKey = "talent-deleted-effect";
  await install(page, missing);
  await expect(page.locator(".timeline-panel")).toContainText(
    "触发效果：效果已删除",
  );
  await expect(page.locator(".timeline-panel")).toContainText(
    "请重新选择效果来源",
  );
});

test("foreground switch is styled, fits desktop/mobile, and changes the event snapshot", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const p = fixture();
  await install(page, p);
  const select = page
    .locator(".switch-select")
    .getByRole("combobox", { name: "切换到角色" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(select).toBeVisible();
    expect(
      await select.evaluate((el) => {
        const style = getComputedStyle(el),
          rect = el.getBoundingClientRect(),
          cell = el.closest(".event-name")!.getBoundingClientRect();
        return {
          height: rect.height,
          border: style.borderTopWidth,
          fits: rect.left >= cell.left && rect.right <= cell.right + 1,
        };
      }),
    ).toEqual({ height: 31, border: "1px", fits: true });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`switch-${width}.png`),
      fullPage: true,
    });
  }
  await select.selectOption(p.characters[1].id);
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).timeline.find(
            (e: { id: string }) => e.id === "switch",
          ).characterId,
        STORAGE_KEY,
      ),
    )
    .toBe(p.characters[1].id);
  await page.locator("nav").getByRole("button", { name: "计算结果" }).click();
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await page.locator(".damage-event summary").click();
  await expect(page.locator(".foreground-summary")).toContainText("奥黛塔");
  await page.reload();
  await page.locator("nav").getByRole("button", { name: "时间轴" }).click();
  await expect(select).toHaveValue(p.characters[1].id);
  expect(errors).toEqual([]);
});
