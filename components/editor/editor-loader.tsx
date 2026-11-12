"use client";

import dynamic from "next/dynamic";
import type { EditorProject } from "./editor";

// Fabric needs the DOM, so the editor and everything under lib/canvas/ is never rendered on the server.
const Editor = dynamic(() => import("./editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <div className="h-screen bg-zinc-200 dark:bg-zinc-900" />,
});

export function EditorLoader({ project }: { project: EditorProject }) {
  // Keyed by project, so opening another design (a resized copy) starts a fresh editor.
  return <Editor key={project.id} project={project} />;
}
