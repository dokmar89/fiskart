import { expect, test, type Page } from "@playwright/test";
import { clickScene, objects, savedObjects, waitForEditor } from "./helpers";
import { makePngFrom } from "./png";
import { AI_TEST_KEY, STOCK_MOCK_PORT } from "./stock-config";

async function createDesign(page: Page, objs: Record<string, unknown>[]) {
  const created = await page.request.post("/api/projects", { data: { title: "AI", width: 1080, height: 1080, unit: "px" } });
  const { id } = (await created.json()) as { id: string };
  const [first] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 2, canvasData: { objects: objs } } });
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
}

const rail = (page: Page) => page.getByRole("navigation", { name: "Nástroje" }).getByRole("button", { name: "AI", exact: true });
const panel = (page: Page) => page.getByRole("complementary", { name: "Panel" });
const textbox = { type: "Textbox", id: "t", text: "Big summer sale today", left: 140, top: 200, width: 800, fontSize: 60, fontFamily: "Inter" };

test("text is rewritten through the server, one undo step each, and no request goes from the browser to a provider", async ({ page }) => {
  const browserCalls: string[] = [];
  const bodies: string[] = [];
  page.on("request", (r) => browserCalls.push(r.url()));
  page.on("response", async (r) => {
    if (/json|javascript|html|text/.test(r.headers()["content-type"] ?? "")) bodies.push(await r.text().catch(() => ""));
  });
  await createDesign(page, [textbox]);
  await rail(page).click();
  await expect(panel(page).getByRole("note")).toContainText("se odesílají poskytovateli AI");
  await clickScene(page, { x: 540, y: 240 });

  await panel(page).getByRole("button", { name: "Kratší" }).click();
  await expect.poll(async () => (await savedObjects(page))[0].text).toBe("Big summer!");
  await panel(page).getByRole("button", { name: "Formálněji" }).click();
  await expect.poll(async () => (await savedObjects(page))[0].text).toBe("Dear reader: Big summer!");
  await panel(page).getByLabel("Přeložit do jazyka").fill("Czech");
  await panel(page).getByRole("button", { name: "Přeložit" }).click();
  await expect.poll(async () => (await savedObjects(page))[0].text).toBe("Velký letní výprodej");

  // Each AI change is one undo step.
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page))[0].text).toBe("Dear reader: Big summer!");
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page))[0].text).toBe("Big summer!");

  await panel(page).getByLabel("Zadání textu").fill("a slogan for summer");
  await panel(page).getByRole("button", { name: "Napsat text" }).click();
  await expect.poll(async () => (await savedObjects(page)).map((o) => o.text)).toContain("Summer is here");

  expect(browserCalls.filter((u) => u.includes(`:${STOCK_MOCK_PORT}/anthropic`) || u.includes(`:${STOCK_MOCK_PORT}/openai`))).toEqual([]);
  expect(bodies.filter((b) => b.includes(AI_TEST_KEY))).toEqual([]);
});

test("a generated image is an ordinary asset that still loads with no provider, and picture edits are undo steps", async ({ page, context }) => {
  const photo = await page.request.post("/api/assets", { multipart: { file: { name: "p.png", mimeType: "image/png", buffer: makePngFrom(200, 100, () => [200, 30, 30]) } } });
  const asset = (await photo.json()) as { url: string };
  await createDesign(page, [{ type: "Image", id: "pic", src: asset.url, left: 340, top: 600, width: 200, height: 100, scaleX: 2, scaleY: 2 }]);
  await rail(page).click();
  await panel(page).getByLabel("Zadání obrázku").fill("a purple square");
  await panel(page).getByRole("button", { name: "Vygenerovat" }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(2);
  const generated = (await savedObjects(page))[1];
  expect(generated.src).toMatch(/^\/api\/assets\//);
  expect((await page.request.get(generated.src as string)).headers()["content-type"]).toBe("image/png");

  // Erase from the original picture: the painted area becomes the mask, the result is swapped in.
  await clickScene(page, { x: 540, y: 700 });
  await panel(page).getByRole("button", { name: "Vymazat…" }).click();
  const dialog = page.getByRole("dialog", { name: "Vymazat z obrázku" });
  const area = (await dialog.getByLabel("Přemalujte, co se má vymazat").boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2 + 40, area.y + area.height / 2, { steps: 5 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Vymazat" }).click();
  await expect.poll(async () => (await savedObjects(page))[0].src).not.toBe(asset.url);
  const edited = (await savedObjects(page))[0];
  expect(edited).toMatchObject({ left: 340, top: 600, width: 200, height: 100, scaleX: 2, scaleY: 2 });
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page))[0].src).toBe(asset.url);

  // Expanding grows the picture around its content.
  await clickScene(page, { x: 540, y: 700 });
  await panel(page).getByRole("button", { name: "Rozšířit" }).click();
  await expect.poll(async () => (await savedObjects(page))[0].width).toBe(300);
  expect((await savedObjects(page))[0]).toMatchObject({ height: 150, scaleX: 2 });

  // With every provider gone, the design (generated image included) still loads.
  await context.route((url) => url.port === String(STOCK_MOCK_PORT), (route) => route.abort());
  await page.reload();
  await waitForEditor(page);
  expect((await objects(page)).map((o) => o.name)).not.toContain("Chybějící obrázek");
});

test("without keys the AI tab says why and the rest of the editor works", async ({ page }) => {
  await page.route("**/api/ai/status", (r) => r.fulfill({ json: { text: false, image: false, textProvider: null, imageProvider: null } }));
  await createDesign(page, [textbox]);
  await rail(page).click();
  await expect(panel(page).getByRole("status").first()).toContainText("ANTHROPIC_API_KEY");
  await expect(panel(page).getByRole("status").nth(1)).toContainText("OPENAI_API_KEY");
  await expect(panel(page).getByRole("button", { name: "Vygenerovat" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Nástroje" }).getByRole("button", { name: "Prvky", exact: true }).click();
  await page.getByRole("button", { name: "Obdélník", exact: true }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(2);
});
