/**
 * The built-in templates. Self-contained: shapes, text, gradients and paths only, no images; where a
 * photo would go there is a tinted shape. Fonts come from the bundled font list.
 */
import { toPx } from "../../lib/units";
import { gradient, PageBuilder, type BuiltInTemplate } from "./build";
import { generateTemplates } from "./generated";
import { generateLibraryTemplates } from "./library";

const page = (slug: string, n: number, width: number, height: number) => new PageBuilder(`${slug}-p${n}`, width, height);

function instagramBusiness(): BuiltInTemplate {
  const slug = "instagram-post-business";
  const navy = "#0f172a";
  const white = "#f8fafc";
  const amber = "#f59e0b";
  const slate = "#94a3b8";
  const p = page(slug, 1, 1080, 1080)
    .background(navy)
    .circle("Accent circle", { cx: 1000, cy: 70, r: 230, fill: amber })
    .circle("Ring", { cx: 1000, cy: 70, r: 300, stroke: white, strokeWidth: 2, opacity: 0.25 })
    .text("Brand", { x: 80, y: 84, w: 600, text: "Northwind Studio", size: 26, font: "Inter", bold: true, color: amber, spacing: 300, upper: true })
    .text("Heading", { x: 80, y: 262, w: 800, text: "Grow your business with design that works.", size: 84, font: "Montserrat", bold: true, color: white, lineHeight: 1.08 })
    .text("Body", { x: 80, y: 716, w: 660, text: "Brand identity, websites and campaigns for small teams.", size: 32, font: "Inter", color: slate, lineHeight: 1.35 })
    .rect("Button", { x: 80, y: 868, w: 360, h: 88, r: 44, fill: amber })
    .text("Button label", { x: 80, y: 893, w: 360, text: "Book a free call", size: 30, font: "Inter", bold: true, color: navy, align: "center" })
    .text("Handle", { x: 600, y: 896, w: 400, text: "@northwind.studio", size: 26, font: "Inter", color: slate, align: "right" });
  return { slug, title: "Firemní propagace", category: "Příspěvek na Instagram", width: 1080, height: 1080, unit: "px", tags: ["business", "agency", "marketing", "dark", "call to action"], pages: [p.build()] };
}

function instagramQuote(): BuiltInTemplate {
  const slug = "instagram-post-quote";
  const cream = "#f5efe6";
  const ink = "#2b2118";
  const terracotta = "#c2410c";
  const p = page(slug, 1, 1080, 1080)
    .background(cream)
    .rect("Frame", { x: 40, y: 40, w: 1000, h: 1000, stroke: ink, strokeWidth: 2, opacity: 0.15 })
    .text("Quote mark", { x: 112, y: 120, w: 300, text: "“", size: 300, font: "Playfair Display", color: terracotta, lineHeight: 1 })
    .text("Quote", { x: 120, y: 360, w: 840, text: "Do the work. Keep it simple. Make it beautiful.", size: 76, font: "Playfair Display", italic: true, color: ink, lineHeight: 1.2 })
    .rect("Rule", { x: 120, y: 720, w: 80, h: 4, fill: terracotta })
    .text("Author", { x: 120, y: 752, w: 840, text: "Ada Novak", size: 26, font: "Inter", bold: true, color: ink, spacing: 250, upper: true })
    .text("Handle", { x: 120, y: 940, w: 840, text: "@dailywords", size: 24, font: "Inter", color: ink, opacity: 0.6 });
  return { slug, title: "Citát", category: "Příspěvek na Instagram", width: 1080, height: 1080, unit: "px", tags: ["quote", "inspiration", "serif", "minimal", "cream"], pages: [p.build()] };
}

function instagramSale(): BuiltInTemplate {
  const slug = "instagram-post-sale";
  const yellow = "#fde047";
  const black = "#111111";
  const red = "#e11d48";
  const p = page(slug, 1, 1080, 1080)
    .background(yellow)
    .rect("Stripe", { x: -120, y: 92, w: 1320, h: 56, fill: black, angle: -4 })
    .text("Stripe text", { x: -119, y: 104, w: 1320, text: "Limited time · Limited time · Limited time", size: 24, font: "Inter", bold: true, color: yellow, spacing: 300, upper: true, align: "center", angle: -4 })
    .text("Summer", { x: 0, y: 196, w: 1080, text: "Summer", size: 150, font: "Anton", color: black, align: "center", upper: true, lineHeight: 1 })
    .text("Sale", { x: 0, y: 350, w: 1080, text: "Sale", size: 340, font: "Anton", color: red, align: "center", upper: true, lineHeight: 1, effect: { type: "shadow", offset: 30, direction: 45, blur: 0, color: black, transparency: 0 } })
    .text("Offer", { x: 0, y: 728, w: 1080, text: "Up to 50% off", size: 60, font: "Inter", bold: true, color: black, align: "center", spacing: 50, upper: true })
    .rect("Button", { x: 290, y: 830, w: 500, h: 96, r: 48, fill: black })
    .text("Button label", { x: 290, y: 858, w: 500, text: "Shop now", size: 34, font: "Inter", bold: true, color: yellow, align: "center", spacing: 300, upper: true })
    .text("Details", { x: 0, y: 970, w: 1080, text: "Online and in store · 1–15 July", size: 26, font: "Inter", color: black, align: "center" });
  return { slug, title: "Letní výprodej", category: "Příspěvek na Instagram", width: 1080, height: 1080, unit: "px", tags: ["sale", "discount", "shop", "summer", "bold", "yellow"], pages: [p.build()] };
}

function storyEvent(): BuiltInTemplate {
  const slug = "instagram-story-event";
  const white = "#ffffff";
  const pink = "#f472b6";
  const lavender = "#c4b5fd";
  const p = page(slug, 1, 1080, 1920)
    .background(gradient(90, "#1e1b4b", "#4c1d95"))
    .circle("Ring", { cx: 540, cy: 720, r: 430, stroke: pink, strokeWidth: 3, opacity: 0.45 })
    .circle("Glow dot", { cx: 860, cy: 330, r: 14, fill: pink })
    .circle("Glow dot", { cx: 210, cy: 1110, r: 9, fill: lavender })
    .text("Label", { x: 0, y: 220, w: 1080, text: "Live music night", size: 30, font: "Inter", bold: true, color: pink, spacing: 400, upper: true, align: "center" })
    .text("Title", { x: 0, y: 430, w: 1080, text: "Neon\nNights", size: 300, font: "Bebas Neue", color: white, align: "center", lineHeight: 0.9, upper: true, effect: { type: "neon", intensity: 45, color: pink } })
    .text("Date", { x: 0, y: 1250, w: 1080, text: "Sat 14 September · 21:00", size: 50, font: "Inter", bold: true, color: white, align: "center" })
    .text("Venue", { x: 0, y: 1325, w: 1080, text: "Lucerna Music Bar, Prague", size: 36, font: "Inter", color: lavender, align: "center" })
    .rect("Button", { x: 240, y: 1560, w: 600, h: 112, r: 56, fill: pink })
    .text("Button label", { x: 240, y: 1592, w: 600, text: "Get tickets", size: 40, font: "Inter", bold: true, color: "#1e1b4b", align: "center", spacing: 300, upper: true });
  return { slug, title: "Večerní akce", category: "Příběh na Instagram", width: 1080, height: 1920, unit: "px", tags: ["event", "music", "party", "concert", "neon", "purple"], pages: [p.build()] };
}

function storyFashion(): BuiltInTemplate {
  const slug = "instagram-story-fashion";
  const paper = "#f4f1ec";
  const black = "#0a0a0a";
  const camel = "#b08968";
  const p = page(slug, 1, 1080, 1920)
    .background(paper)
    .text("Brand", { x: 0, y: 84, w: 1080, text: "Maison Élan", size: 28, font: "Montserrat", color: black, spacing: 600, upper: true, align: "center" })
    .rect("Photo", { x: 80, y: 170, w: 920, h: 1120, fill: gradient(60, "#d6c2a8", camel) })
    .text("Photo note", { x: 120, y: 1220, w: 600, text: "New season", size: 30, font: "Cormorant Garamond", italic: true, color: paper })
    .text("Kicker", { x: 0, y: 1360, w: 1080, text: "The autumn edit", size: 30, font: "Montserrat", color: camel, spacing: 600, upper: true, align: "center" })
    .text("Title", { x: 0, y: 1410, w: 1080, text: "Quiet Luxury", size: 140, font: "Cormorant Garamond", italic: true, color: black, align: "center", lineHeight: 1 })
    .text("Offer", { x: 0, y: 1600, w: 1080, text: "20% off the new collection", size: 34, font: "Montserrat", color: black, align: "center" })
    .text("Link", { x: 0, y: 1730, w: 1080, text: "Shop the look", size: 26, font: "Montserrat", bold: true, color: black, spacing: 400, upper: true, align: "center" })
    .rect("Underline", { x: 440, y: 1772, w: 200, h: 2, fill: black });
  return { slug, title: "Módní propagace", category: "Příběh na Instagram", width: 1080, height: 1920, unit: "px", tags: ["fashion", "promo", "shop", "elegant", "serif", "collection"], pages: [p.build()] };
}

function presentationTitle(): BuiltInTemplate {
  const slug = "presentation-title";
  const green = "#0b3d2e";
  const cream = "#f1f5e9";
  const lime = "#a3e635";
  const p = page(slug, 1, 1920, 1080)
    .background(green)
    .circle("Accent circle", { cx: 1660, cy: 860, r: 380, fill: lime })
    .circle("Ring", { cx: 1660, cy: 860, r: 470, stroke: cream, strokeWidth: 2, opacity: 0.3 })
    .text("Label", { x: 140, y: 300, w: 1100, text: "Quarterly review · Q3 2026", size: 28, font: "DM Sans", bold: true, color: lime, spacing: 300, upper: true })
    .text("Title", { x: 140, y: 360, w: 1150, text: "Building the next chapter", size: 128, font: "DM Serif Display", color: cream, lineHeight: 1.05 })
    .text("Subtitle", { x: 140, y: 690, w: 1000, text: "Strategy update for the leadership team", size: 40, font: "DM Sans", color: cream, opacity: 0.75 })
    .rect("Rule", { x: 140, y: 920, w: 60, h: 3, fill: lime })
    .text("Presenter", { x: 140, y: 945, w: 900, text: "Northwind Studio · 12 November 2026", size: 26, font: "DM Sans", color: cream, opacity: 0.75 });
  return { slug, title: "Úvodní snímek", category: "Prezentace", width: 1920, height: 1080, unit: "px", tags: ["presentation", "title", "cover", "business", "green"], pages: [p.build()] };
}

function presentationData(): BuiltInTemplate {
  const slug = "presentation-data";
  const ink = "#111827";
  const blue = "#2563eb";
  const light = "#bfdbfe";
  const grey = "#6b7280";
  const values = [38, 45, 52, 61, 70, 84];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const base = 900;
  const maxHeight = 460;
  const p = page(slug, 1, 1920, 1080)
    .background("#ffffff")
    .text("Label", { x: 140, y: 110, w: 1000, text: "Results · first half", size: 26, font: "Inter", bold: true, color: blue, spacing: 300, upper: true })
    .text("Title", { x: 140, y: 152, w: 1500, text: "Revenue grew 42% this year", size: 76, font: "Manrope", bold: true, color: ink })
    .rect("Axis", { x: 140, y: base, w: 1010, h: 2, fill: "#e5e7eb" });
  values.forEach((v, i) => {
    const h = (v / 84) * maxHeight;
    const x = 160 + i * 165;
    p.rect(`Bar ${months[i]}`, { x, y: base - h, w: 110, h, r: 8, fill: i === values.length - 1 ? blue : light })
      .text(`Value ${months[i]}`, { x: x - 20, y: base - h - 46, w: 150, text: `${v}k`, size: 28, font: "Inter", bold: true, color: ink, align: "center" })
      .text(`Month ${months[i]}`, { x: x - 20, y: base + 22, w: 150, text: months[i], size: 26, font: "Inter", color: grey, align: "center" });
  });
  p.text("Stat", { x: 1300, y: 400, w: 480, text: "+42%", size: 150, font: "Manrope", bold: true, color: blue, lineHeight: 1 })
    .text("Stat caption", { x: 1300, y: 570, w: 480, text: "Revenue growth compared with the first half of last year", size: 32, font: "Inter", color: grey, lineHeight: 1.35 })
    .rect("Divider", { x: 1300, y: 710, w: 480, h: 2, fill: "#e5e7eb" })
    .text("Stat 2", { x: 1300, y: 740, w: 480, text: "1,280", size: 72, font: "Manrope", bold: true, color: ink, lineHeight: 1 })
    .text("Stat 2 caption", { x: 1300, y: 828, w: 480, text: "New customers", size: 32, font: "Inter", color: grey });
  return { slug, title: "Snímek s daty", category: "Prezentace", width: 1920, height: 1080, unit: "px", tags: ["presentation", "data", "chart", "results", "report", "blue"], pages: [p.build()] };
}

function presentationPitch(): BuiltInTemplate {
  const slug = "presentation-pitch";
  const violet = "#6d28d9";
  const ink = "#18181b";
  const paper = "#fafaf9";
  const soft = "#ede9fe";
  const cover = page(slug, 1, 1920, 1080)
    .background(gradient(35, "#7c3aed", "#4f46e5"))
    .circle("Halo", { cx: 1450, cy: 540, r: 300, fill: paper, opacity: 0.12 })
    .circle("Bulb", { cx: 1450, cy: 540, r: 170, fill: paper, opacity: 0.9 })
    .text("Name", { x: 140, y: 330, w: 1000, text: "Lumen", size: 220, font: "Outfit", bold: true, color: paper, lineHeight: 1 })
    .text("Tagline", { x: 140, y: 590, w: 1000, text: "Lighting that learns your day.", size: 56, font: "Outfit", color: paper })
    .text("Round", { x: 140, y: 900, w: 1000, text: "Seed round · 2026", size: 30, font: "Inter", color: paper, opacity: 0.7, spacing: 100 });
  const problem = page(slug, 2, 1920, 1080)
    .background(paper)
    .text("Label", { x: 140, y: 140, w: 1000, text: "The problem", size: 28, font: "Inter", bold: true, color: violet, spacing: 300, upper: true })
    .text("Heading", { x: 140, y: 190, w: 1500, text: "Homes waste a third of their lighting energy.", size: 88, font: "Outfit", bold: true, color: ink, lineHeight: 1.1 });
  const cards: [string, string][] = [
    ["30%", "of lighting energy is spent on empty rooms"],
    ["2.1 h", "lights stay on each day after everyone has left"],
    ["€140", "lost by an average household every year"],
  ];
  cards.forEach(([value, caption], i) => {
    const x = 140 + i * 570;
    problem
      .rect(`Card ${i + 1}`, { x, y: 560, w: 500, h: 340, r: 24, fill: soft })
      .text(`Card ${i + 1} value`, { x: x + 48, y: 610, w: 404, text: value, size: 96, font: "Outfit", bold: true, color: violet, lineHeight: 1 })
      .text(`Card ${i + 1} caption`, { x: x + 48, y: 740, w: 404, text: caption, size: 32, font: "Inter", color: ink, lineHeight: 1.35 });
  });
  const ask = page(slug, 3, 1920, 1080)
    .background(ink)
    .text("Label", { x: 140, y: 140, w: 1000, text: "The ask", size: 28, font: "Inter", bold: true, color: "#a78bfa", spacing: 300, upper: true })
    .text("Heading", { x: 140, y: 190, w: 1400, text: "Raising €1.5M to launch in three countries.", size: 88, font: "Outfit", bold: true, color: paper, lineHeight: 1.1 })
    .text("Plan", {
      x: 140,
      y: 520,
      w: 1100,
      text: "Manufacturing for the first 10,000 units\nA team of 12 across hardware and software\nLaunch in Czechia, Austria and Germany",
      size: 40,
      font: "Inter",
      color: paper,
      lineHeight: 1.6,
      list: "bullet",
    })
    .text("Contact", { x: 140, y: 930, w: 1000, text: "hello@lumen.example", size: 30, font: "Inter", color: "#a78bfa" });
  return { slug, title: "Prezentace pro investory", category: "Prezentace", width: 1920, height: 1080, unit: "px", tags: ["presentation", "pitch", "startup", "investors", "violet"], pages: [cover.build(), problem.build(), ask.build()] };
}

function youtubeReview(): BuiltInTemplate {
  const slug = "youtube-thumbnail-review";
  const white = "#ffffff";
  const yellow = "#facc15";
  const red = "#ef4444";
  const p = page(slug, 1, 1280, 720)
    .background(gradient(0, "#0f172a", "#1e293b"))
    .rect("Photo", { x: 780, y: 70, w: 430, h: 580, r: 24, fill: gradient(90, "#475569", "#334155"), stroke: yellow, strokeWidth: 8, angle: 3 })
    .text("Line 1", { x: 60, y: 110, w: 720, text: "I tried it", size: 130, font: "Anton", color: white, upper: true, lineHeight: 1, effect: { type: "outline", thickness: 40, color: "#000000" } })
    .text("Line 2", { x: 60, y: 260, w: 720, text: "for 30 days", size: 140, font: "Anton", color: yellow, upper: true, lineHeight: 1, effect: { type: "outline", thickness: 40, color: "#000000" } })
    .path("Arrow", { x: 560, y: 470, d: "M 0 60 C 60 10 140 0 210 20 M 170 -10 L 214 22 L 172 58", stroke: red, strokeWidth: 16 })
    .rect("Badge", { x: 60, y: 520, w: 380, h: 76, r: 10, fill: red })
    .text("Badge label", { x: 60, y: 538, w: 380, text: "Honest review", size: 36, font: "Inter", bold: true, color: white, align: "center", upper: true, spacing: 100 });
  return { slug, title: "Miniatura recenze", category: "Miniatura pro YouTube", width: 1280, height: 720, unit: "px", tags: ["youtube", "thumbnail", "review", "tech", "challenge", "bold"], pages: [p.build()] };
}

function youtubeRecipe(): BuiltInTemplate {
  const slug = "youtube-thumbnail-recipe";
  const orange = "#f97316";
  const white = "#ffffff";
  const dark = "#1c1917";
  const p = page(slug, 1, 1280, 720)
    .background(orange)
    .circle("Photo", { cx: 960, cy: 380, r: 290, fill: gradient(45, "#fed7aa", "#fdba74"), stroke: white, strokeWidth: 14 })
    .circle("Sticker", { cx: 760, cy: 150, r: 78, fill: dark })
    .text("Sticker text", { x: 682, y: 112, w: 156, text: "15\nmin", size: 34, font: "Inter", bold: true, color: white, align: "center", lineHeight: 1 })
    .text("Kicker", { x: 70, y: 100, w: 600, text: "Easy", size: 110, font: "Pacifico", color: white, effect: { type: "shadow", offset: 25, direction: 60, blur: 0, color: dark, transparency: 0 } })
    .text("Title", { x: 70, y: 256, w: 680, text: "Pasta in\n15 minutes", size: 170, font: "Bebas Neue", color: dark, upper: true, lineHeight: 0.88 })
    .text("Series", { x: 70, y: 630, w: 700, text: "Ep. 12 · Weeknight dinners", size: 30, font: "Inter", bold: true, color: white, upper: true, spacing: 150 });
  return { slug, title: "Miniatura receptu", category: "Miniatura pro YouTube", width: 1280, height: 720, unit: "px", tags: ["youtube", "thumbnail", "food", "recipe", "cooking", "orange"], pages: [p.build()] };
}

function logoMonogram(): BuiltInTemplate {
  const slug = "logo-monogram";
  const teal = "#0f766e";
  const ink = "#0f172a";
  const p = page(slug, 1, 500, 500)
    .background("#ffffff")
    .circle("Mark", { cx: 250, cy: 185, r: 110, fill: teal })
    .text("Monogram", { x: 140, y: 85, w: 220, text: "N", size: 170, font: "DM Serif Display", color: "#ffffff", align: "center", lineHeight: 1 })
    .text("Name", { x: 20, y: 328, w: 460, text: "Northwind", size: 42, font: "Montserrat", bold: true, color: ink, align: "center", spacing: 350, upper: true })
    .text("Descriptor", { x: 20, y: 390, w: 460, text: "Design studio", size: 17, font: "Montserrat", color: teal, align: "center", spacing: 600, upper: true });
  return { slug, title: "Logo s monogramem", category: "Logo", width: 500, height: 500, unit: "px", tags: ["logo", "monogram", "brand", "studio", "teal"], pages: [p.build()] };
}

function logoLeaf(): BuiltInTemplate {
  const slug = "logo-leaf";
  const cream = "#fefce8";
  const green = "#65a30d";
  const forest = "#1a2e05";
  // Three leaves growing from one point: the two side leaves in one path, the middle one in another.
  const sides = "M 0 140 C -60 125 -88 70 -72 12 C -22 32 8 82 0 140 Z M 0 140 C 60 125 88 70 72 12 C 22 32 -8 82 0 140 Z";
  const middle = "M 0 140 C -28 95 -24 42 0 0 C 24 42 28 95 0 140 Z";
  const p = page(slug, 1, 500, 500)
    .background(cream)
    .path("Side leaves", { x: 250, y: 205, d: sides, anchor: "bottom", fill: green, scale: 0.8 })
    .path("Middle leaf", { x: 250, y: 205, d: middle, anchor: "bottom", fill: forest, scale: 0.8 })
    .text("Name", { x: 20, y: 222, w: 460, text: "Verde", size: 104, font: "Playfair Display", bold: true, italic: true, color: forest, align: "center", lineHeight: 1 })
    .text("Descriptor", { x: 20, y: 352, w: 460, text: "Plant shop", size: 20, font: "Inter", color: green, align: "center", spacing: 700, upper: true });
  return { slug, title: "Logo s listem", category: "Logo", width: 500, height: 500, unit: "px", tags: ["logo", "plants", "nature", "shop", "green", "organic"], pages: [p.build()] };
}

function posterConcert(): BuiltInTemplate {
  const slug = "poster-concert";
  const width = toPx(297, "mm");
  const height = toPx(420, "mm");
  const cream = "#fff7ed";
  const ink = "#0f172a";
  const orange = "#f97316";
  const blue = "#1d4ed8";
  const p = page(slug, 1, width, height)
    .background(cream)
    .circle("Sun", { cx: 800, cy: 600, r: 360, fill: orange })
    .text("Label", { x: 90, y: 90, w: 940, text: "Open-air concert series", size: 26, font: "Inter", bold: true, color: ink, spacing: 400, upper: true })
    .text("Title", { x: 84, y: 200, w: 940, text: "Jazz\nin the\npark", size: 270, font: "Bebas Neue", color: ink, upper: true, lineHeight: 0.86 })
    .rect("Band", { x: 0, y: 1150, w: width, h: height - 1150, fill: blue })
    .text("When", { x: 90, y: 1215, w: 940, text: "Every Friday in August", size: 48, font: "Inter", bold: true, color: cream })
    .text("Where", { x: 90, y: 1290, w: 940, text: "19:00 · Letná Park, Prague · Free entry", size: 32, font: "Inter", color: cream, opacity: 0.85 })
    .text("Web", { x: 90, y: 1470, w: 940, text: "jazzinthepark.example", size: 26, font: "Inter", bold: true, color: cream, spacing: 100 });
  return { slug, title: "Koncertní plakát", category: "Plakát", width, height, unit: "mm", tags: ["poster", "music", "jazz", "event", "concert", "A3"], pages: [p.build()] };
}

function resume(): BuiltInTemplate {
  const slug = "resume-clean";
  const width = toPx(210, "mm");
  const height = toPx(297, "mm");
  const ink = "#1f2937";
  const teal = "#0e7490";
  const side = "#f1f5f9";
  const grey = "#6b7280";
  const label = (p: PageBuilder, name: string, x: number, y: number, w: number) =>
    p.text(name, { x, y, w, text: name, size: 13, font: "Source Sans 3", bold: true, color: teal, spacing: 250, upper: true });
  const p = page(slug, 1, width, height).background("#ffffff").rect("Sidebar", { x: 0, y: 0, w: 260, h: height, fill: side });
  label(p, "Contact", 36, 80, 200);
  p.text("Contact details", { x: 36, y: 106, w: 200, text: "klara@example.com\n+420 777 123 456\nPrague, Czechia\nklara.example", size: 14, font: "Source Sans 3", color: ink, lineHeight: 1.6 });
  label(p, "Skills", 36, 250, 200);
  p.text("Skills list", { x: 36, y: 276, w: 200, text: "User research\nPrototyping\nDesign systems\nUsability testing\nFigma, HTML and CSS", size: 14, font: "Source Sans 3", color: ink, lineHeight: 1.6, list: "bullet" });
  label(p, "Languages", 36, 440, 200);
  p.text("Languages list", { x: 36, y: 466, w: 200, text: "Czech · native\nEnglish · C1\nGerman · B1", size: 14, font: "Source Sans 3", color: ink, lineHeight: 1.6 });
  p.text("Name", { x: 300, y: 70, w: 460, text: "Klára Dvořáková", size: 40, font: "Lora", bold: true, color: ink, lineHeight: 1.1 })
    .text("Role", { x: 300, y: 122, w: 460, text: "UX designer", size: 20, font: "Source Sans 3", color: teal })
    .rect("Rule", { x: 300, y: 164, w: 48, h: 3, fill: teal });
  label(p, "Profile", 300, 196, 460);
  p.text("Profile text", {
    x: 300,
    y: 222,
    w: 450,
    text: "Designer with eight years of experience making complex products simple to use. I work closely with engineers and research every decision with the people who use the product.",
    size: 14,
    font: "Source Sans 3",
    color: ink,
    lineHeight: 1.5,
  });
  label(p, "Experience", 300, 330, 460);
  const job = (y: number, role: string, when: string, points: string) =>
    p
      .text(`${role}`, { x: 300, y, w: 450, text: role, size: 16, font: "Source Sans 3", bold: true, color: ink })
      .text(`${role} dates`, { x: 300, y: y + 22, w: 450, text: when, size: 13, font: "Source Sans 3", color: grey })
      .text(`${role} points`, { x: 300, y: y + 48, w: 450, text: points, size: 14, font: "Source Sans 3", color: ink, lineHeight: 1.5, list: "bullet" });
  job(358, "Senior UX designer, Northwind Studio", "2022 – present · Prague", "Led the redesign of a booking platform used by 40,000 people\nBuilt and documented a shared design system\nRan monthly usability tests with customers");
  job(526, "UX designer, Lumen", "2018 – 2022 · Brno", "Designed the companion app from first sketch to launch\nWorked with hardware engineers on on-device controls\nCut setup time for new customers from 20 to 5 minutes");
  job(694, "Junior designer, Studio Vltava", "2016 – 2018 · Prague", "Designed websites and print for cultural clients\nMade the studio's first usability test plan");
  label(p, "Education", 300, 852, 460);
  p.text("Degree", { x: 300, y: 880, w: 450, text: "MA Interaction Design", size: 16, font: "Source Sans 3", bold: true, color: ink })
    .text("School", { x: 300, y: 902, w: 450, text: "Academy of Arts, Architecture and Design in Prague · 2014 – 2016", size: 13, font: "Source Sans 3", color: grey, lineHeight: 1.4 });
  label(p, "Interests", 36, 600, 200);
  p.text("Interests text", { x: 36, y: 626, w: 200, text: "Ceramics, trail running and board games", size: 14, font: "Source Sans 3", color: ink, lineHeight: 1.6 });
  return { slug, title: "Čistý životopis", category: "Životopis", width, height, unit: "mm", tags: ["resume", "cv", "job", "A4", "two column", "teal"], pages: [p.build()] };
}

function businessCard(): BuiltInTemplate {
  const slug = "business-card-architect";
  const width = toPx(85, "mm");
  const height = toPx(55, "mm");
  const ink = "#111827";
  const gold = "#fbbf24";
  const white = "#ffffff";
  const front = page(slug, 1, width, height)
    .background(ink)
    .rect("Stripe", { x: 0, y: 0, w: 6, h: height, fill: gold })
    .rect("Mark", { x: 268, y: 26, w: 18, h: 18, fill: null, stroke: gold, strokeWidth: 2, angle: 45 })
    .text("Name", { x: 26, y: 34, w: 220, text: "Tomáš Král", size: 22, font: "Montserrat", bold: true, color: white })
    .text("Role", { x: 26, y: 64, w: 220, text: "Architect", size: 10, font: "Inter", color: gold, spacing: 300, upper: true })
    .text("Contact", { x: 26, y: 126, w: 270, text: "+420 603 555 019\ntomas@kral-studio.example\nkral-studio.example", size: 11, font: "Inter", color: white, lineHeight: 1.55, opacity: 0.85 });
  const back = page(slug, 2, width, height)
    .background(gold)
    .rect("Mark", { x: width / 2 - 14, y: 58, w: 28, h: 28, fill: null, stroke: ink, strokeWidth: 3, angle: 45 })
    .text("Studio", { x: 0, y: 108, w: width, text: "Král Studio", size: 18, font: "Montserrat", bold: true, color: ink, align: "center", spacing: 400, upper: true })
    .text("Tagline", { x: 0, y: 134, w: width, text: "Architecture and interiors", size: 10, font: "Inter", color: ink, align: "center", spacing: 100 });
  return { slug, title: "Vizitka architekta", category: "Vizitka", width, height, unit: "mm", tags: ["business card", "contact", "architect", "dark", "gold"], pages: [front.build(), back.build()] };
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  instagramBusiness(),
  instagramQuote(),
  instagramSale(),
  storyEvent(),
  storyFashion(),
  presentationTitle(),
  presentationData(),
  presentationPitch(),
  youtubeReview(),
  youtubeRecipe(),
  logoMonogram(),
  logoLeaf(),
  posterConcert(),
  resume(),
  businessCard(),
  ...generateTemplates(),
  ...generateLibraryTemplates(),
];
