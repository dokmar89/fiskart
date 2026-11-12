"use client";

import type { Unit } from "@/lib/units";
import { BrandPanel } from "@/components/sidebar/brand-panel";
import { DesignPanel } from "@/components/sidebar/design-panel";
import { DrawPanel } from "@/components/sidebar/draw-panel";
import { ChartPanel } from "@/components/sidebar/chart-panel";
import { AiPanel } from "@/components/sidebar/ai-panel";
import { ElementsPanel } from "@/components/sidebar/elements-panel";
import { GraphicsPanel } from "@/components/sidebar/graphics-panel";
import { LayersPanel } from "@/components/sidebar/layers-panel";
import { PhotosPanel } from "@/components/sidebar/photos-panel";
import { Rail } from "@/components/sidebar/rail";
import { TextPanel } from "@/components/sidebar/text-panel";
import { UploadsPanel } from "@/components/sidebar/uploads-panel";
import { Toolbar } from "@/components/toolbar/toolbar";
import "./font-faces";
import { useEditorStore } from "@/lib/store/editor";
import { BottomBar } from "./bottom-bar";
import { CanvasViewport } from "./canvas-viewport";
import { PageStrip } from "./page-strip";
import { PagePreview } from "./presentation";
import { TopBar } from "./top-bar";

export type EditorProject = {
  id: string;
  title: string;
  width: number;
  height: number;
  unit: Unit;
};

export function Editor({ project }: { project: EditorProject }) {
  const activePanel = useEditorStore((s) => s.activePanel);
  // After a resize the editor shows the new size; the page was rendered with the old one.
  const resized = useEditorStore((s) => (s.design?.projectId === project.id ? s.design : null));
  const design: EditorProject = resized ? { ...project, width: resized.width, height: resized.height, unit: resized.unit } : project;
  const ready = useEditorStore((s) => s.loadState === "ready");

  return (
    <div className="flex h-screen min-w-[1024px] flex-col overflow-hidden">
      <TopBar project={design} />
      <div className="flex min-h-0 flex-1">
        <Rail />
        {activePanel && (
          <aside className="w-72 shrink-0 overflow-y-auto border-r bg-background" aria-label="Panel">
            {/* Panels only add to a loaded page; anything added earlier would be replaced by the load. */}
            <fieldset disabled={!ready} className="contents">
              {activePanel === "design" && <DesignPanel unit={design.unit} />}
              {activePanel === "brand" && <BrandPanel />}
              {activePanel === "elements" && <ElementsPanel />}
              {activePanel === "text" && <TextPanel />}
              {activePanel === "draw" && <DrawPanel />}
              {activePanel === "photos" && <PhotosPanel />}
              {activePanel === "graphics" && <GraphicsPanel />}
              {activePanel === "uploads" && <UploadsPanel />}
              {activePanel === "layers" && <LayersPanel />}
              {activePanel === "chart" && <ChartPanel />}
              {activePanel === "ai" && <AiPanel />}
            </fieldset>
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Toolbar />
          <CanvasViewport initial={project} projectId={project.id} unit={design.unit} />
          <PageStrip artboard={{ width: design.width, height: design.height }} />
          <BottomBar />
          <PagePreview />
        </div>
      </div>
    </div>
  );
}
