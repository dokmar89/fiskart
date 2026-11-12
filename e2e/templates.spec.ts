import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { BUILT_IN_TEMPLATES } from "../prisma/templates/catalog";
import { e2eDatabaseUrl } from "./database-url";
import { addRectangle, clickScene, createProject, currentPageId, objectCount, objects, openUploads, pageIds, savedObjects, serialized, waitForEditor, waitForSaved } from "./helpers";
import { makePng } from "./png";

type Summary = { id: string; title: string; category: string; pageCount: number; isBuiltIn: boolean; version: number; width: number; height: number };

const templateList = async (page: Page) => (await (await page.request.get("/api/templates")).json()) as Summary[];
const builtInId = async (page: Page, title: string) => (await templateList(page)).find((t) => t.isBuiltIn && t.title === title)!.id;

async function openDesignPanel(page: Page) {
  await page.getByRole("button", { name: "Návrh", exact: true }).click();
  await expect(page.getByTestId("template-card").first()).toBeVisible();
}

const card = (page: Page, title: string) => page.getByRole("button", { name: new RegExp(`^${title} \\(`) });

test("the seed has every planned template and running it again changes nothing", async ({ page }) => {
  test.setTimeout(180_000);
  const before = await templateList(page);
  const builtIn = before.filter((t) => t.isBuiltIn);
  expect(builtIn).toHaveLength(BUILT_IN_TEMPLATES.length);
  expect(builtIn.length).toBeGreaterThanOrEqual(55);
  const counts = Object.fromEntries(
    [...new Set(builtIn.map((t) => t.category))].map((c) => [c, builtIn.filter((t) => t.category === c).length]),
  );
  expect(counts["Příspěvek na Instagram"]).toBeGreaterThanOrEqual(3);
  expect(counts["Vzdělávání"]).toBeGreaterThanOrEqual(6);
  expect(counts.Prezentace).toBeGreaterThanOrEqual(3);

  const output = execSync("pnpm exec tsx prisma/seed.ts", { env: { ...process.env, DATABASE_URL: e2eDatabaseUrl() } }).toString();
  expect(output).toContain(`0 added, 0 updated, ${BUILT_IN_TEMPLATES.length} unchanged, 0 removed`);
  const after = (await templateList(page)).filter((t) => t.isBuiltIn);
  expect(after.map((t) => [t.id, t.version])).toEqual(builtIn.map((t) => [t.id, t.version]));
});

test("a representative built-in template from every category loads with its fonts", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));
  const builtIn = (await templateList(page)).filter((t) => t.isBuiltIn);
  const sample = [...new Set(builtIn.map((t) => t.category))].flatMap((category) => {
    const matches = builtIn.filter((t) => t.category === category);
    return [...new Map([matches[0], matches[matches.length - 1]].map((t) => [t.id, t])).values()];
  });
  for (const template of sample) {
    const { id } = (await (await page.request.post(`/api/templates/${template.id}/use`)).json()) as { id: string };
    await page.goto(`/design/${id}`);
    await waitForEditor(page);
    expect(await pageIds(page), template.title).toHaveLength(template.pageCount);
    for (const [index, pageId] of (await pageIds(page)).entries()) {
      if (index > 0) {
        await page.getByTestId("page-tile").nth(index).click();
        await expect.poll(() => page.evaluate(() => window.__opencanva!.pageId())).toBe(pageId);
      }
      const missing = await page.evaluate(() => {
        const faces = JSON.parse(window.__opencanva!.serialized()).objects.filter((o: { fontFamily?: string }) => o.fontFamily) as {
          fontFamily: string;
          fontWeight: string;
          fontStyle: string;
          text: string;
        }[];
        return faces
          .filter((f) => !document.fonts.check(`${f.fontStyle} ${Number(f.fontWeight) >= 600 ? 700 : 400} 20px "${f.fontFamily}"`, f.text))
          .map((f) => `${f.fontFamily} ${f.fontWeight} ${f.fontStyle}`);
      });
      expect(missing, `${template.title} page ${index + 1}`).toEqual([]);
      expect(await objectCount(page)).toBeGreaterThan(2);
    }
  }
  expect(errors).toEqual([]);
});

test("generated photo frame accepts an image and survives undo and reload", async ({ page }) => {
  const templateId = await builtInId(page, "Výprodej 50 % · Výrazná");
  const response = await page.request.post(`/api/templates/${templateId}/use`);
  const { id } = await response.json() as { id: string };
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  const initial = await savedObjects(page);
  const frame = initial.find((object) => object.frame === "rounded") as { left: number; top: number; width: number; height: number } | undefined;
  expect(frame).toBeDefined();
  const upload = await page.request.post("/api/assets", { multipart: { file: { name: "red.png", mimeType: "image/png", buffer: makePng(300, 200, [220, 30, 30]) } } });
  const asset = await upload.json() as { id: string };
  await clickScene(page, { x: frame!.left + frame!.width / 2, y: frame!.top + frame!.height / 2 });
  await openUploads(page);
  await page.locator(`[data-testid=upload-item][data-asset-id="${asset.id}"]`).locator("button").first().click();
  await expect.poll(async () => (await savedObjects(page)).some((object) => object.type === "Image" && object.frame === "rounded")).toBe(true);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page)).some((object) => object.type === "Path" && object.frame === "rounded")).toBe(true);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(async () => (await savedObjects(page)).some((object) => object.type === "Image" && object.frame === "rounded")).toBe(true);
  await waitForSaved(page);
  await page.reload();
  await waitForEditor(page);
  expect((await savedObjects(page)).some((object) => object.type === "Image" && object.frame === "rounded")).toBe(true);
});

test("applying a template replaces the page in one undo step, fitted to another size", async ({ page }) => {
  await createProject(page, "Prezentace");
  await addRectangle(page);
  await openDesignPanel(page);

  // Same-size templates are listed first.
  await expect(page.getByTestId("template-card").first()).toContainText("Prezentace");

  await page.getByRole("textbox", { name: "Hledat šablony" }).fill("quote");
  await card(page, "Citát").click();
  const quote = BUILT_IN_TEMPLATES.find((t) => t.slug === "instagram-post-quote")!;
  await expect.poll(() => objectCount(page)).toBe(quote.pages[0].objects.length);

  // The square template is scaled to the 1080 px height and centred; its background covers the page.
  const boxes = await page.evaluate(() => window.__opencanva!.boxes());
  expect(boxes[0]).toMatchObject({ left: 0, top: 0 });
  expect(boxes[0].width).toBeCloseTo(1920, 0);
  expect(boxes[0].height).toBeCloseTo(1080, 0);
  const frame = boxes[1];
  // Within a pixel: the box includes the frame's stroke.
  expect(Math.abs(frame.left + frame.width / 2 - 960)).toBeLessThan(1.5);

  // Ids are fresh, not the template's.
  const ids = JSON.parse(await serialized(page)).objects.map((o: { id: string }) => o.id);
  expect(ids.some((id: string) => id.startsWith("instagram-post-quote"))).toBe(false);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => objectCount(page)).toBe(1);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => objectCount(page)).toBe(quote.pages[0].objects.length);
});

test("a template with several pages offers its pages", async ({ page }) => {
  await createProject(page, "Prezentace");
  await openDesignPanel(page);
  await page.getByRole("textbox", { name: "Hledat šablony" }).fill("Prezentace pro investory");
  await card(page, "Prezentace pro investory").click();
  await expect(page.getByRole("list", { name: "Stránky šablony" }).getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "Použít stránku 3" }).click();
  const pitch = BUILT_IN_TEMPLATES.find((t) => t.slug === "presentation-pitch")!;
  await expect.poll(() => objectCount(page)).toBe(pitch.pages[2].objects.length);
  expect((await objects(page)).map((o) => o.name)).toContain("Plan");
});

test("save as template, find it by tag, start a design from it on the dashboard and delete it", async ({ page }) => {
  // Several page loads and a thumbnail render: under a full parallel run it needs more than the default.
  test.slow();
  await createProject(page);
  await addRectangle(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Přidat nadpis" }).click();
  await page.getByRole("button", { name: "Přidat stránku" }).click();
  await expect(page.getByTestId("page-tile")).toHaveCount(2);
  const second = (await pageIds(page))[1];
  await expect.poll(() => currentPageId(page)).toBe(second);
  await expect.poll(() => objectCount(page)).toBe(0);
  await page.getByRole("button", { name: "Prvky", exact: true }).click();
  await addRectangle(page);

  await openDesignPanel(page);
  await page.getByRole("button", { name: "Uložit jako šablonu" }).click();
  const dialog = page.getByRole("dialog", { name: "Uložit jako šablonu" });
  await expect(dialog.getByLabel("Kategorie")).toHaveValue("Příspěvek na Instagram");
  const title = `Saved ${Date.now()}`;
  await dialog.getByLabel("Název").fill(title);
  await dialog.getByLabel("Štítky").fill("zebra-tag, launch");
  await dialog.getByRole("button", { name: "Uložit šablonu" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("textbox", { name: "Hledat šablony" }).fill("zebra-tag");
  await expect(page.getByTestId("template-card")).toHaveCount(1);
  await expect(page.getByTestId("template-card")).toContainText("Uložená");
  const saved = (await templateList(page)).find((t) => t.title === title)!;
  expect(saved).toMatchObject({ pageCount: 2, isBuiltIn: false, category: "Příspěvek na Instagram" });
  // The thumbnail was rendered and stored with the save.
  expect((await page.request.get(`/api/templates/${saved.id}/thumbnail`)).ok()).toBe(true);

  await page.goto("/");
  await page.getByRole("textbox", { name: "Hledat šablony" }).fill("zebra-tag");
  await card(page, title).click();
  await page.waitForURL(/\/design\//);
  await waitForEditor(page);
  expect(await pageIds(page)).toHaveLength(2);
  expect(await objectCount(page)).toBe(2);

  await page.goto("/");
  await page.getByRole("textbox", { name: "Hledat šablony" }).fill("zebra-tag");
  await page.getByTestId("template-card").hover();
  await page.getByRole("button", { name: `Smazat šablonu ${title}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Smazat" }).click();
  await expect(page.getByTestId("template-card")).toHaveCount(0);
  expect((await page.request.delete(`/api/templates/${await builtInId(page, "Citát")}`)).status()).toBe(403);
});

test("the dashboard gallery filters by category and starts a design with every page", async ({ page }) => {
  await page.goto("/");
  const pitchId = await builtInId(page, "Prezentace pro investory");
  await page.getByRole("group", { name: "Kategorie šablon" }).getByRole("button", { name: "Prezentace" }).click();
  await expect(page.getByTestId("template-card").first()).toBeVisible();
  // Built-in templates get their thumbnails rendered by the gallery the first time they are shown.
  await expect.poll(async () => (await page.request.get(`/api/templates/${pitchId}/thumbnail`)).status(), { timeout: 30_000 }).toBe(200);
  await page.getByRole("group", { name: "Kategorie šablon" }).getByRole("button", { name: "Vše" }).click();
  await page.getByRole("textbox", { name: "Hledat šablony" }).fill("resume");
  await expect(page.getByTestId("template-card").first()).toBeVisible();
  await page.getByRole("textbox", { name: "Hledat šablony" }).fill("Prezentace pro investory");
  await card(page, "Prezentace pro investory").click();
  await page.waitForURL(/\/design\//);
  await waitForEditor(page);
  expect(await pageIds(page)).toHaveLength(3);
  await expect(page.getByRole("textbox", { name: "Název návrhu" })).toHaveValue("Prezentace pro investory");
});
