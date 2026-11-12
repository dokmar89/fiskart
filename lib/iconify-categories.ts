/** Browse terms and optional icon-set filters for the online Iconify library. */
export const ICONIFY_CATEGORIES = [
  { id: "all", label: "Vše", term: "design" },
  { id: "minimal", label: "Minimalistické", term: "home", prefixes: "lucide,tabler,ph,solar" },
  { id: "business", label: "Biznis & Finance", term: "finance" },
  { id: "social", label: "Sociální sítě", term: "social" },
  { id: "arrows", label: "Šipky & Odznaky", term: "arrow" },
  { id: "technology", label: "Technologie", term: "computer" },
  { id: "food", label: "Jídlo & Nápoje", term: "food" },
  { id: "travel", label: "Cestování", term: "travel" },
  { id: "nature", label: "Příroda", term: "tree" },
  { id: "emoji", label: "Emoji (Twemoji)", term: "smile", prefixes: "twemoji,fluent-emoji,fluent-emoji-flat" },
  { id: "abstract", label: "Abstraktní dekorace", term: "shape" },
] as const;

export type IconifyCategoryId = (typeof ICONIFY_CATEGORIES)[number]["id"];

export type IconifyCategory = { id: IconifyCategoryId; label: string; term: string; prefixes?: string };

export function iconifyCategory(id: string): IconifyCategory {
  return ICONIFY_CATEGORIES.find((category) => category.id === id) ?? ICONIFY_CATEGORIES[0];
}

/** Iconify requires a query, so browsing a category uses its representative term. */
export function iconifySearchTerm(query: string, category: string): string {
  return query.trim().slice(0, 100) || iconifyCategory(category).term;
}
