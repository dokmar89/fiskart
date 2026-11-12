import { expect, test } from "@playwright/test";

test("theme toggle switches between light and dark and persists across reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Přepnout světlý/tmavý režim" }).click();
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Přepnout světlý/tmavý režim" }).click();
  await expect(html).not.toHaveClass(/dark/);
});
