import { expect, test, type Page } from "@playwright/test";
import { exportFile, pixels } from "./export-helpers";
import { currentPageUrl, objects, savedObjects, waitForEditor } from "./helpers";
import { STOCK_MOCK_PORT, STOCK_TEST_KEY } from "./stock-config";

async function createDesign(page: Page) {
  const created = await page.request.post("/api/projects", { data: { title: "Stock", width: 1080, height: 1080, unit: "px" } });
  const { id } = (await created.json()) as { id: string };
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  return id;
}

const rail = (page: Page, name: string) => page.getByRole("navigation", { name: "Nástroje" }).getByRole("button", { name, exact: true });

test("stock photos and icons are copied into local assets and still load and export without the providers", async ({ page, context }) => {
  await createDesign(page);
  await rail(page, "Fotky").click();
  const tiles = page.getByTestId("stock-photo");
  await expect(tiles).toHaveCount(2);
  await page.getByRole("button", { name: "Načíst další" }).click();
  await expect(tiles).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Hledat fotky" }).or(page.getByRole("textbox", { name: "Hledat fotky" })).fill("red");
  await page.keyboard.press("Enter");
  await expect(tiles).toHaveCount(2);
  await page.getByRole("button", { name: "Přidat fotku: Test photo 101" }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(1);

  await rail(page, "Grafika").click();
  await page.getByRole("textbox", { name: "Hledat grafiku" }).fill("square");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("stock-icon")).toHaveCount(2);
  await page.getByRole("button", { name: "Přidat ikonu test:square" }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(2);
  // An icon is an SVG asset like any other: it can be recoloured.
  await expect(page.getByRole("group", { name: "Barvy grafiky" }).getByRole("button")).toHaveCount(1);
  const pageUrl = await currentPageUrl(page);
  await expect
    .poll(async () => ((await (await page.request.get(pageUrl)).json()) as { canvasData: { objects: unknown[] } }).canvasData.objects.length)
    .toBe(2);

  const saved = await savedObjects(page);
  expect(saved.map((o) => o.src)).toEqual([expect.stringMatching(/^\/api\/assets\//), expect.stringMatching(/^\/api\/assets\//)]);

  // From here on only the app answers: the providers (and everything else) are gone.
  await context.route(
    (url) => !(url.hostname === "localhost" && url.port === "3100"),
    (route) => route.abort("internetdisconnected"),
  );
  await page.reload();
  await waitForEditor(page);
  expect((await objects(page)).map((o) => o.name)).not.toContain("Chybějící obrázek");
  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  // The photo (600 × 400, red) is placed in the middle of the page; the icon sits on top of its centre.
  const [photo] = await pixels(page, bytes, [[0.5, 0.36]]);
  expect(photo.slice(0, 3)).toEqual([220, 40, 40]);
});

test("the Pexels key never reaches the browser", async ({ page }) => {
  const seen: string[] = [];
  const browserCalls: string[] = [];
  page.on("request", (request) => browserCalls.push(request.url()));
  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (/json|javascript|html|text/.test(type)) seen.push(await response.text().catch(() => ""));
  });
  await createDesign(page);
  await rail(page, "Fotky").click();
  await expect(page.getByTestId("stock-photo")).toHaveCount(2);
  await page.getByRole("button", { name: "Přidat fotku: Test photo 102" }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(1);

  expect(seen.length).toBeGreaterThan(5);
  expect(seen.filter((body) => body.includes(STOCK_TEST_KEY))).toEqual([]);
  expect(await page.content()).not.toContain(STOCK_TEST_KEY);
  // The browser loads previews, but never calls the API itself.
  expect(browserCalls.filter((url) => url.includes(`:${STOCK_MOCK_PORT}/pexels`))).toEqual([]);
});

test("using the same stock photo twice keeps one copy", async ({ page }) => {
  const first = (await (await page.request.post("/api/stock/photos/103")).json()) as { id: string };
  const second = (await (await page.request.post("/api/stock/photos/103")).json()) as { id: string };
  expect(second.id).toBe(first.id);
  expect((await page.request.post("/api/stock/photos/999")).status()).toBe(404);
  expect((await page.request.post("/api/stock/icons", { data: { name: "../../etc" } })).status()).toBe(400);
});

test("Iconify categories search immediately and more icons load on scroll", async ({ page }) => {
  await createDesign(page);
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/stock/icons?")) calls.push(request.url());
  });
  await rail(page, "Grafika").click();
  const categories = page.getByRole("group", { name: "Kategorie online ikon" });
  await expect(categories.getByRole("button")).toHaveCount(11);
  await categories.getByRole("button", { name: "Emoji (Twemoji)" }).click();
  await expect.poll(() => calls.some((url) => url.includes("category=emoji"))).toBe(true);
  await page.getByRole("textbox", { name: "Hledat grafiku" }).fill("many");
  const icons = page.getByTestId("stock-icon");
  await expect(icons).toHaveCount(96);
  await page.getByRole("button", { name: "Načíst další ikony" }).scrollIntoViewIfNeeded();
  await expect(icons).toHaveCount(98);
  expect(calls.some((url) => url.includes("start=96"))).toBe(true);
});
