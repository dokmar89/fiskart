import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { addRectangle, createProject, currentPageId, objects, serialized, waitForEditor, waitForSaved } from "./helpers";
import { makePng } from "./png";

type Saved = Record<string, unknown> & {
  id?: string;
  fill?: unknown;
  stroke?: unknown;
  src?: string;
  effect?: { type: string; color: string };
};
const saved = async (page: Page) => (JSON.parse(await serialized(page)) as { objects: Saved[] }).objects;
const byId = async (page: Page) => Object.fromEntries((await saved(page)).map((o) => [o.id, o]));

async function uploadAsset(page: Page) {
  const res = await page.request.post("/api/assets", {
    multipart: { file: { name: "logo.png", mimeType: "image/png", buffer: makePng(40, 20, [200, 30, 30]) } },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; url: string };
}

async function openBrand(page: Page) {
  await page.getByRole("button", { name: "Značka", exact: true }).click();
}

test("a brand kit keeps colours, fonts and logos, and offers them in the pickers and on the page", async ({ page }) => {
  test.setTimeout(60_000);
  const logo = await uploadAsset(page);
  await createProject(page);
  await openBrand(page);
  const name = `Acme ${randomUUID().slice(0, 8)}`;

  const created = page.waitForResponse((r) => r.url().endsWith("/api/brand-kits") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Nová sada značky" }).click();
  const { id: kitId } = (await (await created).json()) as { id: string };
  // Other tests create kits at the same time, so the new one is found by its id.
  const kitName = page.locator(`[data-kit-id="${kitId}"]`).getByRole("textbox", { name: "Název sady značky" });
  await kitName.fill(name);
  await kitName.press("Enter");
  const kit = page.getByRole("region", { name: `Sada značky ${name}` });
  await expect(kit).toBeVisible();

  for (const hex of ["#0f766e", "#f59e0b"]) {
    await kit.getByRole("button", { name: "Přidat barvu" }).click();
    const dialog = page.getByRole("dialog", { name: "Nová barva značky" });
    await dialog.getByRole("textbox", { name: "Barva v hex" }).fill(hex);
    const patched = page.waitForResponse((r) => r.url().endsWith(`/api/brand-kits/${kitId}`) && r.ok());
    await dialog.getByRole("button", { name: "Přidat", exact: true }).click();
    await patched;
  }
  await expect(kit.getByRole("button", { name: /^Barva značky / })).toHaveCount(2);

  await kit.getByRole("button", { name: "Přidat písmo" }).click();
  await page.getByRole("textbox", { name: "Hledat písma" }).fill("Lobster");
  const fontSaved = page.waitForResponse((r) => r.url().endsWith(`/api/brand-kits/${kitId}`) && r.ok());
  await page.getByRole("textbox", { name: "Hledat písma" }).press("Enter");
  await fontSaved;
  await expect(kit.getByRole("list", { name: "Písma sady" })).toHaveText("Lobster");

  await kit.getByRole("button", { name: "Přidat logo", exact: true }).click();
  const logoSaved = page.waitForResponse((r) => r.url().endsWith(`/api/brand-kits/${kitId}`) && r.ok());
  await page.locator(`[aria-label="Nahrané soubory k výběru"] [data-asset-id="${logo.id}"]`).click();
  await logoSaved;
  await expect(kit.getByTestId("brand-logo")).toHaveCount(1);

  // Everything was stored.
  await page.reload();
  await waitForEditor(page);
  await openBrand(page);
  await expect(kit.getByRole("button", { name: /^Barva značky / })).toHaveCount(2);
  await expect(kit.getByRole("list", { name: "Písma sady" })).toHaveText("Lobster");

  // The logo shows in the kit.
  await expect
    .poll(() => kit.getByTestId("brand-logo").locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBe(40);

  // Logos go on the page by clicking.
  await kit.getByRole("button", { name: "Přidat logo na stránku" }).click();
  await expect.poll(async () => (await saved(page)).filter((o) => o.src?.endsWith(logo.url)).length).toBe(1);

  // Brand colours head the colour picker and apply.
  await page.getByRole("button", { name: "Prvky", exact: true }).click();
  await addRectangle(page);
  await page.getByRole("button", { name: "Barva výplně" }).click();
  const brandSwatches = page.getByRole("group", { name: `Barvy značky: ${name}` });
  await expect(brandSwatches.getByRole("button")).toHaveCount(2);
  await brandSwatches.getByRole("button", { name: "#f59e0b" }).click();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await saved(page)).at(-1)?.fill).toBe("#f59e0b");

  // Brand fonts head the font picker.
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  await page.getByRole("button", { name: "Písmo", exact: true }).click();
  const brandFonts = page.getByRole("group", { name: "Písma značky" });
  await expect(brandFonts.getByRole("option", { name: "Lobster" })).toBeVisible();
  await brandFonts.getByRole("option", { name: "Lobster" }).click();
  await expect.poll(async () => (await saved(page)).at(-1)?.fontFamily).toBe("Lobster");

  // Deleting the kit asks first.
  await openBrand(page);
  await kit.getByRole("button", { name: "Smazat sadu značky" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Smazat" }).click();
  await expect(kit).toHaveCount(0);
  await expect
    .poll(async () => ((await (await page.request.get("/api/brand-kits")).json()) as { id: string }[]).some((k) => k.id === kitId))
    .toBe(false);
});

test("apply brand colours recolours fills, strokes and text, leaves images alone, and cycles one undo step at a time", async ({ page }) => {
  const image = await uploadAsset(page);
  const palette = ["#112233", "#445566", "#778899"];
  const name = `Palette ${randomUUID().slice(0, 8)}`;
  const kitRes = await page.request.post("/api/brand-kits", { data: { name, colors: palette } });
  expect(kitRes.ok()).toBe(true);
  const { id: kitId } = (await kitRes.json()) as { id: string };

  await createProject(page);
  const pageId = await currentPageId(page);
  const base = { version: "6.9.1", originX: "left", originY: "top" };
  const pageObjects = [
    { ...base, type: "Rect", id: "bg", role: "background", locked: true, left: 0, top: 0, width: 1080, height: 1080, fill: "#ffffff" },
    { ...base, type: "Rect", id: "box", left: 100, top: 100, width: 200, height: 200, fill: "#ff0000", stroke: "#000000", strokeWidth: 4 },
    {
      ...base,
      type: "Rect",
      id: "grad",
      left: 400,
      top: 100,
      width: 200,
      height: 200,
      fill: {
        type: "linear",
        gradientUnits: "percentage",
        coords: { x1: 0, y1: 0.5, x2: 1, y2: 0.5 },
        colorStops: [
          { offset: 0, color: "#ff0000" },
          { offset: 1, color: "#00ff00" },
        ],
      },
    },
    { ...base, type: "Textbox", id: "text", left: 100, top: 400, width: 600, fontSize: 60, fontFamily: "Inter", text: "Brand", fill: "#000000" },
    { ...base, type: "Image", id: "img", left: 100, top: 600, width: 40, height: 20, src: image.url },
  ];
  const put = await page.request.put(`/api/pages/${pageId}`, { data: { schemaVersion: 1, canvasData: { objects: pageObjects } } });
  expect(put.ok()).toBe(true);
  await page.reload();
  await waitForEditor(page);
  await expect.poll(async () => (await objects(page)).length).toBe(5);
  const imageBefore = (await byId(page)).img;

  // Most used first: red (fill and a stop) and black (stroke and text) twice, then white and green once.
  const colorsOf = async () => {
    const o = await byId(page);
    const stops = (o.grad.fill as { colorStops: { color: string }[] }).colorStops.map((s) => s.color);
    return { bg: o.bg.fill, box: o.box.fill, boxStroke: o.box.stroke, stops, text: o.text.fill };
  };
  const original = await colorsOf();
  const first = { bg: "#778899", box: "#112233", boxStroke: "#445566", stops: ["#112233", "#112233"], text: "#445566" };
  const second = { bg: "#112233", box: "#445566", boxStroke: "#778899", stops: ["#445566", "#445566"], text: "#778899" };

  await openBrand(page);
  const apply = page.getByRole("region", { name: `Sada značky ${name}` }).getByRole("button", { name: "Použít barvy značky" });
  await apply.click();
  await expect.poll(colorsOf).toEqual(first);
  expect((await byId(page)).img).toEqual(imageBefore);

  await apply.click();
  await expect.poll(colorsOf).toEqual(second);
  expect((await byId(page)).img).toEqual(imageBefore);
  await waitForSaved(page).catch(() => undefined);

  const undo = page.getByRole("button", { name: "Zpět", exact: true });
  await undo.click();
  await expect.poll(colorsOf).toEqual(first);
  await undo.click();
  await expect.poll(colorsOf).toEqual(original);

  // After undoing, pressing again starts over at the first mapping.
  await apply.click();
  await expect.poll(colorsOf).toEqual(first);

  // The result is saved.
  await expect.poll(async () => {
    const stored = (await (await page.request.get(`/api/pages/${pageId}`)).json()) as { canvasData: { objects: Saved[] } };
    return stored.canvasData.objects.find((o) => o.id === "box")?.fill;
  }, { timeout: 10_000 }).toBe("#112233");

  await page.request.delete(`/api/brand-kits/${kitId}`);
});

test("apply brand colours keeps effect colours of hollow, neon and outline text in step with the text", async ({ page }) => {
  const palette = ["#aa0000", "#00aa00"];
  const name = `Effects ${randomUUID().slice(0, 8)}`;
  const { id: kitId } = (await (await page.request.post("/api/brand-kits", { data: { name, colors: palette } })).json()) as { id: string };
  await createProject(page);
  const pageId = await currentPageId(page);
  const text = (id: string, top: number, effect: Record<string, unknown>, fill: string) => ({
    type: "Textbox",
    version: "6.9.1",
    id,
    left: 40,
    top,
    width: 800,
    fontSize: 80,
    fontFamily: "Inter",
    text: id,
    fill,
    effect,
  });
  const pageObjects = [
    text("neon", 40, { type: "neon", intensity: 50, color: "#123456" }, "#a0aabb"),
    text("outline", 240, { type: "outline", thickness: 50, color: "#ffffff" }, "#123456"),
  ];
  await page.request.put(`/api/pages/${pageId}`, { data: { schemaVersion: 1, canvasData: { objects: pageObjects } } });
  await page.reload();
  await waitForEditor(page);

  await openBrand(page);
  await page.getByRole("region", { name: `Sada značky ${name}` }).getByRole("button", { name: "Použít barvy značky" }).click();
  // #123456 is used twice (neon colour and outline text fill), white once.
  await expect.poll(async () => {
    const o = await byId(page);
    return { neon: o.neon.effect?.color, outlineFill: o.outline.fill, outline: o.outline.effect?.color, outlineStroke: o.outline.stroke };
  }).toEqual({ neon: "#aa0000", outlineFill: "#aa0000", outline: "#00aa00", outlineStroke: "#00aa00" });
  // Neon draws a pale tint of its colour, worked out again from the new colour.
  expect((await byId(page)).neon.fill).not.toBe("#a0aabb");

  await page.request.delete(`/api/brand-kits/${kitId}`);
});
