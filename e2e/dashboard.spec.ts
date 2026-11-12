import { expect, test } from "@playwright/test";
import { makePng } from "./png";

test("dashboard categories and social filters share one selection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Přepnout světlý/tmavý režim" }).click();
  await page.screenshot({ path: test.info().outputPath("dashboard-desktop-dark.png"), fullPage: true });
  await page.getByRole("button", { name: "Sociální sítě", exact: true }).first().click();
  const platforms = page.getByRole("group", { name: "Sociální platformy" });
  await expect(platforms.getByRole("button", { name: "Instagram", exact: true })).toBeVisible();
  await platforms.getByRole("button", { name: "LinkedIn", exact: true }).click();
  await expect(page.getByRole("button", { name: /Příspěvek LinkedIn.*1200 × 627/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Příspěvek na Facebook.*1200 × 630/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Vzdělávání", exact: true }).first().click();
  await expect(page.getByRole("button", { name: /Pracovní list A4/ })).toBeVisible();
});

test("format card creates an artboard at the preset size", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Prezentace", exact: true }).first().click();
  await page.getByRole("button", { name: /Prezentace 16:9.*1920 × 1080/ }).click();
  await expect(page).toHaveURL(/\/design\/[^/]+$/);
  await page.waitForFunction(() => window.__opencanva !== undefined);
  expect(await page.evaluate(() => window.__opencanva!.artboard)).toEqual({ width: 1920, height: 1080 });
});

test("custom centimetres create the matching artboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Vlastní velikost", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Nový návrh" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Šířka").fill("12.5");
  await dialog.getByLabel("Výška").fill("20");
  await dialog.getByLabel("Jednotka").selectOption("cm");
  await dialog.getByRole("button", { name: "Vytvořit návrh vlastní velikosti" }).click();
  await expect(page).toHaveURL(/\/design\/[^/]+$/);
  await page.waitForFunction(() => window.__opencanva !== undefined);
  const size = await page.evaluate(() => window.__opencanva!.artboard);
  expect(size.width).toBeCloseTo(472.44, 1);
  expect(size.height).toBeCloseTo(755.91, 1);
});

test("dashboard remains navigable on a narrow dark screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Přepnout světlý/tmavý režim" }).click();
  const category = page.getByRole("navigation", { name: "Hlavní kategorie" }).getByRole("button", { name: "Sociální sítě" });
  await category.focus();
  await expect(category).toBeFocused();
  await category.press("Enter");
  await expect(page.getByRole("group", { name: "Sociální platformy" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("dashboard-narrow-dark.png"), fullPage: true });
});

test("dashboard upload creates an image design and rejects unsupported bytes", async ({ page }) => {
  await page.goto("/");
  const countBefore = await page.locator('section[aria-label="Vaše návrhy"] li').count();
  const invalid = await page.request.post("/api/projects/from-upload", { multipart: { file: { name: "bad.png", mimeType: "image/png", buffer: Buffer.from("bad") } } });
  expect(invalid.status()).toBe(415);
  await page.reload();
  expect(await page.locator('section[aria-label="Vaše návrhy"] li').count()).toBe(countBefore);

  await page.getByRole("button", { name: "Nahrát", exact: true }).first().click();
  await page.getByLabel("Nahrát obrázek").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: makePng(200, 100, [220, 20, 20]) });
  await expect(page).toHaveURL(/\/design\/[^/]+$/);
  const projectId = page.url().split("/").at(-1);
  const pages = await page.request.get(`/api/projects/${projectId}/pages`);
  const payload = await pages.json() as { canvasData: { objects: { type: string; src: string }[] } }[];
  expect(payload[0].canvasData.objects[0]).toMatchObject({ type: "Image", src: expect.stringMatching(/^\/api\/assets\//) });
});
