"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findInDesign, replaceInDesign } from "@/lib/canvas/find";
import { plural } from "@/lib/plural";
import { useEditorStore } from "@/lib/store/editor";

/** Find and replace text on every page (text boxes, curved text, table cells). */
export function FindReplaceDialog() {
  const open = useEditorStore((s) => s.findOpen);
  const ready = useEditorStore((s) => s.loadState === "ready");
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [counts, setCounts] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setCounts(query ? findInDesign(query, { matchCase }) : []);
  }, [open, query, matchCase]);

  const total = counts.reduce((a, b) => a + b, 0);
  const onPages = counts.map((c, i) => (c > 0 ? i + 1 : 0)).filter((n) => n > 0);

  async function replaceAll() {
    if (!query || total === 0 || busy) return;
    setBusy(true);
    try {
      const replaced = await replaceInDesign(query, replacement, { matchCase });
      setMessage(`Nahrazeno: ${replaced} ${plural(replaced, "výskyt", "výskyty", "výskytů")}.`);
      setCounts(findInDesign(query, { matchCase }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nahrazení se nezdařilo.");
    } finally {
      setBusy(false);
    }
  }

  let status = "Zadejte hledaný text.";
  if (query && total === 0) status = "Nic nenalezeno.";
  if (query && total > 0) status = `${total} ${plural(total, "výskyt", "výskyty", "výskytů")} na ${onPages.length === 1 ? "stránce" : "stránkách"} ${onPages.join(", ")}.`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        useEditorStore.setState({ findOpen: next });
        if (!next) setMessage(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Najít a nahradit" title="Najít a nahradit (Ctrl+F)" disabled={!ready}>
          <Search />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Najít a nahradit</DialogTitle>
          <DialogDescription>Hledá v textu na všech stránkách tohoto návrhu.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void replaceAll();
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor="find-text">Najít</Label>
            <Input
              id="find-text"
              value={query}
              autoFocus
              onChange={(e) => {
                setQuery(e.target.value);
                setMessage(null);
              }}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="replace-text">Nahradit za</Label>
            <Input id="replace-text" value={replacement} onChange={(e) => setReplacement(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
            Rozlišovat velikost písmen
          </label>
          <p className="text-sm text-muted-foreground" role="status" aria-label="Výskyty">
            {status}
          </p>
          {message && <p className="text-sm">{message}</p>}
          <Button type="submit" disabled={!query || total === 0 || busy}>
            {busy ? "Nahrazuji…" : "Nahradit vše"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
