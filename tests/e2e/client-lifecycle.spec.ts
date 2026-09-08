import { test, expect } from "@playwright/test";

test("a lead becomes a client, completes work, and starts again from one workspace", async ({
  page,
}) => {
  test.slow();
  const clientName = "Lifecycle acceptance client";
  const projectName = "Initial engagement";
  await page.goto("/?view=customers");
  await page.getByRole("button", { name: "New client", exact: true }).click();
  await page.getByLabel("Business name").fill(clientName);
  await page
    .getByRole("button", { name: "Create client", exact: true })
    .click();
  await page.locator(".customer-card").filter({ hasText: clientName }).click();
  await expect(page).toHaveURL(/\/clients\//);
  const clientUrl = page.url();
  await expect(page.getByText("Lead", { exact: true }).first()).toBeVisible();

  await page
    .getByRole("button", { name: "Edit relationship", exact: true })
    .click();
  await page.getByLabel("Relationship").selectOption("Client");
  await page.getByLabel("Pipeline stage").selectOption("Won");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Client", { exact: true }).first()).toBeVisible();

  await page
    .getByRole("button", { name: "Add standalone task", exact: true })
    .click();
  const taskDialog = page.getByRole("dialog");
  await expect(taskDialog.getByLabel("Project")).toHaveValue("");
  await expect(
    taskDialog
      .getByRole("combobox", { name: "Client", exact: true })
      .locator("option:checked"),
  ).toHaveText(clientName);
  await taskDialog.getByLabel("Task name").fill("Check in after launch");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    page.getByText("Check in after launch", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Start a project", exact: true })
    .click();
  await page.getByLabel("Project name").fill(projectName);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("link", { name: `${projectName} Active` }).click();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByLabel("Status").selectOption("Completed");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();

  await page.goto("/?view=notes");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "New note", exact: true })
    .click();
  const noteDialog = page.getByRole("dialog");
  await noteDialog.getByLabel("Title").fill("Project-only client note");
  await noteDialog.getByLabel("Project").selectOption({ label: projectName });
  await noteDialog
    .getByRole("combobox", { name: "Client", exact: true })
    .selectOption("");
  await page.getByRole("button", { name: "Create note", exact: true }).click();
  await page.goto(clientUrl);
  await expect(page.getByText("Project-only client note")).toBeVisible();
  await expect(
    page.getByRole("link", { name: `${projectName} Completed` }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Start repeat work", exact: true })
    .click();
  const repeatName = "Repeat engagement";
  await expect(
    page
      .getByRole("dialog")
      .getByRole("combobox", { name: "Client", exact: true })
      .locator("option:checked"),
  ).toHaveText(clientName);
  await page.getByLabel("Project name").fill(repeatName);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("link", { name: `${repeatName} Active` }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task name").fill("Deliver repeat work");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete Deliver repeat work" })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Task completion" }),
  ).toHaveAttribute("aria-valuenow", "100");

  // Keep later project-list tests independent from these fixtures.
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await page.goto(clientUrl);
  await page.getByRole("link", { name: `${projectName} Completed` }).click();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
});

test("customer activity drafts survive closing and switching to edit details", async ({
  page,
}) => {
  await page.goto("/?view=customers");
  const customer = page
    .locator(".customer-card")
    .filter({ hasText: "Form Studio" });
  await customer.click();
  const newActivity = page.getByRole("button", {
    name: "New activity",
    exact: true,
  });
  await newActivity.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Activity details")).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(newActivity).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Activity details")).toBeFocused();
  await page
    .getByLabel("Activity details")
    .fill("Draft retained until I choose to log it");
  await page.getByLabel("Activity type").selectOption("Email");
  await page.getByRole("link", { name: /^Tasks \d/ }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Clients", exact: true })
    .click();
  await customer.click();
  await expect(page.getByLabel("Activity details")).toHaveValue(
    "Draft retained until I choose to log it",
  );
  await expect(page.getByLabel("Activity type")).toHaveValue("Email");
  await page
    .getByRole("button", { name: "Edit relationship", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByLabel("Activity details")).toHaveValue(
    "Draft retained until I choose to log it",
  );
  await page.getByRole("button", { name: "Log activity" }).click();
  await expect(page.getByLabel("Activity details")).toHaveCount(0);
  await expect(newActivity).toBeFocused();
  await expect(page.locator(".timeline time").first()).toHaveAttribute(
    "datetime",
    /T/,
  );
  await expect(page.locator(".timeline time").first()).toContainText(
    String(new Date().getFullYear()),
  );
  await expect(page.locator(".timeline")).toContainText(
    "Draft retained until I choose to log it",
  );
});

test("customer edit failures are announced inside the active editor", async ({
  page,
}) => {
  await page.goto("/?view=customers");
  await page
    .locator(".customer-card")
    .filter({ hasText: "Form Studio" })
    .click();
  await page
    .getByRole("button", { name: "Edit relationship", exact: true })
    .click();
  await page.route("**/*", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByLabel("Pipeline stage").selectOption("Lost");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Couldn't reach the server",
  );
});

test("filters announce selection and project descriptions have readable contrast", async ({
  page,
}) => {
  await page.goto("/?view=tasks");
  const open = page.getByRole("button", { name: "Open", exact: true });
  const completed = page.getByRole("button", {
    name: "Completed",
    exact: true,
  });
  await expect(open).toHaveAttribute("aria-pressed", "true");
  await completed.click();
  await expect(completed).toHaveAttribute("aria-pressed", "true");
  await expect(open).toHaveAttribute("aria-pressed", "false");
  await page.goto("/?view=projects");
  await page.locator(".project-card").first().click();
  const ratio = await page
    .locator(".detail-description")
    .evaluate((element) => {
      function luminance(color: string) {
        const rgb = color
          .match(/\d+/g)!
          .slice(0, 3)
          .map(Number)
          .map((value) => {
            const v = value / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      }
      const foreground = luminance(getComputedStyle(element).color);
      const background = luminance(
        getComputedStyle(document.body).backgroundColor,
      );
      return (
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05)
      );
    });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("mobile dashboard does not overflow and task shortcut hint fits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await expect(page.getByLabel("Task name")).toBeFocused();
  const dialogWidth = await page
    .getByRole("dialog")
    .evaluate((element) => element.scrollWidth);
  expect(dialogWidth).toBeLessThanOrEqual(390);
  await expect(page.getByText("Shift + Enter", { exact: true })).toBeVisible();
});

// All browser writes go through the isolated server's temporary database.
