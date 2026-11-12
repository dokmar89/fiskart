"use client";

import { ChevronLeft, Redo2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { flushSave, redo, undo } from "@/lib/canvas/document";
import { useEditorStore } from "@/lib/store/editor";
import { ProjectTitle, waitForRename } from "./project-title";
import type { EditorProject } from "./editor";
import { ExportDialog } from "./export-dialog";
import { FindReplaceDialog } from "./find-replace-dialog";
import { PresentButton } from "./presentation";
import { ResizeDialog } from "./resize-dialog";
import { SaveIndicator } from "./save-indicator";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function HistoryButton({ label, keys, disabled, onClick, children }: {
  label: string;
  keys: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={label} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} <span className="text-muted-foreground">{keys}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function TopBar({ project }: { project: EditorProject }) {
  const router = useRouter();
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const [leaving, setLeaving] = useState(false);
  const mod = isMac() ? "⌘" : "Ctrl+";

  async function goHome() {
    setLeaving(true);
    await Promise.all([flushSave(), waitForRename()]);
    const { saveStatus } = useEditorStore.getState();
    if (saveStatus === "failed" && !window.confirm("Poslední změny nejsou uložené. Přesto odejít?")) {
      setLeaving(false);
      return;
    }
    router.push("/");
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-background px-2">
      <Button variant="ghost" size="sm" onClick={goHome} disabled={leaving}>
        <ChevronLeft />
        Domů
      </Button>
      <div className="mx-1 h-5 w-px bg-border" />
      <HistoryButton label="Zpět" keys={`${mod}Z`} disabled={!canUndo} onClick={() => void undo()}>
        <Undo2 />
      </HistoryButton>
      <HistoryButton label="Znovu" keys={`${mod}Shift+Z`} disabled={!canRedo} onClick={() => void redo()}>
        <Redo2 />
      </HistoryButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ProjectTitle projectId={project.id} initialTitle={project.title} />
      <div className="flex-1" />
      <SaveIndicator />
      <FindReplaceDialog />
      <ThemeToggle />
      <PresentButton />
      <ResizeDialog design={project} />
      <ExportDialog artboard={{ width: project.width, height: project.height }} />
    </header>
  );
}
