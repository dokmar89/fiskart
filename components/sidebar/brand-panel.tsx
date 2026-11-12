"use client";

import { Paintbrush, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { FontPicker } from "@/components/toolbar/font-picker";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACCEPTED_IMAGE_TYPES, type AssetDto } from "@/lib/assets";
import { MAX_BRAND_COLORS, MAX_BRAND_FONTS, MAX_BRAND_LOGOS, type BrandKitDto } from "@/lib/brand";
import { applyBrandColors } from "@/lib/canvas/brand-colors";
import { ASSET_DRAG_TYPE } from "@/lib/canvas/drop";
import { addImageFromAsset } from "@/lib/canvas/images";
import { normalizeHex } from "@/lib/hex";
import { useBrandStore } from "@/lib/store/brand";
import { useUploadsStore } from "@/lib/store/uploads";
import { cn } from "@/lib/utils";

const CHECKERBOARD =
  "bg-[repeating-conic-gradient(#e4e4e7_0_25%,transparent_0_50%)] bg-[length:16px_16px] dark:bg-[repeating-conic-gradient(#3f3f46_0_25%,transparent_0_50%)]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      {children}
    </div>
  );
}

function KitName({ kit }: { kit: BrandKitDto }) {
  const update = useBrandStore((s) => s.update);
  const [draft, setDraft] = useState(kit.name);
  useEffect(() => setDraft(kit.name), [kit.name]);
  const commit = () => {
    const name = draft.trim();
    if (name && name !== kit.name) void update(kit.id, { name });
    else setDraft(kit.name);
  };
  return (
    <input
      aria-label="Název sady značky"
      value={draft}
      maxLength={100}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(kit.name);
          e.currentTarget.blur();
        }
      }}
      className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm font-medium outline-none hover:border-input focus:border-ring"
    />
  );
}

/** Picker for one colour: a new one is added with the button, an existing one changes when the popover closes. */
function ColorEditor({
  initial,
  trigger,
  onDone,
  onRemove,
}: {
  initial: string;
  trigger: React.ReactNode;
  onDone: (hex: string) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [hexText, setHexText] = useState(initial);
  const adding = onRemove === undefined;

  const setColor = (hex: string) => {
    setDraft(hex);
    setHexText(hex);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setColor(initial);
        else if (!adding && draft !== initial) onDone(draft);
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="grid w-60 gap-2" align="start" aria-label={adding ? "Nová barva značky" : "Upravit barvu značky"}>
        <div className="[&_.react-colorful]:w-full">
          <HexColorPicker color={draft} onChange={setColor} />
        </div>
        <input
          aria-label="Barva v hex"
          value={hexText}
          maxLength={7}
          onChange={(e) => {
            setHexText(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) setDraft(hex);
          }}
          onBlur={() => setHexText(draft)}
          onFocus={(e) => e.target.select()}
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 font-mono text-sm uppercase outline-none focus:border-ring dark:bg-input/30"
        />
        <div className="flex justify-end gap-1">
          {onRemove && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
            >
              Odebrat
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              // Closing through onOpenChange would not fire for a programmatic close.
              setOpen(false);
              if (adding || draft !== initial) onDone(draft);
            }}
          >
            {adding ? "Přidat" : "Hotovo"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function KitColors({ kit }: { kit: BrandKitDto }) {
  const update = useBrandStore((s) => s.update);
  const [message, setMessage] = useState<string | null>(null);
  const setColors = (colors: string[]) => void update(kit.id, { colors });

  return (
    <Section title="Barvy">
      <div className="flex flex-wrap gap-1.5" aria-label="Barvy sady">
        {kit.colors.map((color, i) => (
          <ColorEditor
            key={color}
            initial={color}
            onDone={(hex) => {
              // Changing a colour to one the kit already has merges the two.
              setColors(kit.colors.map((c, j) => (j === i ? hex : c)).filter((c, j, all) => all.indexOf(c) === j));
            }}
            onRemove={() => setColors(kit.colors.filter((c) => c !== color))}
            trigger={
              <button
                type="button"
                aria-label={`Barva značky ${color}`}
                title={color}
                className="size-8 rounded-md border shadow-xs"
                style={{ background: color }}
              />
            }
          />
        ))}
        {kit.colors.length < MAX_BRAND_COLORS && (
          <ColorEditor
            initial={kit.colors.at(-1) ?? "#3b82f6"}
            onDone={(hex) => !kit.colors.includes(hex) && setColors([...kit.colors, hex])}
            trigger={
              <button
                type="button"
                aria-label="Přidat barvu"
                title="Přidat barvu"
                className="flex size-8 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-accent"
              >
                <Plus className="size-4" />
              </button>
            }
          />
        )}
      </div>
      {kit.colors.length > 0 && (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="mt-1"
            onClick={() => setMessage(applyBrandColors(kit.colors) ? "Stiskněte znovu pro jinou kombinaci." : "Na této stránce není co přebarvit.")}
          >
            <Paintbrush />
            Použít barvy značky
          </Button>
          {message && <p className="text-[11px] text-muted-foreground">{message}</p>}
        </>
      )}
    </Section>
  );
}

function KitFonts({ kit }: { kit: BrandKitDto }) {
  const update = useBrandStore((s) => s.update);
  return (
    <Section title="Písma">
      {kit.fonts.length > 0 && (
        <ul className="grid gap-0.5" aria-label="Písma sady">
          {kit.fonts.map((family) => (
            <li key={family} className="group flex h-8 items-center gap-2 rounded-md px-2 hover:bg-accent">
              <span className="min-w-0 flex-1 truncate text-[15px]" style={{ fontFamily: `"${family}", ui-sans-serif` }}>
                {family}
              </span>
              <button
                type="button"
                aria-label={`Odebrat ${family}`}
                title={`Odebrat ${family}`}
                onClick={() => void update(kit.id, { fonts: kit.fonts.filter((f) => f !== family) })}
                className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {kit.fonts.length < MAX_BRAND_FONTS && (
        <FontPicker
          value={undefined}
          onChange={(family) => !kit.fonts.includes(family) && void update(kit.id, { fonts: [...kit.fonts, family] })}
          trigger={
            <Button variant="outline" size="sm" className="justify-start">
              <Plus />
              Přidat písmo
            </Button>
          }
        />
      )}
    </Section>
  );
}

/** Choose a logo from the uploads, or upload a new one. */
function AddLogo({ kit }: { kit: BrandKitDto }) {
  const update = useBrandStore((s) => s.update);
  const { assets, loaded, load, upload, pending, error } = useUploadsStore();
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const add = (asset: AssetDto) => {
    setOpen(false);
    if (!kit.logos.some((l) => l.id === asset.id)) void update(kit.id, { logoAssetIds: [...kit.logos.map((l) => l.id), asset.id] });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !loaded) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-start">
          <Plus />
          Přidat logo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="grid w-72 gap-2" align="start" aria-label="Vybrat logo">
        <Button size="sm" variant="outline" disabled={pending > 0} onClick={() => input.current?.click()}>
          <Upload />
          {pending > 0 ? "Nahrávám…" : "Nahrát logo"}
        </Button>
        <input
          ref={input}
          type="file"
          hidden
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          aria-label="Vybrat soubor s logem"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file).then(add, () => {});
          }}
        />
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        <span className="text-xs text-muted-foreground">Z nahraných souborů</span>
        <div className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto" aria-label="Nahrané soubory k výběru">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              aria-label="Použít jako logo"
              data-asset-id={asset.id}
              onClick={() => add(asset)}
              className={cn("flex aspect-square items-center justify-center overflow-hidden rounded-md border p-1 hover:border-ring", CHECKERBOARD)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route; nothing for next/image to add */}
              <img src={asset.url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
            </button>
          ))}
        </div>
        {loaded && assets.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Zatím nic nenahráno.</p>}
      </PopoverContent>
    </Popover>
  );
}

function KitLogos({ kit }: { kit: BrandKitDto }) {
  const update = useBrandStore((s) => s.update);
  return (
    <Section title="Loga">
      {kit.logos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5" aria-label="Loga sady">
          {kit.logos.map((logo) => (
            <div key={logo.id} className="group relative aspect-square" data-testid="brand-logo" data-asset-id={logo.id}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(logo));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => void addImageFromAsset(logo)}
                aria-label="Přidat logo na stránku"
                className={cn("flex size-full items-center justify-center overflow-hidden rounded-md border p-1 hover:border-ring", CHECKERBOARD)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route; nothing for next/image to add */}
                <img src={logo.url} alt="" draggable={false} className="max-h-full max-w-full object-contain" />
              </button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-1 right-1 size-5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Odebrat logo ze sady"
                onClick={() => void update(kit.id, { logoAssetIds: kit.logos.filter((l) => l.id !== logo.id).map((l) => l.id) })}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {kit.logos.length < MAX_BRAND_LOGOS && <AddLogo kit={kit} />}
    </Section>
  );
}

function KitCard({ kit, onDelete }: { kit: BrandKitDto; onDelete: () => void }) {
  return (
    <section className="grid gap-3 rounded-lg border p-2.5" aria-label={`Sada značky ${kit.name}`} data-kit-id={kit.id}>
      <div className="flex items-center gap-1">
        <KitName kit={kit} />
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Smazat sadu značky" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <KitColors kit={kit} />
      <KitFonts kit={kit} />
      <KitLogos kit={kit} />
    </section>
  );
}

/**
 * Brand kits: colours, fonts and logos kept at hand. Kit colours and fonts also head every colour
 * and font picker; logos are placed by clicking or dragging them onto the page.
 */
export function BrandPanel() {
  const { kits, loaded, error, load, create, remove, clearError } = useBrandStore();
  const [toDelete, setToDelete] = useState<BrandKitDto | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-3 p-3">
      {error && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive" role="alert">
          {error}
          <button type="button" className="underline" onClick={clearError}>
            Zavřít
          </button>
        </div>
      )}
      {loaded && kits.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Sada značky drží vaše barvy, písma a loga po ruce. Její barvy a písma se zobrazují na prvním místě v každém výběru barvy a písma.
        </p>
      )}
      {kits.map((kit) => (
        <KitCard key={kit.id} kit={kit} onDelete={() => setToDelete(kit)} />
      ))}
      {loaded && (
        <Button variant="outline" onClick={() => void create(kits.length === 0 ? "Sada značky" : `Sada značky ${kits.length + 1}`)}>
          <Plus />
          Nová sada značky
        </Button>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Sada se odstraní. Návrhy si ponechají své barvy, písma a loga a loga zůstanou mezi nahranými soubory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) void remove(toDelete.id);
                setToDelete(null);
              }}
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
