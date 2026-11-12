import { expect, test, type Page } from "@playwright/test";
import { exportFile, pixels } from "./export-helpers";
import { clickScene, objects, openUploads, pixelAt, savedObjects, toClient, waitForEditor, waitForSaved } from "./helpers";
import { makePng } from "./png";

async function createDesign(page: Page) {
  const created = await page.request.post("/api/projects", { data: { title: "Graphics", width: 1080, height: 1080, unit: "px" } });
  const { id } = (await created.json()) as { id: string };
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  return id;
}

const rail = (page: Page, name: string) => page.getByRole("navigation", { name: "Nástroje" }).getByRole("button", { name, exact: true });
type ChartObj = { left: number; top: number; width: number; height: number; chart: { kind: string; series: { values: number[] }[] } };

test("editing chart data redraws it as one undo step, and the export matches the editor", async ({ page }) => {
  await createDesign(page);
  await page.getByRole("button", { name: "Sloupcový graf" }).click();
  await expect.poll(async () => (await savedObjects(page))[0]?.type).toBe("Chart");
  const panel = page.getByRole("complementary", { name: "Panel" });
  await expect(panel.getByRole("table", { name: "Data grafu" })).toBeVisible();

  const cell = panel.getByRole("textbox", { name: "2025, Q1" });
  await cell.fill("40");
  await cell.press("Enter");
  await expect.poll(async () => ((await savedObjects(page))[0] as unknown as ChartObj).chart.series[0].values[0]).toBe(40);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => ((await savedObjects(page))[0] as unknown as ChartObj).chart.series[0].values[0]).toBe(12);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(async () => ((await savedObjects(page))[0] as unknown as ChartObj).chart.series[0].values[0]).toBe(40);
  await waitForSaved(page);

  // The same points of the chart, on the canvas and in a PNG export.
  const chart = (await savedObjects(page))[0] as unknown as ChartObj;
  const points: { x: number; y: number }[] = [];
  for (let i = 1; i < 8; i++) for (let j = 1; j < 6; j++) points.push({ x: chart.left + (chart.width * i) / 8, y: chart.top + (chart.height * j) / 6 });
  await clickScene(page, { x: 1060, y: 1060 });
  const onCanvas = await Promise.all(points.map(async (p) => pixelAt(page, await toClient(page, p))));
  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const exported = await pixels(page, bytes, points.map((p) => [p.x / 1080, p.y / 1080] as [number, number]));
  const same = onCanvas.filter((c, i) => c.slice(0, 3).every((v, k) => Math.abs(v - exported[i][k]) <= 24)).length;
  // Sample points on an edge may differ by antialiasing at the editor's zoom.
  expect(same / points.length).toBeGreaterThan(0.85);
  expect(onCanvas.some((c) => c[2] > 200 && c[0] < 80)).toBe(true);

  await clickScene(page, { x: chart.left + 20, y: chart.top + 20 });
  await page.getByRole("button", { name: "Upravit graf" }).click();
  await panel.getByRole("button", { name: "Prstencový" }).click();
  await expect.poll(async () => ((await savedObjects(page))[0] as unknown as ChartObj).chart.kind).toBe("donut");
  const svg = (await exportFile(page, { format: "SVG" })).bytes.toString("utf8");
  expect(svg.match(/<path d="M[^"]+A/g)?.length).toBeGreaterThanOrEqual(1);
});

test("new chart kinds render in canvas and SVG, and table templates preserve their data", async ({ page }) => {
  await createDesign(page);
  await page.getByRole("button", { name: "Radarový graf" }).click();
  await expect.poll(async () => ((await savedObjects(page))[0] as unknown as ChartObj | undefined)?.chart.kind).toBe("radar");
  expect((await exportFile(page, { format: "SVG" })).bytes.toString("utf8")).toContain("<polygon");
  const panel = page.getByRole("complementary", { name: "Panel" });
  await panel.getByRole("button", { name: "Ukazatel" }).click();
  await expect.poll(async () => ((await savedObjects(page))[0] as unknown as ChartObj | undefined)?.chart.kind).toBe("gauge");

  await rail(page, "Prvky").click();
  await page.getByRole("button", { name: "Tabulka: Ceník" }).click();
  await expect.poll(async () => (await savedObjects(page)).length).toBe(2);
  const pricing = (await savedObjects(page))[1] as { table: { cells: { text: string; fill: string; textColor: string }[][] } };
  expect(pricing.table.cells[0][0]).toMatchObject({ text: "Balíček", fill: "#18181b", textColor: "#ffffff" });
  await page.getByRole("button", { name: "Styl tabulky" }).click();
  await page.getByRole("menuitem", { name: "Minimalistická" }).click();
  await expect.poll(async () => (await savedObjects(page))[1]?.borderWidth).toBe(0);
  expect(((await savedObjects(page))[1] as typeof pricing).table.cells[0][0].text).toBe("Balíček");
});

test("a photo grid adds spaced frames, and an image fills the frame it is put into", async ({ page }) => {
  await createDesign(page);
  const upload = await page.request.post("/api/assets", { multipart: { file: { name: "red.png", mimeType: "image/png", buffer: makePng(300, 200, [220, 30, 30]) } } });
  const asset = (await upload.json()) as { id: string };
  await page.getByRole("button", { name: "Mřížka fotek: 4 v mřížce" }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(4);
  const cells = await savedObjects(page);
  expect(cells.every((c) => c.type === "Path" && c.frame === "square")).toBe(true);
  // Even gaps: the second cell starts where the first ends plus the spacing.
  const [a, , c] = cells as { left: number; width: number }[];
  expect(c.left - (a.left + a.width)).toBeCloseTo(16, 0);

  await clickScene(page, { x: 1070, y: 1070 });
  const first = cells[0] as { left: number; top: number; width: number; height: number };
  await clickScene(page, { x: first.left + first.width / 2, y: first.top + first.height / 2 });
  await openUploads(page);
  await page.locator(`[data-testid=upload-item][data-asset-id="${asset.id}"]`).locator("button").first().click();
  await expect.poll(async () => (await savedObjects(page)).filter((o) => o.type === "Image").length).toBe(1);
  expect((await savedObjects(page))[0]).toMatchObject({ type: "Image", frame: "square" });
});

test("new phone frame accepts a picture and local social icon can be placed", async ({ page }) => {
  await createDesign(page);
  const upload = await page.request.post("/api/assets", { multipart: { file: { name: "blue.png", mimeType: "image/png", buffer: makePng(200, 300, [20, 40, 220]) } } });
  const asset = await upload.json() as { id: string };
  await page.getByRole("button", { name: "Rámeček: Telefon" }).click();
  const frame = (await savedObjects(page))[0] as { left: number; top: number; width: number; height: number; frame: string };
  expect(frame.frame).toBe("phone");
  expect((await exportFile(page, { format: "SVG" })).bytes.toString("utf8")).toContain('data-device-overlay="phone"');
  await clickScene(page, { x: frame.left + frame.width / 2, y: frame.top + frame.height / 2 });
  await openUploads(page);
  await page.locator(`[data-testid=upload-item][data-asset-id="${asset.id}"]`).locator("button").first().click();
  await expect.poll(async () => (await savedObjects(page))[0]?.type).toBe("Image");
  expect((await savedObjects(page))[0].frame).toBe("phone");
  expect((await exportFile(page, { format: "SVG" })).bytes.toString("utf8")).toContain('data-device-overlay="phone"');
  await clickScene(page, { x: 1060, y: 1060 });
  await rail(page, "Grafika").click();
  await page.getByRole("textbox", { name: "Hledat grafiku" }).fill("Instagram");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Přidat grafiku Instagram" }).click();
  await expect.poll(async () => (await savedObjects(page)).length).toBe(2);
});

test("sticker outline survives reload and is visible in the PNG export", async ({ page }) => {
  await createDesign(page);
  const upload = await page.request.post("/api/assets", { multipart: { file: { name: "red.png", mimeType: "image/png", buffer: makePng(240, 180, [220, 30, 30]) } } });
  const asset = await upload.json() as { id: string };
  await openUploads(page);
  await page.locator(`[data-testid=upload-item][data-asset-id="${asset.id}"]`).locator("button").first().click();
  await expect.poll(async () => (await savedObjects(page))[0]?.type).toBe("Image");
  await page.getByRole("button", { name: "Nálepka / obrys" }).click();
  await page.getByRole("button", { name: "Zapnout obrys" }).click();
  await page.getByRole("button", { name: "Barva obrysu nálepky" }).click();
  await page.getByRole("textbox", { name: "Barva v hex" }).fill("#00ff00");
  await page.getByRole("textbox", { name: "Barva v hex" }).press("Enter");
  await expect.poll(async () => (await savedObjects(page))[0]?.sticker).toMatchObject({ color: "#00ff00", thickness: 8 });
  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  const picture = (await savedObjects(page))[0] as { left: number; top: number; width: number; height: number; sticker: { color: string } };
  expect(picture.sticker.color).toBe("#00ff00");
  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const [edge] = await pixels(page, bytes, [[(picture.left - 4) / 1080, (picture.top + picture.height / 2) / 1080]]);
  expect(edge[1]).toBeGreaterThan(150);
  expect(edge[0]).toBeLessThan(100);
  expect((await exportFile(page, { format: "SVG" })).bytes.toString("utf8")).toContain('data-sticker-outline="true"');
});

test("graphics from the library are copied once into assets and can be recoloured", async ({ page }) => {
  await createDesign(page);
  await rail(page, "Grafika").click();
  await expect(page.getByTestId("library-graphic").first()).toBeVisible();
  expect(await page.getByTestId("library-graphic").count()).toBeGreaterThanOrEqual(100);
  await page.getByRole("button", { name: "Odznaky", exact: true }).click();
  expect(await page.getByTestId("library-graphic").count()).toBeLessThan(30);
  await page.getByRole("group", { name: "Kategorie knihovny" }).getByRole("button", { name: "Vše", exact: true }).click();

  await page.getByRole("button", { name: "Přidat grafiku 5cípá hvězda" }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(1);
  const [star] = await savedObjects(page);
  expect(star.src).toMatch(/^\/api\/assets\//);
  await expect(page.getByRole("group", { name: "Barvy grafiky" }).getByRole("button")).toHaveCount(1);
  await page.getByRole("button", { name: "Přidat grafiku 5cípá hvězda" }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(2);
  expect((await savedObjects(page))[1].src).toBe(star.src);

  await page.getByRole("textbox", { name: "Hledat grafiku" }).fill("arrow curve");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Přidat grafiku Zahnutá šipka" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Přidat grafiku 5cípá hvězda" })).toBeHidden();
});

test("a text combination is added as one group in its fonts and survives reload", async ({ page }) => {
  await createDesign(page);
  await rail(page, "Text").click();
  await page.getByRole("button", { name: "Přidat text: Elegantní" }).click();
  await expect.poll(async () => (await savedObjects(page))[0]?.type).toBe("Group");
  const group = (await savedObjects(page))[0] as { objects: { type: string; fontFamily: string }[] };
  expect(group.objects.map((o) => [o.type, o.fontFamily])).toEqual([
    ["Textbox", "Playfair Display"],
    ["Textbox", "Lato"],
  ]);
  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect(((await savedObjects(page))[0] as { objects: unknown[] }).objects).toHaveLength(2);
});
