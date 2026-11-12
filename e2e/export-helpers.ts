import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";

export type Pick = { format: "PNG" | "JPEG" | "PDF" | "SVG"; size?: "1×" | "2×" | "3×"; dpi?: "96 DPI" | "150 DPI" | "300 DPI"; transparent?: boolean; pages?: string | "all" };

/** Exports through the dialog and returns the downloaded file. */
export async function exportFile(page: Page, pick: Pick, timeout = 30_000) {
  await page.getByRole("button", { name: "Exportovat", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Exportovat" });
  await dialog.getByRole("radio", { name: pick.format, exact: true }).click();
  if (pick.size) await dialog.getByRole("radio", { name: pick.size }).click();
  if (pick.dpi) await dialog.getByRole("radio", { name: pick.dpi }).click();
  if (pick.transparent !== undefined) await dialog.getByLabel("Průhledné pozadí").setChecked(pick.transparent);
  if (pick.pages === "all") await dialog.getByRole("radio", { name: /^Všechny/ }).click();
  else if (pick.pages !== undefined) {
    await dialog.getByRole("radio", { name: "Vybrat" }).click();
    await dialog.getByLabel("Čísla stránek").fill(pick.pages);
  }
  const download = page.waitForEvent("download", { timeout });
  await dialog.getByRole("button", { name: "Stáhnout" }).click();
  const file = await download;
  await expect(dialog).toBeHidden({ timeout });
  return { name: file.suggestedFilename(), bytes: await readFile((await file.path())!) };
}

export function pngSize(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25] };
}

/** Decodes an image in the browser and reads RGBA at the given fractions of its size. */
export async function pixels(page: Page, bytes: Buffer, points: [number, number][]) {
  return page.evaluate(
    async ([base64, pts]) => {
      const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([data]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      return pts.map(([fx, fy]) => Array.from(ctx.getImageData(Math.floor(fx * bitmap.width), Math.floor(fy * bitmap.height), 1, 1).data));
    },
    [bytes.toString("base64"), points] as const,
  );
}
