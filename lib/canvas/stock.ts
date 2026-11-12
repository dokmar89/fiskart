import type { AssetDto } from "@/lib/assets";
import { useUploadsStore } from "@/lib/store/uploads";
import { addImageFromAsset } from "./images";

/** Drag type the stock panels use; the data is a StockItem as JSON. */
export const STOCK_DRAG_TYPE = "application/x-opencanva-stock";

export type StockItem = { kind: "photo"; id: number } | { kind: "icon"; name: string } | { kind: "graphic"; id: string };

/**
 * Copies a stock photo or icon into local assets (once; the copy is reused) and returns it.
 * Placing never refers to the provider, so designs keep working without it.
 */
export async function importStock(item: StockItem): Promise<AssetDto> {
  const res =
    item.kind === "photo"
      ? await fetch(`/api/stock/photos/${item.id}`, { method: "POST" })
      : item.kind === "graphic"
        ? await fetch(`/api/graphics/${encodeURIComponent(item.id)}`, { method: "POST" })
        : await fetch("/api/stock/icons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name }) });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Nepodařilo se to přidat.");
  }
  const asset = (await res.json()) as AssetDto;
  // The copy is an ordinary asset and shows up in Uploads.
  useUploadsStore.setState((s) => (s.loaded ? { assets: [asset, ...s.assets.filter((a) => a.id !== asset.id)] } : {}));
  return asset;
}

/** Copies the item and places it on the page, or into the selected frame. */
export async function placeStock(item: StockItem, at?: { x: number; y: number }) {
  const asset = await importStock(item);
  await addImageFromAsset(asset, at);
}
