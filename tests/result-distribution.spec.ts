import { test, expect, type Page } from "@playwright/test";
import { newProject, skill, effect, STORAGE_KEY } from "../src/model";
const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name }).click();

test("display modes update totals, every hit and donut without recalculating, while details remain unchanged", async ({
  page,
}, info) => {
  const p = newProject();
  for (let i = 0; i < 4; i++) p.characters[i].name = `角色${i + 1}`;
  Object.assign(p.characters[0], { atk: 1689, critRate: 50, critDamage: 100 });
  Object.assign(p.characters[1], { atk: 1689, critRate: 0, critDamage: 200 });
  p.enemy.level = 90;
  p.skills = p.characters
    .slice(0, 2)
    .map((c, i) => ({ ...skill(c.id), name: `技能${i + 1}` }));
  p.timeline = p.skills.map((s, i) => ({
    id: `hit${i}`,
    kind: "skill",
    skillId: s.id,
    time: i + 1,
  }));
  p.globals = [
    {
      ...effect(p.characters[2].id),
      name: "局外攻击",
      category: "global",
      outsideActive: true,
      value: 100,
      unit: "flat",
      target: "custom",
      targetIds: [p.characters[2].id],
    },
  ];
  await page.addInitScript(() => {
    const Base = window.Worker;
    (window as any).calculationCount = 0;
    window.Worker = class extends Base {
      postMessage(data: any) {
        if (data.kind === "calculate") (window as any).calculationCount++;
        super.postMessage(data);
      }
    } as typeof Worker;
  });
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "shares.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "计算结果");
  await expect(
    page.getByRole("tab", { name: "期望", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("角色伤害占比", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "开始计算", exact: true }).click();
  await expect(page.getByTestId("total-damage")).toHaveText("2,250");
  await expect(page.getByTestId("total-dps")).toHaveText("1,125");
  const shares = page.locator(".distribution-row");
  await expect(shares).toHaveCount(4);
  await expect(shares.first()).toContainText("60%");
  await expect(shares.nth(1)).toContainText("900");
  await page.locator(".damage-event > summary").first().click();
  await expect(page.locator(".final-formula")).toBeVisible();
  const detail = await page.locator(".damage-snapshot").innerText();
  const ring = page.locator(".donut-segment").first();
  await ring.focus();
  await expect(page.getByRole("tooltip")).toContainText("角色1");
  await expect(page.getByRole("tooltip")).toContainText("60%");
  await expect(page.getByRole("tooltip")).toContainText("1,350");
  // Hover the painted top-right arc, not the transparent interior.
  const svgBox = await page.locator(".damage-donut svg").boundingBox();
  await page.mouse.move(
    svgBox!.x + svgBox!.width * 0.759,
    svgBox!.y + svgBox!.height * 0.241,
  );
  await expect(page.getByRole("tooltip")).toContainText("角色1");
  await page.getByRole("tab", { name: "暴击", exact: true }).click();
  await expect(page.getByTestId("total-damage")).toHaveText("4,500");
  await expect(page.getByTestId("total-dps")).toHaveText("2,250");
  await expect(shares.first()).toContainText("40%");
  await expect(shares.nth(1)).toContainText("2,700");
  await expect(page.locator(".damage-value").first()).toContainText("1,800");
  await expect(page.locator(".damage-value").last()).toContainText("2,700");
  expect(await page.locator(".damage-snapshot").innerText()).toBe(detail);
  await page.getByRole("tab", { name: "不暴击", exact: true }).click();
  await expect(page.getByTestId("total-damage")).toHaveText("1,800");
  await expect(page.getByTestId("total-dps")).toHaveText("900");
  await expect(shares.first()).toContainText("50%");
  expect(await page.evaluate(() => (window as any).calculationCount)).toBe(1);
  await ring.focus();
  await ring.press("Enter");
  await expect(page.getByRole("dialog")).toContainText("角色1 · 局外面板");
  await expect(page.locator(".outside-panel-values")).toContainText("2,000");
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await shares.nth(2).click();
  await expect(page.getByRole("dialog")).toContainText("角色3 · 局外面板");
  await expect(page.locator(".outside-panel-values")).toContainText("411");
  await expect(page.locator(".outside-panel-values")).toContainText(
    "物理伤害加成",
  );
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await page.locator(".damage-event > summary").first().click();
  await page.screenshot({
    path: info.outputPath("distribution-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("distribution-mobile.png"),
    fullPage: true,
  });
  await nav(page, "角色");
  await page.getByLabel("基础攻击力", { exact: true }).fill("1");
  await nav(page, "计算结果");
  await expect(
    page.getByRole("tab", { name: "不暴击", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".calculation-status")).toContainText(
    "上次计算结果",
  );
  await shares.first().click();
  await expect(page.locator(".outside-panel-values")).toContainText("2,000");
});

test("star layers migrate once, only offer 1 to 13, and globals start folded", async ({
  page,
}) => {
  const p = newProject();
  delete p.starStackVersion;
  p.characters[0].atk = 1689;
  const s = skill(p.characters[0].id);
  s.damage.special = "星超导";
  p.skills = [s];
  p.globals = [{ ...effect(p.characters[0].id), name: "全局" }];
  p.timeline = [
    { id: "h", kind: "skill", skillId: s.id, time: 1, starStacks: 0 },
  ];
  await page.goto("/");
  await page.getByLabel("导入方案文件", { exact: true }).setInputFiles({
    name: "old.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await nav(page, "时间轴");
  await expect(page.locator(".global-event")).toBeHidden();
  await page.locator(".global-effects-fold > summary").click();
  await expect(page.locator(".global-event")).toBeVisible();
  const layers = page.getByRole("combobox", {
    name: "本次星超导层数",
    exact: true,
  });
  await expect(layers).toHaveValue("1");
  await expect(layers.locator("option")).toHaveCount(13);
  await expect(layers.locator('option[value="0"]')).toHaveCount(0);
  await expect(layers.locator("option").first()).toContainText("上周期元素力0");
  await expect(page.locator(".star-stacks small")).toContainText(
    "20% · 星超导系数 1",
  );
  await layers.selectOption("13");
  await expect(page.locator(".star-stacks small")).toContainText(
    "40% · 星超导系数 2",
  );
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).timeline[0].starStacks,
        STORAGE_KEY,
      ),
    )
    .toBe(13);
  await page.reload();
  await nav(page, "时间轴");
  await expect(layers).toHaveValue("13");
  await expect(page.locator(".global-event")).toBeHidden();
});
