"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { placeStock, STOCK_DRAG_TYPE, type StockItem } from "@/lib/canvas/stock";
import { GRAPHIC_CATEGORIES, graphicUrl, searchGraphics } from "@/lib/graphics";
import { ICONIFY_CATEGORIES, iconifyCategory, type IconifyCategoryId } from "@/lib/iconify-categories";
import { useStockStore } from "@/lib/store/stock";
import { cn } from "@/lib/utils";

function Tile({
  item,
  label,
  title,
  preview,
  busy,
  disabled,
  onPlace,
  testId,
}: {
  item: StockItem;
  label: string;
  title: string;
  preview: string;
  busy: boolean;
  disabled: boolean;
  onPlace: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData(STOCK_DRAG_TYPE, JSON.stringify(item));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onPlace}
      disabled={disabled}
      aria-label={label}
      title={title}
      data-testid={testId}
      className="relative flex aspect-square items-center justify-center rounded-md border bg-white p-2 hover:border-ring disabled:cursor-wait"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a small preview; nothing for next/image to add */}
      <img src={preview} alt="" loading="lazy" draggable={false} className="size-full object-contain" />
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-4 animate-spin" />
        </span>
      )}
    </button>
  );
}

/** The bundled graphics library and paginated Iconify discovery. */
export function GraphicsPanel() {
  const { icons, searchIcons } = useStockStore();
  const [draft, setDraft] = useState(icons.query);
  const [query, setQuery] = useState(icons.query);
  const [category, setCategory] = useState<string | null>(null);
  const [iconCategory, setIconCategory] = useState<IconifyCategoryId>(iconifyCategory(icons.category).id);
  const [placing, setPlacing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = draft.trim();
      setQuery(next);
      void searchIcons(next, iconCategory);
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, iconCategory, searchIcons]);

  useEffect(() => {
    const node = moreRef.current;
    if (!node || !icons.hasMore || icons.status !== "ready" || icons.query !== query || icons.category !== iconCategory) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void searchIcons(query, iconCategory, true);
    }, { rootMargin: "160px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [icons.hasMore, icons.status, icons.query, icons.category, query, iconCategory, searchIcons]);

  async function place(key: string, item: StockItem) {
    setPlacing(key);
    setError(null);
    try {
      await placeStock(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo se přidat.");
    } finally {
      setPlacing(null);
    }
  }

  const library = searchGraphics(draft).filter((g) => !category || g.category === category);

  return (
    <div className="grid gap-3 p-3">
      <form
        className="relative"
        role="search"
        onSubmit={(e) => e.preventDefault()}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Hledat grafiku" placeholder="Hledat grafiku a ikony" value={draft} onChange={(e) => setDraft(e.target.value)} className="pl-8" />
      </form>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <section className="grid gap-2" aria-label="Online ikony">
        <h2 className="text-xs font-medium text-muted-foreground">Ikony Iconify</h2>
        <div className="flex flex-wrap gap-1 pb-1" role="group" aria-label="Kategorie online ikon">
          {ICONIFY_CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={iconCategory === item.id}
              onClick={() => setIconCategory(item.id)}
              className={cn("shrink-0 rounded-full border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent", iconCategory === item.id && "border-ring bg-accent text-foreground")}
            >
              {item.label}
            </button>
          ))}
        </div>
        {(icons.status === "idle" || icons.status === "loading") && icons.icons.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Načítám ikony…</p>}
        {icons.status === "error" && <p className="text-xs text-destructive" role="alert">{icons.error}</p>}
        {icons.status === "error" && <button type="button" className="w-fit text-xs underline" onClick={() => void searchIcons(query, iconCategory, icons.icons.length > 0)}>Zkusit znovu</button>}
        {icons.status === "ready" && icons.icons.length === 0 && <p className="text-xs text-muted-foreground">Žádné ikony nenalezeny.</p>}
        {icons.icons.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {icons.icons.map((icon) => (
              <Tile
                key={icon.name}
                item={{ kind: "icon", name: icon.name }}
                label={`Přidat ikonu ${icon.name}`}
                title={`${icon.name} · ${icon.set} (${icon.license})`}
                preview={icons.previews[icon.name] ?? ""}
                busy={placing === icon.name}
                disabled={placing !== null || icon.license === "Neznámá licence"}
                onPlace={() => void place(icon.name, { kind: "icon", name: icon.name })}
                testId="stock-icon"
              />
            ))}
          </div>
        )}
        {icons.icons.some((icon) => icon.license === "Neznámá licence") && (
          <p className="text-[11px] text-muted-foreground">Ikony bez uvedené licence nelze vložit.</p>
        )}
        {icons.hasMore && <div ref={moreRef} aria-hidden="true" className="h-px" />}
        {icons.hasMore && (
          <button type="button" disabled={icons.status === "loading"} onClick={() => void searchIcons(query, iconCategory, true)} className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50">
            {icons.status === "loading" ? "Načítám další…" : "Načíst další ikony"}
          </button>
        )}
      </section>

      <section className="grid gap-2" aria-label="Knihovna grafiky">
        <h2 className="text-xs font-medium text-muted-foreground">Knihovna aplikace</h2>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Kategorie knihovny">
          {[null, ...GRAPHIC_CATEGORIES].map((c) => (
            <button
              key={c ?? "all"}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn("rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent", category === c && "border-ring bg-accent text-foreground")}
            >
              {c ?? "Vše"}
            </button>
          ))}
        </div>
        {library.length > 0 ? (
          <div className="grid grid-cols-4 gap-1.5">
            {library.map((g) => (
              <Tile
                key={g.id}
                item={{ kind: "graphic", id: g.id }}
                label={`Přidat grafiku ${g.name}`}
                title={g.name}
                preview={graphicUrl(g.id)}
                busy={placing === g.id}
                disabled={placing !== null}
                onPlace={() => void place(g.id, { kind: "graphic", id: g.id })}
                testId="library-graphic"
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">V knihovně neodpovídá žádná grafika.</p>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground">
        Knihovna je nakreslená pro tuto aplikaci. Ikony pocházejí z{" "}
        <a className="underline" href="https://iconify.design" target="_blank" rel="noreferrer">
          Iconify
        </a>
        ; každá sada má vlastní licenci (zobrazí se po najetí myší). Vše vložené se zkopíruje mezi nahrané soubory a lze to přebarvit.
      </p>
    </div>
  );
}
