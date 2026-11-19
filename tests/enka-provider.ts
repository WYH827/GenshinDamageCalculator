import type { Page } from "@playwright/test";
import type { EnkaProvider } from "../src/site-config";

export async function chooseEnkaProvider(page: Page, provider: EnkaProvider) {
  await page
    .getByRole("combobox", { name: "UID查询接口", exact: true })
    .click();
  await page.locator(`.enka-provider-option[data-value="${provider}"]`).click();
}
