"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEditorInstance } from "@/lib/canvas/instance";
import { saveDesignAsTemplate } from "@/lib/canvas/templates";
import { useEditorStore } from "@/lib/store/editor";
import { useTemplatesStore } from "@/lib/store/templates";
import { parseTags, TEMPLATE_CATEGORIES } from "@/lib/templates";
import type { Unit } from "@/lib/units";

/** The built-in category of the design's size, if it has one. */
function categoryForSize(): string {
  const artboard = getEditorInstance()?.artboard;
  if (!artboard) return "";
  const sizes: Record<string, string> = {
    "1080x1080": "Příspěvek na Instagram",
    "1080x1920": "Příběh na Instagram",
    "1920x1080": "Prezentace",
    "1280x720": "Miniatura pro YouTube",
  };
  return sizes[`${Math.round(artboard.width)}x${Math.round(artboard.height)}`] ?? "";
}

/** Saves every page of the open design as a template of its own, shown first in the gallery. */
export function SaveTemplateDialog({
  open,
  onOpenChange,
  unit,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: Unit;
  categories: string[];
}) {
  const projectTitle = useEditorStore((s) => s.projectTitle);
  const added = useTemplatesStore((s) => s.added);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(projectTitle);
    setCategory(categoryForSize());
    setTags("");
    setError(null);
  }, [open, projectTitle]);

  const suggestions = [...new Set([...TEMPLATE_CATEGORIES, ...categories])];

  async function save() {
    setPending(true);
    setError(null);
    try {
      added(await saveDesignAsTemplate({ title: title.trim(), category: category.trim(), tags: parseTags(tags) }, unit));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Šablonu se nepodařilo uložit.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Uložit jako šablonu</DialogTitle>
          <DialogDescription>Všechny stránky tohoto návrhu se stanou šablonou v galerii. Samotný návrh se nezmění.</DialogDescription>
        </DialogHeader>
        <form
          id="save-template"
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="template-title">Název</Label>
            <Input id="template-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-category">Kategorie</Label>
            <Input id="template-category" list="template-categories" value={category} onChange={(e) => setCategory(e.target.value)} required maxLength={200} />
            <datalist id="template-categories">
              {suggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-tags">Štítky</Label>
            <Input id="template-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="výprodej, léto, obchod" />
            <p className="text-xs text-muted-foreground">Oddělené čárkami. Vyhledávání najde šablony podle názvu a štítků.</p>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Zrušit
          </Button>
          <Button type="submit" form="save-template" disabled={pending || !title.trim() || !category.trim()}>
            {pending ? "Ukládám…" : "Uložit šablonu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
