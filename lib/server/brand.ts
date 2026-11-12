import "server-only";
import { assetUrl, type AssetDto } from "@/lib/assets";
import type { BrandKitDto, BrandKitInput } from "@/lib/brand";
import { isBuiltInFamily } from "@/lib/fonts";
import { db } from "./db";

type KitRow = { id: string; name: string; colors: string[]; fonts: string[]; logoAssetIds: string[] };

export const kitSelect = { id: true, name: true, colors: true, fonts: true, logoAssetIds: true } as const;

/** Kits with their logos resolved; a logo whose upload was deleted is left out. */
export async function toDtos(kits: KitRow[]): Promise<BrandKitDto[]> {
  const ids = [...new Set(kits.flatMap((k) => k.logoAssetIds))];
  const assets = ids.length
    ? await db.asset.findMany({ where: { id: { in: ids }, kind: { in: ["image", "svg"] } } })
    : [];
  const byId = new Map<string, AssetDto>(
    assets.map((a) => [
      a.id,
      {
        id: a.id,
        kind: a.kind === "svg" ? "svg" : "image",
        url: assetUrl(a.id),
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        width: a.width ?? 0,
        height: a.height ?? 0,
      },
    ]),
  );
  return kits.map((k) => ({
    id: k.id,
    name: k.name,
    colors: k.colors,
    fonts: k.fonts,
    logos: k.logoAssetIds.flatMap((id) => byId.get(id) ?? []),
  }));
}

/** A reason the kit's fonts or logos cannot be stored, or null when they can. */
export async function checkReferences(input: Partial<BrandKitInput>): Promise<string | null> {
  if (input.fonts) {
    const unknown = input.fonts.filter((f) => !isBuiltInFamily(f));
    if (unknown.length) {
      const uploaded = await db.asset.findMany({
        where: { kind: "font", fontFamily: { in: unknown } },
        select: { fontFamily: true },
      });
      const found = new Set(uploaded.map((u) => u.fontFamily));
      const missing = unknown.find((f) => !found.has(f));
      if (missing) return `Písmo ${missing} není v seznamu písem ani mezi nahranými písmy`;
    }
  }
  if (input.logoAssetIds?.length) {
    const count = await db.asset.count({ where: { id: { in: input.logoAssetIds }, kind: { in: ["image", "svg"] } } });
    if (count !== input.logoAssetIds.length) return "Logo musí být nahraný obrázek";
  }
  return null;
}
