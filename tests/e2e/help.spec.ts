import { test, expect } from "@playwright/test";

test("Help presents scannable guidance in both themes on desktop and mobile", async ({
  page,
}) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/");
      if (width === 390)
        await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("button", { name: /^Help/ }).click();
      const dialog = page.getByRole("dialog", { name: "Help", exact: true });
      const guide = dialog.getByRole("list", { name: "Using OpenCadence" });
      await expect(guide.getByRole("listitem")).toHaveCount(4);
      for (const name of ["Today", "Projects", "Clients", "Notes"]) {
        await guide
          .getByRole("heading", { name, exact: true })
          .scrollIntoViewIfNeeded();
        await expect(
          guide.getByRole("heading", { name, exact: true }),
        ).toBeVisible();
      }
      const sizes = await guide.evaluate((element) => {
        const paragraph = element.querySelector("p")!;
        return {
          overflow: element.scrollWidth - element.clientWidth,
          fontSize: parseFloat(getComputedStyle(paragraph).fontSize),
          lineHeight: parseFloat(getComputedStyle(paragraph).lineHeight),
        };
      });
      expect(sizes.overflow).toBeLessThanOrEqual(1);
      expect(sizes.fontSize).toBeGreaterThanOrEqual(12);
      expect(sizes.lineHeight).toBeGreaterThanOrEqual(20);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
  }
});
