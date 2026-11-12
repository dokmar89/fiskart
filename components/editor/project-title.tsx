"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/lib/store/editor";

const MAX_TITLE_LENGTH = 200;

// The latest rename request, so leaving the editor can wait for it.
let pendingRename: Promise<void> = Promise.resolve();
export const waitForRename = () => pendingRename;

/** The project title, editable in place. Saved on Enter or blur; Escape cancels. */
export function ProjectTitle({ projectId, initialTitle }: { projectId: string; initialTitle: string }) {
  const [saved, setSaved] = useState(initialTitle);
  const [draft, setDraft] = useState(initialTitle);
  const [error, setError] = useState(false);

  useEffect(() => {
    useEditorStore.setState({ projectTitle: saved });
  }, [saved]);

  async function rename(title: string, previous: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setError(false);
    } catch {
      setSaved(previous);
      setDraft((d) => (d === title ? previous : d));
      setError(true);
    }
  }

  function commit() {
    const title = draft.trim();
    if (!title || title === saved) {
      setDraft(saved);
      return;
    }
    // Shown as saved straight away; reverted if the request fails.
    setSaved(title);
    setDraft(title);
    pendingRename = pendingRename.then(() => rename(title, saved));
  }

  return (
    <input
      aria-label="Název návrhu"
      title={error ? "Přejmenování selhalo; zůstal původní název" : undefined}
      value={draft}
      maxLength={MAX_TITLE_LENGTH}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(saved);
          // Blur after the reset has rendered, so commit sees the old title and does nothing.
          const input = e.currentTarget;
          requestAnimationFrame(() => input.blur());
        }
      }}
      className={`h-8 w-64 min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-medium outline-none hover:border-border focus:border-ring ${error ? "text-destructive" : ""}`}
    />
  );
}
