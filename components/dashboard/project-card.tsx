"use client";

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export type ProjectCardData = {
  id: string;
  title: string;
  /** Aspect ratio of the page, width / height. */
  aspect: number;
  meta: string;
  thumbnailUrl: string | null;
};

async function request(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
      return true;
    } catch {
      setError(failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const rename = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const ok = await run(
      () => request(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      }),
      "Návrh se nepodařilo přejmenovat.",
    );
    if (ok) setRenameOpen(false);
  };

  const duplicate = () => run(() => request(`/api/projects/${project.id}/duplicate`, { method: "POST" }), "Návrh se nepodařilo duplikovat.");

  const remove = async () => {
    const ok = await run(() => request(`/api/projects/${project.id}`, { method: "DELETE" }), "Návrh se nepodařilo smazat.");
    if (ok) setDeleteOpen(false);
  };

  return (
    <li className="group" data-testid="project-card">
      <div className="relative">
        <Link href={`/design/${project.id}`} className="block rounded-lg focus-visible:outline-2">
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-muted p-4 transition-colors group-hover:border-ring">
            {project.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local route serves these; next/image would only re-encode them
              <img src={project.thumbnailUrl} alt="" className="max-h-full max-w-full object-contain shadow-sm" />
            ) : (
              <div
                className="max-h-full max-w-full bg-background shadow-sm"
                style={{ aspectRatio: project.aspect, [project.aspect >= 1 ? "width" : "height"]: "100%" }}
              />
            )}
          </div>
          <div className="mt-2 truncate pr-8 text-sm font-medium">{project.title}</div>
          <div className="truncate pr-8 text-xs text-muted-foreground">{project.meta}</div>
        </Link>
  
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-1 right-0 size-7"
              aria-label={`Akce pro ${project.title}`}
              disabled={busy}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setTitle(project.title);
                setRenameOpen(true);
              }}
            >
              <Pencil /> Přejmenovat
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void duplicate()}>
              <Copy /> Duplikovat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 /> Smazat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && <p className="mt-1 text-xs text-destructive" role="alert">{error}</p>}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Přejmenovat návrh</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void rename();
            }}
            className="grid gap-4"
          >
            <Input aria-label="Název" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <DialogFooter>
              <Button type="submit" disabled={busy || !title.trim()}>Uložit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat „{project.title}“?</AlertDialogTitle>
            <AlertDialogDescription>Návrh i všechny jeho stránky budou trvale smazány. Tuto akci nelze vrátit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                // Keep the dialog open until the delete has gone through.
                e.preventDefault();
                void remove();
              }}
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
