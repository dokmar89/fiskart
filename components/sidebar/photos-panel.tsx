"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { placeStock, STOCK_DRAG_TYPE, type StockItem } from "@/lib/canvas/stock";
import { useStockStore } from "@/lib/store/stock";

function MissingKey() {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground" role="note">
      <p className="font-medium text-foreground">Fotobanka není nastavena</p>
      <p>
        Fotky pocházejí z Pexels, který vyžaduje bezplatný API klíč. Vytvořte ho na{" "}
        <a className="underline" href="https://www.pexels.com/api/" target="_blank" rel="noreferrer">
          pexels.com/api
        </a>
        , nastavte <code className="font-mono">PEXELS_API_KEY</code> v prostředí serveru (soubor <code className="font-mono">.env</code>)
        a restartujte aplikaci.
      </p>
      <p>Klíč zůstává na serveru; vyhledávání prochází přes něj.</p>
    </div>
  );
}

export function PhotosPanel() {
  const { photos, searchPhotos } = useStockStore();
  const [draft, setDraft] = useState(photos.query);
  const [placing, setPlacing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (useStockStore.getState().photos.status === "idle") void searchPhotos("");
  }, [searchPhotos]);

  async function place(id: number) {
    setPlacing(id);
    setError(null);
    try {
      await placeStock({ kind: "photo", id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotku se nepodařilo přidat.");
    } finally {
      setPlacing(null);
    }
  }

  return (
    <div className="grid gap-3 p-3">
      <form
        className="relative"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void searchPhotos(draft.trim());
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Hledat fotky" placeholder="Hledat fotky" value={draft} onChange={(e) => setDraft(e.target.value)} className="pl-8" />
      </form>

      {photos.status === "missing-key" && <MissingKey />}
      {photos.status === "error" && (
        <div className="grid gap-2 text-xs text-destructive" role="alert">
          {photos.error}
          <Button variant="outline" size="sm" onClick={() => void searchPhotos(photos.query)}>
            Zkusit znovu
          </Button>
        </div>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {photos.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2" aria-label="Fotky">
          {photos.photos.map((photo) => {
            const item: StockItem = { kind: "photo", id: photo.id };
            return (
              <button
                key={photo.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(STOCK_DRAG_TYPE, JSON.stringify(item));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => void place(photo.id)}
                disabled={placing !== null}
                aria-label={`Přidat fotku: ${photo.alt || `autor ${photo.photographer}`}`}
                title={`Fotka: ${photo.photographer}, Pexels`}
                data-testid="stock-photo"
                className="relative overflow-hidden rounded-md border hover:border-ring disabled:cursor-wait"
                style={{ aspectRatio: photo.width && photo.height ? `${photo.width} / ${photo.height}` : "1", background: photo.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a remote preview; nothing for next/image to add */}
                <img src={photo.thumb} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
                {placing === photo.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Loader2 className="size-5 animate-spin" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {photos.status === "ready" && photos.photos.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">Žádné fotky nenalezeny.</p>
      )}
      {photos.status === "loading" && <p className="py-2 text-center text-xs text-muted-foreground">Načítám…</p>}
      {photos.status === "ready" && photos.hasMore && (
        <Button variant="outline" size="sm" onClick={() => void searchPhotos(photos.query, true)}>
          Načíst další
        </Button>
      )}
      <p className="text-[11px] text-muted-foreground">
        Fotky poskytuje{" "}
        <a className="underline" href="https://www.pexels.com" target="_blank" rel="noreferrer">
          Pexels
        </a>
        . Použitá fotka se zkopíruje mezi nahrané soubory.
      </p>
    </div>
  );
}
