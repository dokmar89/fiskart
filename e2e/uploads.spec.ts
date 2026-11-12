import { expect, test, type Page } from "@playwright/test";
import {
  createProject,
  currentPageUrl,
  objectCount,
  objects,
  openUploads,
  pick,
  pixelAt,
  toClient,
  uploadThroughPicker,
  waitForEditor,
  waitForSaved,
} from "./helpers";
import { makePng } from "./png";

const RED = makePng(200, 100, [220, 20, 20]);
const BLUE = makePng(120, 120, [20, 40, 220]);
const GREEN = makePng(80, 160, [20, 180, 60]);

async function storedPage(page: Page, url: string): Promise<string> {
  const res = await page.request.get(url);
  return JSON.stringify(((await res.json()) as { canvasData: unknown }).canvasData);
}

async function sendFileEvent(page: Page, kind: "paste" | "drop", buffer: Buffer, at?: { x: number; y: number }) {
  await page.evaluate(
    ({ b64, kind, at }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], `${kind}.png`, { type: "image/png" }));
      if (kind === "paste") {
        document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
        return;
      }
      const host = document.querySelector("[data-testid=canvas-viewport]")!;
      const init = { dataTransfer: data, clientX: at!.x, clientY: at!.y, bubbles: true, cancelable: true };
      host.dispatchEvent(new DragEvent("dragover", init));
      host.dispatchEvent(new DragEvent("drop", init));
    },
    { b64: buffer.toString("base64"), kind, at },
  );
}

test("upload, paste, drop and drag images; pages only reference stored assets", async ({ page }) => {
  // Many uploads and reloads in one test: under a full parallel run it needs more than the default.
  test.slow();
  await createProject(page);
  const pageRef = { url: await currentPageUrl(page) };
  await openUploads(page);

  const redTile = (await uploadThroughPicker(page, "red.png", RED)).getByTestId("upload-tile");
  await expect(redTile.locator("img")).toHaveJSProperty("naturalWidth", 200);
  await redTile.click();
  await expect.poll(() => objectCount(page)).toBe(1);

  await sendFileEvent(page, "paste", BLUE);
  await expect.poll(() => objectCount(page)).toBe(2);

  const dropAt = await toClient(page, { x: 200, y: 200 });
  await sendFileEvent(page, "drop", GREEN, dropAt);
  await expect.poll(() => objectCount(page)).toBe(3);
  const dropped = (await objects(page))[2];
  // Drag events carry whole-pixel coordinates, so allow a few scene pixels.
  expect(Math.abs(dropped.center.x - 200)).toBeLessThan(3);
  expect(Math.abs(dropped.center.y - 200)).toBeLessThan(3);

  // Drag the red upload from the panel onto the page.
  const dragTarget = await toClient(page, { x: 850, y: 850 });
  const box = (await page.getByTestId("canvas-viewport").boundingBox())!;
  await redTile.dragTo(page.getByTestId("canvas-viewport"), {
    targetPosition: { x: dragTarget.x - box.x, y: dragTarget.y - box.y },
  });
  await expect.poll(() => objectCount(page)).toBe(4);
  const dragged = (await objects(page))[3];
  expect(dragged.center.x).toBeCloseTo(850, -1);

  // All four are images, and the red one really drew red pixels.
  expect((await objects(page)).map((o) => o.type)).toEqual(["image", "image", "image", "image"]);
  expect((await pixelAt(page, await toClient(page, dragged.center))).slice(0, 3)).toEqual([220, 20, 20]);

  await page.keyboard.press("Escape");
  await waitForSaved(page);
  const stored = await storedPage(page, pageRef.url);
  expect(stored).not.toContain("data:");
  const sources = [...stored.matchAll(/"src":"([^"]*)"/g)].map((m) => m[1]);
  expect(sources).toHaveLength(4);
  for (const src of sources) expect(src).toMatch(/^\/api\/assets\/[\w-]+$/);

  await page.reload();
  await waitForEditor(page);
  expect(await objectCount(page)).toBe(4);
  expect((await pixelAt(page, await toClient(page, dragged.center))).slice(0, 3)).toEqual([220, 20, 20]);
});

test("a 20 MB upload succeeds; wrong types and oversized files are refused", async ({ page }) => {
  test.setTimeout(120_000);
  await createProject(page);
  await openUploads(page);

  const big = makePng(2700, 2700, "noise");
  expect(big.length).toBeGreaterThan(20 * 1024 * 1024);
  expect(big.length).toBeLessThan(25 * 1024 * 1024);
  const response = page.waitForResponse((r) => r.url().endsWith("/api/assets") && r.request().method() === "POST", {
    timeout: 90_000,
  });
  await pick(page, "big.png", big);
  const res = await response;
  expect(res.status()).toBe(201);
  // The inspector does not keep bodies of requests this large, so look the asset up instead.
  const list = (await (await page.request.get("/api/assets")).json()) as { url: string; fileSize: number; width: number; height: number }[];
  const asset = list.find((a) => a.fileSize === big.length);
  expect(asset).toMatchObject({ fileSize: big.length, width: 2700, height: 2700 });

  const served = await page.request.get(asset!.url);
  expect(served.headers()["cache-control"]).toContain("immutable");
  expect(served.headers()["content-type"]).toBe("image/png");
  expect((await served.body()).length).toBe(big.length);

  await pick(page, "fake.png", Buffer.from("not really an image"));
  await expect(page.getByRole("alert").filter({ hasText: "Nahrát lze jen obrázky PNG, JPEG, WebP a SVG" })).toBeVisible();

  await pick(page, "huge.png", Buffer.alloc(26 * 1024 * 1024));
  await expect(page.getByRole("alert").filter({ hasText: "je větší než 25 MB" })).toBeVisible();
});

test("SVG uploads get a size and a restrictive policy", async ({ page }) => {
  const form = { file: { name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><script>alert(1)</script><rect width="30" height="10" fill="red"/></svg>') } };
  const res = await page.request.post("/api/assets", { multipart: form });
  expect(res.status()).toBe(201);
  const asset = (await res.json()) as { url: string; kind: string; width: number; height: number };
  expect(asset).toMatchObject({ kind: "svg", width: 30, height: 10 });
  const served = await page.request.get(asset.url);
  expect(served.headers()["content-security-policy"]).toContain("sandbox");
  expect(await served.text()).toContain('<svg width="30" height="10"');
});

test("deleting an upload in use asks twice and leaves a placeholder that keeps the page loadable", async ({ page, browser }) => {
  // Two editors and several reloads: under a full parallel run it needs more than the default.
  test.slow();
  await createProject(page);
  const pageRef = { url: await currentPageUrl(page) };
  await openUploads(page);
  const item = await uploadThroughPicker(page, "green.png", GREEN);
  const tile = item.getByTestId("upload-tile");
  await expect(tile.locator("img")).toHaveJSProperty("naturalWidth", 80);
  await tile.click();
  await expect.poll(() => objectCount(page)).toBe(1);
  await waitForSaved(page);
  const before = await storedPage(page, pageRef.url);

  await tile.hover();
  await item.getByRole("button", { name: "Smazat nahraný soubor" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Smazat tento soubor?");
  await dialog.getByRole("button", { name: "Smazat" }).click();
  await expect(dialog).toContainText("se používá");
  await expect(dialog).toContainText("na 1 stránce");
  await dialog.getByRole("button", { name: "Přesto smazat" }).click();
  await expect(dialog).toBeHidden();

  // This tab may still draw the image from its HTTP cache; a fresh browser context has no copy.
  const fresh = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
  await fresh.goto(page.url());
  await waitForEditor(fresh);
  const [placeholder] = await objects(fresh);
  expect(placeholder.name).toBe("Chybějící obrázek");
  // Saving again writes the original image JSON back, untouched.
  await fresh.getByRole("button", { name: "Obdélník" }).click();
  await waitForSaved(fresh);
  const after = await storedPage(fresh, pageRef.url);
  const firstObject = (json: string) => JSON.stringify((JSON.parse(json) as { objects: unknown[] }).objects[0]);
  expect(firstObject(after)).toBe(firstObject(before));
});
