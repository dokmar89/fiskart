"use client";

import { BookOpen, Camera, Clapperboard, Code2, FileText, Grid2X2, Mail, Monitor, Palette, Presentation, Printer, Share2, Sparkles, Table2, Upload, WandSparkles } from "lucide-react";
import type { ComponentType } from "react";

export const DASHBOARD_CATEGORIES = ["Šablony", "Prezentace", "Sociální sítě", "Video", "Tisk", "Dokument", "Whiteboard", "Tabulka", "Kód", "Web", "E-mail", "Fotografie", "Zázračné vrstvy", "Vlastní velikost", "Nahrát"] as const;
export type DashboardCategory = (typeof DASHBOARD_CATEGORIES)[number] | "Vzdělávání";

const icons: ComponentType<{ className?: string }>[] = [Grid2X2, Presentation, Share2, Clapperboard, Printer, FileText, BookOpen, Table2, Code2, Monitor, Mail, Camera, WandSparkles, Palette, Upload];
const colors = ["from-violet-500 to-indigo-600", "from-orange-500 to-amber-400", "from-rose-500 to-pink-600", "from-fuchsia-500 to-purple-600", "from-violet-500 to-fuchsia-600", "from-cyan-500 to-teal-500", "from-emerald-500 to-green-600", "from-blue-500 to-cyan-500", "from-purple-500 to-pink-500", "from-blue-500 to-indigo-600", "from-indigo-500 to-violet-600", "from-amber-500 to-orange-600", "from-violet-500 to-purple-600", "from-slate-500 to-violet-500", "from-indigo-500 to-blue-500"];

export function CategoryNavbar({ selected, onSelect }: { selected: DashboardCategory; onSelect: (category: DashboardCategory) => void }) {
  return (
    <nav aria-label="Hlavní kategorie" className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#1c1d23]">
      {DASHBOARD_CATEGORIES.map((category, index) => {
        const Icon = icons[index];
        return <button key={category} type="button" onClick={() => onSelect(category)} aria-pressed={selected === category} className="group flex min-w-19 shrink-0 flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-[11px] text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-300 dark:hover:bg-white/7" >
          <span className={`grid size-9 place-items-center rounded-lg bg-linear-to-br ${colors[index]} text-white shadow-sm transition-transform group-hover:-translate-y-0.5 ${selected === category ? "ring-2 ring-indigo-300 ring-offset-2 ring-offset-[#1c1d23]" : ""}`}><Icon className="size-5" /></span>
          <span className="whitespace-nowrap">{category}</span>
        </button>;
      })}
      <Sparkles className="sr-only" aria-hidden="true" />
    </nav>
  );
}
