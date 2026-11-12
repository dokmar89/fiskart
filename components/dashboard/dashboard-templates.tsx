"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { TemplateGallery } from "@/components/templates/template-gallery";
import { useTemplatesStore } from "@/lib/store/templates";
import type { TemplateSummary } from "@/lib/templates";

/** The template gallery on the dashboard: picking a template starts a new design from it. */
export function DashboardTemplates() {
  const router = useRouter();
  const { templates, categories, total, page, pageSize, query, category, loading, error, load } = useTemplatesStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<TemplateSummary | null>(null);

  useEffect(() => { void load({ query: "", category: null, page: 1, preferredWidth: null, preferredHeight: null }); }, [load]);

  async function use(template: TemplateSummary) {
    setBusyId(template.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}/use`, { method: "POST" });
      const body = (await res.json()) as { id?: string };
      if (!res.ok || !body.id) throw new Error();
      router.push(`/design/${body.id}`);
    } catch {
      setActionError(`Ze šablony ${template.title} se nepodařilo založit návrh.`);
      setBusyId(null);
    }
  }

  async function remove(template: TemplateSummary) {
    const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) setActionError(`Šablonu ${template.title} se nepodařilo smazat.`);
    setToDelete(null);
    if (res.ok || res.status === 404) await load({ page: 1 });
  }

  return (
    <section aria-labelledby="templates-heading" className="grid gap-3">
      <h2 id="templates-heading" className="text-lg font-semibold">
        Začít ze šablony
      </h2>
      {actionError && (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}
      <TemplateGallery
        templates={templates}
        categories={categories}
        total={total}
        page={page}
        pageSize={pageSize}
        query={query}
        category={category}
        loading={loading}
        error={error}
        onQueryChange={(value) => void load({ query: value, page: 1 })}
        onCategoryChange={(value) => void load({ category: value, page: 1 })}
        onPageChange={(value) => void load({ page: value })}
        onRetry={() => void load({})}
        layout="page"
        busyId={busyId}
        onPick={(t) => void use(t)}
        renderActions={(t) =>
          !t.isBuiltIn && (
            <button
              type="button"
              aria-label={`Smazat šablonu ${t.title}`}
              title="Smazat šablonu"
              onClick={() => setToDelete(t)}
              className="absolute top-1.5 right-1.5 hidden rounded-md bg-background/90 p-1 text-muted-foreground shadow-sm group-hover:block hover:text-foreground focus-visible:block"
            >
              <Trash2 className="size-4" />
            </button>
          )
        }
      />
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat šablonu?</AlertDialogTitle>
            <AlertDialogDescription>
              Šablona {toDelete?.title} bude odebrána z galerie. Návrhů, které z ní vznikly, se to nedotkne.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && void remove(toDelete)}>Smazat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
