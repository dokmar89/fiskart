import { toPx } from "../../lib/units";
import { gradient, PageBuilder, type BuiltInTemplate } from "./build";

type Concept = {
  slug: string; title: string; category: string; width: number; height: number; unit?: "px" | "mm";
  headline: string; subtitle: string; kicker: string; cta: string; accent: string; tags: string[];
};

const a4w = toPx(210, "mm");
const a4h = toPx(297, "mm");
const concepts: Concept[] = [
  { slug: "sale", title: "Výprodej 50 %", category: "Příspěvek na Instagram", width: 1080, height: 1080, headline: "SLEVA 50 %", subtitle: "Oblíbené kousky za poloviční cenu.", kicker: "JEN TENTO TÝDEN", cta: "Nakupovat", accent: "#f43f5e", tags: ["e-shop", "sleva", "akce"] },
  { slug: "podcast", title: "Nová epizoda podcastu", category: "Příspěvek na Instagram", width: 1080, height: 1080, headline: "NOVÁ EPIZODA", subtitle: "O nápadech, které mění svět.", kicker: "PODCAST · DÍL 24", cta: "Poslechnout", accent: "#8b5cf6", tags: ["podcast", "audio", "rozhovor"] },
  { slug: "quote", title: "Inspirativní citát", category: "Příspěvek na Instagram", width: 1080, height: 1080, headline: "Začni tam, kde jsi.", subtitle: "Použij to, co máš. Udělej, co můžeš.", kicker: "MALÁ PŘIPOMÍNKA", cta: "Sdílet dál", accent: "#d97706", tags: ["citát", "motivace", "typografie"] },
  { slug: "property", title: "Nabídka nemovitosti", category: "Příspěvek na Instagram", width: 1080, height: 1080, headline: "BYDLENÍ S VÝHLEDEM", subtitle: "3+kk · terasa · Praha 7", kicker: "NOVĚ V NABÍDCE", cta: "Prohlédnout", accent: "#0d9488", tags: ["reality", "byt", "nemovitost"] },
  { slug: "fitness", title: "Fitness tipy", category: "Příspěvek na Instagram", width: 1080, height: 1080, headline: "SÍLA KAŽDÝ DEN", subtitle: "Tři kroky k lepší kondici.", kicker: "TVŮJ DENNÍ PLÁN", cta: "Začít dnes", accent: "#84cc16", tags: ["fitness", "zdraví", "cvičení"] },
  { slug: "story-sale", title: "Výprodej ve Stories", category: "Příběh na Instagram", width: 1080, height: 1920, headline: "DNES JE TVŮJ DEN", subtitle: "Nová kolekce právě dorazila.", kicker: "LIMITOVANÁ NABÍDKA", cta: "Zjistit víc", accent: "#ec4899", tags: ["story", "móda", "prodej"] },
  { slug: "story-podcast", title: "Podcast ve Stories", category: "Příběh na Instagram", width: 1080, height: 1920, headline: "HLAS, KTERÝ STOJÍ ZA POSLECH", subtitle: "Nový rozhovor už je venku.", kicker: "EPIZODA 25", cta: "Přehrát", accent: "#6366f1", tags: ["story", "podcast", "rozhovor"] },
  { slug: "gaming", title: "Herní miniatura", category: "Miniatura pro YouTube", width: 1280, height: 720, headline: "TOHLE JSEM NEČEKAL!", subtitle: "Největší herní překvapení roku.", kicker: "GAMEPLAY", cta: "Sledovat", accent: "#f97316", tags: ["gaming", "video", "reakce"] },
  { slug: "coding", title: "Výuka programování", category: "Miniatura pro YouTube", width: 1280, height: 720, headline: "KÓD BEZ CHAOSU", subtitle: "Jednoduchý postup krok za krokem.", kicker: "TECH TUTORIÁL", cta: "Pustit video", accent: "#38bdf8", tags: ["kód", "výuka", "technologie"] },
  { slug: "finance", title: "Finanční přehled", category: "Miniatura pro YouTube", width: 1280, height: 720, headline: "PENÍZE POD KONTROLOU", subtitle: "Kam investovat v roce 2026?", kicker: "FINANCE", cta: "Zjistit víc", accent: "#22c55e", tags: ["investice", "finance", "graf"] },
  { slug: "webinar", title: "Pozvánka na webinář", category: "LinkedIn", width: 1200, height: 627, headline: "WEBINÁŘ PRO LÍDRY", subtitle: "Jak vést tým v době změn.", kicker: "12. 12. · 17:00", cta: "Registrovat se", accent: "#3b82f6", tags: ["webinář", "událost", "byznys"] },
  { slug: "hiring", title: "Hledáme kolegy", category: "LinkedIn", width: 1200, height: 627, headline: "ROZŠIŘUJEME TÝM", subtitle: "Hledáme lidi, kteří rádi tvoří.", kicker: "PŘIDEJ SE K NÁM", cta: "Volné pozice", accent: "#14b8a6", tags: ["práce", "nábor", "kariéra"] },
  { slug: "timetable", title: "Rozvrh hodin", category: "Vzdělávání", width: toPx(297, "mm"), height: a4w, unit: "mm", headline: "MŮJ ROZVRH", subtitle: "Školní rok 2026/2027", kicker: "PONDĚLÍ — PÁTEK", cta: "Moje třída", accent: "#a855f7", tags: ["rozvrh", "škola", "tabulka"] },
  { slug: "worksheet", title: "Pracovní list", category: "Vzdělávání", width: a4w, height: a4h, unit: "mm", headline: "OBJEVUJEME SVĚT", subtitle: "Jméno: __________  Datum: __________", kicker: "PRACOVNÍ LIST", cta: "Hotovo!", accent: "#f59e0b", tags: ["pracovní list", "škola", "úkoly"] },
  { slug: "mind-map", title: "Myšlenková mapa", category: "Vzdělávání", width: 1600, height: 900, headline: "OD NÁPADU K PLÁNU", subtitle: "Propojte myšlenky a najděte směr.", kicker: "BRAINSTORMING", cta: "Přidat nápad", accent: "#8b5cf6", tags: ["myšlenková mapa", "nápady", "výuka"] },
  { slug: "pitch-title", title: "Úvod pitch decku", category: "Prezentace", width: 1920, height: 1080, headline: "NÁPAD, KTERÝ ROSTE", subtitle: "Nová kapitola pro náš tým.", kicker: "PITCH DECK · 2026", cta: "Začínáme", accent: "#a3e635", tags: ["pitch", "úvod", "startup"] },
  { slug: "pitch-problem", title: "Problém a řešení", category: "Prezentace", width: 1920, height: 1080, headline: "PROBLÉM. ŘEŠENÍ.", subtitle: "Jednodušší cesta od potřeby k výsledku.", kicker: "01 / VIZE", cta: "Naše řešení", accent: "#fb7185", tags: ["pitch", "problém", "řešení"] },
  { slug: "pitch-team", title: "Představení týmu", category: "Prezentace", width: 1920, height: 1080, headline: "LIDÉ ZA NÁPADEM", subtitle: "Zkušenosti, energie a společný cíl.", kicker: "02 / TÝM", cta: "Poznejte nás", accent: "#60a5fa", tags: ["pitch", "tým", "lidé"] },
  { slug: "pricing", title: "Cenová matice", category: "Prezentace", width: 1920, height: 1080, headline: "PLÁN PRO KAŽDÝ TÝM", subtitle: "Vyberte tempo, které vám sedí.", kicker: "03 / CENÍK", cta: "Vybrat plán", accent: "#2dd4bf", tags: ["pitch", "cena", "tarify"] },
  { slug: "product-launch", title: "Představení produktu", category: "Příspěvek na Instagram", width: 1080, height: 1080, headline: "PŘICHÁZÍ NOVINKA", subtitle: "Detaily, na kterých záleží.", kicker: "PREMIÉRA", cta: "Objevovat", accent: "#f472b6", tags: ["produkt", "uvedení", "novinka"] },
];

function detail(p: PageBuilder, concept: Concept, w: number, h: number, color: string, muted: string) {
  const slug = concept.slug;
  if (slug === "timetable") {
    const days = ["PO", "ÚT", "ST", "ČT", "PÁ"];
    days.forEach((day, index) => {
      const x = w * (0.07 + index * 0.185);
      p.rect(`Den ${day}`, { x, y: h * 0.55, w: w * 0.17, h: h * 0.11, r: 12, fill: muted });
      p.text(`Popis dne ${day}`, { x, y: h * 0.57, w: w * 0.17, text: day, size: w * 0.025, font: "Inter", bold: true, color, align: "center" });
    });
  } else if (slug === "worksheet") {
    [1, 2, 3].forEach((n) => p.text(`Otázka ${n}`, { x: w * 0.08, y: h * (0.58 + n * 0.095), w: w * 0.84, text: `${n}. __________________________________`, size: w * 0.025, font: "Inter", color }));
  } else if (slug === "mind-map") {
    const points = [[0.13, 0.56], [0.31, 0.74], [0.5, 0.55], [0.69, 0.74], [0.86, 0.56]];
    points.forEach(([x, y], index) => {
      p.circle(`Nápad ${index + 1}`, { cx: w * x, cy: h * y, r: w * 0.026, fill: concept.accent });
      p.text(`Nápad štítek ${index + 1}`, { x: w * (x - 0.05), y: h * (y + 0.05), w: w * 0.1, text: `Nápad ${index + 1}`, size: w * 0.014, font: "Inter", color, align: "center" });
    });
  } else if (slug === "pricing") {
    ["START", "TEAM", "PRO"].forEach((name, index) => {
      const x = w * (0.055 + index * 0.15);
      p.rect(`Tarif ${name}`, { x, y: h * 0.59, w: w * 0.13, h: h * 0.23, r: 15, fill: muted });
      p.text(`Tarif název ${name}`, { x, y: h * 0.63, w: w * 0.13, text: name, size: w * 0.017, font: "Inter", bold: true, color, align: "center" });
    });
  } else if (slug === "podcast" || slug === "story-podcast") {
    for (let i = 0; i < 11; i++) p.rect(`Zvuková vlna ${i}`, { x: w * (0.06 + i * 0.036), y: h * (0.72 - (i % 4) * 0.014), w: w * 0.011, h: h * (0.06 + (i % 4) * 0.028), r: 10, fill: concept.accent });
  } else if (slug === "finance") {
    [0.13, 0.19, 0.27, 0.35].forEach((v, i) => p.rect(`Graf ${i}`, { x: w * (0.08 + i * 0.085), y: h * (0.84 - v), w: w * 0.045, h: h * v, r: 5, fill: concept.accent }));
  } else if (slug === "coding") {
    p.rect("Okno editoru", { x: w * 0.06, y: h * 0.64, w: w * 0.39, h: h * 0.2, r: 12, fill: "#111827" });
    p.text("Ukázka kódu", { x: w * 0.085, y: h * 0.68, w: w * 0.34, text: "const nápad = true;\nnavrhni(nápad);", size: w * 0.018, font: "Fira Code", color: "#7dd3fc" });
  } else if (slug === "sale") {
    p.circle("Sleva", { cx: w * 0.86, cy: h * 0.12, r: w * 0.07, fill: concept.accent });
    p.text("Sleva číslo", { x: w * 0.8, y: h * 0.095, w: w * 0.12, text: "50 %", size: w * 0.032, font: "Anton", color: "#ffffff", align: "center" });
  } else if (slug === "fitness") {
    ["Pohyb", "Energie", "Odpočinek"].forEach((word, index) => p.text(`Tip ${index}`, { x: w * 0.07, y: h * (0.63 + index * 0.07), w: w * 0.39, text: `✓ ${word}`, size: w * 0.026, font: "Inter", bold: true, color }));
  } else if (slug === "gaming") {
    p.path("Dynamická šipka", { x: w * 0.32, y: h * 0.6, d: "M 0 70 L 110 0 L 95 55 L 180 50 L 45 155 Z", fill: concept.accent });
  }
}

function make(concept: Concept, variant: 1 | 2): BuiltInTemplate {
  const { width: w, height: h } = concept;
  const portrait = h > w * 1.2;
  const dark = variant === 1;
  const bg = dark ? "#101625" : "#f8fafc";
  const fg = dark ? "#ffffff" : "#142033";
  const muted = dark ? "#263349" : "#e4eaf1";
  const slug = `generated-${concept.slug}-${variant === 1 ? "bold" : "calm"}`;
  const p = new PageBuilder(`${slug}-p1`, w, h).background(dark ? gradient(25, bg, "#263149") : bg);
  p.circle("Dekorativní kruh", { cx: w * (variant === 1 ? 0.96 : 0.04), cy: h * 0.05, r: w * 0.17, fill: concept.accent, opacity: dark ? 0.22 : 0.12 });
  p.rect("Akcentní pruh", { x: w * 0.055, y: h * 0.055, w: w * 0.065, h: Math.max(5, h * 0.006), r: 4, fill: concept.accent });

  const x = w * 0.06;
  const textW = portrait ? w * 0.88 : w * 0.47;
  const titleY = portrait ? h * (dark ? 0.16 : 0.61) : h * 0.25;
  const frame = portrait
    ? { x: w * 0.08, y: h * (dark ? 0.47 : 0.08), w: w * 0.84, h: h * 0.32 }
    : { x: w * (dark ? 0.57 : 0.53), y: h * 0.15, w: w * 0.39, h: h * 0.69 };
  const textX = portrait ? x : dark ? x : w * 0.06;
  p.text("Štítek", { x: textX, y: titleY - h * 0.09, w: textW, text: concept.kicker, size: Math.max(15, w * 0.024), font: "Inter", bold: true, color: concept.accent, spacing: 130 });
  p.text("Nadpis", { x: textX, y: titleY, w: textW, text: concept.headline, size: Math.min(w * (portrait ? 0.074 : 0.055), h * 0.115), font: dark ? "Montserrat" : "Playfair Display", bold: true, color: fg, lineHeight: 1.04 });
  p.text("Podnadpis", { x: textX, y: titleY + h * (portrait ? 0.14 : 0.22), w: textW, text: concept.subtitle, size: Math.min(w * 0.028, h * 0.045), font: "Inter", color: fg, opacity: 0.85, lineHeight: 1.25 });
  p.rect("Zvýraznění fotografie", { x: frame.x - 8, y: frame.y - 8, w: frame.w + 16, h: frame.h + 16, r: 20, fill: null, stroke: concept.accent, strokeWidth: 5, opacity: 0.7 });
  p.frame("Fotografie – přetáhněte obrázek", { ...frame, shape: concept.slug === "property" ? "arch" : concept.slug === "story-podcast" ? "circle" : "rounded" });
  const buttonY = portrait ? h * 0.89 : h * 0.75;
  p.rect("Tlačítko", { x: textX, y: buttonY, w: textW * 0.53, h: Math.max(44, h * 0.072), r: 18, fill: concept.accent });
  p.text("Výzva k akci", { x: textX, y: buttonY + h * 0.013, w: textW * 0.53, text: concept.cta, size: Math.max(17, w * 0.022), font: "Inter", bold: true, color: dark ? "#101625" : "#ffffff", align: "center" });
  p.text("Zápatí", { x: x, y: h * 0.94, w: w * 0.88, text: "VAŠE ZNAČKA  ·  VÁŠ PŘÍBĚH", size: Math.max(12, w * 0.014), font: "Inter", color: fg, opacity: 0.5, spacing: 180 });
  detail(p, concept, w, h, fg, muted);
  return { slug, title: `${concept.title} · ${dark ? "Výrazná" : "Světlá"}`, category: concept.category, width: w, height: h, unit: concept.unit ?? "px", tags: [...concept.tags, dark ? "výrazná" : "světlá", "česky", "editovatelný rámeček"], pages: [p.build()] };
}

export function generateTemplates(): BuiltInTemplate[] {
  return concepts.flatMap((concept) => [make(concept, 1), make(concept, 2)]);
}
