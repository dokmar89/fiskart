import { Group } from "fabric";
import { loadFonts, normalizeWeight } from "@/lib/fonts";
import type { TextEffect } from "@/lib/text-effects";
import { applyEffectStyle } from "./effects";
import { artboardScale, placeObject } from "./elements";
import { getEditorInstance } from "./instance";
import { newObjectId } from "./serialize";
import { DesignTextbox } from "./text-box";

type Line = { text: string; family: string; size: number; weight: string; italic?: boolean; spacing?: number; upper?: boolean; color: string; align?: "left" | "center" | "right"; gap?: number; effect?: TextEffect };

export type TextCombo = { id: string; name: string; lines: Line[] };

/** Heading and body pairings, added as one group in one click (phase 15). */
export const TEXT_COMBOS: TextCombo[] = [
  {
    id: "announcement",
    name: "Oznamovací",
    lines: [
      { text: "Velká novinka", family: "Anton", size: 110, weight: "400", upper: true, spacing: 40, color: "#18181b" },
      { text: "Něco, o čem by měli vědět všichni", family: "Inter", size: 30, weight: "400", color: "#52525b" },
    ],
  },
  {
    id: "elegant",
    name: "Elegantní",
    lines: [
      { text: "Večer, na který se nezapomíná", family: "Playfair Display", size: 76, weight: "700", italic: true, color: "#1c1917" },
      { text: "SOBOTA · 19:00 · ZAHRADNÍ SÁL", family: "Lato", size: 24, weight: "400", spacing: 250, color: "#78716c" },
    ],
  },
  {
    id: "modern",
    name: "Moderní",
    lines: [
      { text: "Jednoduše", family: "Montserrat", size: 80, weight: "700", color: "#0f172a" },
      { text: "Jasné myšlenky, srozumitelně podané.", family: "Montserrat", size: 30, weight: "400", color: "#475569" },
    ],
  },
  {
    id: "playful",
    name: "Hravý",
    lines: [
      { text: "Pojďme si hrát!", family: "Fredoka", size: 96, weight: "700", color: "#ea580c" },
      { text: "Hry, dobroty a dobrá společnost", family: "Nunito", size: 30, weight: "400", color: "#9a3412" },
    ],
  },
  {
    id: "classic",
    name: "Klasický",
    lines: [
      { text: "Kapitola první", family: "EB Garamond", size: 84, weight: "400", color: "#292524" },
      { text: "Ve které vše začíná", family: "Source Sans 3", size: 28, weight: "400", italic: true, color: "#57534e" },
    ],
  },
  {
    id: "tech",
    name: "Technický",
    lines: [
      { text: "verze 2.0", family: "Space Mono", size: 72, weight: "700", color: "#2563eb" },
      { text: "Rychlejší sestavení, méně překvapení.", family: "Inter", size: 28, weight: "400", color: "#334155" },
    ],
  },
  {
    id: "cyber", name: "Cyber Monday",
    lines: [
      { text: "CYBER MONDAY", family: "Archivo Black", size: 89, weight: "700", color: "#111827", effect: { type: "glitch", intensity: 55, color: "#00e5ff", magenta: "#ff3ba7" } },
      { text: "SLEVY, KTERÉ ZMĚNÍ PRAVIDLA HRY", family: "Space Mono", size: 23, weight: "700", spacing: 80, color: "#06b6d4" },
    ],
  },
  {
    id: "retro", name: "Retro diskotéka",
    lines: [
      { text: "SUPER VIBES", family: "Righteous", size: 101, weight: "400", color: "#f97316", effect: { type: "splice", thickness: 68, offset: 70, direction: 135, color: "#7c3aed" } },
      { text: "HUDBA • BARVY • TANEC", family: "Oswald", size: 31, weight: "700", spacing: 190, color: "#b45309" },
    ],
  },
  {
    id: "luxury", name: "Luxusní editorial",
    lines: [
      { text: "VOGUE COUTURE", family: "Bodoni Moda", size: 86, weight: "700", color: "#1c1917" },
      { text: "NADČASOVÁ ELEGANCE V KAŽDÉM DETAILU", family: "Cormorant Garamond", size: 28, weight: "400", italic: true, spacing: 125, color: "#78716c" },
    ],
  },
  {
    id: "sale", name: "Výprodej dnes",
    lines: [
      { text: "SLEVA 70 %", family: "Anton", size: 116, weight: "400", color: "#171717", effect: { type: "background", padding: 25, radius: 25, transparency: 0, color: "#fde047" } },
      { text: "DNES POUZE • OMEZENÁ NABÍDKA", family: "Montserrat", size: 28, weight: "700", spacing: 100, color: "#dc2626" },
    ],
  },
  {
    id: "quote", name: "Citát a podpis",
    lines: [
      { text: "„Všechno začíná odvahou začít.“", family: "Playfair Display", size: 73, weight: "400", italic: true, color: "#292524" },
      { text: "— AUTOR MYŠLENKY", family: "Caveat", size: 40, weight: "700", color: "#a16207", align: "right" },
    ],
  },
  {
    id: "festival", name: "Festivalový plakát",
    lines: [
      { text: "HLASITĚ ŽÍT", family: "Staatliches", size: 110, weight: "400", color: "#e11d48", effect: { type: "outline", thickness: 30, color: "#1e293b" } },
      { text: "21.–23. ČERVNA • LETNÍ STAGE", family: "Barlow", size: 31, weight: "700", spacing: 130, color: "#0f172a" },
    ],
  },
  {
    id: "corporate", name: "Firemní prezentace",
    lines: [
      { text: "ROSTEME SPOLEČNĚ", family: "Plus Jakarta Sans", size: 84, weight: "700", color: "#0f172a", align: "left" },
      { text: "Strategie, která proměňuje nápady ve výsledky.", family: "Inter", size: 32, weight: "400", color: "#475569", align: "left" },
    ],
  },
  {
    id: "gaming", name: "Herní turnaj",
    lines: [
      { text: "LEVEL UP!", family: "Russo One", size: 120, weight: "400", color: "#7c3aed", effect: { type: "neon", intensity: 65, color: "#7c3aed" } },
      { text: "FINÁLE ZAČÍNÁ V 19:00", family: "JetBrains Mono", size: 30, weight: "700", color: "#0891b2" },
    ],
  },
  {
    id: "wedding", name: "Svatební oznámení",
    lines: [
      { text: "Jana & David", family: "Great Vibes", size: 110, weight: "400", color: "#9d174d" },
      { text: "S LÁSKOU VÁS ZVEME • 12. ZÁŘÍ", family: "Lora", size: 26, weight: "400", spacing: 180, color: "#57534e" },
    ],
  },
  {
    id: "minimalist", name: "Minimalistický titulek",
    lines: [
      { text: "MÉNĚ. LÉPE.", family: "Manrope", size: 102, weight: "700", color: "#111827", align: "left" },
      { text: "Prostor pro to podstatné.", family: "Manrope", size: 32, weight: "400", color: "#6b7280", align: "left" },
    ],
  },
  {
    id: "brutalist", name: "Brutalistický kontrast",
    lines: [
      { text: "ŽÁDNÁ PRAVIDLA", family: "Archivo Black", size: 96, weight: "700", color: "#18181b", effect: { type: "splice", thickness: 80, offset: 55, direction: 90, color: "#f43f5e" } },
      { text: "TVŮRČÍ MANIFEST / 2026", family: "Roboto Mono", size: 25, weight: "700", spacing: 155, color: "#be123c" },
    ],
  },
  {
    id: "news", name: "Novinový titulek",
    lines: [
      { text: "DNEŠNÍ ZPRÁVY", family: "Source Serif 4", size: 92, weight: "700", color: "#1f2937", align: "left" },
      { text: "Důležité události v krátkém přehledu", family: "Source Sans 3", size: 31, weight: "400", color: "#475569", align: "left" },
    ],
  },
  {
    id: "podcast", name: "Podcastová epizoda",
    lines: [
      { text: "HLAS NÁPADŮ", family: "Syne", size: 98, weight: "700", color: "#4f46e5" },
      { text: "EP. 042 / ROZHOVORY, KTERÉ ZŮSTANOU", family: "DM Sans", size: 26, weight: "700", spacing: 80, color: "#6d28d9" },
    ],
  },
  {
    id: "wellness", name: "Klid a zdraví",
    lines: [
      { text: "Nadechni se", family: "Cormorant Garamond", size: 100, weight: "700", italic: true, color: "#166534" },
      { text: "MALÝ RITUÁL PRO VELKÝ DEN", family: "Quicksand", size: 27, weight: "700", spacing: 110, color: "#65a30d" },
    ],
  },
  {
    id: "travel", name: "Cestovatelský deník",
    lines: [
      { text: "TAM, KDE TO ZAČÍNÁ", family: "Bebas Neue", size: 108, weight: "400", spacing: 65, color: "#0369a1" },
      { text: "DOBRODRUŽSTVÍ ČEKÁ ZA ROHEM", family: "Nunito", size: 27, weight: "700", color: "#0f766e" },
    ],
  },
  {
    id: "architecture", name: "Architektura prostoru",
    lines: [
      { text: "FORMA & FUNKCE", family: "Josefin Sans", size: 93, weight: "700", spacing: 90, color: "#334155" },
      { text: "INTERIÉRY PRO ŽIVOT", family: "Inter", size: 27, weight: "400", spacing: 170, color: "#94a3b8" },
    ],
  },
  {
    id: "culinary", name: "Kulinářský zážitek",
    lines: [
      { text: "Chuť okamžiku", family: "Abril Fatface", size: 92, weight: "400", color: "#92400e" },
      { text: "ČERSTVÉ SUROVINY • POCTIVÁ KUCHYNĚ", family: "Lato", size: 27, weight: "700", spacing: 90, color: "#b45309" },
    ],
  },
  {
    id: "science", name: "Věda jednoduše",
    lines: [
      { text: "OBJEVUJTE VÍC", family: "Fira Sans", size: 96, weight: "700", color: "#1d4ed8" },
      { text: "Nápady podložené daty", family: "Fira Code", size: 27, weight: "400", color: "#64748b" },
    ],
  },
  {
    id: "nature", name: "Přírodní elegance",
    lines: [
      { text: "Pomalé ráno", family: "Lora", size: 101, weight: "700", italic: true, color: "#3f6212" },
      { text: "NÁVRAT K TOMU, CO JE OPRAVDU DŮLEŽITÉ", family: "Work Sans", size: 24, weight: "400", spacing: 85, color: "#65a30d" },
    ],
  },
];

/** Adds a combination as a group of text boxes, centred on the page, with its fonts loaded first. */
export async function addTextCombo(id: string) {
  const editor = getEditorInstance();
  const combo = TEXT_COMBOS.find((c) => c.id === id);
  if (!editor || !combo) return;
  const scale = artboardScale(editor.artboard);
  await loadFonts(combo.lines.map((l) => ({ family: l.family, weight: normalizeWeight(l.weight), style: l.italic ? "italic" : "normal", text: l.upper ? l.text.toUpperCase() : l.text })));
  const width = editor.artboard.width * 0.75;
  let top = 0;
  const boxes = combo.lines.map((line) => {
    const box = new DesignTextbox(line.text, {
      width,
      left: 0,
      top,
      fontFamily: line.family,
      fontSize: line.size * scale,
      fontWeight: line.weight,
      fontStyle: line.italic ? "italic" : "normal",
      charSpacing: line.spacing ?? 0,
      fill: line.color,
      textAlign: line.align ?? "center",
    });
    box.set({ id: newObjectId(), name: line.text.slice(0, 40), locked: false, textCase: line.upper ? "upper" : undefined, effect: line.effect });
    if (line.effect) applyEffectStyle(box);
    box.initDimensions();
    top += box.height + line.size * scale * (line.gap ?? 0.25);
    return box;
  });
  placeObject(new Group(boxes, { subTargetCheck: false }), `${combo.name} text`);
}
