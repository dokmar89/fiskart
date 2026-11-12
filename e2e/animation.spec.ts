import { expect, test, type Page } from "@playwright/test";
import { exportFile, pixels } from "./export-helpers";
import { clickScene, closePopovers, savedObjects, waitForEditor, waitForSaved } from "./helpers";

type Obj = Record<string, unknown>;

/** A design whose pages are stored as version 1, as phases before 16 saved them. */
async function createDesign(page: Page, pages: Obj[][]) {
  const created = await page.request.post("/api/projects", { data: { title: "Animation", width: 1080, height: 1080, unit: "px" } });
  const { id } = (await created.json()) as { id: string };
  const [first] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 1, canvasData: { objects: pages[0] } } });
  for (const [index, objs] of pages.slice(1).entries()) {
    await page.request.post(`/api/projects/${id}/pages`, { data: { index: index + 1, canvasData: { objects: objs } } });
  }
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  return { id, firstPage: first.id };
}

const box = (id: string, fill: string, extra: Obj = {}) => ({ type: "Rect", id, name: id, left: 340, top: 340, width: 400, height: 400, fill, ...extra });

async function pick(page: Page, label: string, value: string) {
  await page.getByRole("combobox", { name: label }).selectOption(value);
}

test("element animations survive save, reload and undo, and exports show the final state", async ({ page }) => {
  const { firstPage } = await createDesign(page, [[box("box", "#2563eb")]]);
  await clickScene(page, { x: 540, y: 540 });
  await page.getByRole("button", { name: "Animovat" }).click();
  await pick(page, "Příchod: efekt", "slide");
  await expect.poll(async () => (await savedObjects(page))[0].animation).toMatchObject({ in: { type: "slide" } });
  await pick(page, "Příchod: směr", "left");
  await pick(page, "Odchod: efekt", "fade");
  await expect.poll(async () => (await savedObjects(page))[0].animation).toMatchObject({ in: { type: "slide", direction: "left" }, out: { type: "fade" } });
  await closePopovers(page);
  // Until the popover has gone, keys still go to its selects.
  await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page))[0].animation).toEqual({ in: expect.objectContaining({ direction: "left" }) });
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(async () => (await savedObjects(page))[0].animation).toMatchObject({ out: { type: "fade" } });
  await waitForSaved(page);

  const stored = (await (await page.request.get(`/api/pages/${firstPage}`)).json()) as { schemaVersion: number; canvasData: { objects: Obj[] } };
  expect(stored.schemaVersion).toBe(2);
  expect(stored.canvasData.objects[0].animation).toMatchObject({ in: { type: "slide" }, out: { type: "fade" } });

  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page))[0].animation).toMatchObject({ in: { type: "slide", direction: "left" }, out: { type: "fade" } });
  // Exports are stills of the design: the box is where it was put, fully visible.
  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const [centre] = await pixels(page, bytes, [[0.5, 0.5]]);
  expect(centre.slice(0, 3)).toEqual([37, 99, 235]);
});

test("a continuous rotation has a hover preview, survives undo and reload, and exports as a still", async ({ page }) => {
  await createDesign(page, [[box("loop-box", "#7c3aed", { width: 420, height: 220 })]]);
  await clickScene(page, { x: 540, y: 500 });
  await page.getByRole("button", { name: "Animovat" }).click();
  await pick(page, "Smyčka: efekt", "spin");
  const tile = page.getByRole("group", { name: "Smyčka: předvolby" }).getByRole("button", { name: /Rotace/ });
  await tile.hover();
  await expect.poll(async () => {
    const style = await tile.locator("span").nth(1).getAttribute("style");
    return Math.abs(Number(/rotate\((-?[\d.]+)deg\)/.exec(style ?? "")?.[1] ?? 0));
  }).toBeGreaterThan(5);
  await pick(page, "Smyčka: směr", "left");
  await expect.poll(async () => (await savedObjects(page))[0].animation).toMatchObject({ loop: { type: "spin", direction: "left" } });
  await closePopovers(page);
  await page.getByRole("button", { name: "Zpět", exact: true }).click();
  await expect.poll(async () => (await savedObjects(page))[0].animation).toMatchObject({ loop: { type: "spin", direction: "right" } });
  await page.getByRole("button", { name: "Znovu", exact: true }).click();
  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page))[0].animation).toMatchObject({ loop: { type: "spin", direction: "left" } });
  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const [centre] = await pixels(page, bytes, [[0.5, 0.5]]);
  expect(centre.slice(0, 3)).toEqual([124, 58, 237]);
});

test("page timing is saved with the page and the preview plays the page from the start", async ({ page }) => {
  await createDesign(page, [[box("box", "#dc2626", { animation: { in: { type: "fade", duration: 400, delay: 2000, easing: "linear", direction: "up" } } })]]);
  await page.getByRole("navigation", { name: "Nástroje" }).getByRole("button", { name: "Návrh", exact: true }).click();
  const duration = page.getByRole("spinbutton", { name: "Délka stránky (s)" });
  await duration.fill("3");
  await duration.press("Enter");
  await pick(page, "Přechod na stránku", "fade");
  await expect.poll(async () => JSON.parse(await page.evaluate(() => window.__opencanva!.serialized())).timing).toMatchObject({ duration: 3000, transition: { type: "fade" } });
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => JSON.parse(await page.evaluate(() => window.__opencanva!.serialized())).timing?.transition.type).toBe("none");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await waitForSaved(page);

  await page.getByRole("button", { name: "Přehrát", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Náhled" });
  await expect(preview).toBeVisible();
  const centre = () =>
    page.getByTestId("presentation-page").last().evaluate((c: HTMLCanvasElement) => Array.from(c.getContext("2d")!.getImageData(c.width / 2, c.height / 2, 1, 1).data.slice(0, 3)));
  // Before its entrance (2 s in) the box is not there yet; once the page has played it is.
  await expect.poll(centre, { timeout: 1800 }).toEqual([255, 255, 255]);
  await expect(preview.getByRole("status", { name: "Přehrávání" })).toHaveText("Dokončeno", { timeout: 6000 });
  expect(await centre()).toEqual([220, 38, 38]);
  await preview.getByRole("button", { name: "Zavřít náhled" }).click();
  await expect(preview).toBeHidden();

  await page.reload();
  await waitForEditor(page);
  expect(JSON.parse(await page.evaluate(() => window.__opencanva!.serialized())).timing).toMatchObject({ duration: 3000, transition: { type: "fade" } });
});

test("a version 1 page without animations loads unchanged", async ({ page }) => {
  const objects = [box("a", "#16a34a"), { type: "Textbox", id: "t", text: "Hello", left: 100, top: 100, width: 400, fontSize: 48, fontFamily: "Inter" }];
  const { firstPage } = await createDesign(page, [objects]);
  const stored = (await (await page.request.get(`/api/pages/${firstPage}`)).json()) as { schemaVersion: number; canvasData: { objects: Obj[] } };
  expect(stored.schemaVersion).toBe(2);
  expect(stored.canvasData).toEqual({ objects });
  const loaded = await savedObjects(page);
  expect(loaded.map((o) => [o.id, o.left, o.top, o.animation])).toEqual([
    ["a", 340, 340, undefined],
    ["t", 100, 100, undefined],
  ]);
  // Its timing is the default and is not written back.
  expect(JSON.parse(await page.evaluate(() => window.__opencanva!.serialized())).timing).toBeUndefined();
});
