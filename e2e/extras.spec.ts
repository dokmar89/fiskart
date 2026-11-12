import { expect, test, type Page } from "@playwright/test";
import { exportFile, pixels } from "./export-helpers";
import { clickScene, closePopovers, drag, objects, savedObjects, serialized, toClient, waitForEditor, waitForSaved } from "./helpers";

type Obj = Record<string, unknown>;

async function createDesign(page: Page, pages: Obj[][], title = "Extras") {
  const created = await page.request.post("/api/projects", { data: { title, width: 1080, height: 1080, unit: "px" } });
  const { id } = (await created.json()) as { id: string };
  const [first] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 1, canvasData: { objects: pages[0] } } });
  for (const [index, objs] of pages.slice(1).entries()) {
    await page.request.post(`/api/projects/${id}/pages`, { data: { index: index + 1, canvasData: { objects: objs } } });
  }
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  return id;
}

const rail = (page: Page, name: string) => page.getByRole("navigation", { name: "Nástroje" }).getByRole("button", { name, exact: true });
const rect = (id: string, left: number, top: number, fill = "#2563eb") => ({ type: "Rect", id, name: id, left, top, width: 100, height: 100, fill });

async function dragScene(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await drag(page, await toClient(page, from), await toClient(page, to));
}

test("pen strokes and the stroke eraser survive save, reload, undo and export", async ({ page }) => {
  await createDesign(page, [[]]);
  await rail(page, "Kreslení").click();
  await expect(page.getByRole("button", { name: "Pero", exact: true })).toHaveAttribute("aria-pressed", "true");

  await dragScene(page, { x: 200, y: 300 }, { x: 800, y: 300 });
  await expect.poll(async () => (await objects(page)).length).toBe(1);
  await dragScene(page, { x: 200, y: 700 }, { x: 800, y: 700 });
  await expect.poll(async () => (await objects(page)).length).toBe(2);
  const strokes = await savedObjects(page);
  expect(strokes.map((s) => [s.type, s.role, s.name])).toEqual([
    ["Path", "drawing", "Kresba"],
    ["Path", "drawing", "Kresba"],
  ]);

  // Each stroke is an undo step of its own.
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await objects(page)).length).toBe(1);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(async () => (await objects(page)).length).toBe(2);

  // The eraser removes the stroke it is dragged across, whole, and nothing else.
  await page.getByRole("button", { name: "Guma", exact: true }).click();
  await dragScene(page, { x: 500, y: 250 }, { x: 500, y: 350 });
  await expect.poll(async () => (await objects(page)).length).toBe(1);
  expect((await savedObjects(page))[0].top as number).toBeGreaterThan(600);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await objects(page)).length).toBe(2);

  // Escape leaves the draw tool; objects can be selected again.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Guma", exact: true })).toBeHidden();
  await waitForSaved(page);

  await page.reload();
  await waitForEditor(page);
  expect(await objects(page)).toHaveLength(2);
  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const [onStroke, offStroke] = await pixels(page, bytes, [[500 / 1080, 300 / 1080], [500 / 1080, 500 / 1080]]);
  expect(onStroke.slice(0, 3)).toEqual([24, 24, 27]);
  expect(offStroke.slice(0, 3)).toEqual([255, 255, 255]);
});

test("marker, glow and pressure brush create distinct persistent vector strokes", async ({ page }) => {
  await createDesign(page, [[]]);
  await rail(page, "Kreslení").click();
  await page.getByRole("button", { name: "Zvýrazňovač" }).click();
  await dragScene(page, { x: 140, y: 180 }, { x: 500, y: 180 });
  await expect.poll(async () => (await savedObjects(page)).length).toBe(1);
  expect((await savedObjects(page))[0]).toMatchObject({ brushKind: "marker", opacity: 0.4, globalCompositeOperation: "multiply" });

  await page.getByRole("button", { name: "Neonové pero" }).click();
  await dragScene(page, { x: 140, y: 330 }, { x: 500, y: 330 });
  await expect.poll(async () => (await savedObjects(page)).length).toBe(2);
  expect((await savedObjects(page))[1]).toMatchObject({ brushKind: "glow", shadow: expect.objectContaining({ blur: expect.any(Number) }) });

  await page.getByRole("button", { name: "Krasopis" }).click();
  await page.keyboard.down("Shift");
  await dragScene(page, { x: 140, y: 480 }, { x: 500, y: 505 });
  await page.keyboard.up("Shift");
  await expect.poll(async () => (await savedObjects(page)).length).toBe(3);
  const calligraphy = (await savedObjects(page))[2] as { brushKind: string; fill: string; stroke: string | null; height: number };
  expect(calligraphy).toMatchObject({ brushKind: "calligraphy", fill: "#18181b", stroke: null });
  expect(calligraphy.height).toBeLessThan(35);

  await page.keyboard.press("Escape");
  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page)).map((o) => o.brushKind)).toEqual(["marker", "glow", "calligraphy"]);
});

test("guides are dragged from the rulers, snap objects, and survive undo and reload but not export", async ({ page }) => {
  await createDesign(page, [[rect("box", 600, 600)]]);
  await page.locator("body").press("Shift+R");
  const top = page.getByTestId("ruler-top");
  const left = page.getByTestId("ruler-left");
  await expect(top).toBeVisible();

  // Drag down from the top ruler to page y = 300, and right from the left ruler to x = 200.
  const topBox = (await top.boundingBox())!;
  const y300 = await toClient(page, { x: 540, y: 300 });
  await drag(page, { x: y300.x, y: topBox.y + 10 }, y300);
  const leftBox = (await left.boundingBox())!;
  const x200 = await toClient(page, { x: 200, y: 540 });
  await drag(page, { x: leftBox.x + 10, y: x200.y }, x200);
  await expect.poll(async () => JSON.parse(await serialized(page)).guides).toEqual({ vertical: [expect.closeTo(200, 0)], horizontal: [expect.closeTo(300, 0)] });

  // Undo takes back the last guide.
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => JSON.parse(await serialized(page)).guides.vertical).toEqual([]);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(async () => JSON.parse(await serialized(page)).guides.vertical).toHaveLength(1);
  const guides = JSON.parse(await serialized(page)).guides as { vertical: number[]; horizontal: number[] };

  // A box dragged near the horizontal guide snaps its top edge to it.
  await dragScene(page, { x: 650, y: 650 }, { x: 650, y: 354 });
  await expect.poll(async () => (await savedObjects(page))[0].top).toBeCloseTo(guides.horizontal[0], 1);
  await waitForSaved(page);

  await page.reload();
  await waitForEditor(page);
  await expect(top).toBeVisible();
  expect(JSON.parse(await serialized(page)).guides).toEqual(guides);
  await expect(page.getByTestId("guide-vertical")).toHaveCount(1);

  // Guides are not part of the design.
  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const [onGuide] = await pixels(page, bytes, [[guides.vertical[0] / 1080, 100 / 1080]]);
  expect(onGuide.slice(0, 3)).toEqual([255, 255, 255]);

  // Dragging a guide back onto its ruler removes it.
  const handle = (await page.getByTestId("guide-vertical").boundingBox())!;
  await drag(page, { x: handle.x + 3, y: handle.y + 300 }, { x: leftBox.x + 10, y: handle.y + 300 });
  await expect.poll(async () => JSON.parse(await serialized(page)).guides?.vertical ?? []).toEqual([]);

  // The view menu turns rulers off; guides hide with them.
  await page.getByRole("button", { name: "Zobrazení" }).click();
  await page.getByRole("menuitemcheckbox", { name: /Pravítka a vodítka/ }).click();
  await expect(top).toBeHidden();
  await expect(page.getByTestId("guide-horizontal")).toHaveCount(0);
});

test("a box dragged between two others snaps to equal spacing", async ({ page }) => {
  await createDesign(page, [[rect("a", 100, 400), rect("b", 500, 400), rect("c", 290, 420, "#16a34a")]]);
  // Moving c a little: the nearest equal-gap position is left = 300 (100 px on both sides).
  await dragScene(page, { x: 340, y: 470 }, { x: 344, y: 470 });
  await expect.poll(async () => (await savedObjects(page))[2].left).toBeCloseTo(300, 1);
});

test("curved text is edited in the toolbar and survives save, reload, undo and export", async ({ page }) => {
  await createDesign(page, [[]]);
  await rail(page, "Text").click();
  await page.getByRole("button", { name: "Přidat zakřivený text" }).click();
  await expect.poll(async () => (await savedObjects(page))[0]?.type).toBe("CurvedText");
  expect((await savedObjects(page))[0]).toMatchObject({ text: "Zakřivený text", curve: 40 });

  const field = page.getByRole("textbox", { name: "Zakřivený text" });
  await field.fill("Around the world");
  await field.press("Enter");
  await expect.poll(async () => (await savedObjects(page))[0].text).toBe("Around the world");
  const straightWidth = (await savedObjects(page))[0].width as number;

  await page.getByRole("button", { name: "Zakřivení", exact: true }).click();
  const curve = page.getByRole("textbox", { name: "Zakřivení (°)", exact: true });
  await curve.fill("180");
  await curve.press("Enter");
  await closePopovers(page);
  await expect.poll(async () => (await savedObjects(page))[0].curve as number).toBeCloseTo(52.083, 2);
  const curved = (await savedObjects(page))[0];
  // A 180° arch is visibly narrower and taller than the starting curve.
  expect(curved.width as number).toBeLessThan(straightWidth);
  expect((curved.height as number) / (curved.width as number)).toBeGreaterThan(0.35);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page))[0].curve).toBe(40);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(async () => (await savedObjects(page))[0].curve as number).toBeCloseTo(52.083, 2);
  await waitForSaved(page);

  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page))[0]).toMatchObject({ type: "CurvedText", text: "Around the world", curve: expect.closeTo(52.083, 2) });
  // The arch stays centred where the text was placed; its top is where the letters are.
  expect((curved.left as number) + (curved.width as number) / 2).toBeCloseTo(540, 0);
  await clickScene(page, { x: 540, y: (curved.top as number) + 20 });
  await expect(page.getByRole("textbox", { name: "Zakřivený text" })).toHaveValue("Around the world");

  const png = await exportFile(page, { format: "PNG", size: "1×" });
  // Text at the top of the arch, nothing in its middle.
  const [middle] = await pixels(page, png.bytes, [[0.5, 0.5]]);
  expect(middle.slice(0, 3)).toEqual([255, 255, 255]);
  const svg = (await exportFile(page, { format: "SVG" })).bytes.toString("utf8");
  expect(svg).toMatch(/<tspan x="[-\d.]+" y="[-\d.]+" rotate="[-\d.]+">A<\/tspan>/);
});

test("presentation mode shows the pages full screen and moves between them with the arrow keys", async ({ page }) => {
  await createDesign(page, [[{ ...rect("red", 0, 0, "#dc2626"), width: 1080, height: 1080 }], [{ ...rect("blue", 0, 0, "#2563eb"), width: 1080, height: 1080 }]]);
  await page.getByRole("button", { name: "Prezentovat" }).click();
  const show = page.getByRole("dialog", { name: "Prezentace" });
  await expect(show).toBeVisible();
  await expect(page.getByTestId("presentation-position")).toHaveText("1 / 2");
  // Pages are played on canvases (phase 16); the newest one is the page shown.
  const colour = () =>
    page.getByTestId("presentation-page").last().evaluate((c: HTMLCanvasElement) => Array.from(c.getContext("2d")!.getImageData(c.width / 2, c.height / 2, 1, 1).data.slice(0, 3)));
  await expect.poll(colour).toEqual([220, 38, 38]);

  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("presentation-position")).toHaveText("2 / 2");
  await expect.poll(colour).toEqual([37, 99, 235]);
  // Past the last page it stays there; Delete does nothing to the design while presenting.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("presentation-position")).toHaveText("2 / 2");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("presentation-position")).toHaveText("1 / 2");

  await page.keyboard.press("Escape");
  await expect(show).toBeHidden();
  expect(await objects(page)).toHaveLength(1);
});
