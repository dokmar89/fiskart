import { expect, test } from "@playwright/test";
import {
  addRectangle,
  createProject,
  currentPageUrl,
  drag,
  objectCount,
  objects,
  renameInEditor,
  saveStatus,
  serialized,
  toClient,
  waitForEditor,
  waitForSaved,
} from "./helpers";

/** Fabric writes coordinates with limited precision, so a restored position matches to a few decimals. */
const round = (p: { x: number; y: number } | undefined) => p && { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };

test("a reloaded design is identical to the saved one", async ({ page }) => {
  await createProject(page);
  await addRectangle(page);
  await page.getByRole("button", { name: "Hvězda", exact: true }).click();
  for (let i = 0; i < 20; i++) await page.keyboard.press("Shift+ArrowLeft");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  for (let i = 0; i < 30; i++) await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Escape");

  const [rect] = await objects(page);
  const grab = await toClient(page, { x: rect.center.x + 120, y: rect.center.y + 120 });
  await drag(page, grab, { x: grab.x + 40, y: grab.y + 70 });
  await page.keyboard.press("Escape");
  await waitForSaved(page);

  const before = await serialized(page);
  const parsed = JSON.parse(before) as { objects: Record<string, unknown>[] };
  expect(parsed.objects).toHaveLength(3);
  for (const o of parsed.objects) {
    expect(typeof o.id).toBe("string");
    expect(typeof o.name).toBe("string");
    expect(o.locked).toBe(false);
  }

  await page.reload();
  await waitForEditor(page);
  expect(await serialized(page)).toBe(before);
  await expect(saveStatus(page)).toHaveText(/Uloženo/);
});

test("one drag is one undo step; redo restores it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await createProject(page);
  const undoButton = page.getByRole("button", { name: "Zpět", exact: true });
  const redoButton = page.getByRole("button", { name: "Znovu", exact: true });
  await expect(undoButton).toBeDisabled();

  await addRectangle(page);
  const [rect] = await objects(page);
  const grab = await toClient(page, rect.center);
  await drag(page, grab, { x: grab.x + 100, y: grab.y + 50 });
  const [moved] = await objects(page);
  expect(moved.center.x).toBeGreaterThan(rect.center.x + 50);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => round((await objects(page))[0]?.center)).toEqual(round(rect.center));
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => objectCount(page)).toBe(0);
  await expect(undoButton).toBeDisabled();

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(async () => round((await objects(page))[0]?.center)).toEqual(round(rect.center));
  await redoButton.click();
  await expect.poll(async () => round((await objects(page))[0]?.center)).toEqual(round(moved.center));
  await expect(redoButton).toBeDisabled();

  // A burst of nudges settles into a single step.
  await page.mouse.click(grab.x + 100, grab.y + 50);
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await objects(page))[0].center.x).toBeCloseTo(moved.center.x + 5, 1);
  await undoButton.click();
  await expect.poll(async () => round((await objects(page))[0].center)).toEqual(round(moved.center));

  // A new change after undo clears redo. Undo drops the selection, so select the rectangle again.
  await expect(redoButton).toBeEnabled();
  await page.mouse.click(grab.x + 100, grab.y + 50);
  await page.keyboard.press("Delete");
  await expect(redoButton).toBeDisabled({ timeout: 2_000 });
  await waitForSaved(page);

  await page.reload();
  await waitForEditor(page);
  expect(await objectCount(page)).toBe(0);
  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  expect(await objectCount(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("a failed save is reported and retry succeeds once the network is back", async ({ page }) => {
  await createProject(page);
  await page.route("**/api/pages/**", (route) =>
    route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.continue(),
  );
  await addRectangle(page);
  await expect(saveStatus(page)).toHaveText(/Uložení selhalo/, { timeout: 10_000 });

  await page.unroute("**/api/pages/**");
  await saveStatus(page).getByRole("button", { name: "Zkusit znovu" }).click();
  await expect(saveStatus(page)).toHaveText(/Uloženo/);

  await page.reload();
  await waitForEditor(page);
  expect(await objectCount(page)).toBe(1);
});

test("changes are saved when leaving through Home, and the dashboard shows a thumbnail", async ({ page }) => {
  const id = await createProject(page);
  const title = `Thumb ${Date.now()}`;
  const titleInput = page.getByRole("textbox", { name: "Název návrhu" });
  await titleInput.fill(title);
  await titleInput.press("Enter");

  await addRectangle(page);
  // Leave before the two-second autosave fires: Home saves first.
  await page.getByRole("button", { name: "Domů" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const card = page.getByTestId("project-card").filter({ hasText: title });
  await expect(card).toBeVisible();
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  expect(await objectCount(page)).toBe(1);
  await expect(titleInput).toHaveValue(title);

  // The thumbnail is uploaded after the save; the dashboard shows it once it exists.
  await expect
    .poll(async () => (await page.request.get(`/api/projects/${id}/thumbnail`)).status(), { timeout: 10_000 })
    .toBe(200);
  const thumb = await page.request.get(`/api/projects/${id}/thumbnail`);
  expect(thumb.headers()["content-type"]).toBe("image/png");
  await page.goto("/");
  const img = card.locator("img");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(480);
});

test("title edits: Escape cancels, empty keeps the old title", async ({ page }) => {
  await createProject(page);
  const titleInput = page.getByRole("textbox", { name: "Název návrhu" });
  await renameInEditor(page, "Keep me");
  await titleInput.fill("Discard me");
  await titleInput.press("Escape");
  await expect(titleInput).toHaveValue("Keep me");
  await titleInput.fill("   ");
  await titleInput.press("Enter");
  await expect(titleInput).toHaveValue("Keep me");
  // Typing in the title must not trigger canvas shortcuts.
  await addRectangle(page);
  await titleInput.click();
  await titleInput.press("End");
  await titleInput.press("Backspace");
  expect(await objectCount(page)).toBe(1);
  const response = page.waitForResponse((r) => r.request().method() === "PATCH");
  await titleInput.press("Enter");
  await response;

  await page.reload();
  await expect(titleInput).toHaveValue("Keep m");
});

test("dashboard rename, duplicate and delete with confirmation", async ({ page }) => {
  test.slow();
  const id = await createProject(page);
  const title = `Dash ${Date.now()}`;
  await renameInEditor(page, title);
  await addRectangle(page);
  await waitForSaved(page);
  await page.goto("/");

  const cards = page.getByTestId("project-card");
  const card = cards.filter({ hasText: title });
  await card.getByRole("button", { name: `Akce pro ${title}` }).click();
  await page.getByRole("menuitem", { name: "Přejmenovat" }).click();
  const renamed = `${title} renamed`;
  await page.getByRole("textbox", { name: "Název" }).fill(renamed);
  await page.getByRole("button", { name: "Uložit" }).click();
  const renamedCard = cards.filter({ hasText: renamed }).filter({ hasNotText: "(kopie)" });
  await expect(renamedCard).toBeVisible();

  await renamedCard.getByRole("button", { name: /^Akce pro/ }).click();
  await page.getByRole("menuitem", { name: "Duplikovat" }).click();
  const copyCard = cards.filter({ hasText: `${renamed} (kopie)` });
  await expect(copyCard).toBeVisible();
  const copyHref = await copyCard.locator("a").getAttribute("href");
  expect(copyHref).not.toBe(`/design/${id}`);
  await page.goto(copyHref!);
  await waitForEditor(page);
  expect(await objectCount(page)).toBe(1);
  await page.goto("/");

  await copyCard.getByRole("button", { name: /^Akce pro/ }).click();
  await page.getByRole("menuitem", { name: "Smazat" }).click();
  await page.getByRole("button", { name: "Zrušit" }).click();
  await expect(copyCard).toBeVisible();

  await copyCard.getByRole("button", { name: /^Akce pro/ }).click();
  await page.getByRole("menuitem", { name: "Smazat" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Smazat" }).click();
  await expect(copyCard).toHaveCount(0);
  await expect(renamedCard).toBeVisible();
});

test("closing the tab right after a change still saves it", async ({ page, context }) => {
  await createProject(page);
  const pageUrl = await currentPageUrl(page);
  await addRectangle(page);
  page.on("dialog", (dialog) => void dialog.accept());
  // Well within the two-second autosave delay, so only the save on close can have stored it.
  await page.close({ runBeforeUnload: true });

  await expect
    .poll(async () => {
      const res = await context.request.get(pageUrl);
      const body = (await res.json()) as { canvasData: { objects: unknown[] } };
      return body.canvasData.objects.length;
    })
    .toBe(1);
});

test("discrete edits in quick succession are separate undo steps", async ({ page }) => {
  await createProject(page);
  await addRectangle(page);
  await page.getByRole("button", { name: "Elipsa" }).click();
  await page.keyboard.press("Delete");
  expect(await objectCount(page)).toBe(1);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => objectCount(page)).toBe(2);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => objectCount(page)).toBe(1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => objectCount(page)).toBe(0);
});
