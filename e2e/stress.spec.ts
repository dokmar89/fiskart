import { expect, test, type Page } from "@playwright/test";
import { STRESS_PAGE, stressObjects } from "../scripts/stress-data";
import { objectCount, objects, toClient, waitForEditor } from "./helpers";

/** Frames the browser painted while the mouse dragged from `from` 300 px to the right over about a second. */
async function framesWhileDragging(page: Page, from: { x: number; y: number }) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __counting: boolean };
    w.__frames = 0;
    w.__counting = true;
    const tick = () => {
      if (!w.__counting) return;
      w.__frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const started = Date.now();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 60; i++) {
    await page.mouse.move(from.x + i * 5, from.y + (i % 2));
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const seconds = (Date.now() - started) / 1000;
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __counting: boolean };
    w.__counting = false;
    return w.__frames;
  });
  return frames / seconds;
}

test("a 200-object page loads and drags without stalling", async ({ page }) => {
  test.setTimeout(90_000);
  const created = await page.request.post("/api/projects", {
    data: { title: "Stress test", ...STRESS_PAGE, unit: "px" },
  });
  const { id } = (await created.json()) as { id: string };
  const [first] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { id: string }[];
  const saved = await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 1, canvasData: { objects: stressObjects() } } });
  expect(saved.status()).toBe(204);
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
  expect(await objectCount(page)).toBe(200);

  // One object across a full page of snap targets.
  const one = (await objects(page))[42];
  const fpsOne = await framesWhileDragging(page, await toClient(page, one.center));

  // Everything at once.
  await page.keyboard.press("ControlOrMeta+a");
  const fpsAll = await framesWhileDragging(page, await toClient(page, (await objects(page))[105].center));

  console.log(`Drag frame rate on 200 objects (dev server, headless): one object ${fpsOne.toFixed(0)} fps, all objects ${fpsAll.toFixed(0)} fps`);
  test.info().annotations.push({ type: "fps", description: `one ${fpsOne.toFixed(0)}, all ${fpsAll.toFixed(0)}` });
  // A loose floor: this guards against a stall, the smoothness itself is judged by eye.
  expect(fpsOne).toBeGreaterThan(15);
  expect(fpsAll).toBeGreaterThan(15);
});
