import { expect, test, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { exportFile, pixels } from "./export-helpers";
import { clickScene, closePopovers, drag, objects, savedObjects, toClient, waitForEditor, waitForSaved } from "./helpers";

type Obj = Record<string, unknown>;

async function createDesign(page: Page, pages: Obj[][]) {
  const created = await page.request.post("/api/projects", { data: { title: "Structure", width: 1080, height: 1080, unit: "px" } });
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

const rect = (id: string, left: number, top: number, width = 100, height = 100) => ({ type: "Rect", id, name: id, left, top, width, height, fill: "#2563eb" });
const byId = (all: Obj[], id: string) => all.find((o) => o.id === id) as Obj;

async function field(page: Page, label: string, value: string) {
  const input = page.getByRole("group", { name: "Velikost a pozice" }).getByRole("textbox", { name: label, exact: true });
  await input.fill(value);
  await input.press("Enter");
}

test("the position panel moves, sizes and rotates the selection by typed numbers, one undo step each", async ({ page }) => {
  await createDesign(page, [[rect("box", 200, 200, 200, 100)]]);
  await clickScene(page, { x: 300, y: 250 });
  await page.getByRole("button", { name: "Pozice" }).click();
  await field(page, "X", "300");
  await expect.poll(async () => byId(await savedObjects(page), "box").left).toBe(300);
  // Locked by default: the height follows the width.
  await field(page, "Šířka", "400");
  await expect.poll(async () => byId(await savedObjects(page), "box")).toMatchObject({ scaleX: 2, scaleY: 2 });
  await page.getByRole("button", { name: "Poměr stran zamčen" }).click();
  await field(page, "Výška", "50");
  await expect.poll(async () => byId(await savedObjects(page), "box")).toMatchObject({ scaleX: 2, scaleY: 0.5 });
  await field(page, "Otočení", "45");
  await expect.poll(async () => byId(await savedObjects(page), "box").angle).toBe(45);
  await closePopovers(page);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => byId(await savedObjects(page), "box").angle).toBe(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => byId(await savedObjects(page), "box").scaleY).toBe(2);
});

/** A connector's ends in page coordinates, from its saved JSON (Fabric counts the stroke in an object's box). */
function ends(c: Obj) {
  const cx = (c.left as number) + ((c.width as number) + (c.strokeWidth as number)) / 2;
  const cy = (c.top as number) + ((c.height as number) + (c.strokeWidth as number)) / 2;
  const s = c.start as { x: number; y: number };
  const e = c.end as { x: number; y: number };
  return { start: { x: cx + s.x, y: cy + s.y }, end: { x: cx + e.x, y: cy + e.y } };
}

test("a connector attaches to two shapes, follows a moved shape, and undo restores both in one step", async ({ page }) => {
  await createDesign(page, [[rect("a", 100, 200), rect("b", 700, 600)]]);
  await page.getByRole("button", { name: "Spojnice", exact: true }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(3);
  let connector = (await savedObjects(page))[2];
  expect(connector).toMatchObject({ type: "Connector", route: "elbow", endHead: "arrow" });

  // Drag each end handle onto a shape's side.
  let e = ends(connector);
  await drag(page, await toClient(page, e.start), await toClient(page, { x: 203, y: 250 }));
  connector = (await savedObjects(page))[2];
  e = ends(connector);
  await drag(page, await toClient(page, e.end), await toClient(page, { x: 698, y: 652 }));
  await waitForSaved(page);
  connector = (await savedObjects(page))[2];
  expect(connector.startLink).toEqual({ id: "a", anchor: "right" });
  expect(connector.endLink).toEqual({ id: "b", anchor: "left" });
  e = ends(connector);
  // On the sides' midpoints (Fabric's box includes the shapes' 1 px default stroke).
  const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1.5);
  near(e.start.x, 200);
  near(e.start.y, 250);
  near(e.end.x, 700);
  near(e.end.y, 650);

  // Moving b drags the connector's end along.
  await drag(page, await toClient(page, { x: 750, y: 650 }), await toClient(page, { x: 850, y: 800 }));
  // Mouse steps at this zoom are almost 2 page px; follow wherever b ended up.
  await expect.poll(async () => byId(await savedObjects(page), "b").left as number).toBeGreaterThan(790);
  const moved = byId(await savedObjects(page), "b");
  connector = (await savedObjects(page))[2];
  near(ends(connector).end.x, moved.left as number);
  near(ends(connector).end.y, (moved.top as number) + 50);
  await waitForSaved(page);

  // One undo step puts both back.
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => byId(await savedObjects(page), "b").left).toBe(700);
  near(ends((await savedObjects(page))[2]).end.x, 700);

  // Heads per end.
  await clickScene(page, { x: 450, y: 250 });
  await clickScene(page, ends((await savedObjects(page))[2]).start);
  await page.getByRole("button", { name: "Konce čáry" }).click();
  await page.getByRole("button", { name: "Začátek: Kruh" }).click();
  await closePopovers(page);
  await expect.poll(async () => (await savedObjects(page))[2].startHead).toBe("circle");

  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page))[2]).toMatchObject({ startHead: "circle", endHead: "arrow", startLink: { id: "a" }, endLink: { id: "b" } });
  const svg = (await exportFile(page, { format: "SVG" })).bytes.toString("utf8");
  expect(svg).toContain("<polyline");
  expect(svg).toContain("<circle");
});

test("tables: cells are edited in place, rows and columns change, and the table survives reload, undo and export", async ({ page }) => {
  await createDesign(page, [[]]);
  await page.getByRole("button", { name: "Tabulka (3 × 3)" }).click();
  await expect.poll(async () => (await savedObjects(page))[0]?.type).toBe("Table");
  const table = () => savedObjects(page).then((all) => all[0] as { table: { columns: number[]; rows: number[]; cells: { text: string; fill: string | null }[][] }; left: number; top: number; width: number; height: number });
  const t0 = await table();
  // The middle cell of the second row.
  const cell = { x: t0.left + t0.table.columns[0] + t0.table.columns[1] / 2, y: t0.top + t0.table.rows[0] + t0.table.rows[1] / 2 };
  const at = await toClient(page, cell);
  await page.mouse.dblclick(at.x, at.y);
  const editor = page.getByRole("textbox", { name: "Text buňky" });
  await expect(editor).toBeVisible();
  await editor.fill("Hello table");
  await editor.press("Enter");
  await expect.poll(async () => (await table()).table.cells[1][1].text).toBe("Hello table");

  await clickScene(page, cell);
  await page.getByRole("button", { name: "Řádky" }).click();
  await page.getByRole("menuitem", { name: "Přidat řádek pod" }).click();
  await expect.poll(async () => (await table()).table.rows.length).toBe(4);
  await page.getByRole("button", { name: "Sloupce" }).click();
  await page.getByRole("menuitem", { name: "Smazat sloupec" }).click();
  await expect.poll(async () => (await table()).table.columns.length).toBe(2);
  // The edited cell was in the deleted column.
  expect((await table()).table.cells.flat().map((c) => c.text)).not.toContain("Hello table");
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await table()).table.cells[1][1].text).toBe("Hello table");

  // Undo reloads the page, so the table is selected again for the toolbar.
  await clickScene(page, cell);
  const widthField = page.getByRole("textbox", { name: "Šířka sloupce" });
  await widthField.fill("400");
  await widthField.press("Enter");
  await expect.poll(async () => (await table()).table.columns[1]).toBe(400);
  await waitForSaved(page);

  await page.reload();
  await waitForEditor(page);
  const t = await table();
  expect(t.table.rows).toHaveLength(4);
  expect(t.table.cells[1][1].text).toBe("Hello table");
  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  // The header row's grey fill.
  const [header] = await pixels(page, bytes, [[(t.left + 30) / 1080, (t.top + t.table.rows[0] - 6) / 1080]]);
  expect(header.slice(0, 3)).toEqual([228, 228, 231]);
});

function decodeQr(bytes: Buffer): string | null {
  const png = PNG.sync.read(bytes);
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
}

test("a QR code is an SVG asset that scans to its text after export, and can be edited", async ({ page }) => {
  await createDesign(page, [[]]);
  const text = "https://example.com/opencanva?phase=14";
  await page.getByRole("textbox", { name: "Odkaz nebo text QR kódu" }).fill(text);
  await page.getByRole("button", { name: "Přidat", exact: true }).click();
  await expect.poll(async () => (await savedObjects(page))[0]?.qr).toMatchObject({ text });
  const [qr] = await savedObjects(page);
  const asset = await page.request.get(qr.src as string);
  expect(asset.headers()["content-type"]).toBe("image/svg+xml");
  await waitForSaved(page);

  expect(decodeQr((await exportFile(page, { format: "PNG", size: "2×" })).bytes)).toBe(text);

  await clickScene(page, { x: 540, y: 540 });
  await page.getByRole("button", { name: "Upravit QR kód" }).click();
  await page.getByRole("textbox", { name: "Obsah QR kódu" }).fill("Changed");
  await page.getByRole("button", { name: "Aktualizovat" }).click();
  await expect.poll(async () => (await savedObjects(page))[0].qr).toMatchObject({ text: "Changed" });
  await closePopovers(page);
  await waitForSaved(page);
  expect(decodeQr((await exportFile(page, { format: "PNG", size: "1×" })).bytes)).toBe("Changed");

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page))[0].qr).toMatchObject({ text });
});

test("find and replace changes text on every page as one undo step", async ({ page }) => {
  const textbox = (id: string, text: string, top: number) => ({ type: "Textbox", id, text, left: 100, top, width: 800, fontSize: 60, fontFamily: "Inter" });
  const projectId = await createDesign(page, [[textbox("t1", "Summer sale", 100), textbox("t2", "summer prices", 300)], [textbox("t3", "See you in summer", 100)]]);
  const stored = async () => {
    const pages = (await (await page.request.get(`/api/projects/${projectId}/pages`)).json()) as { canvasData: { objects: { text: string }[] } }[];
    return pages.map((p) => p.canvasData.objects.map((o) => o.text));
  };

  await page.locator("body").press("ControlOrMeta+f");
  const dialog = page.getByRole("dialog", { name: "Najít a nahradit" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Najít").fill("summer");
  await expect(dialog.getByRole("status", { name: "Výskyty" })).toHaveText("3 výskyty na stránkách 1, 2.");
  await dialog.getByLabel("Rozlišovat velikost písmen").check();
  await expect(dialog.getByRole("status", { name: "Výskyty" })).toHaveText("2 výskyty na stránkách 1, 2.");
  await dialog.getByLabel("Rozlišovat velikost písmen").uncheck();
  await dialog.getByLabel("Nahradit za").fill("Autumn");
  await dialog.getByRole("button", { name: "Nahradit vše" }).click();
  await expect(dialog.getByText("Nahrazeno: 3 výskyty.")).toBeVisible();
  await expect(dialog.getByRole("status", { name: "Výskyty" })).toHaveText("Nic nenalezeno.");
  await page.keyboard.press("Escape");

  await expect.poll(stored).toEqual([["Autumn sale", "Autumn prices"], ["See you in Autumn"]]);
  expect((await savedObjects(page)).map((o) => o.text)).toEqual(["Autumn sale", "Autumn prices"]);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(stored).toEqual([["Summer sale", "summer prices"], ["See you in summer"]]);
});
