"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { originalOf } from "@/lib/canvas/ai";
import { getEditorInstance } from "@/lib/canvas/instance";
import { FabricImage } from "fabric";

const VIEW = 440;

/**
 * Paint over what to erase from the selected picture. The strokes become the mask the image
 * service fills in: transparent where painted, opaque elsewhere, at the picture's own size.
 */
export function EraseDialog({ open, onOpenChange, onErase }: { open: boolean; onOpenChange: (open: boolean) => void; onErase: (mask: Blob) => void }) {
  const view = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1);
  const [brush, setBrush] = useState(40);
  const [painted, setPainted] = useState(false);
  const drawing = useRef(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setPainted(false);
    const image = getEditorInstance()?.canvas.getActiveObject();
    if (!(image instanceof FabricImage)) return;
    void originalOf(image).then((original) => {
      const canvas = view.current;
      if (!live || !canvas) return;
      const s = Math.min(VIEW / original.width, VIEW / original.height);
      setScale(s);
      canvas.width = Math.round(original.width * s);
      canvas.height = Math.round(original.height * s);
      canvas.getContext("2d")!.drawImage(original, 0, 0, canvas.width, canvas.height);
      const layer = document.createElement("canvas");
      layer.width = original.width;
      layer.height = original.height;
      strokes.current = layer;
    });
    return () => {
      live = false;
    };
  }, [open]);

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = view.current;
    const layer = strokes.current;
    if (!canvas || !layer) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(239, 68, 68, 0.45)";
    ctx.beginPath();
    ctx.arc(x, y, (brush * scale) / 2, 0, Math.PI * 2);
    ctx.fill();
    const lctx = layer.getContext("2d")!;
    lctx.fillStyle = "#000";
    lctx.beginPath();
    lctx.arc(x / scale, y / scale, brush / 2, 0, Math.PI * 2);
    lctx.fill();
    setPainted(true);
  };

  async function erase() {
    const layer = strokes.current;
    if (!layer) return;
    // Opaque everywhere, cleared where painted.
    const mask = document.createElement("canvas");
    mask.width = layer.width;
    mask.height = layer.height;
    const ctx = mask.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, mask.width, mask.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(layer, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => mask.toBlob(resolve, "image/png"));
    if (blob) onErase(blob);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vymazat z obrázku</DialogTitle>
          <DialogDescription>Přemalujte, co má zmizet. Obrázek a přemalovaná oblast se odešlou obrázkové službě.</DialogDescription>
        </DialogHeader>
        <canvas
          ref={view}
          aria-label="Přemalujte, co se má vymazat"
          className="mx-auto max-w-full cursor-crosshair touch-none rounded border"
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            paint(e);
          }}
          onPointerMove={(e) => drawing.current && paint(e)}
          onPointerUp={() => (drawing.current = false)}
        />
        <div className="grid gap-1.5 text-xs text-muted-foreground">
          <span>Štětec: {brush} px</span>
          <Slider aria-label="Velikost štětce" value={[brush]} min={5} max={200} step={5} onValueChange={([v]) => setBrush(v)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button disabled={!painted} onClick={() => void erase()}>
            Vymazat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
