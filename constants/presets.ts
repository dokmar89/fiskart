import { toPx } from "@/lib/units";

export interface DesignPreset {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  /** Geometry in CSS pixels at 96 DPI, including physical formats. */
  width: number;
  height: number;
  unit: "px" | "mm";
  icon: string;
  badge?: string;
}

type Row = [id: string, name: string, category: string, width: number, height: number, icon: string, subCategory?: string];
const pxRows: Row[] = [
  ["instagram-post", "Příspěvek na Instagram", "Sociální sítě", 1080, 1080, "instagram", "Instagram"],
  ["instagram-portrait", "Portrét na Instagram", "Sociální sítě", 1080, 1350, "instagram", "Instagram"],
  ["instagram-story", "Příběh na Instagram", "Sociální sítě", 1080, 1920, "instagram", "Instagram"],
  ["instagram-reel", "Instagram Reel", "Video", 1080, 1920, "video", "Instagram"],
  ["instagram-carousel", "Instagram Carousel", "Sociální sítě", 1080, 1080, "instagram", "Instagram"],
  ["facebook-feed", "Příspěvek na Facebook", "Sociální sítě", 1200, 630, "facebook", "Facebook"],
  ["facebook-square", "Čtverec na Facebook", "Sociální sítě", 1080, 1080, "facebook", "Facebook"],
  ["facebook-story", "Příběh na Facebook", "Sociální sítě", 1080, 1920, "facebook", "Facebook"],
  ["facebook-cover", "Titulní fotka Facebook", "Sociální sítě", 820, 312, "facebook", "Facebook"],
  ["facebook-group", "Titulní fotka skupiny", "Sociální sítě", 1640, 856, "facebook", "Facebook"],
  ["facebook-event", "Událost Facebook", "Sociální sítě", 1920, 1080, "facebook", "Facebook"],
  ["youtube-thumbnail", "Miniatura YouTube", "Sociální sítě", 1280, 720, "youtube", "YouTube"],
  ["youtube-banner", "Banner kanálu YouTube", "Sociální sítě", 2560, 1440, "youtube", "YouTube"],
  ["youtube-video", "Video YouTube", "Video", 1920, 1080, "video", "YouTube"],
  ["youtube-short", "YouTube Short", "Video", 1080, 1920, "video", "YouTube"],
  ["tiktok-video", "Video TikTok", "Video", 1080, 1920, "video", "TikTok"],
  ["tiktok-profile", "Profil TikTok", "Sociální sítě", 500, 500, "tiktok", "TikTok"],
  ["linkedin-post", "Příspěvek LinkedIn", "Sociální sítě", 1200, 627, "linkedin", "LinkedIn"],
  ["linkedin-banner", "Banner profilu LinkedIn", "Sociální sítě", 1584, 396, "linkedin", "LinkedIn"],
  ["linkedin-company", "Firemní příspěvek LinkedIn", "Sociální sítě", 1200, 1200, "linkedin", "LinkedIn"],
  ["x-post", "Příspěvek X", "Sociální sítě", 1600, 900, "x", "Twitter"],
  ["x-header", "Záhlaví X", "Sociální sítě", 1500, 500, "x", "Twitter"],
  ["pinterest-pin", "Pinterest Pin", "Sociální sítě", 1000, 1500, "pinterest", "Pinterest"],
  ["pinterest-long", "Dlouhý Pinterest Pin", "Sociální sítě", 1000, 2100, "pinterest", "Pinterest"],
  ["whatsapp-status", "Stav WhatsApp", "Sociální sítě", 1080, 1920, "chat", "WhatsApp"],
  ["whatsapp-profile", "Profil WhatsApp", "Sociální sítě", 500, 500, "chat", "WhatsApp"],
  ["presentation", "Prezentace 16:9", "Prezentace", 1920, 1080, "presentation"],
  ["presentation-4-3", "Prezentace 4:3", "Prezentace", 1024, 768, "presentation"],
  ["pitch-deck", "Pitch deck", "Prezentace", 1920, 1080, "presentation"],
  ["tshirt", "Potisk trička", "Tisk", 3600, 4800, "print"],
  ["flashcard", "Kartička", "Vzdělávání", 1050, 600, "education"],
  ["infographic", "Infografika", "Vzdělávání", 800, 2000, "education"],
  ["classroom-header", "Záhlaví Google Classroom", "Vzdělávání", 1000, 250, "education"],
  ["whiteboard", "Tabule", "Whiteboard", 3200, 1800, "whiteboard"],
  ["mind-map", "Myšlenková mapa", "Whiteboard", 2400, 1600, "whiteboard"],
  ["brainstorm", "Brainstorming", "Whiteboard", 2400, 1600, "whiteboard"],
  ["planner", "Plánovač", "Tabulka", 1600, 1000, "table"],
  ["budget", "Rozpočet", "Tabulka", 1600, 1000, "table"],
  ["matrix", "Matice", "Tabulka", 1600, 1000, "table"],
  ["code-card", "Karta s kódem", "Kód", 1200, 800, "code"],
  ["tech-snippet", "Technický úryvek", "Kód", 1200, 630, "code"],
  ["web-banner", "Webový banner", "Web", 1920, 600, "web"],
  ["web-hero", "Hero sekce", "Web", 1920, 1080, "web"],
  ["shop-header", "Záhlaví e-shopu", "Web", 1440, 480, "web"],
  ["email-header", "Záhlaví newsletteru", "E-mail", 1200, 400, "email"],
  ["email-signature", "E-mailový podpis", "E-mail", 600, 200, "email"],
  ["photo-edit", "Úprava fotografie", "Fotografie", 1600, 1200, "photo"],
  ["photo-collage", "Fotokoláž", "Fotografie", 1920, 1080, "photo"],
  ["portrait", "Portrét", "Fotografie", 1200, 1600, "photo"],
  ["wallpaper", "Tapeta", "Fotografie", 1920, 1080, "photo"],
  ["magic-layers", "Zázračné vrstvy", "Zázračné vrstvy", 1600, 1000, "sparkles"],
];
const mmRows: Row[] = [
  ["a4", "A4 na výšku", "Tisk", 210, 297, "print"],
  ["a4-landscape", "A4 na šířku", "Tisk", 297, 210, "print"],
  ["a5", "A5", "Tisk", 148, 210, "print"],
  ["a3", "Plakát A3", "Tisk", 297, 420, "print"],
  ["a2", "Plakát A2", "Tisk", 420, 594, "print"],
  ["business-card", "Vizitka", "Tisk", 88.9, 50.8, "print"],
  ["flyer", "Leták", "Tisk", 107.95, 158.75, "print"],
  ["worksheet", "Pracovní list A4", "Vzdělávání", 210, 297, "education"],
  ["timetable", "Rozvrh hodin", "Vzdělávání", 297, 210, "education"],
  ["class-newsletter", "Třídní zpravodaj", "Vzdělávání", 210, 297, "education"],
  ["document", "Dokument A4", "Dokument", 210, 297, "document"],
  ["report", "Souhrnná zpráva", "Dokument", 210, 297, "document"],
  ["invoice", "Faktura", "Dokument", 210, 297, "document"],
  ["resume", "Životopis", "Dokument", 210, 297, "document"],
];

export const DESIGN_PRESETS: readonly DesignPreset[] = [
  ...pxRows.map(([id, name, category, width, height, icon, subCategory]) => ({ id, name, category, width, height, icon, subCategory, unit: "px" as const })),
  ...mmRows.map(([id, name, category, width, height, icon, subCategory]) => ({ id, name, category, width: toPx(width, "mm"), height: toPx(height, "mm"), icon, subCategory, unit: "mm" as const })),
];

export function findDesignPreset(id: string): DesignPreset | undefined {
  return DESIGN_PRESETS.find((preset) => preset.id === id);
}
