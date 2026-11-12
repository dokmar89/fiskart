import { expect, test } from "@playwright/test";
import { makePngFrom } from "../e2e/png";

test("the production build opens a design, removes a background without other hosts, and saves", async ({ page, context }) => {
  test.setTimeout(240_000);
  const outside: string[] = [];
  await context.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => { outside.push(route.request().url()); return route.abort(); });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New design" })).toBeVisible();
  const photo = makePngFrom(320, 320, (x, y) => ((x - 160) ** 2 + (y - 160) ** 2 < 90 ** 2 ? [200, 30, 30] : [235, 235, 235]));
  const form = { file: { name: "disc.png", mimeType: "image/png", buffer: photo } };
  const asset = (await (await page.request.post("/api/assets", { multipart: form })).json()) as { url: string };
  const { id } = (await (await page.request.post("/api/projects", { data: { title: "Smoke", width: 1080, height: 1080, unit: "px" } })).json()) as { id: string };
  const [first] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 1, canvasData: { objects: [{ type: "Image", id: "p", src: asset.url, left: 0, top: 0, width: 320, height: 320, scaleX: 3.375, scaleY: 3.375 }] } } });
  await page.goto(`/design/${id}`);
  await expect(page.getByText("Loading…")).toBeHidden({ timeout: 60_000 });
  await page.waitForTimeout(1000);
  const canvas = page.getByTestId("canvas-viewport");
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("button", { name: "Remove background" }).click();
  await expect(page.getByRole("status", { name: "Background removal" })).toBeHidden({ timeout: 200_000 });
  await expect(page.getByText(/Background removal failed/)).toHaveCount(0);
  await expect.poll(async () => {
    const [p] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { canvasData: { objects: { src: string }[] } }[];
    return p.canvasData.objects[0].src;
  }, { timeout: 20_000 }).not.toBe(asset.url);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  expect(outside).toEqual([]);
});
