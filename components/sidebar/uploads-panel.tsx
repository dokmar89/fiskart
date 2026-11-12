"use client";

import { Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, type AssetDto } from "@/lib/assets";
import { ACCEPTED_VIDEO_TYPES, formatClipTime } from "@/lib/video";
import { ASSET_DRAG_TYPE } from "@/lib/canvas/drop";
import { addImageFromAsset } from "@/lib/canvas/images";
import { useUploadsStore } from "@/lib/store/uploads";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

type PendingDelete = { asset: AssetDto; uses: number | null };

export function UploadsPanel() {
  const { assets, loaded, pending, error, load, upload, remove, clearError } = useUploadsStore();
  const input = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toDelete, setToDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const uploadAll = (files: FileList | File[] | null) => {
    for (const file of Array.from(files ?? [])) void upload(file).catch(() => {});
  };

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const result = await remove(toDelete.asset.id, toDelete.uses !== null);
      setToDelete(result.deleted ? null : { asset: toDelete.asset, uses: result.uses });
    } catch {
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={cn("flex min-h-full flex-col gap-3 p-3", dragOver && "bg-accent/50")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(false);
        uploadAll(e.dataTransfer.files);
      }}
    >
      <Button onClick={() => input.current?.click()}>
        <Upload />
        Nahrát soubory
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(",")}
        aria-label="Vybrat soubory k nahrání"
        onChange={(e) => {
          uploadAll(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">Obrázky (PNG, JPEG, WebP, SVG) do 25 MB, videa (MP4, WebM) do 200 MB. Soubory přetáhněte sem nebo na stránku.</p>

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive" role="alert">
          {error}
          <button type="button" className="underline" onClick={clearError}>Zavřít</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2" aria-label="Nahrané">
        {Array.from({ length: pending }, (_, i) => (
          <div key={`pending-${i}`} className="aspect-square animate-pulse rounded-md bg-muted" aria-label="Nahrávám" />
        ))}
        {assets.map((asset) => (
          <div key={asset.id} className="group relative aspect-square" data-testid="upload-item" data-asset-id={asset.id}>
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(asset));
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => void addImageFromAsset(asset)}
              className="flex size-full items-center justify-center overflow-hidden rounded-md border bg-[repeating-conic-gradient(#e4e4e7_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-1 hover:border-ring"
              aria-label="Přidat na stránku"
              data-testid="upload-tile"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route; nothing for next/image to add */}
              <img src={asset.posterUrl ?? asset.url} alt="" loading="lazy" decoding="async" draggable={false} className="max-h-full max-w-full object-contain" />
              {asset.kind === "video" && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white tabular-nums" aria-label="Délka videa">
                  {formatClipTime(asset.duration ?? 0)}
                </span>
              )}
            </button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-1 top-1 size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label="Smazat nahraný soubor"
              onClick={() => setToDelete({ asset, uses: null })}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      {loaded && assets.length === 0 && pending === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">Zatím nic nenahráno.</p>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toDelete?.uses ? "Tento soubor se používá" : "Smazat tento soubor?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.uses
                ? `Vyskytuje se na ${toDelete.uses} ${plural(toDelete.uses, "stránce", "stránkách", "stránkách")}. Po smazání tam zůstane prázdné místo. Tuto akci nelze vrátit.`
                : "Soubor se odstraní z nahraných souborů. Tuto akci nelze vrátit."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {toDelete?.uses ? "Přesto smazat" : "Smazat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
