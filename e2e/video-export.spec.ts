import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { waitForEditor } from "./helpers";

type Obj = Record<string, unknown>;
type Asset = { id: string; url: string; posterUrl: string; duration: number };

async function createDesign(page: Page, pages: { timing: Obj; objects: Obj[] }[]) {
  const created = await page.request.post("/api/projects", { data: { title: "Video export", width: 1080, height: 1080, unit: "px" } });
  const { id } = (await created.json()) as { id: string };
  const [first] = (await (await page.request.get(`/api/projects/${id}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, { data: { schemaVersion: 2, canvasData: pages[0] } });
  for (const [index, data] of pages.slice(1).entries()) {
    await page.request.post(`/api/projects/${id}/pages`, { data: { index: index + 1, canvasData: data } });
  }
  return id;
}

async function openDesign(page: Page, id: string) {
  await page.goto(`/design/${id}`);
  await waitForEditor(page);
}

/** Uploads a test clip (red counts tenths of a second; with a tone when asked) through the app's video route. */
async function uploadClip(page: Page, seconds: number, tone?: number): Promise<Asset> {
  const base64 = await page.evaluate(
    ([s, t]) => window.__opencanva!.makeTestVideo({ width: 320, height: 240, seconds: s, fps: 30, green: 0, tone: t ?? undefined }),
    [seconds, tone ?? null] as const,
  );
  const response = page.waitForResponse((r) => r.url().endsWith("/api/assets/video"));
  await page.getByRole("button", { name: "Nahrané", exact: true }).click();
  await page.getByLabel("Vybrat soubory k nahrání").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: Buffer.from(base64, "base64") });
  return (await (await response).json()) as Asset;
}

async function exportVideo(page: Page, format: "Video" | "GIF", size: "720p" | "1080p", timeout: number) {
  await page.getByRole("button", { name: "Exportovat", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Exportovat" });
  await dialog.getByRole("radio", { name: format, exact: true }).click();
  await dialog.getByRole("radio", { name: size }).click();
  const download = page.waitForEvent("download", { timeout });
  await dialog.getByRole("button", { name: "Stáhnout" }).click();
  const file = await download;
  return { name: file.suggestedFilename(), bytes: await readFile((await file.path())!) };
}

/** Loads a video file in the browser: its length, sound, and the picture at given times and points. */
function inspectVideo(page: Page, bytes: Buffer, mime: string, times: number[], points: { x: number; y: number }[]) {
  return page.evaluate(
    async ([base64, type, ts, pts]) => {
      const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([data], { type }));
      const video = document.createElement("video");
      video.muted = true;
      video.src = url;
      await new Promise((r) => video.addEventListener("loadeddata", r, { once: true }));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      const frames: number[][][] = [];
      for (const t of ts) {
        video.currentTime = t;
        await new Promise((r) => video.addEventListener("seeked", r, { once: true }));
        ctx.drawImage(video, 0, 0);
        frames.push(pts.map((p) => Array.from(ctx.getImageData(Math.round(p.x * canvas.width), Math.round(p.y * canvas.height), 1, 1).data)));
      }
      let loudness: number[] = [];
      try {
        const audio = await new AudioContext().decodeAudioData(data.buffer.slice(0));
        const ch = audio.getChannelData(0);
        // Loudness per second.
        loudness = Array.from({ length: Math.floor(audio.duration) }, (_, s) => {
          let sum = 0;
          for (let i = s * audio.sampleRate; i < (s + 1) * audio.sampleRate; i++) sum += ch[i] * ch[i];
          return Math.sqrt(sum / audio.sampleRate);
        });
      } catch {
        loudness = [];
      }
      return { duration: video.duration, width: video.videoWidth, height: video.videoHeight, frames, loudness };
    },
    [bytes.toString("base64"), mime, times, points] as const,
  );
}

const box = (fill: string, extra: Obj = {}) => ({ type: "Rect", left: 140, top: 640, width: 800, height: 300, fill, ...extra });

test("a 30-second 1080p design of three animated pages with a clip exports as one file of the right length, with the clip's sound", async ({ page }) => {
  test.setTimeout(600_000);
  const projectId = await createDesign(page, [{ timing: {}, objects: [] }]);
  await openDesign(page, projectId);
  const clip = await uploadClip(page, 3, 440);
  const fade = { in: { type: "fade", duration: 800, delay: 300, easing: "linear", direction: "up" } };
  const slide = { in: { type: "slide", duration: 800, delay: 200, easing: "ease-out", direction: "left" } };
  const timing = (transition: string) => ({ duration: 10_000, transition: { type: transition, duration: 600 } });
  const [first] = (await (await page.request.get(`/api/projects/${projectId}/pages`)).json()) as { id: string }[];
  await page.request.put(`/api/pages/${first.id}`, {
    data: {
      schemaVersion: 2,
      canvasData: {
        timing: timing("none"),
        objects: [
          { type: "Image", src: clip.posterUrl, left: 300, top: 100, width: 320, height: 240, scaleX: 1.5, scaleY: 1.5, video: { src: clip.url, duration: clip.duration, trimStart: 0, trimEnd: clip.duration, muted: false, loop: false } },
          box("#2563eb", { animation: fade }),
        ],
      },
    },
  });
  await page.request.post(`/api/projects/${projectId}/pages`, { data: { index: 1, canvasData: { timing: timing("fade"), objects: [box("#16a34a", { animation: slide })] } } });
  await page.request.post(`/api/projects/${projectId}/pages`, { data: { index: 2, canvasData: { timing: timing("push"), objects: [box("#dc2626", { animation: fade })] } } });
  await openDesign(page, projectId);

  // Heap use is sampled while the export runs.
  const heap: number[] = [];
  const sampling = setInterval(() => {
    void page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0).then((n) => heap.push(n), () => {});
  }, 1000);
  const started = Date.now();
  const file = await exportVideo(page, "Video", "1080p", 540_000).finally(() => clearInterval(sampling));
  const seconds = (Date.now() - started) / 1000;
  console.log(`Exported ${file.name}, ${(file.bytes.length / 1024 / 1024).toFixed(1)} MB in ${seconds.toFixed(0)} s, peak JS heap ${(Math.max(...heap) / 1024 / 1024).toFixed(0)} MB`);
  // This Chromium has no H.264 encoder, so the export falls back to WebM.
  expect(file.name).toMatch(/\.(mp4|webm)$/);
  const mime = file.name.endsWith(".mp4") ? "video/mp4" : "video/webm";
  const info = await inspectVideo(page, file.bytes, mime, [5, 15, 25], [{ x: 0.5, y: 0.73 }]);
  expect(info.width).toBe(1080);
  expect(info.height).toBe(1080);
  expect(info.duration).toBeGreaterThan(29.8);
  expect(info.duration).toBeLessThan(30.2);
  // Each page's box, in its colour, in the middle of its ten seconds.
  expect(info.frames.map((f) => f[0].slice(0, 3))).toEqual([
    [expect.closeTo(37, -1.5), expect.closeTo(99, -1.5), expect.closeTo(235, -1.5)],
    [expect.closeTo(22, -1.5), expect.closeTo(163, -1.5), expect.closeTo(74, -1.5)],
    [expect.closeTo(220, -1.5), expect.closeTo(38, -1.5), expect.closeTo(38, -1.5)],
  ]);
  // The clip's tone plays for its three seconds on the first page, then silence.
  expect(info.loudness.length).toBeGreaterThanOrEqual(29);
  expect(info.loudness[1]).toBeGreaterThan(0.1);
  expect(info.loudness[6]).toBeLessThan(0.01);
  expect(Math.max(...heap)).toBeLessThan(800 * 1024 * 1024);
});

test("exported frames match the preview at the same times, and GIF export makes an animated GIF", async ({ page }) => {
  test.setTimeout(240_000);
  const slide = { in: { type: "slide", duration: 1000, delay: 0, easing: "linear", direction: "left" } };
  const projectId = await createDesign(page, [
    { timing: { duration: 2000 }, objects: [box("#2563eb", { animation: slide })] },
    { timing: { duration: 2000 }, objects: [box("#f59e0b", { animation: { in: { ...slide.in, type: "rise" } } })] },
  ]);
  await openDesign(page, projectId);
  const file = await exportVideo(page, "Video", "720p", 180_000);
  const mime = file.name.endsWith(".mp4") ? "video/mp4" : "video/webm";
  const points = [{ x: 200, y: 790 }, { x: 540, y: 790 }, { x: 900, y: 790 }, { x: 540, y: 700 }];
  const times = [0.3, 0.6, 1.5, 2.3, 3.5];
  const info = await inspectVideo(page, file.bytes, mime, times, points.map((p) => ({ x: p.x / 1080, y: p.y / 1080 })));
  expect(info.duration).toBeCloseTo(4, 0);
  for (const [i, t] of times.entries()) {
    const pageIndex = t < 2 ? 0 : 1;
    const preview = await page.evaluate(([index, ms, pts]) => window.__opencanva!.framePixels(index, ms, 720 / 1080, pts), [pageIndex, (t - pageIndex * 2) * 1000, points] as const);
    for (const [j, expected] of preview.entries()) {
      const got = info.frames[i][j];
      for (let k = 0; k < 3; k++) expect(Math.abs(got[k] - expected[k]), `t=${t} point ${j}`).toBeLessThanOrEqual(40);
    }
  }

  const gif = await exportVideo(page, "GIF", "720p", 180_000);
  expect(gif.name).toMatch(/\.gif$/);
  expect(gif.bytes.subarray(0, 6).toString("ascii")).toBe("GIF89a");
  const frames = await page.evaluate(async (base64) => {
    const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const decoder = new ImageDecoder({ data, type: "image/gif" });
    await decoder.tracks.ready;
    return decoder.tracks.selectedTrack!.frameCount;
  }, gif.bytes.toString("base64"));
  expect(frames).toBe(120);
});

test("a video export can be cancelled", async ({ page }) => {
  const projectId = await createDesign(page, [{ timing: { duration: 20_000 }, objects: [box("#2563eb")] }]);
  await openDesign(page, projectId);
  await page.getByRole("button", { name: "Exportovat", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Exportovat" });
  await dialog.getByRole("radio", { name: "Video", exact: true }).click();
  await expect(dialog.getByTestId("export-summary")).toContainText("20 s při 30 fps");
  let downloaded = false;
  page.on("download", () => (downloaded = true));
  await dialog.getByRole("button", { name: "Stáhnout" }).click();
  await expect(dialog.getByRole("progressbar", { name: "Průběh exportu" })).toBeVisible();
  await expect.poll(async () => Number(await dialog.getByRole("progressbar", { name: "Průběh exportu" }).getAttribute("aria-valuenow"))).toBeGreaterThan(2);
  await dialog.getByRole("button", { name: "Zrušit" }).click();
  await expect(dialog.getByRole("progressbar", { name: "Průběh exportu" })).toBeHidden();
  await page.waitForTimeout(1000);
  expect(downloaded).toBe(false);
});
