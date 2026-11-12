"use client";

import { Check, CloudOff, Loader2 } from "lucide-react";
import { retrySave } from "@/lib/canvas/document";
import { useEditorStore } from "@/lib/store/editor";

export function SaveIndicator() {
  const status = useEditorStore((s) => s.saveStatus);

  return (
    <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground" role="status" data-testid="save-status">
      {status === "saved" && (
        <>
          <Check className="size-3.5" />
          Uloženo
        </>
      )}
      {(status === "pending" || status === "saving") && (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Ukládám…
        </>
      )}
      {status === "failed" && (
        <>
          <CloudOff className="size-3.5 text-destructive" />
          <span className="text-destructive">Uložení selhalo</span>
          <button type="button" className="font-medium text-foreground underline" onClick={() => void retrySave()}>
            Zkusit znovu
          </button>
        </>
      )}
    </div>
  );
}
