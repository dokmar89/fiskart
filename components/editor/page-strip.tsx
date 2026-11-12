"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { finalIndex, type DropTarget } from "@/lib/canvas/layer-order";
import { addPage, deletePage, duplicatePage, goToPage, movePage, pageHasObjects } from "@/lib/canvas/pages";
import type { Size } from "@/lib/canvas/viewport-math";
import { useEditorStore } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

const PAGE_DRAG_TYPE = "application/x-opencanva-page";
/** Tiles fit a 100 × 56 px box, keeping the page's proportions. */
const TILE_BOX = { width: 100, height: 56 };

function tileSize(artboard: Size) {
  const scale = Math.min(TILE_BOX.width / artboard.width, TILE_BOX.height / artboard.height);
  return { width: Math.round(artboard.width * scale), height: Math.round(artboard.height * scale) };
}

function TileAction({ label, onClick, disabled, children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="flex size-6 items-center justify-center rounded bg-background/90 text-muted-foreground shadow-sm hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function PageTile({ pageId, index, count, size, dropTarget, onDragTarget, onDragEnd, onDelete }: {
  pageId: string;
  index: number;
  count: number;
  size: { width: number; height: number };
  dropTarget: DropTarget | null;
  onDragTarget: (target: DropTarget | null) => void;
  onDragEnd: () => void;
  onDelete: () => void;
}) {
  const current = useEditorStore((s) => s.currentPageId === pageId);
  const thumb = useEditorStore((s) => s.pageThumbs[pageId]);

  return (
    <li
      className="group relative shrink-0"
      data-testid="page-tile"
      data-page-id={pageId}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PAGE_DRAG_TYPE, JSON.stringify({ id: pageId, from: index }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onDragTarget({ index, position: e.clientX < rect.left + rect.width / 2 ? "before" : "after" });
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(PAGE_DRAG_TYPE);
        if (!raw || !dropTarget) return;
        e.preventDefault();
        const { id, from } = JSON.parse(raw) as { id: string; from: number };
        void movePage(id, finalIndex(from, dropTarget));
        onDragEnd();
      }}
      onDragEnd={onDragEnd}
    >
      {dropTarget?.index === index && (
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 w-0.5 rounded bg-primary",
            dropTarget.position === "before" ? "-left-1.5" : "-right-1.5",
          )}
        />
      )}
      <button
        type="button"
        aria-label={`Stránka ${index + 1}`}
        aria-current={current ? "page" : undefined}
        onClick={() => void goToPage(pageId)}
        style={size}
        className={cn(
          "block overflow-hidden rounded-sm bg-white ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // Offset, so the ring stays visible in dark mode, where it is as light as the page.
          current && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for next/image to optimise */}
        {thumb && <img src={thumb} alt="" draggable={false} className="size-full object-contain" />}
      </button>
      <span className="absolute bottom-0.5 left-1 rounded bg-background/80 px-1 text-[10px] tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
        <TileAction label="Duplikovat stránku" onClick={() => void duplicatePage(pageId)}>
          <Copy className="size-3.5" />
        </TileAction>
        <TileAction label="Smazat stránku" onClick={onDelete} disabled={count <= 1}>
          <Trash2 className="size-3.5" />
        </TileAction>
      </div>
    </li>
  );
}

/** Pages of the design as small previews: click to open, drag to reorder, add, duplicate and delete. */
export function PageStrip({ artboard }: { artboard: Size }) {
  const pageIds = useEditorStore((s) => s.pageIds);
  const pageError = useEditorStore((s) => s.pageError);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const size = tileSize(artboard);

  const requestDelete = (pageId: string) => {
    if (pageHasObjects(pageId)) setConfirmDelete(pageId);
    else void deletePage(pageId);
  };

  return (
    <div className="flex h-[76px] shrink-0 items-center gap-3 border-t bg-background px-3" aria-label="Stránky" role="region">
      <ol
        className="flex min-w-0 items-center gap-3 overflow-x-auto p-1.5"
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
        }}
      >
        {pageIds.map((pageId, index) => (
          <PageTile
            key={pageId}
            pageId={pageId}
            index={index}
            count={pageIds.length}
            size={size}
            dropTarget={dropTarget}
            onDragTarget={setDropTarget}
            onDragEnd={() => setDropTarget(null)}
            onDelete={() => requestDelete(pageId)}
          />
        ))}
      </ol>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Přidat stránku"
            onClick={() => void addPage()}
            style={{ height: size.height, width: Math.max(32, Math.min(size.width, 56)) }}
            className="flex shrink-0 items-center justify-center rounded-sm border border-dashed text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Přidat stránku</TooltipContent>
      </Tooltip>
      {pageError && (
        <p className="text-xs text-destructive" role="alert">
          {pageError}
        </p>
      )}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat stránku {confirmDelete ? pageIds.indexOf(confirmDelete) + 1 : ""}?</AlertDialogTitle>
            <AlertDialogDescription>Stránka i vše na ní bude smazáno. Tuto akci nelze vrátit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) void deletePage(confirmDelete);
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
