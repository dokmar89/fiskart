"use client";

import { BookOpen, Camera, Clapperboard, Code2, FileText, Grid2X2, Mail, Monitor, Palette, Presentation, Printer, Share2, Sparkles, Table2, Upload } from "lucide-react";
import type { ComponentType } from "react";
import type { DashboardCategory } from "./CategoryNavbar";

const rows: { label: string; category: DashboardCategory; icon: ComponentType<{ className?: string }> }[] = [
  { label: "Pro vás", category: "Šablony", icon: Sparkles },
  { label: "Vzdělávání", category: "Vzdělávání", icon: BookOpen },
  { label: "Prezentace", category: "Prezentace", icon: Presentation },
  { label: "Sociální sítě", category: "Sociální sítě", icon: Share2 },
  { label: "Fotografie", category: "Fotografie", icon: Camera },
  { label: "Videa", category: "Video", icon: Clapperboard },
  { label: "Tisk", category: "Tisk", icon: Printer },
  { label: "Docs", category: "Dokument", icon: FileText },
  { label: "Tabule", category: "Whiteboard", icon: Palette },
  { label: "Listy", category: "Tabulka", icon: Table2 },
  { label: "Kód", category: "Kód", icon: Code2 },
  { label: "Weby", category: "Web", icon: Monitor },
  { label: "E-maily", category: "E-mail", icon: Mail },
  { label: "Vlastní velikost", category: "Vlastní velikost", icon: Grid2X2 },
  { label: "Nahrát", category: "Nahrát", icon: Upload },
];

export function DashboardSidebar({ selected, onSelect }: { selected: DashboardCategory; onSelect: (category: DashboardCategory) => void }) {
  return <nav aria-label="Vedlejší kategorie" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 md:w-48 md:shrink-0 md:flex-col dark:border-white/8 dark:bg-[#202127]">
    {rows.map(({ label, category, icon: Icon }) => <button key={label} type="button" onClick={() => onSelect(category)} aria-pressed={selected === category} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${selected === category ? "bg-indigo-600 text-white shadow-[0_0_15px_#6366f14d] dark:bg-[#4b3978]" : "text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/7"}`}><Icon className="size-3.5 shrink-0" /><span>{label}</span></button>)}
  </nav>;
}
