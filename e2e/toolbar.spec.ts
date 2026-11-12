import { expect, test, type Page } from "@playwright/test";
import {
  activeIds,
  addRectangle,
  clickScene,
  closePopovers,
  createProject,
  drag,
  objectCount,
  objects,
  openUploads,
  pixelAt,
  savedObjects,
  toClient,
  uploadThroughPicker,
  waitForEditor,
  waitForSaved,
} from "./helpers";
import { makePng } from "./png";

const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Výběr" });

async function setFillHex(page: Page, hex: string, label = "Barva výplně") {
  await toolbar(page).getByRole("button", { name: label }).click();
  const input = page.getByRole("textbox", { name: "Barva v hex" });
  await input.fill(hex);
  await input.press("Enter");
  await closePopovers(page);
}

const rgbAt = async (page: Page, scene: { x: number; y: number }) => (await pixelAt(page, await toClient(page, scene))).slice(0, 3);

test("a colour change is one undo step and the control follows the selection", async ({ page }) => {
  await createProject(page);
  await addRectangle(page);
  const [rect] = await objects(page);
  await setFillHex(page, "#ff0000");
  expect(await rgbAt(page, rect.center)).toEqual([255, 0, 0]);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => rgbAt(page, rect.center)).toEqual([161, 161, 170]);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => rgbAt(page, rect.center)).toEqual([255, 0, 0]);

  // A second shape, moved aside, in a different colour.
  await page.getByRole("button", { name: "Elipsa" }).click();
  for (let i = 0; i < 35; i++) await page.keyboard.press("Shift+ArrowRight");
  await setFillHex(page, "#0000ff");
  const ellipse = (await objects(page))[1];

  await clickScene(page, { x: rect.center.x - 100, y: rect.center.y });
  await expect(page.getByTestId("Barva výplně-swatch")).toHaveCSS("background-color", "rgb(255, 0, 0)");
  await clickScene(page, ellipse.center);
  await expect(page.getByTestId("Barva výplně-swatch")).toHaveCSS("background-color", "rgb(0, 0, 255)");

  // Both selected: the fill is mixed, the shared stroke width is not.
  await clickScene(page, { x: rect.center.x - 100, y: rect.center.y }, true);
  expect(await activeIds(page)).toHaveLength(2);
  await expect(page.getByTestId("Barva výplně-swatch")).toHaveCSS("background-image", /conic-gradient/);
  await toolbar(page).getByRole("button", { name: "Styl obrysu" }).click();
  await expect(page.getByRole("textbox", { name: "Šířka obrysu" })).toHaveValue("0");
  await closePopovers(page);

  // One colour applied to both is still one step.
  await setFillHex(page, "#00ff00");
  expect(await rgbAt(page, ellipse.center)).toEqual([0, 255, 0]);
  expect(await rgbAt(page, { x: rect.center.x - 100, y: rect.center.y })).toEqual([0, 255, 0]);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => rgbAt(page, ellipse.center)).toEqual([0, 0, 255]);
  expect(await rgbAt(page, { x: rect.center.x - 100, y: rect.center.y })).toEqual([255, 0, 0]);
});

test("a slider drag is one undo step", async ({ page }) => {
  await createProject(page);
  await addRectangle(page);
  await toolbar(page).getByRole("button", { name: "Neprůhlednost" }).click();
  const thumb = page.locator("[data-slot=popover-content]").getByRole("slider");
  const track = (await page.getByLabel("Neprůhlednost: posuvník").boundingBox())!;
  const start = (await thumb.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(track.x + track.width * (1 - i * 0.05), start.y + start.height / 2);
  await page.mouse.up();
  await closePopovers(page);
  const opacity = () => savedObjects(page).then((o) => o[0].opacity as number);
  expect(await opacity()).toBeCloseTo(0.5, 1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(opacity).toBe(1);
  // The rectangle itself is still there: the undo took back only the opacity.
  expect((await objects(page)).length).toBe(1);
});

test("text controls change the text, reflect it and survive reload", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  const bar = toolbar(page);
  await expect(bar.getByRole("button", { name: "Písmo", exact: true })).toHaveText("Inter");
  await expect(bar.getByRole("button", { name: "Tučné" })).toHaveAttribute("aria-pressed", "true");

  await bar.getByRole("button", { name: "Písmo", exact: true }).click();
  await page.getByRole("option", { name: "Playfair Display" }).click();
  await expect(bar.getByRole("button", { name: "Písmo", exact: true })).toHaveText("Playfair Display");
  await bar.getByRole("button", { name: "Tučné" }).click();
  await bar.getByRole("button", { name: "Kurzíva" }).click();
  await bar.getByRole("button", { name: "Podtržení" }).click();
  const size = bar.getByRole("textbox", { name: "Velikost písma" });
  await size.fill("50");
  await size.press("Enter");
  await bar.getByRole("button", { name: /^Zarovnat na střed/ }).click();
  await bar.getByRole("button", { name: "Mezery" }).click();
  const spacing = page.getByRole("textbox", { name: "Mezery mezi písmeny" });
  await spacing.fill("200");
  await spacing.press("Enter");
  const lineHeight = page.getByRole("textbox", { name: "Výška řádku" });
  await lineHeight.fill("1.5");
  await lineHeight.press("Enter");
  await closePopovers(page);

  const expected = {
    fontFamily: "Playfair Display",
    fontWeight: "400",
    fontStyle: "italic",
    underline: true,
    fontSize: 50,
    textAlign: "right",
    charSpacing: 200,
    lineHeight: 1.5,
  };
  expect((await savedObjects(page))[0]).toMatchObject(expected);
  // The face really is loaded: the browser reports it available.
  expect(await page.evaluate(() => document.fonts.check('italic 400 20px "Playfair Display"'))).toBe(true);

  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page))[0]).toMatchObject(expected);
  await clickScene(page, (await objects(page))[0].center);
  await expect(bar.getByRole("textbox", { name: "Velikost písma" })).toHaveValue("50");
  await expect(bar.getByRole("button", { name: "Kurzíva" })).toHaveAttribute("aria-pressed", "true");
});

test("mixed text selection shows indeterminate controls", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  for (let i = 0; i < 30; i++) await page.keyboard.press("Shift+ArrowUp");
  await page.getByRole("button", { name: "Přidat trochu běžného textu" }).click();
  // Text is added once its font has loaded; select all only when both are there.
  await expect.poll(() => objectCount(page)).toBe(2);
  await page.keyboard.press("ControlOrMeta+a");
  const bar = toolbar(page);
  await expect(bar.getByRole("textbox", { name: "Velikost písma" })).toHaveValue("");
  await expect(bar.getByRole("textbox", { name: "Velikost písma" })).toHaveAttribute("placeholder", "Různé");
  await expect(bar.getByRole("button", { name: "Tučné" })).toHaveAttribute("aria-pressed", "mixed");
  await expect(bar.getByRole("button", { name: "Písmo", exact: true })).toHaveText("Inter");
});

test("image tools: flip, corner radius and crop", async ({ page }) => {
  await createProject(page);
  await openUploads(page);
  const png = makePng(200, 100, [255, 0, 0]);
  const item = await uploadThroughPicker(page, "halves.png", png);
  await item.getByTestId("upload-tile").click();
  await expect.poll(async () => (await objects(page)).length).toBe(1);
  const [image] = await objects(page);
  const leftPoint = { x: image.center.x - 60, y: image.center.y };
  expect(await rgbAt(page, leftPoint)).toEqual([255, 0, 0]);

  const bar = toolbar(page);
  await bar.getByRole("button", { name: "Převrátit vodorovně" }).click();
  expect((await savedObjects(page))[0].flipX).toBe(true);
  await expect(bar.getByRole("button", { name: "Převrátit vodorovně" })).toHaveAttribute("aria-pressed", "true");

  await bar.getByRole("button", { name: "Zaoblení rohů" }).click();
  const radius = page.getByRole("textbox", { name: "Zaoblení rohů" });
  await radius.fill("40");
  await radius.press("Enter");
  await closePopovers(page);
  // The very corner is now cut away (page white shows through), the middle is still red.
  expect(await rgbAt(page, { x: image.center.x - 99, y: image.center.y - 49 })).toEqual([255, 255, 255]);
  expect(await rgbAt(page, image.center)).toEqual([255, 0, 0]);

  // Crop: drag the right-hand handle 50 page px inwards.
  await bar.getByRole("button", { name: "Oříznout" }).click();
  await expect(bar.getByRole("button", { name: "Hotovo" })).toBeVisible();
  const handle = await toClient(page, { x: image.center.x + 100, y: image.center.y });
  const zoom = await page.evaluate(() => window.__opencanva!.zoom());
  await drag(page, handle, { x: handle.x - 50 * zoom, y: handle.y });
  await bar.getByRole("button", { name: "Hotovo" }).click();
  const cropped = (await savedObjects(page))[0];
  expect(cropped.width as number).toBeCloseTo(150, -1);
  expect(cropped.scaleX).toBeCloseTo(1, 5);
  // The left edge stayed where it was.
  const after = (await objects(page))[0];
  expect(after.center.x - (cropped.width as number) / 2).toBeCloseTo(image.center.x - 100, 0);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page))[0].width).toBe(200);
});

test("align, distribute and arrange", async ({ page }) => {
  await createProject(page);
  for (const [name, dx, dy] of [["Obdélník", -30, -20], ["Elipsa", 5, 0], ["Hvězda", 30, 25]] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    for (let i = 0; i < Math.abs(dx); i++) await page.keyboard.press(dx < 0 ? "Shift+ArrowLeft" : "Shift+ArrowRight");
    for (let i = 0; i < Math.abs(dy); i++) await page.keyboard.press(dy < 0 ? "Shift+ArrowUp" : "Shift+ArrowDown");
  }
  await page.keyboard.press("ControlOrMeta+a");
  const bar = toolbar(page);
  await bar.getByRole("button", { name: "Pozice" }).click();
  await page.getByRole("button", { name: "Zarovnat k výběru: nahoru" }).click();
  await closePopovers(page);
  const tops = (await page.evaluate(() => window.__opencanva!.boxes())).map((b) => Math.round(b.top));
  expect(new Set(tops).size).toBe(1);

  await bar.getByRole("button", { name: "Pozice" }).click();
  await page.getByRole("button", { name: "Rozmístit vodorovně" }).click();
  await closePopovers(page);
  const boxes = (await page.evaluate(() => window.__opencanva!.boxes())).sort((a, b) => a.left - b.left);
  const gap1 = boxes[1].left - (boxes[0].left + boxes[0].width);
  const gap2 = boxes[2].left - (boxes[1].left + boxes[1].width);
  expect(gap1).toBeCloseTo(gap2, 1);

  // Align a single object to the page's left edge. Clicking inside a multi-selection keeps it, so clear it first.
  await clickScene(page, { x: 5, y: 5 });
  expect(await activeIds(page)).toEqual([]);
  const star = (await objects(page))[2];
  await clickScene(page, star.center);
  await bar.getByRole("button", { name: "Pozice" }).click();
  await page.getByRole("button", { name: "Zarovnat ke stránce: vlevo" }).click();
  await closePopovers(page);
  expect(Math.round((await page.evaluate(() => window.__opencanva!.boxes()))[2].left)).toBe(0);

  // Send the star to the back, then bring it forward one step.
  await bar.getByRole("button", { name: "Uspořádat" }).click();
  await page.getByRole("menuitem", { name: "Na pozadí" }).click();
  expect((await objects(page)).map((o) => o.name)).toEqual(["Hvězda", "Obdélník", "Elipsa"]);
  await bar.getByRole("button", { name: "Uspořádat" }).click();
  await page.getByRole("menuitem", { name: "Posunout dopředu" }).click();
  expect((await objects(page)).map((o) => o.name)).toEqual(["Obdélník", "Hvězda", "Elipsa"]);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await objects(page)).map((o) => o.name)).toEqual(["Hvězda", "Obdélník", "Elipsa"]);

  // Locking from the toolbar leaves only Unlock. Undo dropped the selection; pick the star from the layers panel.
  await page.getByRole("button", { name: "Vrstvy", exact: true }).click();
  await page.getByTestId("layer-row").filter({ hasText: "Hvězda" }).click();
  await bar.getByRole("button", { name: "Zamknout" }).click();
  await expect(bar.getByRole("button", { name: "Odemknout" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Pozice" })).toHaveCount(0);
});

test("dragging snaps to the page centre with a guide; Alt turns snapping off", async ({ page }) => {
  await createProject(page);
  await addRectangle(page);
  const [rect] = await objects(page);
  const from = await toClient(page, rect.center);
  const zoom = await page.evaluate(() => window.__opencanva!.zoom());

  // Drag away, then back to 3 screen px off centre: it snaps, and a guide is drawn while dragging.
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 80, from.y, { steps: 5 });
  await page.mouse.move(from.x + 3, from.y, { steps: 5 });
  const guide = await rgbAt(page, { x: 540, y: 60 });
  await page.mouse.up();
  // The 1 px guide is anti-aliased, so check for its pink rather than an exact value.
  expect(guide[0]).toBeGreaterThan(200);
  expect(guide[1]).toBeLessThan(200);
  expect((await objects(page))[0].center.x).toBe(540);

  await page.keyboard.down("Alt");
  await drag(page, from, { x: from.x + 3, y: from.y });
  await page.keyboard.up("Alt");
  const unsnapped = (await objects(page))[0].center.x;
  expect(Math.abs(unsnapped - (540 + 3 / zoom))).toBeLessThan(1.5);
  expect(unsnapped).not.toBe(540);
});
