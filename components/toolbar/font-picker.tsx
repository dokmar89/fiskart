"use client";

import { Check, ChevronDown, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FONT_FILE_ACCEPT } from "@/lib/custom-font-types";
import { isMixed, type Mixed } from "@/lib/canvas/mixed";
import { plural } from "@/lib/plural";
import { FONT_CATALOG, FONT_CATEGORIES, searchFonts, type FontCategory } from "@/lib/fonts";
import { useBrandStore } from "@/lib/store/brand";
import { useFontsStore } from "@/lib/store/fonts";
import { cn } from "@/lib/utils";

const fontStyle = (family: string) => ({ fontFamily: `"${family}", ui-sans-serif` });

function FontRow({ family, selected, onPick, children }: { family: string; selected: boolean; onPick: () => void; children?: React.ReactNode }) {
  return (
    <div className="group flex items-center rounded-md hover:bg-accent">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onPick}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left outline-none focus-visible:bg-accent"
      >
        <Check className={cn("size-3.5 shrink-0", !selected && "invisible")} />
        <span className="flex min-w-0 flex-col truncate" style={fontStyle(family)}>
          <span className="truncate text-sm">{family}</span>
          <span className="truncate text-xs text-muted-foreground">Příliš žluťoučký kůň</span>
        </span>
      </button>
      {children}
    </div>
  );
}

/**
 * Font family control: search, categories, brand fonts and then uploaded fonts first; each name
 * shown in its own face. `trigger` replaces the default button (the brand panel uses it to add a font).
 */
export function FontPicker({
  value,
  onChange,
  trigger,
}: {
  value: Mixed<string> | undefined;
  onChange: (family: string) => void;
  trigger?: React.ReactNode;
}) {
  const { custom, upload, remove, uploading, error, clearError } = useFontsStore();
  const kits = useBrandStore((s) => s.kits);
  const loadBrand = useBrandStore((s) => s.load);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FontCategory | null>(null);
  const [confirm, setConfirm] = useState<{ family: string; uses: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) void loadBrand();
    else {
      setConfirm(null);
      clearError();
    }
  }, [open, clearError, loadBrand]);

  const current = value === undefined || isMixed(value) ? null : value;
  const customFamilies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...new Set(custom.map((f) => f.family))].filter((f) => !q || f.toLowerCase().includes(q));
  }, [custom, query]);
  const brandFamilies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...new Set(kits.flatMap((k) => k.fonts))].filter((f) => !q || f.toLowerCase().includes(q));
  }, [kits, query]);
  const fonts = searchFonts(FONT_CATALOG, query, category);
  const showBrand = category === null && brandFamilies.length > 0;
  const showCustom = category === null && customFamilies.length > 0;

  const pick = (family: string) => {
    onChange(family);
    setOpen(false);
  };

  const deleteFamily = async (family: string, force: boolean) => {
    try {
      const result = await remove(family, force);
      setConfirm(result.deleted ? null : { family, uses: result.uses });
    } catch {
      setConfirm(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="w-40 justify-between px-2 font-normal" aria-label="Písmo">
            <span className="truncate" style={current ? fontStyle(current) : undefined}>
              {current ?? (isMixed(value) ? "Různá" : "Písmo")}
            </span>
            <ChevronDown className="size-4 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2 p-2" align="start">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground" />
          <input
            aria-label="Hledat písma"
            placeholder="Hledat písma"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              const first = showBrand ? brandFamilies[0] : showCustom ? customFamilies[0] : fonts[0]?.family;
              if (e.key === "Enter" && first) pick(first);
            }}
            className="h-8 w-full rounded-md border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus:border-ring dark:bg-input/30"
          />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Kategorie písem">
          {[{ id: null, label: "Vše" }, ...FONT_CATEGORIES].map((c) => (
            <button
              key={c.label}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent",
                category === c.id && "border-foreground/30 bg-accent text-accent-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="-mx-1 max-h-80 overflow-y-auto px-1" role="listbox" aria-label="Písma">
          {showBrand && (
            <div role="group" aria-label="Písma značky">
              <p className="px-2 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">Písma značky</p>
              {brandFamilies.map((family) => (
                <FontRow key={family} family={family} selected={family === current} onPick={() => pick(family)} />
              ))}
            </div>
          )}
          {showCustom && (
            <>
              <p className={cn("px-2 pb-0.5 text-xs font-medium text-muted-foreground", showBrand ? "pt-2" : "pt-1")}>Nahraná</p>
              {customFamilies.map((family) => (
                <FontRow key={family} family={family} selected={family === current} onPick={() => pick(family)}>
                  <button
                    type="button"
                    aria-label={`Smazat ${family}`}
                    title={`Smazat ${family}`}
                    onClick={() => void deleteFamily(family, false)}
                    className="mr-1 hidden rounded p-1 text-muted-foreground group-hover:block hover:text-foreground focus-visible:block"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </FontRow>
              ))}
              <p className="px-2 pt-2 pb-0.5 text-xs font-medium text-muted-foreground">Vestavěná</p>
            </>
          )}
          {showBrand && !showCustom && <p className="px-2 pt-2 pb-0.5 text-xs font-medium text-muted-foreground">Vestavěná</p>}
          {fonts.map((f) => (
            <FontRow key={f.family} family={f.family} selected={f.family === current} onPick={() => pick(f.family)} />
          ))}
          {fonts.length === 0 && !showCustom && !showBrand && <p className="px-2 py-3 text-sm text-muted-foreground">Žádné písmo neodpovídá.</p>}
        </div>
        {confirm && (
          <div className="grid gap-2 rounded-md border p-2 text-xs" role="alert">
            <p>
              Písmo {confirm.family} je použito na {confirm.uses} {plural(confirm.uses, "stránce", "stránkách", "stránkách")}. Jeho text se zobrazí náhradním písmem.
            </p>
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                Zrušit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void deleteFamily(confirm.family, true)}>
                Přesto smazat
              </Button>
            </div>
          </div>
        )}
        {error && <p className="px-1 text-xs text-destructive" role="alert">{error}</p>}
        <input
          ref={fileInput}
          type="file"
          accept={FONT_FILE_ACCEPT}
          multiple
          hidden
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            for (const file of files) await upload(file);
          }}
        />
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <Upload />
          {uploading ? "Nahrávám…" : "Nahrát písmo"}
        </Button>
        <p className="px-1 text-[11px] text-muted-foreground">TTF, OTF nebo WOFF2. Pokud má písmo tučný a kurzívní řez, nahrajte i ty.</p>
      </PopoverContent>
    </Popover>
  );
}
