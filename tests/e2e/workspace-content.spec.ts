import { test, expect } from "@playwright/test";
import { createCustomer } from "./helpers";

test("web note editor round-trips leading indentation and trailing blank lines on create/update", async ({
  page,
}) => {
  await page.goto("/?view=notes");
  await page
    .getByRole("button", { name: "New note", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("  Whitespace browser regression  ");
  const body = "\n\n  indented first line\t\nlast line  \n\n";
  await page.getByRole("textbox", { name: "Note", exact: true }).fill(body);
  await page.getByRole("button", { name: "Create note", exact: true }).click();
  const note = page
    .locator(".note-card")
    .filter({ hasText: "Whitespace browser regression" });
  await note.click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Whitespace browser regression",
  );
  await expect(
    page.getByRole("textbox", { name: "Note", exact: true }),
  ).toHaveValue(body);
  const updated = " \t\n\n";
  await page.getByRole("textbox", { name: "Note", exact: true }).fill(updated);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await note.click();
  await expect(
    page.getByRole("textbox", { name: "Note", exact: true }),
  ).toHaveValue(updated);
});

test("accepted 200-character unbroken task titles wrap in lists, Today and project details", async ({
  page,
}) => {
  const title = "W".repeat(200);
  await page.goto("/?view=tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task name").fill(title);
  const project = page.getByRole("combobox", { name: "Project", exact: true });
  const projectName = await project.locator("option").nth(1).textContent();
  await project.selectOption({ index: 1 });
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("High");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  for (const width of [390, 667, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of ["tasks", "today", "project"]) {
      await page.goto(
        view === "project"
          ? "/?view=projects"
          : view === "today"
            ? "/"
            : "/?view=tasks",
      );
      if (view === "project")
        await page
          .locator(".project-card")
          .filter({ hasText: projectName! })
          .click();
      const task = page.locator(".task-title").filter({ hasText: title });
      await expect(task).toBeVisible();
      const fits = await task.evaluate((element) => {
        const row = element.closest(".task-row")!;
        const titleRect = element.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        return {
          titleOverflow: element.scrollWidth - element.clientWidth,
          rowOverflow: row.scrollWidth - row.clientWidth,
          left: titleRect.left - rowRect.left,
          right: rowRect.right - titleRect.right,
        };
      });
      expect(
        fits.titleOverflow,
        `${view} at ${width}px: ${JSON.stringify(fits)}`,
      ).toBeLessThanOrEqual(1);
      expect(
        fits.rowOverflow,
        `${view} at ${width}px: ${JSON.stringify(fits)}`,
      ).toBeLessThanOrEqual(1);
      expect(fits.left).toBeGreaterThanOrEqual(0);
      expect(fits.right).toBeGreaterThanOrEqual(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  }
});

test("short sidebar scrolls to project shortcuts and Help without losing navigation", async ({
  page,
}) => {
  await page.goto("/?view=projects");
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "New project", exact: true })
      .first()
      .click();
    await page.getByLabel("Project name").fill(`Short viewport project ${i}`);
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  for (const width of [667, 1024]) {
    await page.setViewportSize({ width, height: 375 });
    if (width === 667)
      await page.getByRole("button", { name: "Open navigation" }).click();
    const sidebar = page.locator(".sidebar");
    await expect(sidebar.locator(".sidebar-project")).toHaveCount(5);
    const help = sidebar.getByRole("button", { name: /^Help/ });
    await help.focus();
    await expect(help).toBeFocused();
    const bounds = await help.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(375);
    expect(
      await sidebar.evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(0);
    await help.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Help", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeFocused();
    await sidebar.locator(".sidebar-project").last().click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (width === 667)
      await page.getByRole("button", { name: "Open navigation" }).click();
    await sidebar.getByRole("link", { name: "Notes", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Notes", exact: true }),
    ).toBeVisible();
  }
});

test("a stale editor cannot delete a client changed in another tab", async ({
  page,
  context,
}) => {
  const originalName = "Stale deletion client";
  const updatedName = "Updated stale deletion client";
  await createCustomer(page, originalName);
  await page
    .getByRole("button", { name: "Edit relationship", exact: true })
    .click();

  const other = await context.newPage();
  await other.goto(page.url());
  await other
    .getByRole("button", { name: "Edit relationship", exact: true })
    .click();
  await other.getByLabel("Business name").fill(updatedName);
  await other
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(other.getByRole("dialog")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Delete client", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "changed after you opened",
  );
  await expect(other.getByRole("heading", { name: updatedName })).toBeVisible();
  await other.close();
});

// Clearing examples is last because the original smoke tests exercise seeded records.
