import { expect, type Page } from "@playwright/test";

export type Pt = { x: number; y: number };

export async function createProject(page: Page, preset = "Příspěvek na Instagram") {
  await page.goto("/");
  if (preset === "Prezentace") {
    // The expanded dashboard offers this format directly; the compact dialog shows only eight presets.
    await page.getByRole("region", { name: "Prozkoumat formáty" }).getByRole("button", { name: /^Prezentace 16:9/ }).click();
  } else {
    await page.getByRole("button", { name: "Nový návrh" }).click();
    await page.getByRole("button", { name: new RegExp(`^${preset}`) }).click();
  }
  await page.waitForURL(/\/design\//);
  await waitForEditor(page);
  return page.url().split("/design/")[1];
}

/** The test hook appears once the page has loaded into the canvas. */
export async function waitForEditor(page: Page) {
  await page.waitForFunction(() => window.__opencanva !== undefined);
}

export const currentPageId = (page: Page) => page.evaluate(() => window.__opencanva!.pageId());
export const pageIds = (page: Page) => page.evaluate(() => window.__opencanva!.pageIds());
/** API URL of the page on the canvas, to read what the server stored. */
export const currentPageUrl = async (page: Page) => `/api/pages/${await currentPageId(page)}`;
export const objectCount = (page: Page) => page.evaluate(() => window.__opencanva!.objects().length);
export const objects = (page: Page) => page.evaluate(() => window.__opencanva!.objects());
export const activeIds = (page: Page) => page.evaluate(() => window.__opencanva!.activeIds());
export const serialized = (page: Page) => page.evaluate(() => window.__opencanva!.serialized());
export const zoom = (page: Page) => page.evaluate(() => window.__opencanva!.zoom());
export const toClient = (page: Page, p: Pt) =>
  page.evaluate(([x, y]) => window.__opencanva!.sceneToClient(x, y), [p.x, p.y]);
export const toScene = (page: Page, p: Pt) =>
  page.evaluate(([x, y]) => window.__opencanva!.clientToScene(x, y), [p.x, p.y]);
export const pixelAt = (page: Page, p: Pt) =>
  page.evaluate(([x, y]) => window.__opencanva!.pixelAt(x, y), [p.x, p.y]);

export async function drag(page: Page, from: Pt, to: Pt, button: "left" | "middle" = "left") {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up({ button });
}

export async function addRectangle(page: Page) {
  await page.getByRole("button", { name: "Obdélník" }).click();
}

export const saveStatus = (page: Page) => page.getByTestId("save-status");

/** Waits until a change has been picked up by autosave and written. */
export async function waitForSaved(page: Page) {
  await expect(saveStatus(page)).toHaveText(/Ukládám/, { timeout: 5_000 });
  await expect(saveStatus(page)).toHaveText(/Uloženo/, { timeout: 10_000 });
}

/** Renames the project from the editor title and waits until the server has stored it. */
export async function renameInEditor(page: Page, title: string) {
  const input = page.getByRole("textbox", { name: "Název návrhu" });
  await input.fill(title);
  const response = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/projects/"));
  await input.press("Enter");
  expect((await response).ok()).toBe(true);
}

export async function openUploads(page: Page) {
  await page.getByRole("button", { name: "Nahrané", exact: true }).click();
}

export async function pick(page: Page, name: string, buffer: Buffer, mimeType = "image/png") {
  await page.getByLabel("Vybrat soubory k nahrání").setInputFiles({ name, mimeType, buffer });
}

/** Uploads through the file picker and returns this upload's panel item (other tests share the list). */
export async function uploadThroughPicker(page: Page, name: string, buffer: Buffer) {
  const response = page.waitForResponse((r) => r.url().endsWith("/api/assets") && r.request().method() === "POST");
  await pick(page, name, buffer);
  const asset = (await (await response).json()) as { id: string };
  const item = page.locator(`[data-testid=upload-item][data-asset-id="${asset.id}"]`);
  await expect(item).toBeVisible();
  return item;
}

/** The page's objects as saved JSON, for reading properties the test hook does not list. */
export async function savedObjects(page: Page): Promise<Record<string, unknown>[]> {
  return (JSON.parse(await serialized(page)) as { objects: Record<string, unknown>[] }).objects;
}

/** Clicks an object on the canvas at a scene point. */
export async function clickScene(page: Page, p: Pt, withShift = false) {
  const c = await toClient(page, p);
  if (withShift) await page.keyboard.down("Shift");
  await page.mouse.click(c.x, c.y);
  if (withShift) await page.keyboard.up("Shift");
}

/**
 * Closes open toolbar popovers. Escape closes one layer at a time (a tooltip over the trigger is a
 * layer too), and pressing it with nothing open would deselect, so press only while one is open.
 */
export async function closePopovers(page: Page) {
  const open = page.locator("[data-slot=popover-content][data-state=open]");
  for (let i = 0; i < 4 && (await open.count()) > 0; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(50);
  }
  await expect(open).toHaveCount(0);
}
