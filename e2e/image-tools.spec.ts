import { expect, test, type Page } from "@playwright/test";
import { pixels, exportFile } from "./export-helpers";
import { clickScene, closePopovers, drag, openUploads, pixelAt, savedObjects, toClient, waitForEditor, waitForSaved } from "./helpers";
import { makePng, makePngFrom } from "./png";

type Obj = Record<string, unknown>;

async function uploadAsset(page: Page, name: string, buffer: Buffer, mimeType = "image/png") {
  const res = await page.request.post("/api/assets", { multipart: { file: { name, mimeType, buffer } } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; url: string };
}

async function createDesign(page: Page, objects: Obj[]) {
  const created = await page.request.post("/api/projects", { data: { title: "Image tools", width: 1080, height: 1080, unit: "px" } });
  const { id } = (await created.json()) as { id: string };
  const [first] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 1, canvasData: { objects } } });
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  return id;
}

const pixelOnPage = async (page: Page, x: number, y: number) => pixelAt(page, await toClient(page, { x, y }));
const near = (actual: number[], expected: number[], tolerance = 12) =>
  expected.every((value, i) => Math.abs(actual[i] - value) <= tolerance);

test("adjustments and filters survive save, reload and export", async ({ page }) => {
  const asset = await uploadAsset(page, "red.png", makePng(200, 200, [255, 0, 0]));
  await createDesign(page, [{ type: "Image", id: "photo", src: asset.url, left: 0, top: 0, width: 200, height: 200, scaleX: 5.4, scaleY: 5.4 }]);
  await clickScene(page, { x: 540, y: 540 });

  await page.getByRole("button", { name: "Upravit" }).click();
  await page.getByRole("button", { name: "Černobílý" }).click();
  const brightness = page.getByRole("textbox", { name: "Jas" });
  await brightness.fill("40");
  await brightness.press("Enter");
  await closePopovers(page);
  await waitForSaved(page);

  const expected = [{ type: "Grayscale" }, { type: "Brightness", brightness: 0.2 }];
  expect((await savedObjects(page))[0].filters).toMatchObject(expected);
  // Red averaged to grey (85), then brightened by 0.2 × 255.
  await expect.poll(() => pixelOnPage(page, 540, 540)).toEqual(expect.arrayContaining([136]));
  expect(near(await pixelOnPage(page, 540, 540), [136, 136, 136, 255], 3)).toBe(true);

  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page))[0].filters).toMatchObject(expected);
  await expect.poll(async () => near(await pixelOnPage(page, 540, 540), [136, 136, 136, 255], 3)).toBe(true);

  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const [centre] = await pixels(page, bytes, [[0.5, 0.5]]);
  expect(near(centre, [136, 136, 136, 255], 3)).toBe(true);

  // Undo takes the adjustments back.
  await clickScene(page, { x: 540, y: 540 });
  await page.getByRole("button", { name: "Upravit" }).click();
  await page.getByRole("button", { name: "Obnovit úpravy" }).click();
  await closePopovers(page);
  await expect.poll(async () => near(await pixelOnPage(page, 540, 540), [255, 0, 0, 255], 3)).toBe(true);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => near(await pixelOnPage(page, 540, 540), [136, 136, 136, 255], 3)).toBe(true);
});

test("an image dropped into a frame is clipped by it, can be moved inside it, and survives reload and export", async ({ page }) => {
  // Blue on the left half, green on the right: where the frame shows it tells how it is cropped.
  const asset = await uploadAsset(page, "halves.png", makePngFrom(400, 200, (x) => (x < 200 ? [0, 0, 255] : [0, 255, 0])));
  await createDesign(page, []);
  await page.getByRole("button", { name: "Rámeček: Kruh" }).click();
  await openUploads(page);
  const item = page.locator(`[data-testid=upload-item][data-asset-id="${asset.id}"]`);
  await item.locator("button").first().click();

  await expect.poll(async () => (await savedObjects(page))[0]?.type).toBe("Image");
  let [framed] = await savedObjects(page);
  expect(framed).toMatchObject({ frame: "circle", cropX: 100, width: 200, height: 200 });
  expect((framed.clipPath as Obj).type).toBe("Path");
  // The 400 px frame shows the middle of the picture: the seam between blue and green is at its centre.
  expect(near(await pixelOnPage(page, 450, 540), [0, 0, 255, 255])).toBe(true);
  expect(near(await pixelOnPage(page, 630, 540), [0, 255, 0, 255])).toBe(true);
  // Inside the frame's box but outside the circle: the white page.
  expect(near(await pixelOnPage(page, 355, 355), [255, 255, 255, 255])).toBe(true);

  // Double-click, then drag right: the picture moves right inside the frame, showing more blue.
  const centre = await toClient(page, { x: 540, y: 540 });
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(page.getByText("Tažením posuňte obrázek v rámečku.")).toBeVisible();
  const right = await toClient(page, { x: 640, y: 540 });
  await drag(page, centre, right);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Tažením posuňte obrázek v rámečku.")).toBeHidden();
  await waitForSaved(page);
  [framed] = await savedObjects(page);
  expect(framed.cropX).toBeCloseTo(50, 0);
  expect(framed).toMatchObject({ left: 340, top: 340 });
  expect(near(await pixelOnPage(page, 630, 540), [0, 0, 255, 255])).toBe(true);

  await page.reload();
  await waitForEditor(page);
  [framed] = await savedObjects(page);
  expect(framed).toMatchObject({ frame: "circle" });
  await expect.poll(async () => near(await pixelOnPage(page, 630, 540), [0, 0, 255, 255])).toBe(true);
  expect(near(await pixelOnPage(page, 355, 355), [255, 255, 255, 255])).toBe(true);

  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const [inside, corner] = await pixels(page, bytes, [[630 / 1080, 0.5], [355 / 1080, 355 / 1080]]);
  expect(near(inside, [0, 0, 255, 255])).toBe(true);
  expect(near(corner, [255, 255, 255, 255])).toBe(true);
});

const FOUR_COLOURS = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100">
  <rect x="0" width="100" height="100" fill="#ff0000"/>
  <rect x="100" width="100" height="100" fill="#00ff00"/>
  <rect x="200" width="100" height="100" style="fill:#0000ff"/>
  <rect x="300" width="100" height="100" fill="#ffff00"/>
</svg>`;

test("recolouring an SVG with four colours changes each independently", async ({ page }) => {
  const asset = await uploadAsset(page, "four.svg", Buffer.from(FOUR_COLOURS), "image/svg+xml");
  await createDesign(page, [{ type: "Image", id: "graphic", src: asset.url, left: 140, top: 440, width: 400, height: 100, scaleX: 2, scaleY: 2 }]);
  // Centres of the four bars on the page.
  const bars = [240, 440, 640, 840].map((x) => ({ x, y: 540 }));
  const colours = async () => Promise.all(bars.map((b) => pixelOnPage(page, b.x, b.y)));

  await clickScene(page, bars[0]);
  const swatches = page.getByRole("group", { name: "Barvy grafiky" }).getByRole("button");
  await expect(swatches).toHaveCount(4);

  async function recolour(index: number, hex: string) {
    await page.getByRole("button", { name: `Barva grafiky ${index}` }).click();
    const input = page.getByRole("textbox", { name: "Barva v hex" });
    await input.fill(hex);
    await input.press("Enter");
    await closePopovers(page);
  }

  await recolour(2, "#000000");
  await expect.poll(async () => near((await colours())[1], [0, 0, 0, 255])).toBe(true);
  await recolour(4, "#ffffff");
  await expect.poll(async () => near((await colours())[3], [255, 255, 255, 255])).toBe(true);
  const after = await colours();
  expect(near(after[0], [255, 0, 0, 255])).toBe(true);
  expect(near(after[1], [0, 0, 0, 255])).toBe(true);
  expect(near(after[2], [0, 0, 255, 255])).toBe(true);
  await waitForSaved(page);
  const [saved] = await savedObjects(page);
  expect(saved.colorMap).toEqual({ "#00ff00": "#000000", "#ffff00": "#ffffff" });
  // The page still refers to the uploaded file, never to a recoloured copy.
  expect(saved.src).toBe(asset.url);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => near((await colours())[3], [255, 255, 0, 255])).toBe(true);
  expect(near((await colours())[1], [0, 0, 0, 255])).toBe(true);
  await waitForSaved(page);

  await page.reload();
  await waitForEditor(page);
  await expect.poll(async () => near((await colours())[1], [0, 0, 0, 255])).toBe(true);
  expect(near((await colours())[3], [255, 255, 0, 255])).toBe(true);

  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const exported = await pixels(page, bytes, bars.map((b) => [b.x / 1080, b.y / 1080] as [number, number]));
  expect(near(exported[0], [255, 0, 0, 255])).toBe(true);
  expect(near(exported[1], [0, 0, 0, 255])).toBe(true);
  expect(near(exported[2], [0, 0, 255, 255])).toBe(true);
  expect(near(exported[3], [255, 255, 0, 255])).toBe(true);
});

test("background removal runs on files this app serves, with no other host reachable", async ({ page, context }) => {
  test.setTimeout(240_000);
  const outside: string[] = [];
  // Everything but this app fails, as it would without internet.
  await context.route(
    (url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
    (route) => {
      outside.push(route.request().url());
      return route.abort("internetdisconnected");
    },
  );
  // A red disc on a plain light background.
  const photo = makePngFrom(320, 320, (x, y) => ((x - 160) ** 2 + (y - 160) ** 2 < 90 ** 2 ? [200, 30, 30] : [235, 235, 235]));
  const asset = await uploadAsset(page, "disc.png", photo);
  await createDesign(page, [{ type: "Image", id: "photo", src: asset.url, left: 200, top: 200, width: 320, height: 320, scaleX: 2, scaleY: 2 }]);
  await clickScene(page, { x: 520, y: 520 });

  await page.getByRole("button", { name: "Odstranit pozadí" }).click();
  await expect(page.getByRole("status", { name: "Odstranění pozadí" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Odstranění pozadí" })).toBeHidden({ timeout: 200_000 });
  await expect(page.getByText(/Odstranění pozadí selhalo/)).toHaveCount(0);
  await waitForSaved(page);

  const [saved] = await savedObjects(page);
  expect(saved.src).not.toBe(asset.url);
  expect(saved).toMatchObject({ left: 200, top: 200, width: 320, height: 320, scaleX: 2, scaleY: 2 });
  const result = await page.request.get(saved.src as string);
  expect(result.headers()["content-type"]).toBe("image/png");
  const [corner, middle] = await pixels(page, await result.body(), [[0.03, 0.03], [0.5, 0.5]]);
  expect(corner[3]).toBeLessThan(40);
  expect(middle[3]).toBeGreaterThan(200);
  expect(outside).toEqual([]);

  // One undo step brings the original back.
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page))[0].src).toBe(asset.url);
});
