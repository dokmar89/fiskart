import { expect, test, type Page } from "@playwright/test";
import { exportFile, pixels } from "./export-helpers";
import { openUploads, savedObjects, waitForEditor } from "./helpers";

type Asset = { id: string; kind: string; url: string; posterUrl: string; duration: number; width: number; height: number };

async function createDesign(page: Page) {
  const created = await page.request.post("/api/projects", { data: { title: "Video", width: 1080, height: 1080, unit: "px" } });
  const { id } = (await created.json()) as { id: string };
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  return id;
}

async function uploadClip(page: Page, name: string, green: number): Promise<Asset> {
  const base64 = await page.evaluate((g) => window.__opencanva!.makeTestVideo({ width: 320, height: 240, seconds: 3, fps: 30, green: g }), green);
  const response = page.waitForResponse((r) => r.url().endsWith("/api/assets/video") && r.request().method() === "POST");
  await page.getByLabel("Vybrat soubory k nahrání").setInputFiles({ name, mimeType: "video/webm", buffer: Buffer.from(base64, "base64") });
  const res = await response;
  expect(res.status()).toBe(201);
  return (await res.json()) as Asset;
}

/** The clip time a sampled colour shows (tenths of a second, as drawn by makeTestVideo). */
const clipSeconds = (red: number) => Math.round(red / 12) / 10;

test("two video clips play in step with each other and with the page's animations, and survive reload", async ({ page }) => {
  test.slow();
  const projectId = await createDesign(page);
  await openUploads(page);
  const a = await uploadClip(page, "a.webm", 0);
  const b = await uploadClip(page, "b.webm", 200);
  expect(a).toMatchObject({ kind: "video", width: 320, height: 240 });
  expect(a.duration).toBeCloseTo(3, 0);
  // The tile shows the poster and the length.
  await expect(page.locator(`[data-testid=upload-item][data-asset-id="${a.id}"]`).getByLabel("Délka videa")).toHaveText("0:03");

  // Clip a on the left from 0 s, clip b on the right from 1 s in, and a box fading in at 1 s.
  const clip = (asset: Asset, left: number, trimStart: number) => ({
    type: "Image",
    id: asset.id,
    src: asset.posterUrl,
    left,
    top: 100,
    width: 320,
    height: 240,
    scaleX: 1.5,
    scaleY: 1.5,
    video: { src: asset.url, duration: asset.duration, trimStart, trimEnd: asset.duration, muted: true, loop: false },
  });
  const box = { type: "Rect", id: "box", left: 340, top: 700, width: 400, height: 200, fill: "#2563eb", animation: { in: { type: "fade", duration: 200, delay: 1000, easing: "linear", direction: "up" } } };
  const [first] = (await (await page.request.get(`/api/projects/${projectId}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 2, canvasData: { objects: [clip(a, 40, 0), clip(b, 560, 1), box] } } });
  await page.reload();
  await waitForEditor(page);
  // Only asset URLs in the page.
  const saved = await savedObjects(page);
  expect(saved.slice(0, 2).map((o) => [o.src, (o.video as { src: string }).src])).toEqual([
    [a.posterUrl, a.url],
    [b.posterUrl, b.url],
  ]);

  await page.getByRole("button", { name: "Přehrát", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Náhled" });
  await expect(preview).toBeVisible();
  await expect(page.getByTestId("presentation-page")).toHaveCount(1);
  // Sample the clips and the box together, many times while the page plays.
  const samples: { a: number; b: number; boxShown: boolean; bGreen: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const s = await page.getByTestId("presentation-page").evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext("2d")!;
      const at = (x: number, y: number) => Array.from(ctx.getImageData(Math.round((x / 1080) * c.width), Math.round((y / 1080) * c.height), 1, 1).data);
      return { a: at(280, 280), b: at(800, 280), box: at(540, 800) };
    });
    samples.push({ a: clipSeconds(s.a[0]), b: clipSeconds(s.b[0]), bGreen: s.b[1], boxShown: s.box[2] > 180 && s.box[0] < 100 });
    await page.waitForTimeout(50);
  }
  // Both clips are drawn (clip b has its green), and b runs a second ahead of a.
  expect(samples.every((s) => s.bGreen > 150)).toBe(true);
  // The colour code stops at 2.1 s, so b (a second ahead) can be read while a is under 1.1 s.
  const playing = samples.filter((s) => s.a > 0.15 && s.a < 1.05);
  expect(playing.length).toBeGreaterThan(5);
  for (const s of playing) expect(Math.abs(s.b - s.a - 1)).toBeLessThanOrEqual(0.35);
  // The box appears when clip a is about a second in.
  const firstShown = samples.findIndex((s) => s.boxShown);
  expect(firstShown).toBeGreaterThan(0);
  expect(samples[firstShown].a).toBeGreaterThanOrEqual(0.8);
  expect(samples[firstShown].a).toBeLessThanOrEqual(1.6);
  expect(samples.slice(0, firstShown).every((s) => s.a <= 1.3)).toBe(true);
  await preview.getByRole("button", { name: "Zavřít náhled" }).click();

  // A still export shows the posters.
  const { bytes } = await exportFile(page, { format: "PNG", size: "1×" });
  const [posterA] = await pixels(page, bytes, [[280 / 1080, 280 / 1080]]);
  expect(posterA[1]).toBeLessThan(50);
});

test("trim, sound and loop are set in the toolbar and saved", async ({ page }) => {
  await createDesign(page);
  await openUploads(page);
  const a = await uploadClip(page, "trim.webm", 100);
  await page.locator(`[data-testid=upload-item][data-asset-id="${a.id}"]`).locator("button").first().click();
  await expect.poll(async () => (await savedObjects(page))[0]?.video).toMatchObject({ src: a.url, trimStart: 0, muted: false, loop: false });
  await page.getByRole("button", { name: "Zkrátit video" }).click();
  const start = page.getByRole("spinbutton", { name: "Začátek (s)" });
  await start.fill("0.5");
  await start.press("Enter");
  const end = page.getByRole("spinbutton", { name: "Konec (s)" });
  await end.fill("2");
  await end.press("Enter");
  await expect.poll(async () => (await savedObjects(page))[0].video).toMatchObject({ trimStart: 0.5, trimEnd: 2 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Zvuk zapnutý" }).click();
  await page.getByRole("button", { name: "Opakovat" }).click();
  await expect.poll(async () => (await savedObjects(page))[0].video).toMatchObject({ muted: true, loop: true });
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await savedObjects(page))[0].video).toMatchObject({ muted: true, loop: false });

  // The file streams in ranges, as video players ask for it.
  const part = await page.request.get(a.url, { headers: { Range: "bytes=0-99" } });
  expect(part.status()).toBe(206);
  expect(part.headers()["content-range"]).toMatch(/^bytes 0-99\/\d+$/);
  expect((await part.body()).byteLength).toBe(100);
});
