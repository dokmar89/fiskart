"use client";

import { BookOpen, Camera, Clapperboard, Code2, FileText, Grid2X2, Mail, Monitor, Presentation, Printer, Sparkles, Table2 } from "lucide-react";
import type { DesignPreset } from "@/constants/presets";
import { formatSize } from "@/lib/units";

const icons = { education: BookOpen, presentation: Presentation, print: Printer, document: FileText, whiteboard: Grid2X2, table: Table2, code: Code2, web: Monitor, email: Mail, photo: Camera, video: Clapperboard, sparkles: Sparkles };
const socialIcons = new Set(["instagram", "facebook", "youtube", "linkedin", "pinterest", "tiktok", "x", "chat"]);
const colors = ["from-pink-500 to-fuchsia-700", "from-violet-500 to-indigo-700", "from-orange-500 to-red-600", "from-cyan-400 to-blue-700", "from-emerald-400 to-teal-700", "from-blue-500 to-violet-700"];

export function FormatGrid({ presets, onPick, pending }: { presets: readonly DesignPreset[]; onPick: (preset: DesignPreset) => void; pending?: boolean }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    {presets.map((preset, index) => {
      const Icon = icons[preset.icon as keyof typeof icons] ?? Sparkles;
      const social = socialIcons.has(preset.icon);
      return <button key={preset.id} type="button" disabled={pending} onClick={() => onPick(preset)} className="group min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:border-white/8 dark:bg-[#202127] dark:hover:bg-[#292a31]">
        <span className="flex aspect-4/3 items-center justify-center overflow-hidden rounded-xl bg-slate-200 dark:bg-[#2c2d36]"><span className={`grid size-16 place-items-center rounded-2xl bg-linear-to-br ${colors[index % colors.length]} text-white shadow-[0_12px_30px_#0005] transition-transform group-hover:scale-110`}>{social ? (
          // eslint-disable-next-line @next/next/no-img-element -- locally generated SVG icon
          <img src={`/graphics/social-${preset.icon === "chat" ? "whatsapp" : preset.icon}.svg`} alt="" className="size-11 rounded-lg bg-white p-1" />
        ) : <Icon className="size-9" />}</span></span>
        <span className="mt-2 block truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{preset.name}</span>
        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{formatSize(preset.width, preset.height, preset.unit)}</span>
      </button>;
    })}
  </div>;
}
