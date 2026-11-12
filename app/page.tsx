import { DashboardTemplates } from "@/components/dashboard/dashboard-templates";
import { DashboardExplore } from "@/components/dashboard/DashboardExplore";
import { NewDesignDialog } from "@/components/dashboard/new-design-dialog";
import { ProjectCard } from "@/components/dashboard/project-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/server/db";
import { formatSize } from "@/lib/units";

// The project list changes with every edit; never serve it from the build-time cache.
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("cs", { dateStyle: "medium", timeStyle: "short" });

export default async function Dashboard() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, width: true, height: true, unit: true, thumbnailPath: true, updatedAt: true },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center justify-between border-b px-4">
        <h1 className="text-sm font-semibold">FiskART</h1>
        <ThemeToggle />
      </header>
      <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-10 px-4 py-6">
        <DashboardExplore />
        <DashboardTemplates />
        <section aria-label="Vaše návrhy">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Návrhy</h2>
          <NewDesignDialog />
        </div>
        {projects.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Zatím žádné návrhy.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Návrhy">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={{
                  id: p.id,
                  title: p.title,
                  aspect: p.width / p.height,
                  meta: `${formatSize(p.width, p.height, p.unit)} · ${dateFormat.format(p.updatedAt)}`,
                  // The version parameter changes whenever the project does, so the image can be cached for good.
                  thumbnailUrl: p.thumbnailPath ? `/api/projects/${p.id}/thumbnail?v=${p.updatedAt.getTime()}` : null,
                }}
              />
            ))}
          </ul>
        )}
        </section>
      </main>
    </div>
  );
}
