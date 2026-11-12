import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/enka-equipment.json", import.meta.url),
    "utf8",
  ),
);
import {
  newProject,
  effect,
  skill,
  type Project,
  STORAGE_KEY,
} from "../src/model";
import { defaultTiming } from "../src/effect-catalog";
const nav = (p: Page, name: string) =>
  p.locator("nav").getByRole("button", { name }).click();
async function load(page: Page, p: Project) {
  await page.goto("/");
  await page
    .getByLabel("导入方案文件", { exact: true })
    .setInputFiles({
      name: "test.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(p)),
    });
  await page.getByRole("button", { name: "确认", exact: true }).click();
}
test("Enka four character import carries base stats, avatars, weapons and activated set icons into cards and timeline", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/enka/**", (r) => r.fulfill({ json: fixture }));
  await page.goto("/");
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await page.getByRole("tab", { name: "Enka UID", exact: true }).click();
  await page.getByLabel("UID查询接口", { exact: true }).selectOption("cloudflare");
  await page.getByLabel("原神UID", { exact: true }).fill("618285856");
  await page.getByRole("button", { name: "读取账号", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(
    d.getByLabel("导入角色基础生命/攻击/防御", { exact: true }),
  ).toBeChecked();
  await expect(d.getByLabel("导入武器图标", { exact: true })).toBeChecked();
  await page.getByRole("tab", { name: "四角色批量导入", exact: true }).click();
  await expect(page.locator(".batch-import-row")).toHaveCount(4);
  for (const box of await page.locator(".batch-import-flags input").all())
    await expect(box).toBeChecked();
  await page.screenshot({
    path: info.outputPath("four-import.png"),
    fullPage: true,
  });
  await d.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue(
    "安柏",
  );
  await expect(page.getByLabel("基础攻击力", { exact: true })).not.toHaveValue(
    "0",
  );
  await expect(page.locator(".character-card .character-portrait")).toHaveCount(
    4,
  );
  await expect(page.locator(".character-card .element-symbol")).toHaveCount(4);
  await page.screenshot({
    path: info.outputPath("character-cards.png"),
    fullPage: true,
  });
  await nav(page, "圣遗物");
  await expect(page.locator(".paired-set")).not.toHaveCount(0);
  await expect(
    page.locator(".equipment-panel .equipment-image"),
  ).not.toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("artifact-cards.png"),
    fullPage: true,
  });
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).characters[0].avatarUrl,
        STORAGE_KEY,
      ),
    )
    .toContain("Ambor");
  await page.reload();
  await expect(page.locator(".character-card .character-portrait")).toHaveCount(
    4,
  );
  await page
    .getByRole("combobox", { name: "角色头像", exact: true })
    .selectOption({ label: "丝柯克" });
  await expect(page.getByLabel("头像图片地址", { exact: true })).toHaveValue(
    "https://enka.network/ui/UI_AvatarIcon_Side_SkirkNew.png",
  );
  await page.setViewportSize({ width: 390, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("expiry events display through end, share automatic effect style, and shared range is bounded", async ({
  page,
}, info) => {
  const p = newProject(),
    c = p.characters[0];
  c.name = "丝柯克";
  c.avatarUrl = "https://enka.network/ui/UI_AvatarIcon_Side_SkirkNew.png";
  c.element = "冰";
  const s = { ...skill(c.id), name: "测试技能" };
  p.skills = [s];
  const e = {
    ...effect(c.id),
    name: "武器效果",
    boundSkillIds: [s.id],
    realtime: {
      kind: "fixed" as const,
      max: 1,
      initial: 0,
      duration: 3,
      interval: 1,
      delta: 1,
      activeFor: null,
    },
  };
  p.weapons[0].iconUrl = "https://enka.network/ui/UI_EquipIcon_Bow_Dvalin.png";
  p.weapons[0].effects = [e];
  p.timeline = [{ id: "s", kind: "skill", time: 0, skillId: s.id }];
  await load(page, p);
  await nav(page, "时间轴");
  await expect(page.locator(".expiry-event")).toHaveCount(1);
  await expect(page.locator(".expiry-event")).toContainText("效果结束");
  await expect(page.locator(".expiry-event")).toContainText("3.00");
  await expect(page.locator(".timeline-overview")).toContainText("0.00");
  await expect(page.locator(".bound-effect-row .equipment-visual")).toHaveCount(
    1,
  );
  await expect(page.locator(".event-skill .character-portrait")).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("expiry-timeline.png"),
    fullPage: true,
  });
  await nav(page, "武器");
  await page.locator(".effect-details > summary").click();
  await page
    .getByRole("combobox", { name: "实时效果类型", exact: true })
    .selectOption("sharedPeriodic");
  await expect(
    page.getByLabel("预设定时范围永久", { exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("预设在接下来的", { exact: true })).toHaveValue(
    "3",
  );
  await page.getByLabel("预设在接下来的", { exact: true }).fill("99");
  await expect(page.getByLabel("预设在接下来的", { exact: true })).toHaveValue(
    "3",
  );
  await page.getByLabel("默认共用持续时间", { exact: false }).fill("2");
  await expect(page.getByLabel("预设在接下来的", { exact: true })).toHaveValue(
    "2",
  );
  await nav(page, "时间轴");
  const child = page.locator(".bound-effect-row");
  await child.getByLabel("使用预设", { exact: true }).uncheck();
  await child.locator(".periodic-settings > summary").click();
  await expect(
    child.getByLabel("定时范围永久", { exact: true }),
  ).toBeDisabled();
  await child.getByLabel("在接下来的", { exact: true }).fill("9");
  await expect(child.getByLabel("在接下来的", { exact: true })).toHaveValue(
    "2",
  );
  await expect(page.locator(".expiry-event").last()).toContainText("2.00");
});
