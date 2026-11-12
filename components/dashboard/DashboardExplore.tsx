"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DESIGN_PRESETS, findDesignPreset, type DesignPreset } from "@/constants/presets";
import { NewDesignDialog } from "./new-design-dialog";
import { CategoryNavbar, type DashboardCategory } from "./CategoryNavbar";
import { DashboardSidebar } from "./DashboardSidebar";
import { FormatGrid } from "./FormatGrid";
import { SubcategoryPills, type SocialPlatform } from "./SubcategoryPills";
import { DashboardUpload } from "./DashboardUpload";

const featured = new Set(["worksheet", "flashcard", "presentation", "classroom-header", "infographic", "timetable", "mind-map", "instagram-post", "youtube-thumbnail", "a4"]);

export function DashboardExplore() {
  const router = useRouter();
  const [category, setCategory] = useState<DashboardCategory>("Šablony");
  const [platform, setPlatform] = useState<SocialPlatform>("Populární");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(preset: DesignPreset) {
    const safePreset = findDesignPreset(preset.id);
    if (!safePreset) { setError("Neznámý formát návrhu."); return; }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ width: safePreset.width, height: safePreset.height, unit: safePreset.unit, title: safePreset.name }) });
      const body = await res.json() as { id?: string; error?: string };
      if (!res.ok || !body.id) throw new Error(body.error ?? "Návrh se nepodařilo vytvořit.");
      router.push(`/design/${body.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Návrh se nepodařilo vytvořit.");
      setPending(false);
    }
  }

  const presets = DESIGN_PRESETS.filter((preset) => {
    if (category === "Šablony") return featured.has(preset.id);
    if (category === "Sociální sítě") return preset.category === category && (platform === "Populární" || preset.subCategory === platform);
    return preset.category === category;
  });

  return <section aria-label="Prozkoumat formáty" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/8 dark:bg-[#18191b]">
    <CategoryNavbar selected={category} onSelect={setCategory} />
    <div className="flex flex-col gap-4 p-3 md:flex-row md:p-4">
      <DashboardSidebar selected={category} onSelect={setCategory} />
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{category === "Šablony" ? "Inspirace pro vás" : category}</h2><p className="text-sm text-muted-foreground">Vyberte formát a začněte tvořit.</p></div>
          {category === "Vlastní velikost" && <NewDesignDialog autoOpen />}
        </div>
        {category === "Sociální sítě" && <SubcategoryPills selected={platform} onSelect={setPlatform} />}
        {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
        {presets.length > 0 && <FormatGrid presets={presets} onPick={(preset) => void pick(preset)} pending={pending} />}
        {category === "Nahrát" && <DashboardUpload />}
      </div>
    </div>
  </section>;
}
