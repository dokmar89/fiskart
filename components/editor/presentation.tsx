"use client";

import { Play, Presentation as PresentationIcon, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { transitionStyle } from "@/lib/animation";
import { commitHistoryStep, currentPageId, pageSnapshot } from "@/lib/canvas/document";
import { getEditorInstance } from "@/lib/canvas/instance";
import { PagePlayer } from "@/lib/canvas/player";
import type { CanvasData } from "@/lib/page-data";
import { useEditorStore } from "@/lib/store/editor";

type Show = { snapshots: (string | null)[]; artboard: { width: number; height: number } };

const NEXT = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"]);
const PREVIOUS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

/**
 * Plays `player` from `from` to `to` ms in real time, its clips following `clock` (the time the page
 * has been showing, kept in `clock.value`). Resolves true on reaching `to`, false once `current` says
 * another run took over. With `hold`, frames go on at `to` (clips keep playing) until then.
 */
function animate(player: PagePlayer, from: number, to: number, current: () => boolean, clock: { value: number }, hold = false) {
  return new Promise<boolean>((resolve) => {
    const started = performance.now();
    const clockStart = clock.value;
    let reached = false;
    const frame = (now: number) => {
      if (!current()) {
        if (!reached) resolve(false);
        return;
      }
      const elapsed = now - started;
      const t = Math.min(to, from + elapsed);
      clock.value = clockStart + elapsed;
      player.frame(t, clock.value);
      if (t >= to && !reached) {
        reached = true;
        resolve(true);
        if (!hold) return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/** Puts a player's canvas on the stage, fitted and centred. */
function mount(player: PagePlayer, artboard: { width: number; height: number }) {
  const el = player.canvas.getElement();
  el.setAttribute("data-testid", "presentation-page");
  el.className = "absolute inset-0 m-auto max-h-full max-w-full";
  el.style.width = "";
  el.style.height = "";
  el.style.aspectRatio = `${artboard.width} / ${artboard.height}`;
  return el;
}

/** The design's pages as they are now (the open page's latest edits included). */
function currentShow(): { show: Show; start: number } | null {
  const editor = getEditorInstance();
  if (!editor) return null;
  commitHistoryStep();
  const pages = useEditorStore.getState().pageIds;
  const current = currentPageId();
  return {
    show: { snapshots: pages.map((id) => pageSnapshot(id)), artboard: { ...editor.artboard } },
    start: Math.max(0, current ? pages.indexOf(current) : 0),
  };
}

/**
 * Plays pages: each page's animations run when it is shown and stop before its exits; moving on
 * plays the exits, then the next page's transition. `single` previews one page from start to end.
 */
function Player({ show, start, single, onClose }: { show: Show; start: number; single: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const players = useRef(new Map<number, Promise<PagePlayer | null>>());
  const [index, setIndex] = useState(start);
  const [ended, setEnded] = useState(false);
  const run = useRef(0);
  // How long the page on show has been showing, for its clips.
  const clock = useRef({ value: 0 });
  const showing = useRef<PagePlayer | null>(null);
  const count = show.snapshots.length;

  const load = useCallback(
    (i: number): Promise<PagePlayer | null> => {
      const snapshot = show.snapshots[i];
      if (i < 0 || i >= count || snapshot === null) return Promise.resolve(null);
      let p = players.current.get(i);
      if (!p) {
        const bounds = single ? { width: window.innerWidth * 0.8, height: window.innerHeight * 0.8 } : { width: window.screen.width || window.innerWidth, height: window.screen.height || window.innerHeight };
        const scale = Math.min(bounds.width / show.artboard.width, bounds.height / show.artboard.height) * (window.devicePixelRatio || 1);
        p = PagePlayer.create(JSON.parse(snapshot) as CanvasData, show.artboard, scale).catch((error: unknown) => {
          console.error(error);
          return null;
        });
        players.current.set(i, p);
      }
      return p;
    },
    [show, count, single],
  );

  useEffect(() => {
    const all = players.current;
    const runs = run;
    return () => {
      // Stops any playing page, then frees the players; a remount (React's development double
      // mount too) starts with fresh ones.
      runs.current++;
      all.forEach((p) => void p.then((player) => player?.dispose()));
      all.clear();
    };
  }, []);

  // Shows page `index`: a transition from the page before (if coming forward), then its animations.
  const showPage = useCallback(
    async (i: number, from: number | null) => {
      const token = ++run.current;
      setEnded(false);
      const player = await load(i);
      const host = stage.current;
      if (!player || !host || run.current !== token) return;
      const incoming = mount(player, show.artboard);
      const outgoing = from !== null ? host.lastElementChild : null;
      showing.current?.pause();
      showing.current = player;
      clock.current = { value: 0 };
      player.frame(0, 0);
      host.appendChild(incoming);
      const transition = player.timing.transition;
      if (outgoing instanceof HTMLElement && from !== null && i > from && transition.type !== "none") {
        await new Promise<void>((resolve) => {
          const started = performance.now();
          const frame = (now: number) => {
            const p = Math.min(1, (now - started) / transition.duration);
            const st = transitionStyle(transition.type, p);
            outgoing.style.opacity = String(st.from.opacity);
            outgoing.style.transform = `translateX(${st.from.x * 100}%) scale(${st.from.scale})`;
            incoming.style.opacity = String(st.to.opacity);
            incoming.style.transform = `translateX(${st.to.x * 100}%) scale(${st.to.scale})`;
            if (p < 1 && run.current === token) requestAnimationFrame(frame);
            else resolve();
          };
          requestAnimationFrame(frame);
        });
      }
      [...host.children].forEach((child) => child !== incoming && child.remove());
      incoming.style.opacity = "1";
      incoming.style.transform = "";
      if (run.current !== token) return;
      const done = await animate(player, 0, single ? player.duration : player.holdTime(), () => run.current === token, clock.current, !single);
      if (done) setEnded(true);
      if (done && single) player.pause();
      void load(i + 1);
    },
    [load, single, show.artboard],
  );

  const previous = useRef<number | null>(null);
  useEffect(() => {
    const from = previous.current;
    previous.current = index;
    void showPage(index, from);
  }, [index, showPage]);

  /** Plays the current page's exits, then moves on. */
  const next = useCallback(async () => {
    if (index >= count - 1) return;
    const token = ++run.current;
    const player = await load(index);
    if (player && player.holdTime() < player.duration) await animate(player, player.holdTime(), player.duration, () => run.current === token, clock.current);
    if (run.current === token) setIndex((i) => Math.min(count - 1, i + 1));
  }, [index, count, load]);

  // The latest handlers, for listeners that are set up once.
  const handlers = useRef({ next, onClose });
  useEffect(() => {
    handlers.current = { next, onClose };
  });

  useEffect(() => {
    if (single) return;
    root.current?.requestFullscreen?.().catch(() => {
      // Not allowed (or not supported): the slideshow still fills the window.
    });
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) handlers.current.onClose();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [single]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Captured before the editor's shortcuts, which must not act on the hidden page meanwhile.
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === "Escape") handlers.current.onClose();
      else if (single) return;
      else if (NEXT.has(e.key)) void handlers.current.next();
      else if (PREVIOUS.has(e.key)) setIndex((i) => Math.max(0, i - 1));
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(count - 1);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [count, single]);

  return (
    <div
      ref={root}
      role="dialog"
      aria-label={single ? "Náhled" : "Prezentace"}
      aria-modal
      className={single ? "fixed inset-0 z-50 flex items-center justify-center bg-black/80" : "fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black"}
      onClick={() => !single && void next()}
    >
      <div ref={stage} className="relative flex size-full items-center justify-center overflow-hidden" style={single ? { width: "80vw", height: "80vh" } : undefined} />
      {single ? (
        <div className="absolute top-4 right-4 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void showPage(index, null)} disabled={!ended} aria-label="Přehrát znovu">
            <RotateCcw /> Přehrát znovu
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose} aria-label="Zavřít náhled">
            <X />
          </Button>
        </div>
      ) : (
        <span className="absolute right-4 bottom-3 text-xs text-zinc-400 tabular-nums" data-testid="presentation-position">
          {index + 1} / {count}
        </span>
      )}
      <span className="sr-only" role="status" aria-label="Přehrávání">
        {ended ? "Dokončeno" : "Přehrává se"}
      </span>
    </div>
  );
}

/** "Present": the design full screen, one page at a time; arrow keys move between pages, Escape ends. */
export function PresentButton() {
  const [show, setShow] = useState<{ show: Show; start: number } | null>(null);
  const ready = useEditorStore((s) => s.loadState === "ready");
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setShow(currentShow())} disabled={!ready}>
        <PresentationIcon />
        Prezentovat
      </Button>
      {show && createPortal(<Player show={show.show} start={show.start} single={false} onClose={() => setShow(null)} />, document.body)}
    </>
  );
}

/** Plays the current page's animations once, over the editor (bottom bar "Play", or the Animate popover). */
export function PagePreview() {
  const previewing = useEditorStore((s) => s.previewing);
  const [show, setShow] = useState<{ show: Show; start: number } | null>(null);
  useEffect(() => {
    if (!previewing) return;
    const next = currentShow();
    if (!next) {
      useEditorStore.setState({ previewing: false });
      return;
    }
    setShow({ show: { ...next.show, snapshots: [next.show.snapshots[next.start]] }, start: 0 });
  }, [previewing]);
  if (!previewing || !show) return null;
  return createPortal(
    <Player
      show={show.show}
      start={0}
      single
      onClose={() => {
        setShow(null);
        useEditorStore.setState({ previewing: false });
      }}
    />,
    document.body,
  );
}

export function PlayButton() {
  const ready = useEditorStore((s) => s.loadState === "ready");
  return (
    <Button variant="ghost" size="sm" className="h-7" onClick={() => useEditorStore.setState({ previewing: true })} disabled={!ready}>
      <Play />
      Přehrát
    </Button>
  );
}
