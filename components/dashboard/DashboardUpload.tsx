"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";

export function DashboardUpload() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file?: File) {
    if (!file || pending) return;
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/projects/from-upload", { method: "POST", body: form });
      const body = await response.json() as { id?: string; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error ?? "Obrázek se nepodařilo nahrát.");
      router.push(`/design/${body.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Obrázek se nepodařilo nahrát.");
      setPending(false);
    }
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    void upload(event.dataTransfer.files[0]);
  }

  return <div className="space-y-3">
    <label onDragOver={(event) => event.preventDefault()} onDrop={drop} className="flex min-h-50 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-indigo-400 bg-indigo-50 p-6 text-center hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/15">
      <Upload className="size-10 text-indigo-500" />
      <span className="font-medium">{pending ? "Nahrávám…" : "Přetáhněte obrázek sem nebo klikněte"}</span>
      <span className="text-xs text-muted-foreground">PNG, JPEG, WebP nebo SVG · nejvýše 25 MB</span>
      <input type="file" aria-label="Nahrát obrázek" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" disabled={pending} onChange={(event) => void upload(event.target.files?.[0])} />
    </label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
