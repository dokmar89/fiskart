import { expect, test } from "@playwright/test";
import {
  activeIds,
  addRectangle,
  createProject,
  drag,
  objectCount,
  objects,
  pixelAt,
  toClient,
  toScene,
  zoom,
} from "./helpers";

test("add, move, duplicate and delete objects", async ({ page }) => {
  await createProject(page);
  expect(await objectCount(page)).toBe(0);

  await addRectangle(page);
  expect(await objectCount(page)).toBe(1);

  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  await expect.poll(() => objectCount(page)).toBe(2);

  // The heading sits on the rectangle's centre, so grab the rectangle below the text.
  const [rect] = await objects(page);
  const grab = await toClient(page, { x: rect.center.x, y: rect.center.y + 110 });
  await drag(page, grab, { x: grab.x + 120, y: grab.y + 60 });
  const z = await zoom(page);
  const moved = (await objects(page))[0];
  expect(moved.id).toBe(rect.id);
  expect(moved.center.x - rect.center.x).toBeCloseTo(120 / z, 0);
  expect(moved.center.y - rect.center.y).toBeCloseTo(60 / z, 0);
  expect(await activeIds(page)).toEqual([rect.id]);

  await page.keyboard.press("ControlOrMeta+d");
  expect(await objectCount(page)).toBe(3);
  const [duplicateId] = await activeIds(page);
  expect(duplicateId).toBeTruthy();
  expect(duplicateId).not.toBe(rect.id);

  await page.keyboard.press("Delete");
  expect(await objectCount(page)).toBe(2);
  expect((await objects(page)).map((o) => o.id)).not.toContain(duplicateId);
});

test("select all, marquee, shift-click, clipboard and nudge", async ({ page }) => {
  await createProject(page);
  await addRectangle(page);
  await page.getByRole("button", { name: "Elipsa" }).click();
  // Spread them apart: move the ellipse right with keyboard nudges (10 px each with Shift).
  for (let i = 0; i < 30; i++) await page.keyboard.press("Shift+ArrowRight");
  const [rect, ellipse] = await objects(page);
  expect(ellipse.center.x - rect.center.x).toBeCloseTo(300, 5);
  await page.keyboard.press("ArrowDown");
  expect((await objects(page))[1].center.y - ellipse.center.y).toBeCloseTo(1, 5);

  await page.keyboard.press("Escape");
  expect(await activeIds(page)).toEqual([]);

  await page.keyboard.press("ControlOrMeta+a");
  expect((await activeIds(page)).sort()).toEqual([rect.id, ellipse.id].sort());
  await page.keyboard.press("Escape");

  // Marquee from the empty top-left of the page across both objects.
  const start = await toClient(page, { x: 20, y: 20 });
  const end = await toClient(page, { x: 1060, y: 1060 });
  await drag(page, start, end);
  expect((await activeIds(page)).sort()).toEqual([rect.id, ellipse.id].sort());
  await page.keyboard.press("Escape");

  const rectPoint = await toClient(page, rect.center);
  const ellipsePoint = await toClient(page, ellipse.center);
  await page.mouse.click(rectPoint.x, rectPoint.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(ellipsePoint.x, ellipsePoint.y);
  await page.keyboard.up("Shift");
  expect((await activeIds(page)).sort()).toEqual([rect.id, ellipse.id].sort());

  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  await expect.poll(() => objectCount(page)).toBe(4);
  expect(await activeIds(page)).toHaveLength(2);

  await page.keyboard.press("ControlOrMeta+x");
  await expect.poll(() => objectCount(page)).toBe(2);
  await page.keyboard.press("ControlOrMeta+v");
  await expect.poll(() => objectCount(page)).toBe(4);
  const ids = (await objects(page)).map((o) => o.id);
  expect(new Set(ids).size).toBe(4);
});

test("shortcuts do not fire while editing text", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  const [text] = await objects(page);
  const p = await toClient(page, text.center);
  await page.mouse.dblclick(p.x, p.y);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("Hello");
  await page.keyboard.press("ControlOrMeta+d");
  expect(await objectCount(page)).toBe(1);

  await page.keyboard.press("Escape");
  await page.keyboard.press("Delete");
  expect(await objectCount(page)).toBe(0);
});

test("zoom keeps the point under the cursor; zoom and pan never move objects", async ({ page }) => {
  await createProject(page);
  await addRectangle(page);
  await page.keyboard.press("Escape");
  const before = await objects(page);

  // Mouse events carry whole-pixel client coordinates, so use a whole-pixel cursor position.
  const near = await toClient(page, { x: 200, y: 300 });
  const cursor = { x: Math.round(near.x), y: Math.round(near.y) };
  const sceneBefore = await toScene(page, cursor);
  await page.mouse.move(cursor.x, cursor.y);
  const zoomBefore = await zoom(page);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect.poll(() => zoom(page)).toBeGreaterThan(zoomBefore * 1.2);
  const sceneAfter = await toScene(page, cursor);
  expect(sceneAfter.x).toBeCloseTo(sceneBefore.x, 3);
  expect(sceneAfter.y).toBeCloseTo(sceneBefore.y, 3);

  // Space + drag, started on top of the rectangle: it pans instead of moving the object.
  const rectPoint = await toClient(page, before[0].center);
  const originBefore = await toClient(page, { x: 0, y: 0 });
  await page.keyboard.down("Space");
  await drag(page, rectPoint, { x: rectPoint.x + 80, y: rectPoint.y + 40 });
  await page.keyboard.up("Space");
  const originAfterSpace = await toClient(page, { x: 0, y: 0 });
  expect(originAfterSpace.x - originBefore.x).toBeCloseTo(80, 3);
  expect(originAfterSpace.y - originBefore.y).toBeCloseTo(40, 3);
  expect(await activeIds(page)).toEqual([]);

  // Middle-button drag pans as well.
  await drag(page, rectPoint, { x: rectPoint.x - 50, y: rectPoint.y - 30 }, "middle");
  const originAfterMiddle = await toClient(page, { x: 0, y: 0 });
  expect(originAfterMiddle.x - originAfterSpace.x).toBeCloseTo(-50, 3);
  expect(originAfterMiddle.y - originAfterSpace.y).toBeCloseTo(-30, 3);

  await page.getByRole("button", { name: "Přiblížit" }).click();
  await page.getByRole("button", { name: "Přizpůsobit obrazovce" }).click();
  await expect.poll(() => zoom(page)).toBeCloseTo(zoomBefore, 5);
  await expect(page.getByTestId("zoom-level")).toHaveText(`${Math.round(zoomBefore * 100)}%`);

  expect(await objects(page)).toEqual(before);
});

test("objects outside the artboard are clipped but stay selectable", async ({ page }) => {
  await createProject(page);
  await addRectangle(page);
  const [rect] = await objects(page);
  // The rectangle is 300 px wide; centre it on the left edge of the page.
  const grab = await toClient(page, rect.center);
  const target = await toClient(page, { x: 0, y: rect.center.y });
  await drag(page, grab, target);
  await page.keyboard.press("Escape");
  const [moved] = await objects(page);
  expect(moved.center.x).toBeCloseTo(0, 0);

  const outside = await toClient(page, { x: -75, y: rect.center.y });
  const inside = await toClient(page, { x: 75, y: rect.center.y });
  // Outside the page nothing is painted (the workspace behind the canvas shows through).
  expect((await pixelAt(page, outside))[3]).toBe(0);
  const fill = await pixelAt(page, inside);
  expect(fill.slice(0, 3)).toEqual([161, 161, 170]);

  await page.mouse.click(outside.x, outside.y);
  expect(await activeIds(page)).toEqual([rect.id]);
});
