import { expect, type Page } from "@playwright/test";

export async function warnsBeforeUnload(page: Page) {
  return page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

export async function createCustomer(page: Page, name: string) {
  await page.goto("/?view=customers");
  await page.getByRole("button", { name: "New client", exact: true }).click();
  await page.getByLabel("Business name").fill(name);
  await page
    .getByRole("button", { name: "Create client", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".customer-card").filter({ hasText: name }).click();
}
