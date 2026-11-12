"use client";

import { useEffect, useState } from "react";
import type { CanvasData } from "@/lib/page-data";
import type { TemplateSummary } from "@/lib/templates";
import { useFontsStore } from "@/lib/store/fonts";
import { cn } from "@/lib/utils";

/** Rendered thumbnails by template id and version, so reopening the gallery does not render again. */
const rendered = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

/** Fabric, the font stylesheets and the uploaded fonts, loaded only when something has to be rendered. */
async function renderer() {
  const [templates] = await Promise.all([
    import("@/lib/canvas/templates"),
    import("@/components/editor/font-faces"),
    useFontsStore.getState().load(),
  ]);
  return templates;
}

/** Renders one page at a time: each render holds a canvas and loads fonts. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function renderedThumbnail(template: TemplateSummary): Promise<string> {
  const key = `${template.id}@${template.version}`;
  let url = rendered.get(key);
  if (!url) {
    url = enqueue(async () => {
      const { fetchTemplate, createTemplateThumbnail } = await renderer();
      await createTemplateThumbnail(await fetchTemplate(template.id));
      // Keep only the small, cacheable URL. A full gallery no longer retains every PNG blob.
      return `/api/templates/${template.id}/thumbnail?v=${template.version}`;
    });
    url.catch(() => rendered.delete(key));
    rendered.set(key, url);
  }
  return url;
}

/** A preview of any page of a template, rendered here (pages after the first have no stored thumbnail). */
export function renderedPagePreview(template: TemplateSummary, index: number, page: CanvasData): Promise<string> {
  const key = `${template.id}@${template.version}#${index}`;
  let url = rendered.get(key);
  if (!url) {
    url = enqueue(async () => {
      const { renderTemplateThumbnail } = await renderer();
      return URL.createObjectURL(await renderTemplateThumbnail(template, page));
    });
    rendered.set(key, url);
  }
  return url;
}

/**
 * The template's first page: the stored thumbnail, or one rendered in the browser and stored for
 * next time when there is none yet (built-in templates after seeding).
 */
export function TemplateThumb({ template, className }: { template: TemplateSummary; className?: string }) {
  const stored = `/api/templates/${template.id}/thumbnail?v=${template.version}`;
  const [src, setSrc] = useState<string | null>(template.hasThumbnail ? stored : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (src) return;
    let live = true;
    renderedThumbnail(template)
      .then((url) => live && setSrc(url))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [src, template]);

  const aspect = template.width / template.height;
  // A frame of one shape for every card, the page drawn inside it at its own proportions.
  return (
    <div className={cn("relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border bg-muted p-3", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- local PNGs and object URLs, not worth the image optimizer
        <img
          src={src}
          alt=""
          loading="lazy"
          className="max-h-full max-w-full object-contain shadow-sm"
          onError={() => {
            // A stored thumbnail whose file has gone: render a new one.
            if (src === stored) {
              rendered.delete(`${template.id}@${template.version}`);
              setSrc(null);
            }
          }}
        />
      ) : (
        <div
          className="max-h-full max-w-full animate-pulse bg-background shadow-sm"
          style={{ aspectRatio: aspect, [aspect >= 4 / 3 ? "width" : "height"]: "100%" }}
          aria-hidden
        />
      )}
      {failed && <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Bez náhledu</span>}
    </div>
  );
}
