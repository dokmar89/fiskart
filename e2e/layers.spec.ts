import { expect, test, type Page } from "@playwright/test";
import { activeIds, createProject, drag, objectCount, objects, toClient, waitForEditor, waitForSaved } from "./helpers";

/** Adds a rectangle, an ellipse and a star, spread apart left to right. */
async function addThreeShapes(page: Page) {
  for (const [name, dx] of [["Obdélník", -30], ["Elipsa", 0], ["Hvězda", 30]] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    for (let i = 0; i < Math.abs(dx); i++) await page.keyboard.press(dx < 0 ? "Shift+ArrowLeft" : "Shift+ArrowRight");
  }
  await page.keyboard.press("Escape");
}

const rows = (page: Page) => page.getByTestId("layer-row");
const rowNames = (page: Page) => rows(page).allInnerTexts();
const row = (page: Page, name: string) => rows(page).filter({ hasText: name });
const names = async (page: Page) => (await objects(page)).map((o) => o.name);

const round = (p: { x: number; y: number }) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });

test("layers list in stacking order; drag reorders the canvas and survives reload", async ({ page }) => {
  await createProject(page);
  await addThreeShapes(page);
  await page.getByRole("button", { name: "Vrstvy", exact: true }).click();
  await expect.poll(() => rowNames(page)).toEqual(["Hvězda", "Elipsa", "Obdélník"]);

  // Drag Rectangle above Star: it moves to the front.
  const starBox = (await row(page, "Hvězda").boundingBox())!;
  await row(page, "Obdélník").dragTo(row(page, "Hvězda"), { targetPosition: { x: 20, y: 2 } });
  await expect.poll(() => rowNames(page)).toEqual(["Obdélník", "Hvězda", "Elipsa"]);
  expect(await names(page)).toEqual(["Elipsa", "Hvězda", "Obdélník"]);
  expect(starBox.height).toBeGreaterThan(0);

  // Clicking a row selects the object.
  await row(page, "Elipsa").click();
  const ellipseId = (await objects(page))[0].id;
  expect(await activeIds(page)).toEqual([ellipseId]);

  // Rename by double-click.
  await row(page, "Elipsa").locator("span").dblclick();
  await page.getByRole("textbox", { name: "Název vrstvy" }).fill("Sun");
  await page.getByRole("textbox", { name: "Název vrstvy" }).press("Enter");
  await expect.poll(() => rowNames(page)).toEqual(["Obdélník", "Hvězda", "Sun"]);

  // Undo takes back the rename only.
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => rowNames(page)).toEqual(["Obdélník", "Hvězda", "Elipsa"]);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => rowNames(page)).toEqual(["Obdélník", "Hvězda", "Sun"]);

  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect(await names(page)).toEqual(["Sun", "Hvězda", "Obdélník"]);
  await page.getByRole("button", { name: "Vrstvy", exact: true }).click();
  await expect.poll(() => rowNames(page)).toEqual(["Obdélník", "Hvězda", "Sun"]);
});

test("hidden layers cannot be clicked; locked layers cannot be selected, moved or deleted on canvas", async ({ page }) => {
  await createProject(page);
  await addThreeShapes(page);
  const [rect, ellipse, star] = await objects(page);
  await page.getByRole("button", { name: "Vrstvy", exact: true }).click();

  // Hide the ellipse: a click where it was selects nothing.
  await row(page, "Elipsa").hover();
  await row(page, "Elipsa").getByRole("button", { name: "Skrýt" }).click();
  expect((await objects(page))[1].visible).toBe(false);
  const ellipsePoint = await toClient(page, ellipse.center);
  await page.mouse.click(ellipsePoint.x, ellipsePoint.y);
  expect(await activeIds(page)).toEqual([]);

  // Lock the star.
  await row(page, "Hvězda").hover();
  await row(page, "Hvězda").getByRole("button", { name: "Zamknout" }).click();
  expect((await objects(page))[2].locked).toBe(true);
  const starPoint = await toClient(page, star.center);
  await page.mouse.click(starPoint.x, starPoint.y);
  expect(await activeIds(page)).toEqual([]);
  await drag(page, starPoint, { x: starPoint.x + 80, y: starPoint.y + 80 });
  expect(round((await objects(page))[2].center)).toEqual(round(star.center));

  // Marquee and select-all skip it.
  await page.keyboard.press("ControlOrMeta+a");
  expect(await activeIds(page)).toEqual([rect.id]);
  await page.keyboard.press("Escape");

  // The panel can select it, but arrows and Delete leave it alone.
  await row(page, "Hvězda").click();
  expect(await activeIds(page)).toEqual([star.id]);
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Delete");
  expect(await objectCount(page)).toBe(3);
  expect(round((await objects(page))[2].center)).toEqual(round(star.center));

  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  const reloaded = await objects(page);
  expect(reloaded[1].visible).toBe(false);
  expect(reloaded[2].locked).toBe(true);
  await page.mouse.click(starPoint.x, starPoint.y);
  expect(await activeIds(page)).toEqual([]);

  // Unlocking makes it selectable on the canvas again.
  await page.getByRole("button", { name: "Vrstvy", exact: true }).click();
  await row(page, "Hvězda").getByRole("button", { name: "Odemknout" }).click();
  await page.keyboard.press("Escape");
  await page.mouse.click(starPoint.x, starPoint.y);
  expect(await activeIds(page)).toEqual([star.id]);
});

test("group and ungroup keep positions; groups survive reload and undo", async ({ page }) => {
  await createProject(page);
  await addThreeShapes(page);
  const before = await objects(page);

  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+g");
  await expect.poll(() => objectCount(page)).toBe(1);
  const [group] = await objects(page);
  expect(group.type).toBe("group");
  expect(group.name).toBe("Skupina");

  // Moving the group moves everything.
  await page.keyboard.press("Shift+ArrowDown");
  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect((await objects(page)).map((o) => o.type)).toEqual(["group"]);

  const groupPoint = await toClient(page, (await objects(page))[0].center);
  await page.mouse.click(groupPoint.x, groupPoint.y);
  await page.keyboard.press("ControlOrMeta+Shift+g");
  await expect.poll(() => objectCount(page)).toBe(3);
  const after = await objects(page);
  expect(after.map((o) => o.id)).toEqual(before.map((o) => o.id));
  after.forEach((o, i) => expect(round(o.center)).toEqual(round({ x: before[i].center.x, y: before[i].center.y + 10 })));
  expect((await activeIds(page)).sort()).toEqual(before.map((o) => o.id).sort());

  // Undo brings the group back as one object.
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => objectCount(page)).toBe(1);
});
