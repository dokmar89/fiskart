import { expect, test } from "@playwright/test";

test("dashboard loads one page and returns to page one when the category changes", async ({ page }) => {
  await page.goto("/");
  const cards = page.getByTestId("template-card");
  await expect(cards).toHaveCount(24);
  const firstId = await cards.first().getAttribute("data-template-id");
  await page.getByTestId("template-next-page").click();
  await expect.poll(async () => cards.first().getAttribute("data-template-id")).not.toBe(firstId);
  await expect(page.getByRole("navigation", { name: "Stránkování šablon" })).toContainText(/Strana 2 z/);
  await page.getByRole("group", { name: "Kategorie šablon" }).getByRole("button", { name: "Prezentace" }).click();
  await expect(page.getByRole("navigation", { name: "Stránkování šablon" })).toContainText(/Strana 1 z/);
});

test("search handles Czech accents and an empty result", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Hledat šablony" });
  await input.fill("zivotopis");
  await expect(page.getByTestId("template-card").first()).toContainText("Životopis");
  await input.fill("Životopis");
  await expect(page.getByTestId("template-card").first()).toContainText("Životopis");
  await input.fill("neexistujici-sablona-7a85f3");
  await expect(page.getByText("Žádná šablona neodpovídá.")).toBeVisible();
});

test("a short search shows the result count and hides stale cards while loading", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Hledat šablony" });
  await expect(page.getByTestId("template-card")).toHaveCount(24);
  await page.route("**/api/templates/catalog?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("query") === "Prezentace pro investory") {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    await route.continue();
  });
  await input.fill("Prezentace pro investory");
  await expect(page.getByRole("status")).toContainText("Načítám šablony");
  await expect(page.getByTestId("template-card")).toHaveCount(0);
  await expect(page.getByTestId("template-card")).toHaveCount(1);
  await expect(page.getByText("1 šablona", { exact: true })).toBeVisible();
});
