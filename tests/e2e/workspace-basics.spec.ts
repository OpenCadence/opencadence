import { test, expect } from "@playwright/test";

test("first run offers example and empty choices and remembers the selection", async ({
  page,
}) => {
  await page.goto("/");
  const setup = page.getByRole("region", { name: "Choose how to start" });
  await expect(setup).toBeVisible();
  await expect(
    setup.getByRole("button", { name: "Use example workspace" }),
  ).toBeVisible();
  await expect(
    setup.getByRole("button", { name: "Start empty" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear examples", exact: true }),
  ).toHaveCount(0);
  await setup.getByRole("button", { name: "Use example workspace" }).click();
  await expect(setup).toHaveCount(0);
  await page.reload();
  await expect(setup).toHaveCount(0);
  await expect(
    page.getByText("This workspace includes example data."),
  ).toBeVisible();
});

test("search focuses input, uses the platform hint, and supports arrows and Enter", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const mac = await page.evaluate(() =>
    /Mac|iPhone|iPad/.test(navigator.platform),
  );
  await expect(page.locator(".search-trigger")).toContainText(
    mac ? "⌘ K" : "Ctrl K",
  );
  await page.keyboard.press(mac ? "Meta+k" : "Control+k");
  const search = page.getByRole("combobox", { name: "Search workspace" });
  await expect(search).toBeFocused();
  await search.fill("website");
  const options = page.getByRole("option");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await search.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(search).toBeFocused();
  await search.press("ArrowUp");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await search.press("Enter");
  await expect(page.getByRole("dialog", { name: "Edit task" })).toBeVisible();
  await expect(page.getByLabel("Task name")).toBeFocused();
});

test("client details are included in list and workspace search", async ({
  page,
}) => {
  await page.goto("/?view=customers");
  await page.getByLabel("Filter clients").fill("website redesign");
  await expect(
    page.locator(".customer-card").filter({ hasText: "Northside Dental" }),
  ).toBeVisible();
  await page.locator(".search-trigger").click();
  await page
    .getByRole("combobox", { name: "Search workspace" })
    .fill("website redesign");
  await expect(
    page.getByRole("option").filter({ hasText: "Northside Dental" }),
  ).toBeVisible();
});

test("search handles empty results without selecting a stale option", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".search-trigger").click();
  const search = page.getByRole("combobox", { name: "Search workspace" });
  await search.fill("no-result-987654321");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
  await expect(search).toBeFocused();
  await expect(search).not.toHaveAttribute("aria-activedescendant");
  await expect(
    page.getByText("No results. Try a different search."),
  ).toBeVisible();
});

test("Shift N focuses the task name, Tab works, and Shift Enter creates it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.keyboard.press("Shift+N");
  const name = page.getByLabel("Task name");
  await expect(name).toBeFocused();
  await name.fill("Keyboard-created UI test task");
  await name.press("Tab");
  await expect(
    page.getByRole("combobox", { name: "Project", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(name).toBeFocused();
  await expect(page.getByText("Shift + Enter", { exact: true })).toBeVisible();
  await name.press("Shift+Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .locator(".task-title")
      .filter({ hasText: "Keyboard-created UI test task" }),
  ).toBeVisible();
});

test("task waiting states can be set, changed, and cleared", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByLabel("Task name").fill("Waiting state UI test");
  await page.getByLabel("Attention state").selectOption("waiting_on_client");
  await page.getByRole("button", { name: "Create task" }).click();

  const clientPanel = page.locator(".follow-panel");
  await expect(clientPanel.getByText("Waiting state UI test")).toBeVisible();
  await clientPanel.getByText("Waiting state UI test").click();
  await page.getByLabel("Attention state").selectOption("waiting_on_me");
  await page.getByRole("button", { name: "Save changes" }).click();

  const actionPanel = page.locator(".task-panel");
  await expect(actionPanel.getByText("Waiting state UI test")).toBeVisible();
  await actionPanel.getByText("Waiting state UI test").click();
  await page.getByLabel("Attention state").selectOption("actionable");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(actionPanel.getByText("Waiting state UI test")).toBeVisible();
});

test("N still opens capture and failed submission keeps the draft", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.keyboard.press("n");
  const name = page.getByLabel("Task name");
  await expect(name).toBeFocused();
  await name.fill("   ");
  await name.press("Shift+Enter");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Please enter a title",
  );
  await expect(name).toHaveValue("   ");
});

test("projects navigate to a page and editing returns focus to its opener", async ({
  page,
}) => {
  await page.goto("/?view=projects");
  const card = page.locator(".project-card").first();
  const href = await card.getAttribute("href");
  await card.click();
  await expect(page).toHaveURL(href!);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const edit = page.getByRole("button", { name: "Edit project", exact: true });
  await edit.click();
  await page.keyboard.press("Escape");
  await expect(edit).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL("/?view=projects");
});

test("task focus survives toast expiry", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.clock.install({ time: new Date() });
  await page.keyboard.press("n");
  await page.getByLabel("Task name").fill("Focus-preservation UI test task");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  const task = page
    .locator(".task-title")
    .filter({ hasText: "Focus-preservation UI test task" });
  await expect(task).toBeVisible();
  await task.focus();
  await page.clock.fastForward(5000);
  await expect(page.locator(".toast")).not.toHaveClass(/visible/);
  await expect(task).toBeFocused();
});
