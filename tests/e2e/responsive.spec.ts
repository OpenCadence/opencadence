import { test, expect, type Page } from "@playwright/test";

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return {
      page: document.documentElement.scrollWidth - width,
      dialogs: [...document.querySelectorAll("dialog[open]")].map(
        (dialog) => dialog.scrollWidth - dialog.clientWidth,
      ),
    };
  });
  expect(overflow.page).toBeLessThanOrEqual(1);
  for (const width of overflow.dialogs) expect(width).toBeLessThanOrEqual(1);
}

for (const width of [320, 390, 700, 768, 1024, 1440]) {
  test(`workspace and editors fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const view of ["today", "tasks", "projects", "customers", "notes"]) {
      await page.goto(view === "today" ? "/" : `/?view=${view}`);
      await expect(page.locator(".app-shell")).toHaveAttribute(
        "data-ready",
        "true",
      );
      await expectNoOverflow(page);
      if (view === "customers") {
        const board = page.locator(".pipeline-board");
        await board.evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
        });
        await expect(
          board.getByRole("heading", { name: "Lost", exact: true }),
        ).toBeInViewport();
        await expectNoOverflow(page);
      }
      await page.locator(".topbar-actions button").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expectNoOverflow(page);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    await page.goto("/?view=projects");
    await page.locator(".project-card").first().click();
    await expect(page.locator(".project-page")).toBeVisible();
    await expectNoOverflow(page);
    await page
      .getByRole("button", { name: "Edit project", exact: true })
      .click();
    await expectNoOverflow(page);
  });
}

test("mobile navigation, search, customer list and details remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  const open = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  const sidebar = page.locator(".sidebar");
  await expect(sidebar).toHaveCSS("overflow-x", "hidden");
  await open.click();
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".mobile-nav-close")).toBeFocused();
  await expectNoOverflow(page);
  await expect(page.locator(".main-shell")).toHaveAttribute("inert", "");
  await page.keyboard.press("Shift+Tab");
  await expect(sidebar.getByRole("button", { name: "Help" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".mobile-nav-close")).toBeFocused();
  for (let step = 0; step < 18; step++) {
    await page.keyboard.press("Tab");
    expect(
      await sidebar.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await open.click();
  await page.getByRole("button", { name: "Dismiss navigation" }).click();
  await expect(open).toBeFocused();
  await expect(page.locator(".main-shell")).not.toHaveAttribute("inert");
  await open.click();
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "List view" }).click();
  await expectNoOverflow(page);
  await page.locator(".customer-list > button").first().click();
  await expect(page).toHaveURL(/\/clients\//);
  await expect(
    page.getByRole("button", { name: "Edit relationship", exact: true }),
  ).toBeVisible();
  await expectNoOverflow(page);
  await page.getByRole("link", { name: "All relationships" }).click();
  await open.click();
  await page.locator(".search-trigger").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoOverflow(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".search-trigger")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
});

test("long record content wraps without widening mobile screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?view=projects");
  await page.locator(".topbar-actions button").click();
  const name = "MobileLongProject".repeat(10);
  await page.getByLabel("Project name").fill(name);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const card = page.locator(".project-card").filter({ hasText: name });
  await expect(card).toBeVisible();
  await expectNoOverflow(page);
  await card.click();
  await expect(page.locator(".project-page")).toBeVisible();
  await expectNoOverflow(page);
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await expectNoOverflow(page);
  await page.setViewportSize({ width: 568, height: 320 });
  const cancel = page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true });
  await cancel.scrollIntoViewIfNeeded();
  await expect(cancel).toBeInViewport();
  await expectNoOverflow(page);
  await cancel.click();
});
