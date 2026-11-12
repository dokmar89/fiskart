"use client";

import { QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { updateQrCode, type QrSettings } from "@/lib/canvas/qr";
import { ToolButton } from "./controls";

/** Edits a QR code: what it holds, its colours and margin. Applied with Update (each update stores a new SVG). */
export function QrTools({ qr }: { qr: QrSettings }) {
  const [draft, setDraft] = useState(qr);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(qr), [qr]);
  const changed = JSON.stringify(draft) !== JSON.stringify(qr);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolButton label="Upravit QR kód">
          <QrCode />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent className="grid w-72 gap-3" align="start">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Odkaz nebo text
          <Input aria-label="Obsah QR kódu" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
        </label>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            Barva
            <input aria-label="Barva QR kódu" type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border bg-transparent" />
          </label>
          <label className="flex items-center gap-1.5">
            Pozadí
            <input
              aria-label="Pozadí QR kódu"
              type="color"
              value={draft.background ?? "#ffffff"}
              disabled={draft.background === null}
              onChange={(e) => setDraft({ ...draft, background: e.target.value })}
              className="h-7 w-9 cursor-pointer rounded border bg-transparent disabled:opacity-40"
            />
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={draft.background === null} onChange={(e) => setDraft({ ...draft, background: e.target.checked ? null : "#ffffff" })} />
            Žádné
          </label>
        </div>
        <div className="grid gap-1.5 text-xs text-muted-foreground">
          <span>Okraj: {draft.margin}</span>
          <Slider aria-label="Okraj QR kódu" value={[draft.margin]} min={0} max={8} step={1} onValueChange={([margin]) => setDraft({ ...draft, margin })} />
        </div>
        <p className="text-[11px] text-muted-foreground">Nejlépe se načítá tmavý kód na světlém pozadí; nechte kolem něj okraj.</p>
        <Button
          size="sm"
          disabled={!changed || !draft.text.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await updateQrCode(draft);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Aktualizuji…" : "Aktualizovat"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
