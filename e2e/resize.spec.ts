import { expect, test, type Page } from "@playwright/test";
import { addRectangle, objectCount, pageIds, savedObjects, waitForEditor } from "./helpers";
import { makePng } from "./png";

type Obj = Record<string, number | string>;

async function createDesign(page: Page, pages: Obj[][]) {
  const created = await page.request.post("/api/projects", { data: { title: "Resize test", width: 1080, height: 1080, unit: "px" } });
  const { id } = (await created.json()) as { id: string };
  const [first] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 1, canvasData: { objects: pages[0] } } });
  for (const [index, objects] of pages.slice(1).entries()) {
    await page.request.post(`/api/projects/${id}/pages`, { data: { index: index + 1, canvasData: { objects } } });
  }
  return id;
}

async function storedPages(page: Page, projectId: string) {
  const pages = (await (await page.request.get(`/api/projects/${projectId}/pages`)).json()) as { id: string; canvasData: { objects: Obj[] } }[];
  return pages.map((p) => p.canvasData.objects);
}

const artboard = (page: Page) => page.evaluate(() => ({ ...window.__opencanva!.artboard }));
const byId = (objects: Record<string, unknown>[], id: string) => objects.find((o) => o.id === id) as Obj;

async function openResize(page: Page) {
  await page.getByRole("button", { name: "Změnit velikost", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Změnit velikost" })).toBeVisible();
}

const background = { type: "Rect", id: "bg", left: 0, top: 0, width: 1080, height: 1080, fill: "#e4e4e7" };
const box = { type: "Rect", id: "box", left: 100, top: 200, width: 100, height: 50, fill: "#dc2626" };

test("resizing changes every page, is undone and redone as one step, and is saved", async ({ page }) => {
  const upload = await page.request.post("/api/assets", {
    multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: makePng(2000, 2000, [30, 120, 200]) } },
  });
  const asset = (await upload.json()) as { url: string };
  const photo = { type: "Image", id: "photo", src: asset.url, left: 0, top: 0, width: 2000, height: 2000, cropX: 0, cropY: 0, scaleX: 0.54, scaleY: 0.54 };
  const id = await createDesign(page, [[background, box], [photo]]);
  await page.goto(`/design/${id}`);
  await waitForEditor(page);

  await openResize(page);
  await page.getByRole("radio", { name: /^Příběh na Instagram/ }).click();
  await page.getByRole("button", { name: "Změnit velikost tohoto návrhu" }).click();
  await expect(page.getByRole("dialog", { name: "Změnit velikost" })).toBeHidden();
  expect(await artboard(page)).toEqual({ width: 1080, height: 1920 });

  // Page 1: background stretched, content at the same scale moved to the vertical centre.
  const resized = await savedObjects(page);
  expect(byId(resized, "bg")).toMatchObject({ left: 0, top: 0, scaleX: 1 });
  expect(byId(resized, "bg").scaleY).toBeCloseTo(1920 / 1080);
  expect(byId(resized, "box")).toMatchObject({ left: 100, top: 620, scaleX: 1, scaleY: 1 });

  // Page 2: the background photo covers the new page at one scale.
  const stored = await storedPages(page, id);
  const cover = byId(stored[1], "photo") as Record<string, number>;
  expect(cover.scaleX).toBeCloseTo(cover.scaleY);
  expect(cover.width * cover.scaleX).toBeCloseTo(1080);
  expect(cover.height * cover.scaleY).toBeCloseTo(1920);
  expect(byId(stored[0], "box")).toMatchObject({ top: 620 });

  // An edit after the resize is undone first; the next undo takes back the resize, on every page.
  await addRectangle(page);
  await expect.poll(() => objectCount(page)).toBe(3);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => objectCount(page)).toBe(2);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => artboard(page)).toEqual({ width: 1080, height: 1080 });
  await expect.poll(async () => byId(await savedObjects(page), "box").top).toBe(200);
  const undone = await storedPages(page, id);
  expect(byId(undone[0], "bg")).toMatchObject({ scaleY: 1 });
  expect(byId(undone[1], "photo")).toMatchObject({ width: 2000, height: 2000, scaleX: 0.54 });

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => artboard(page)).toEqual({ width: 1080, height: 1920 });
  await expect.poll(async () => byId(await savedObjects(page), "box").top).toBe(620);

  await page.reload();
  await waitForEditor(page);
  expect(await artboard(page)).toEqual({ width: 1080, height: 1920 });
  expect(await pageIds(page)).toHaveLength(2);
  expect(byId(await savedObjects(page), "box")).toMatchObject({ top: 620 });
});

test("copy and resize opens a resized copy and leaves the original untouched", async ({ page }) => {
  const id = await createDesign(page, [[background, box], [box]]);
  const before = await storedPages(page, id);
  await page.goto(`/design/${id}`);
  await waitForEditor(page);

  await openResize(page);
  await page.getByLabel("Šířka").fill("1920");
  await page.getByLabel("Výška").fill("1080");
  await page.getByRole("button", { name: "Kopírovat a změnit velikost" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/design/") && !url.pathname.endsWith(id));
  await waitForEditor(page);
  await expect.poll(() => artboard(page)).toEqual({ width: 1920, height: 1080 });
  await expect(page.getByRole("textbox", { name: "Název návrhu" })).toHaveValue("Resize test (1920 × 1080 px)");
  expect(await pageIds(page)).toHaveLength(2);
  // Landscape from square: scale 1, moved right by half the extra width.
  expect(byId(await savedObjects(page), "box")).toMatchObject({ left: 520, top: 200 });

  expect(await storedPages(page, id)).toEqual(before);
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  expect(await artboard(page)).toEqual({ width: 1080, height: 1080 });
});

test("the size route refuses a page list that does not match the design", async ({ page }) => {
  const id = await createDesign(page, [[box]]);
  const res = await page.request.put(`/api/projects/${id}/size`, { data: { width: 500, height: 500, unit: "px", pages: [] } });
  expect(res.status()).toBe(400);
  const tooBig = await page.request.put(`/api/projects/${id}/size`, { data: { width: 9000, height: 500, unit: "px", pages: [] } });
  expect(tooBig.status()).toBe(400);
});
