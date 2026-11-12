import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { exportFile } from "./export-helpers";
import { createProject, currentPageId, serialized, waitForEditor, waitForSaved } from "./helpers";

const SAMPLE = "Příliš žluťoučký kůň";
const FIVE_FONTS = ["Lobster", "Playfair Display", "Bebas Neue", "Caveat", "JetBrains Mono"];

type SavedObject = Record<string, unknown> & { effect?: { type: string }; shadow?: unknown; listStyle?: string; textCase?: string; text?: string };
const savedObjects = async (page: Page) => (JSON.parse(await serialized(page)) as { objects: SavedObject[] }).objects;

async function addHeading(page: Page) {
  await page.getByRole("button", { name: "Text", exact: true }).click();
  const before = await page.evaluate(() => window.__opencanva!.objects().length);
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  // Adding text waits for its font, so the object appears a moment after the click.
  await expect.poll(() => page.evaluate(() => window.__opencanva!.objects().length)).toBe(before + 1);
}

test("font picker previews Czech accents with bundled fonts", async ({ page }) => {
  const remoteFonts: string[] = [];
  page.on("request", (request) => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) remoteFonts.push(request.url()); });
  await createProject(page);
  await addHeading(page);
  await page.getByRole("button", { name: "Písmo", exact: true }).click();
  await page.getByRole("textbox", { name: "Hledat písma" }).fill("Cinzel");
  const option = page.getByRole("option", { name: /Cinzel.*Příliš žluťoučký kůň/ });
  await expect(option).toBeVisible();
  const loaded = await page.evaluate(async () => (await document.fonts.load('400 20px "Cinzel"', "Příliš žluťoučký kůň")).length);
  expect(loaded).toBeGreaterThan(0);
  expect(remoteFonts).toEqual([]);
});

/** Width of `text` in a face, measured by the browser once the face is loaded. */
function measured(page: Page, family: string, size: number, text: string) {
  return page.evaluate(
    async ([f, s, t]) => {
      const font = `400 ${s}px "${f}"`;
      await document.fonts.load(font, t);
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = font;
      return ctx.measureText(t).width;
    },
    [family, size, text] as const,
  );
}

test("a page with five fonts measures its text in those fonts on a cold first load, and exports them", async ({ page, browser }) => {
  const projectId = await createProject(page);
  const pageId = await currentPageId(page);
  const objects = FIVE_FONTS.map((family, i) => ({
    type: "Textbox",
    version: "6.9.1",
    id: `t${i}`,
    left: 40,
    top: 40 + i * 180,
    width: 1000,
    fontSize: 60,
    fontFamily: family,
    text: SAMPLE,
    fill: "#18181b",
  }));
  const put = await page.request.put(`/api/pages/${pageId}`, { data: { schemaVersion: 1, canvasData: { objects } } });
  expect(put.ok()).toBe(true);

  // A new context has an empty HTTP cache and no fonts loaded.
  const cold = await (await browser.newContext()).newPage();
  await cold.goto(`/design/${projectId}`);
  await waitForEditor(cold);
  const texts = await cold.evaluate(() => window.__opencanva!.texts());
  expect(texts.map((t) => t.family)).toEqual(FIVE_FONTS);
  for (const text of texts) {
    const width = await measured(cold, text.family, 60, SAMPLE);
    // Fabric adds up per-character widths with kerning, so allow a little difference; a fallback
    // font would be off by far more.
    expect(Math.abs(text.width - width) / width, text.family).toBeLessThan(0.02);
    expect(text.lines).toBe(1);
  }

  const svg = (await exportFile(cold, { format: "SVG" })).bytes.toString("utf8");
  for (const family of FIVE_FONTS) expect(svg).toContain(`font-family:"${family}"`);
  const png = await exportFile(cold, { format: "PNG", size: "1×" });
  await writeFile(test.info().outputPath("five-fonts.png"), png.bytes);
  await cold.context().close();
});

test("text effects survive save, reload, undo and export", async ({ page }) => {
  await createProject(page);
  await addHeading(page);

  await page.getByRole("button", { name: "Efekty" }).click();
  const effects = page.getByRole("dialog", { name: "Efekty" });
  await effects.getByRole("button", { name: "Stín", exact: true }).click();
  await effects.getByRole("textbox", { name: "Odsazení" }).fill("80");
  await effects.getByRole("textbox", { name: "Odsazení" }).press("Enter");
  await page.keyboard.press("Escape");

  let [heading] = await savedObjects(page);
  expect(heading.effect).toMatchObject({ type: "shadow", offset: 80 });
  expect(heading.shadow).toMatchObject({ offsetX: expect.any(Number), blur: expect.any(Number) });
  await waitForSaved(page);

  await page.reload();
  await waitForEditor(page);
  [heading] = await savedObjects(page);
  expect(heading.effect).toMatchObject({ type: "shadow", offset: 80 });

  // Each effect replaces the last; hollow keeps the text colour and gives it back when turned off.
  await addHeading(page);
  for (const [label, type] of [["Obrys", "outline"], ["Dutý", "hollow"], ["Neon", "neon"]]) {
    await page.getByRole("button", { name: "Efekty" }).click();
    await effects.getByRole("button", { name: label, exact: true }).click();
    await page.keyboard.press("Escape");
    const objs = await savedObjects(page);
    expect(objs[1].effect).toMatchObject({ type });
  }
  let objs = await savedObjects(page);
  // Neon draws a pale tint of the text colour, and keeps the colour itself in the effect.
  expect(objs[1].effect).toMatchObject({ color: "#18181b" });
  expect(objs[1].fill).not.toBe("#18181b");
  await page.keyboard.press("Control+z");
  objs = await savedObjects(page);
  expect(objs[1].effect).toMatchObject({ type: "hollow" });
  expect(objs[1].fill).toBe("");
  await page.keyboard.press("Control+z");
  objs = await savedObjects(page);
  expect(objs[1].effect).toMatchObject({ type: "outline" });
  expect(objs[1].fill).toBe("#18181b");

  const png = await exportFile(page, { format: "PNG", size: "1×" });
  await writeFile(test.info().outputPath("effects.png"), png.bytes);
  const svg = (await exportFile(page, { format: "SVG" })).bytes.toString("utf8");
  expect(svg).toContain("<filter");
  expect(svg).toContain("paint-order");
});

test("new typography combinations and effects create editable exported text", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Přidat text:/ })).toHaveCount(25);
  await page.getByRole("button", { name: "Přidat text: Cyber Monday" }).click();
  await expect.poll(() => savedObjects(page).then((objects) => objects.length)).toBe(1);
  const [group] = await savedObjects(page);
  expect(group.type).toBe("Group");
  expect((group.objects as SavedObject[]).map((item) => item.text)).toEqual(["CYBER MONDAY", "SLEVY, KTERÉ ZMĚNÍ PRAVIDLA HRY"]);
  expect((group.objects as SavedObject[])[0].effect).toMatchObject({ type: "glitch" });
  const svg = (await exportFile(page, { format: "SVG" })).bytes.toString("utf8");
  expect(svg).toContain("#00e5ff");
  expect(svg).toContain("#ff3ba7");
  await writeFile(test.info().outputPath("cyber-combination.png"), (await exportFile(page, { format: "PNG", size: "1×" })).bytes);
  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page))[0].objects).toBeTruthy();
});

test("splice and rounded text background survive undo, reload and SVG export", async ({ page }) => {
  await createProject(page);
  await addHeading(page);
  await page.getByRole("button", { name: "Efekty" }).click();
  const effects = page.getByRole("dialog", { name: "Efekty" });
  await effects.getByRole("button", { name: "Spojení", exact: true }).click();
  await page.keyboard.press("Escape");
  expect((await savedObjects(page))[0].effect).toMatchObject({ type: "splice", color: "#a855f7" });
  expect((await exportFile(page, { format: "SVG" })).bytes.toString("utf8")).toContain("#a855f7");

  await page.getByRole("button", { name: "Efekty" }).click();
  await effects.getByRole("button", { name: "Pozadí", exact: true }).click();
  await page.keyboard.press("Escape");
  expect((await savedObjects(page))[0].effect).toMatchObject({ type: "background", radius: 30 });
  expect((await exportFile(page, { format: "SVG" })).bytes.toString("utf8")).toContain('fill="#fef08a"');
  await page.keyboard.press("Control+z");
  expect((await savedObjects(page))[0].effect).toMatchObject({ type: "splice" });
  await page.keyboard.press("Control+Shift+z");
  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page))[0].effect).toMatchObject({ type: "background" });
});

test("lists and upper case change the drawing, not the stored text", async ({ page }) => {
  await createProject(page);
  await addHeading(page);
  await page.mouse.dblclick(...(await centreOfFirst(page)));
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Jedna\nDvě\nTři");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Odrážkový seznam" }).click();
  let [text] = await savedObjects(page);
  expect(text.listStyle).toBe("bullet");
  await page.getByRole("button", { name: /Odrážkový seznam \(kliknutím číslovat\)/ }).click();
  await page.getByRole("button", { name: "Velká písmena" }).click();
  [text] = await savedObjects(page);
  expect(text).toMatchObject({ listStyle: "number", textCase: "upper", text: "Jedna\nDvě\nTři" });
  const [measuredText] = await page.evaluate(() => window.__opencanva!.texts());
  expect(measuredText.lines).toBe(3);

  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  [text] = await savedObjects(page);
  expect(text).toMatchObject({ listStyle: "number", textCase: "upper", text: "Jedna\nDvě\nTři" });
  const svg = (await exportFile(page, { format: "SVG" })).bytes.toString("utf8");
  expect(svg).toContain("JEDNA");
  expect(svg).toContain(">3.</tspan>");
  const png = await exportFile(page, { format: "PNG", size: "1×" });
  await writeFile(test.info().outputPath("list.png"), png.bytes);
});

async function centreOfFirst(page: Page): Promise<[number, number]> {
  const p = await page.evaluate(() => {
    const [o] = window.__opencanva!.objects();
    return window.__opencanva!.sceneToClient(o.center.x, o.center.y);
  });
  return [p.x, p.y];
}

const geist = (file: string) => readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans", file));

test("an uploaded font can be picked, survives reload, and can be deleted", async ({ page }) => {
  // Uploads, two reloads and an export: under a full parallel run this needs more than the default.
  test.slow();
  const projectId = await createProject(page);
  // Other tests may have uploaded Geist already; start without it.
  await page.request.delete("/api/fonts?family=Geist&force=1");
  await page.reload();
  await waitForEditor(page);
  await addHeading(page);

  await page.getByRole("button", { name: "Písmo", exact: true }).click();
  const upload = (name: string, buffer: Buffer) =>
    Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/fonts") && r.request().method() === "POST"),
      page.locator("input[type=file][accept*=woff2]").setInputFiles({ name, mimeType: "font/ttf", buffer }),
    ]).then(([r]) => r);
  expect((await upload("Geist-Regular.ttf", await geist("Geist-Regular.ttf"))).status()).toBe(201);
  expect((await upload("Geist-Bold.woff2", await geist("Geist-Bold.woff2"))).status()).toBe(201);
  expect((await upload("Geist-Regular.ttf", await geist("Geist-Regular.ttf"))).status()).toBe(409);
  await expect(page.getByRole("alert").filter({ hasText: "už je nahraný" })).toBeVisible();

  await page.getByRole("option", { name: "Geist" }).click();
  // The face is loaded before the change is applied.
  await expect.poll(async () => (await savedObjects(page))[0].fontFamily).toBe("Geist");
  await waitForSaved(page);

  await page.reload();
  await waitForEditor(page);
  const [measuredText] = await page.evaluate(() => window.__opencanva!.texts());
  const [text] = await savedObjects(page);
  const fontSize = (await savedObjects(page))[0].fontSize as number;
  const weight = (await savedObjects(page))[0].fontWeight;
  const width = await page.evaluate(
    async ([size, w, t]) => {
      const font = `${w} ${size}px "Geist"`;
      await document.fonts.load(font, t);
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = font;
      return ctx.measureText(t).width;
    },
    [fontSize, String(weight), String(text.text)] as const,
  );
  expect(Math.abs(measuredText.width - width) / width).toBeLessThan(0.02);
  const svg = (await exportFile(page, { format: "SVG" })).bytes.toString("utf8");
  expect(svg).toContain('font-family:"Geist"');

  // Deleting a font in use asks first.
  await page.mouse.click(...(await centreOfFirst(page)));
  await page.getByRole("button", { name: "Písmo", exact: true }).click();
  await page.getByRole("option", { name: "Geist" }).hover();
  await page.getByRole("button", { name: "Smazat Geist" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "je použito na 1 stránce" })).toBeVisible();
  await page.getByRole("button", { name: "Přesto smazat" }).click();
  await expect(page.getByRole("option", { name: "Geist" })).toHaveCount(0);
  expect((await savedObjects(page))[0].fontFamily).toBe("Geist");
  expect(projectId).toBeTruthy();
});

test("the font picker searches, filters by category and refuses fonts that are built in", async ({ page }) => {
  await createProject(page);
  await addHeading(page);
  await page.getByRole("button", { name: "Písmo", exact: true }).click();
  // 60 built-in fonts, plus any another test has uploaded meanwhile.
  await expect(page.getByRole("option").nth(59)).toBeVisible();
  await page.getByRole("button", { name: "Psací" }).click();
  await expect(page.getByRole("option", { name: "Pacifico" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Inter" })).toHaveCount(0);
  await page.getByRole("button", { name: "Vše" }).click();
  await page.getByRole("textbox", { name: "Hledat písma" }).fill("playf");
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Hledat písma" }).press("Enter");
  await expect.poll(async () => (await savedObjects(page))[0].fontFamily).toBe("Playfair Display");

  const lora = await readFile(join(process.cwd(), "node_modules/@fontsource/lora/files/lora-latin-400-normal.woff2"));
  const res = await page.request.post("/api/fonts", { multipart: { file: { name: "Lora.woff2", mimeType: "font/woff2", buffer: lora } } });
  expect(res.status()).toBe(409);
  const bad = await page.request.post("/api/fonts", { multipart: { file: { name: "x.ttf", mimeType: "font/ttf", buffer: Buffer.from("not a font at all, really not".repeat(4)) } } });
  expect(bad.status()).toBe(415);
});
