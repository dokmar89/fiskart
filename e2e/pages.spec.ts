import { expect, test, type Page } from "@playwright/test";
import {
  addRectangle,
  createProject,
  currentPageId,
  drag,
  objectCount,
  objects,
  pageIds,
  savedObjects,
  toClient,
  waitForEditor,
} from "./helpers";

const tiles = (page: Page) => page.getByTestId("page-tile");
const tile = (page: Page, n: number) => tiles(page).nth(n - 1);

async function openPageTile(page: Page, n: number) {
  const id = (await pageIds(page))[n - 1];
  await tile(page, n).getByRole("button", { name: `Stránka ${n}`, exact: true }).click();
  await expect.poll(() => currentPageId(page)).toBe(id);
  await expect(page.getByText("Načítám…")).toHaveCount(0);
}

async function tileAction(page: Page, n: number, action: "Duplikovat stránku" | "Smazat stránku") {
  await tile(page, n).hover();
  await tile(page, n).getByRole("button", { name: action }).click();
}

async function storedObjectCount(page: Page, pageId: string): Promise<number> {
  const res = await page.request.get(`/api/pages/${pageId}`);
  return ((await res.json()) as { canvasData: { objects: unknown[] } }).canvasData.objects.length;
}

test("add, duplicate, delete and reorder pages; contents and order survive reload", async ({ page }) => {
  await createProject(page);
  await expect(tiles(page)).toHaveCount(1);
  await expect(tile(page, 1).getByRole("button", { name: "Smazat stránku" })).toBeDisabled();
  await addRectangle(page);

  await page.getByRole("button", { name: "Přidat stránku" }).click();
  await expect(tiles(page)).toHaveCount(2);
  await expect(tile(page, 2).getByRole("button", { name: "Stránka 2" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => objectCount(page)).toBe(0);
  await page.getByRole("button", { name: "Elipsa" }).click();
  await page.getByRole("button", { name: "Hvězda", exact: true }).click();

  await openPageTile(page, 1);
  expect((await objects(page)).map((o) => o.type)).toEqual(["rect"]);
  const originalIds = (await savedObjects(page)).map((o) => o.id);

  // The copy lands right after the original and is opened, with the same objects under new ids.
  await tileAction(page, 1, "Duplikovat stránku");
  await expect(tiles(page)).toHaveCount(3);
  await expect(tile(page, 2).getByRole("button", { name: "Stránka 2" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => objectCount(page)).toBe(1);
  const copyIds = (await savedObjects(page)).map((o) => o.id);
  expect(copyIds).toHaveLength(1);
  expect(copyIds[0]).not.toBe(originalIds[0]);

  // Pages: [rect, rect copy, ellipse+star]. Drag the last before the first.
  const [p1, p2, p3] = await pageIds(page);
  await tile(page, 3).dragTo(tile(page, 1), { targetPosition: { x: 4, y: 20 } });
  await expect.poll(() => pageIds(page)).toEqual([p3, p1, p2]);

  // Deleting a page with content asks first.
  await tileAction(page, 3, "Smazat stránku");
  await page.getByRole("alertdialog").getByRole("button", { name: "Smazat" }).click();
  await expect.poll(() => pageIds(page)).toEqual([p3, p1]);
  // The deleted page was the open one; its neighbour opens instead.
  await expect.poll(() => currentPageId(page)).toBe(p1);

  // Every page gets a preview.
  for (let n = 1; n <= 2; n++) {
    await expect.poll(() => tile(page, n).locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }

  await page.reload();
  await waitForEditor(page);
  expect(await pageIds(page)).toEqual([p3, p1]);
  expect(await currentPageId(page)).toBe(p3);
  expect((await objects(page)).map((o) => o.type).sort()).toEqual(["ellipse", "polygon"]);
  await openPageTile(page, 2);
  expect((await objects(page)).map((o) => o.type)).toEqual(["rect"]);
  expect((await page.request.get(`/api/pages/${p2}`)).status()).toBe(404);
});

test("switching pages saves the page being left straight away", async ({ page }) => {
  await createProject(page);
  const first = await currentPageId(page);
  await page.getByRole("button", { name: "Přidat stránku" }).click();
  await expect(tiles(page)).toHaveCount(2);
  await openPageTile(page, 1);

  await addRectangle(page);
  // Well within the two-second autosave delay.
  await openPageTile(page, 2);
  expect(await storedObjectCount(page, first!)).toBe(1);
});

test("undo history is kept per page", async ({ page }) => {
  await createProject(page);
  const undoButton = page.getByRole("button", { name: "Zpět", exact: true });
  await addRectangle(page);
  const [rect] = await objects(page);
  const grab = await toClient(page, rect.center);
  await drag(page, grab, { x: grab.x + 80, y: grab.y + 40 });
  await page.keyboard.press("Escape");
  const moved = (await objects(page))[0].center;

  await page.getByRole("button", { name: "Přidat stránku" }).click();
  await expect.poll(() => objectCount(page)).toBe(0);
  await expect(undoButton).toBeDisabled();
  await page.getByRole("button", { name: "Elipsa" }).click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => objectCount(page)).toBe(0);
  await expect(undoButton).toBeDisabled();

  // Back on page 1, its own steps are still there: undo the drag, then the add.
  await openPageTile(page, 1);
  expect((await objects(page))[0].center.x).toBeCloseTo(moved.x, 1);
  await expect(undoButton).toBeEnabled();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await objects(page))[0]?.center.x).toBeCloseTo(rect.center.x, 1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => objectCount(page)).toBe(0);

  // Page 2 kept its redo.
  await openPageTile(page, 2);
  await page.getByRole("button", { name: "Znovu", exact: true }).click();
  await expect.poll(() => objectCount(page)).toBe(1);
});

test("copy on one page and paste on another", async ({ page }) => {
  await createProject(page);
  await addRectangle(page);
  await page.keyboard.press("ControlOrMeta+c");
  await page.getByRole("button", { name: "Přidat stránku" }).click();
  await expect.poll(() => objectCount(page)).toBe(0);
  await page.keyboard.press("ControlOrMeta+v");
  await expect.poll(() => objectCount(page)).toBe(1);
});

test("the server keeps at least one page and a consistent order", async ({ page }) => {
  await createProject(page);
  const only = await currentPageId(page);
  expect((await page.request.delete(`/api/pages/${only}`)).status()).toBe(409);

  const projectId = page.url().split("/design/")[1];
  const bad = await page.request.put(`/api/projects/${projectId}/pages`, { data: { order: [only, only] } });
  expect(bad.status()).toBe(400);
  const added = await page.request.post(`/api/projects/${projectId}/pages`, { data: { index: 0 } });
  expect(added.status()).toBe(201);
  const list = (await (await page.request.get(`/api/projects/${projectId}/pages`)).json()) as { id: string }[];
  expect(list.map((p) => p.id)).toEqual([((await added.json()) as { id: string }).id, only]);
});
