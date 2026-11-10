import { test, expect } from "@playwright/test";
import { newProject, character, STORAGE_KEY } from "../src/model";
test("official presets preview and apply projects, characters and weapons while preserving target IDs", async ({
  page,
}) => {
  const team = newProject();
  team.name = "官方整队";
  const c = character();
  c.name = "官方角色";
  c.atk = 300;
  const w = { ...team.weapons[0], name: "官方武器", atk: 674 };
  await page.route("**/presets/index.json", (r) =>
    r.fulfill({
      json: {
        version: 1,
        presets: [
          {
            id: "p",
            kind: "project",
            name: "官方整队",
            description: "整队及时间轴",
            file: "方案预设/team.json",
          },
          {
            id: "c",
            kind: "character",
            name: "官方角色",
            file: "角色/character.json",
          },
          {
            id: "w",
            kind: "weapon",
            name: "官方武器",
            file: "武器/weapon.json",
          },
        ],
      },
    }),
  );
  await page.route(/\/presets\/.+\/team\.json$/, (r) =>
    r.fulfill({ json: team }),
  );
  await page.route(/\/presets\/.+\/character\.json$/, (r) =>
    r.fulfill({
      json: { id: "cp", kind: "character", name: "官方角色", data: c },
    }),
  );
  await page.route(/\/presets\/.+\/weapon\.json$/, (r) =>
    r.fulfill({
      json: { id: "wp", kind: "weapon", name: "官方武器", data: w },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "导入预设", exact: true }).click();
  let d = page.getByRole("dialog");
  await d.getByRole("tab", { name: "从官方预设库导入", exact: true }).click();
  await d.locator(".official-preset-card").click();
  await expect(d.locator(".official-preview")).toContainText("攻击 300");
  await d.getByRole("button", { name: "应用官方预设", exact: true }).click();
  await expect(page.getByLabel("角色名称", { exact: true })).toHaveValue(
    "官方角色",
  );
  await page.locator("nav").getByRole("button", { name: "武器" }).click();
  await page
    .getByRole("button", { name: "导入武器预设 1", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByRole("tab", { name: "从官方预设库导入", exact: true }).click();
  await d.locator(".official-preset-card").click();
  await d.getByRole("button", { name: "应用官方预设", exact: true }).click();
  await expect(page.getByLabel("武器名称", { exact: true })).toHaveValue(
    "官方武器",
  );
  await page
    .getByRole("button", { name: "从官方预设库导入", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.locator(".official-preset-card").click();
  await d.getByRole("button", { name: "应用官方预设", exact: true }).click();
  await page
    .getByRole("dialog")
    .filter({
      has: page.getByRole("heading", {
        name: "应用官方方案预设？",
        exact: true,
      }),
    })
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await expect(page.getByLabel("方案名称", { exact: true })).toHaveValue(
    "官方整队",
  );
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).characters[0].id,
        STORAGE_KEY,
      ),
    )
    .toBe(team.characters[0].id);
});
test("empty official library and invalid imports give recoverable messages", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "从官方预设库导入", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("此分类暂无已收录预设");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "应用官方预设", exact: true }),
  ).toHaveCount(0);
});
