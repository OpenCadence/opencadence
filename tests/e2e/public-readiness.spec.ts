import { test, expect, type Locator, type Page } from "@playwright/test";

test("responses include baseline browser security headers", async ({
  request,
}) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe("same-origin");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});

test("requests with an unapproved host cannot reach workspace data", async ({
  request,
}) => {
  const response = await request.get("/", {
    headers: { Host: "attacker.example" },
  });
  expect(response.status()).toBe(421);
  expect(await response.text()).toBe("This host is not allowed.");
});

async function expectReadableText(elements: Locator) {
  expect(await elements.count()).toBeGreaterThan(0);
  for (const element of await elements.all()) {
    const ratio = await element.evaluate((node) => {
      function luminance(color: string) {
        const rgb = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((value) => {
            const channel = value / 255;
            return channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      }
      const foreground = luminance(getComputedStyle(node).color);
      let ancestor: Element | null = node;
      while (
        ancestor &&
        getComputedStyle(ancestor).backgroundColor === "rgba(0, 0, 0, 0)"
      )
        ancestor = ancestor.parentElement;
      // The first-run banner uses a gradient; check its two endpoints separately below.
      const background = luminance(
        getComputedStyle(ancestor || document.body).backgroundColor,
      );
      return (
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05)
      );
    });
    expect(
      ratio,
      (await element.textContent()) || "Text contrast",
    ).toBeGreaterThanOrEqual(4.5);
  }
}

async function createTask(
  page: Page,
  title: string,
  state: string,
  due: string,
) {
  await page.goto("/");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task name").fill(title);
  await page.getByLabel("Attention state").selectOption(state);
  await page.getByLabel("Priority").selectOption("High");
  await page.getByLabel("Due date").fill(due);
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption("demo-p1");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function deleteTask(page: Page, title: string) {
  await page.goto("/?view=tasks");
  await page.getByRole("button", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

for (const theme of ["light", "dark"] as const) {
  test(`attention and inactive filters have readable ${theme} text`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/");
    await expectReadableText(page.locator(".attention-empty"));
    await createTask(
      page,
      `Contrast waiting client ${theme}`,
      "waiting_on_client",
      "2024-01-02",
    );
    await createTask(
      page,
      `Contrast waiting me ${theme}`,
      "waiting_on_me",
      "2024-01-02",
    );
    await expectReadableText(
      page.locator(".task-state.waiting_on_client, .task-state.waiting_on_me"),
    );
    await page.goto("/?view=tasks");
    await expectReadableText(page.locator(".tabs > button:not(.active)"));
    await deleteTask(page, `Contrast waiting client ${theme}`);
    await deleteTask(page, `Contrast waiting me ${theme}`);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`first-run ${theme} text contrasts with both banner gradient endpoints`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Choose how to start" });
    await expect(banner).toBeVisible();
    const gradient = await banner.evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    );
    const endpoints = gradient.match(/rgb\([^)]+\)/g)!;
    expect(endpoints).toHaveLength(2);
    for (const background of endpoints) {
      await banner.evaluate((element, color) => {
        element.style.background = color;
      }, background);
      await expectReadableText(
        banner.locator(".eyebrow, h1, .first-run-copy > p"),
      );
    }
  });
}

for (const view of ["projects", "notes"]) {
  test(`${view} filters explain and recover from zero results`, async ({
    page,
  }) => {
    await page.goto(`/?view=${view}`);
    const cards = page.locator(
      view === "projects" ? ".project-card" : ".note-card",
    );
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    await page
      .getByLabel(`Filter ${view}`)
      .fill("impossible-public-readiness-987654321");
    await expect(
      page.getByRole("heading", { name: `No matching ${view}` }),
    ).toBeVisible();
    await expect(cards).toHaveCount(0);
    if (view === "notes")
      await expect(page.locator(".result-count")).toHaveText("0 notes");
    await page.getByLabel(`Filter ${view}`).fill("");
    await expect(cards).toHaveCount(count);
    await expect(
      page.getByRole("heading", { name: `No matching ${view}` }),
    ).toHaveCount(0);
  });
}

test("delete confirmation focuses safe cancellation and restores its trigger", async ({
  page,
}) => {
  const title = "Keyboard deletion focus";
  await createTask(page, title, "actionable", "2024-01-02");
  await page.getByRole("button", { name: title, exact: true }).click();
  const trigger = page.getByRole("button", {
    name: "Delete task",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const confirmation = page.getByRole("group", { name: "Confirm deletion" });
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await expect(confirmation).toHaveAccessibleDescription(/Delete this task/);
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(confirmation).toHaveCount(0);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+Tab");
  await expect(
    confirmation.getByRole("button", { name: "Yes, delete" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("high priority stays visible in Today, Tasks and project details at compact widths", async ({
  page,
}) => {
  const title = "Compact priority regression";
  await createTask(page, title, "actionable", "2024-01-02");
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/", "/?view=tasks", "/projects/demo-p1"]) {
      await page.goto(path);
      const row = page.locator(".task-row").filter({
        has: page.getByRole("button", { name: title, exact: true }),
      });
      await expect(row.getByText("High", { exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
  }
  await deleteTask(page, title);
});

test("dates distinguish different years while preserving Today and Tomorrow", async ({
  page,
}) => {
  await createTask(page, "Date year one", "actionable", "2023-01-02");
  await createTask(page, "Date year two", "actionable", "2024-01-02");
  await page.goto("/?view=tasks");
  for (const [title, year] of [
    ["Date year one", "2023"],
    ["Date year two", "2024"],
  ]) {
    await expect(
      page
        .locator(".task-row")
        .filter({ hasText: title })
        .locator(".task-date"),
    ).toContainText(year);
  }
  const today = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  await page
    .getByRole("button", { name: "Date year one", exact: true })
    .click();
  await page.getByLabel("Due date").fill(today);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page
      .locator(".task-row")
      .filter({ hasText: "Date year one" })
      .locator(".task-date"),
  ).toHaveText("Today");
  const tomorrow = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  await page
    .getByRole("button", { name: "Date year one", exact: true })
    .click();
  await page.getByLabel("Due date").fill(tomorrow);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page
      .locator(".task-row")
      .filter({ hasText: "Date year one" })
      .locator(".task-date"),
  ).toHaveText("Tomorrow");
  await deleteTask(page, "Date year one");
  await deleteTask(page, "Date year two");
});

test("missing client uses the shared error layout on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/clients/missing-public-readiness-client");
  await expect(
    page
      .locator(".error-page")
      .getByRole("heading", { name: "Relationship not found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to relationships" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
