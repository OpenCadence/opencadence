import { test, expect } from "@playwright/test";
import { createCustomer, warnsBeforeUnload } from "./helpers";

test("confirmed customer deletion discards its activity draft only after success", async ({
  page,
}) => {
  const name = "Local deletion draft regression";
  await createCustomer(page, name);
  await page.getByRole("button", { name: "New activity", exact: true }).click();
  await page
    .getByLabel("Activity details")
    .fill("Keep until deletion succeeds");
  await page
    .getByRole("button", { name: "Edit relationship", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete client", exact: true })
    .click();
  const deletionWarning = await page.locator(".delete-confirm").textContent();
  await page
    .locator(".delete-confirm")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByLabel("Activity details")).toHaveValue(
    "Keep until deletion succeeds",
  );
  await page
    .getByRole("button", { name: "Edit relationship", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete client", exact: true })
    .click();
  await page.route("**/*", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Couldn't delete",
  );
  expect(await warnsBeforeUnload(page)).toBe(true);
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\?view=customers$/);
  await expect(
    page.locator(".customer-card").filter({ hasText: name }),
  ).toHaveCount(0);
  expect(await warnsBeforeUnload(page)).toBe(false);
  expect(deletionWarning).toContain(
    "unsaved activity draft will also be discarded",
  );
  await expect(
    page.getByRole("button", { name: /Recover activity drafts/ }),
  ).toHaveCount(0);
});

test("external customer deletion keeps exact draft text accessible for copy and explicit discard", async ({
  page,
  context,
}) => {
  const name = "External deletion draft regression";
  const secondName = "Another removed customer";
  const body = "\n  Recover this unsaved email\t\n\n";
  await createCustomer(page, secondName);
  await createCustomer(page, name);
  await page.getByRole("button", { name: "New activity", exact: true }).click();
  await page.getByLabel("Activity details").fill(body);
  await page.getByLabel("Activity type").selectOption("Email");
  await page.getByRole("link", { name: "All relationships" }).click();
  await page.locator(".customer-card").filter({ hasText: secondName }).click();
  await page.getByRole("button", { name: "New activity", exact: true }).click();
  await page.getByLabel("Activity details").fill("Second recoverable draft");
  await page.getByRole("link", { name: "All relationships" }).click();
  const other = await context.newPage();
  await other.goto("/?view=customers");
  for (const customerName of [secondName, name]) {
    await other
      .locator(".customer-card")
      .filter({ hasText: customerName })
      .click();
    await other
      .getByRole("button", { name: "Edit relationship", exact: true })
      .click();
    await other
      .getByRole("button", { name: "Delete client", exact: true })
      .click();
    await other.getByRole("button", { name: "Yes, delete" }).click();
    await expect(other.getByRole("dialog")).toHaveCount(0);
  }
  await other.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const recover = page.getByRole("button", {
    name: "Recover activity drafts (2)",
    exact: true,
  });
  await expect(recover).toBeVisible({ timeout: 10000 });
  expect(await warnsBeforeUnload(page)).toBe(true);
  await recover.click();
  await expect(page.getByLabel(`${name} · Email`)).toHaveValue(body);
  await page.keyboard.press("Escape");
  await expect(recover).toBeFocused();
  await recover.click();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Copy draft", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Activity draft copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(body);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .first()
    .click();
  await expect(page.getByLabel(`${name} · Email`)).toHaveValue(body);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .first()
    .click();
  await expect(page.getByLabel(`${secondName} · Note`)).toBeFocused();
  await expect(page.getByLabel(`${secondName} · Note`)).toHaveValue(
    "Second recoverable draft",
  );
  expect(await warnsBeforeUnload(page)).toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Recover activity drafts/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New client", exact: true }),
  ).toBeFocused();
  expect(await warnsBeforeUnload(page)).toBe(false);
});
