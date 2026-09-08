import { test, expect } from "@playwright/test";

test("appearance follows the system, persists overrides, and synchronizes tabs", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("radio", { name: "Auto", exact: true }),
  ).toBeChecked();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByText("Dark", { exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("radio", { name: "Dark", exact: true }),
  ).toBeChecked();
  const other = await context.newPage();
  await other.goto("/?view=notes");
  await other.getByText("Light", { exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByText("Auto", { exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await other.close();
});

test("system appearance survives unavailable storage and is applied before hydration", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage blocked");
    };
  });
  await page.route("**/*.js*", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.unroute("**/*.js*");
  await page.reload();
  await page.getByText("Light", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("project page supports scoped tasks, notes, progress, editing and direct URLs", async ({
  page,
}) => {
  await page.goto("/?view=projects");
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page.getByLabel("Project name").fill("Dedicated project UI test");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const card = page
    .locator(".project-card")
    .filter({ hasText: "Dedicated project UI test" });
  const href = await card.getAttribute("href");
  await card.click();
  await expect(page).toHaveURL(href!);
  await expect(
    page.getByRole("heading", {
      name: "Dedicated project UI test",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("A fresh start", { exact: true })).toBeVisible();
  await page.keyboard.press("n");
  await expect(
    page.getByRole("combobox", { name: "Project", exact: true }),
  ).toHaveValue(href!.split("/").pop()!);
  await page.getByLabel("Task name").fill("First scoped task");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.locator(".project-task-rows")).toContainText(
    "First scoped task",
  );
  await page
    .getByRole("button", { name: "Complete First scoped task", exact: true })
    .click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page.getByRole("button", { name: /^Completed 1$/ }).click();
  await page
    .getByRole("button", { name: "Reopen First scoped task", exact: true })
    .click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Project", exact: true }),
  ).toHaveValue(href!.split("/").pop()!);
  await page.getByLabel("Title", { exact: true }).fill("Project context");
  await page.getByRole("button", { name: "Create note", exact: true }).click();
  await expect(page.locator(".project-note")).toContainText("Project context");
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByLabel("Project name").fill("Renamed project UI test");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Renamed project UI test", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(href!);
  await expect(page).toHaveTitle("Renamed project UI test · OpenCadence");
  await expect(page.locator(".project-note")).toContainText("Project context");
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page.getByRole("button", { name: /Yes, delete/ }).click();
  await expect(page).toHaveURL("/?view=projects");
  await page.goto(href!);
  await expect(
    page.getByRole("heading", { name: "Project not found" }),
  ).toBeVisible();
});

test("project search navigates and mobile project page fits in both themes", async ({
  page,
}) => {
  await page.goto("/?view=projects");
  const name = await page.locator(".project-card h3").first().innerText();
  const href = await page.locator(".project-card").first().getAttribute("href");
  await page.locator(".search-trigger").click();
  await page.getByRole("combobox", { name: "Search workspace" }).fill(name);
  await page
    .getByRole("option")
    .filter({ has: page.locator("small", { hasText: /^project$/ }) })
    .first()
    .click();
  await expect(page).toHaveURL(href!);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["Dark", "Light"]) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByText(theme, { exact: true }).click();
    await page
      .getByRole("button", { name: "Close navigation", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    expect(
      (await page.locator(".project-hero-copy").boundingBox())!.width,
    ).toBeGreaterThan(250);
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
});
