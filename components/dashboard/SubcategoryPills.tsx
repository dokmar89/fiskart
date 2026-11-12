"use client";

export const SOCIAL_PLATFORMS = ["Populární", "Facebook", "Instagram", "LinkedIn", "Pinterest", "TikTok", "Twitter", "WhatsApp", "YouTube"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export function SubcategoryPills({ selected, onSelect }: { selected: SocialPlatform; onSelect: (platform: SocialPlatform) => void }) {
  return <div role="group" aria-label="Sociální platformy" className="flex gap-2 overflow-x-auto py-3">
    {SOCIAL_PLATFORMS.map((platform) => <button key={platform} type="button" aria-pressed={selected === platform} onClick={() => onSelect(platform)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${selected === platform ? "border-indigo-400 bg-indigo-600 text-white dark:bg-[#4b3978]" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#202127] dark:text-slate-200 dark:hover:bg-[#30313a]"}`}>{platform}</button>)}
  </div>;
}
