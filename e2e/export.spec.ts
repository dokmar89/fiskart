import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { STRESS_PAGE, stressObjects } from "../scripts/stress-data";
import { addRectangle, createProject, currentPageId, objectCount, openUploads, uploadThroughPicker, waitForEditor } from "./helpers";
import { exportFile, pixels, pngSize } from "./export-helpers";
import { makePng } from "./png";

async function addPages(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    const before = await page.getByTestId("page-tile").count();
    await page.getByRole("button", { name: "Přidat stránku" }).click();
    await expect(page.getByTestId("page-tile")).toHaveCount(before + 1);
  }
}

test("a 1080 px page at 2× is 2160 px; a transparent PNG is clear where the page is empty", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Obdélník" }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  await page.keyboard.press("Escape");

  const big = await exportFile(page, { format: "PNG", size: "2×" });
  expect(big.name).toMatch(/\.png$/);
  expect(pngSize(big.bytes)).toMatchObject({ width: 2160, height: 2160 });

  const opaque = await exportFile(page, { format: "PNG", size: "1×", transparent: false });
  const [opaqueCorner] = await pixels(page, opaque.bytes, [[0.01, 0.01]]);
  expect(opaqueCorner).toEqual([255, 255, 255, 255]);

  const clear = await exportFile(page, { format: "PNG", size: "1×", transparent: true });
  expect(pngSize(clear.bytes)).toMatchObject({ width: 1080, height: 1080, colourType: 6 });
  const [corner, centre] = await pixels(page, clear.bytes, [[0.01, 0.01], [0.5, 0.5]]);
  expect(corner[3]).toBe(0);
  expect(centre[3]).toBe(255);

  const jpeg = await exportFile(page, { format: "JPEG", size: "3×" });
  expect(jpeg.name).toMatch(/\.jpg$/);
  expect(jpeg.bytes[0]).toBe(0xff);
  expect(jpeg.bytes[1]).toBe(0xd8);
});

test("an A4 PDF at 300 DPI has an A4 page holding a 2480 × 3508 image", async ({ page }) => {
  await createProject(page, "A4");
  await addRectangle(page);
  const pdf = await exportFile(page, { format: "PDF", dpi: "300 DPI" });
  expect(pdf.name).toMatch(/\.pdf$/);
  const text = pdf.bytes.toString("latin1");
  expect(text.startsWith("%PDF-")).toBe(true);
  const box = /\/MediaBox \[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/.exec(text);
  expect(Number(box?.[1])).toBeCloseTo(595.28, 1);
  expect(Number(box?.[2])).toBeCloseTo(841.89, 1);
  expect(text).toMatch(/\/Width 2480\b/);
  expect(text).toMatch(/\/Height 3508\b/);
});

test("several pages download as a zip, one file per selected page", async ({ page }) => {
  await createProject(page);
  await addPages(page, 2);

  const all = await exportFile(page, { format: "PNG" });
  expect(all.name).toMatch(/\.zip$/);
  const files = unzipSync(new Uint8Array(all.bytes));
  expect(Object.keys(files).sort()).toEqual(["Návrh bez názvu-1.png", "Návrh bez názvu-2.png", "Návrh bez názvu-3.png"]);
  for (const bytes of Object.values(files)) expect(pngSize(Buffer.from(bytes))).toMatchObject({ width: 1080, height: 1080 });

  const some = await exportFile(page, { format: "SVG", pages: "1, 3" });
  expect(Object.keys(unzipSync(new Uint8Array(some.bytes))).sort()).toEqual(["Návrh bez názvu-1.svg", "Návrh bez názvu-3.svg"]);

  // The dialog remembers the last page choice; go back to all pages.
  const pdf = await exportFile(page, { format: "PDF", dpi: "96 DPI", pages: "all" });
  expect(pdf.bytes.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(3);
});

test("exports leave out hidden layers; SVG embeds its images and fonts", async ({ page }) => {
  await createProject(page);
  await openUploads(page);
  const tile = (await uploadThroughPicker(page, "blue.png", makePng(120, 120, [0, 0, 255]))).getByTestId("upload-tile");
  await tile.click();
  await expect.poll(() => objectCount(page)).toBe(1);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  // Out of the way of the image at the centre.
  for (let i = 0; i < 30; i++) await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Prvky", exact: true }).click();
  // A rectangle over the image, then hidden.
  await page.getByRole("button", { name: "Obdélník" }).click();
  await page.getByRole("button", { name: "Vrstvy", exact: true }).click();
  const rectRow = page.getByTestId("layer-row").filter({ hasText: "Obdélník" });
  await rectRow.hover();
  await rectRow.getByRole("button", { name: "Skrýt" }).click();

  const png = await exportFile(page, { format: "PNG" });
  // The image sits at the centre of the page; the hidden rectangle must not cover it.
  const [centre] = await pixels(page, png.bytes, [[0.5, 0.5]]);
  expect(centre.slice(0, 3)).toEqual([0, 0, 255]);

  const svg = (await exportFile(page, { format: "SVG" })).bytes.toString("utf8");
  expect(svg).toContain('width="1080px"');
  expect(svg).not.toContain("/api/assets/");
  expect(svg).toContain("data:image/png;base64,");
  expect(svg).toMatch(/@font-face\{font-family:"Inter";font-style:normal;font-weight:(400|700);src:url\(data:font\/woff2;base64,/);
  // The hidden rectangle (grey #a1a1aa) is not in the file at all.
  expect(svg).not.toContain("rgb(161,161,170)");
});

test("a 20-page A4 PDF at 300 DPI completes without crashing the tab", async ({ page }) => {
  test.setTimeout(300_000);
  let crashed = false;
  page.on("crash", () => (crashed = true));

  const created = await page.request.post("/api/projects", {
    data: { title: "Long document", width: (210 / 25.4) * 96, height: (297 / 25.4) * 96, unit: "mm" },
  });
  const { id } = (await created.json()) as { id: string };
  // Heavy pages: 200 objects each (shapes, gradients, text), scaled from the 1920 px stress layout.
  const objects = stressObjects().map((o) => ({ ...o, scaleX: 794 / STRESS_PAGE.width, scaleY: 794 / STRESS_PAGE.width }));
  const [first] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 1, canvasData: { objects } } });
  for (let i = 1; i < 20; i++) {
    const res = await page.request.post(`/api/projects/${id}/pages`, { data: { index: i, canvasData: { objects } } });
    expect(res.status()).toBe(201);
  }

  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  await expect(page.getByTestId("page-tile")).toHaveCount(20);
  expect(await currentPageId(page)).toBe(first.id);

  const started = Date.now();
  const pdf = await exportFile(page, { format: "PDF", dpi: "300 DPI" }, 240_000);
  const seconds = (Date.now() - started) / 1000;
  const text = pdf.bytes.toString("latin1");
  expect(text.match(/\/Type \/Page\b/g)).toHaveLength(20);
  expect(text.match(/\/Width 2480\b/g)).toHaveLength(20);
  expect(crashed).toBe(false);
  console.log(`20-page A4 PDF at 300 DPI: ${seconds.toFixed(0)} s, ${(pdf.bytes.length / 1024 / 1024).toFixed(1)} MB`);
  test.info().annotations.push({ type: "pdf", description: `${seconds.toFixed(0)} s, ${(pdf.bytes.length / 1024 / 1024).toFixed(1)} MB` });
});
