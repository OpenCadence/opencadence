import { test, expect } from "@playwright/test";

test("headers summarize each page and task counts stay current across filters and edits", async ({
  page,
}) => {
  await page.goto("/");
  const active = Number(await page.locator(".stat-number").nth(1).innerText());
  const followUps = Number(
    await page.locator(".stat-number").nth(2).innerText(),
  );
  await page.goto("/?view=projects");
  await expect(page.locator(".header-context")).toHaveText(
    `${active} active projects`,
  );
  await page.goto("/?view=customers");
  await expect(page.locator(".header-context")).toHaveText(
    followUps
      ? `${followUps} ${followUps === 1 ? "follow-up" : "follow-ups"} due`
      : "No follow-ups due",
  );
  await page.goto("/?view=notes");
  const notes = await page.locator(".note-card").count();
  await expect(page.locator(".header-context")).toHaveText(
    notes ? `${notes} ${notes === 1 ? "note" : "notes"}` : "No notes yet",
  );
  await page.goto("/?view=tasks");
  const open = await page.locator(".all-tasks .task-row").count();
  const overdue = await page.locator(".all-tasks .task-date.overdue").count();
  const original = open
    ? `${open} open${overdue ? ` · ${overdue} overdue` : ""}`
    : "No open tasks";
  await expect(page.locator(".header-context")).toHaveText(original);
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task name").fill("Header count test task");
  await page.getByLabel("Due date", { exact: true }).fill("2000-01-01");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.locator(".header-context")).toHaveText(
    `${open + 1} open · ${overdue + 1} overdue`,
  );
  await page
    .getByRole("button", {
      name: "Complete Header count test task",
      exact: true,
    })
    .click();
  await expect(page.locator(".header-context")).toHaveText(original);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.locator(".header-context")).toHaveText(original);
  await page
    .getByRole("button", { name: "Edit Header count test task", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(page.locator(".header-context")).toHaveText(original);
});

test.describe("local date", () => {
  test.use({ timezoneId: "Pacific/Honolulu" });
  test("Today shows the browser-local date and rolls over without a ticking clock", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-09-06T09:59:50Z") });
    await page.goto("/");
    await expect(page.locator(".header-context time")).toHaveAttribute(
      "datetime",
      "2026-09-05",
    );
    await expect(page.locator(".header-context")).toHaveText(
      /Saturday,? 5 September/,
    );
    await expect(page.locator(".today-heading time")).toHaveCount(0);
    await page.clock.fastForward(60000);
    await expect(page.locator(".header-context time")).toHaveAttribute(
      "datetime",
      "2026-09-06",
    );
    await expect(page.locator(".header-context")).toHaveText(
      /Sunday,? 6 September/,
    );
  });
});

test("header context leaves room for actions on mobile in both themes; projects retain breadcrumbs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const view of ["today", "tasks", "projects", "customers", "notes"]) {
      await page.goto(view === "today" ? "/" : `/?view=${view}`);
      await expect(page.locator(".header-context")).toBeVisible();
      const bounds = await page.locator(".header-context").boundingBox();
      const actions = await page.locator(".topbar-actions").boundingBox();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(actions!.x);
      expect(bounds!.height).toBeLessThan(45);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(320);
    }
  }
  await page.goto("/?view=projects");
  const name = await page.locator(".project-card h3").first().innerText();
  await page.locator(".project-card").first().click();
  await expect(page.locator(".topbar .breadcrumb strong")).toHaveText(name);
  await expect(
    page
      .locator(".topbar")
      .getByRole("link", { name: "Projects", exact: true }),
  ).toHaveAttribute("href", "/?view=projects");
  await expect(page.locator(".header-context")).toHaveCount(0);
});
