/** A deterministic library of editable compositions. No remote media or random choices. */
import { toPx } from "../../lib/units";
import { PageBuilder, type BuiltInTemplate } from "./build";

type Kind = "promo" | "logo" | "resume" | "card" | "education";
type Topic = { headline: string; subtitle: string };
type Category = {
  slug: string;
  name: string;
  width: number;
  height: number;
  unit: "px" | "mm";
  kind: Kind;
  accent: string;
  kicker: string;
  cta: string;
  topics: Topic[];
};

const topics = (headlines: string, subtitles: string): Topic[] => {
  const names = headlines.split("|");
  const descriptions = subtitles.split("|");
  return names.map((headline, index) => ({ headline, subtitle: descriptions[index % descriptions.length] }));
};

const categories: Category[] = [
  {
    slug: "instagram-post", name: "Příspěvek na Instagram", width: 1080, height: 1080, unit: "px", kind: "promo", accent: "#e95d87", kicker: "PRO VÁŠ FEED", cta: "Zjistit více",
    topics: topics("Nová kolekce|Letní výprodej|Náš příběh|Otevřeno dnes|Tip týdne|Dárek pro vás|Představujeme novinku|Ze zákulisí|Děkujeme|Limitovaná edice|Naše hodnoty|Víkendová nabídka|Malé radosti|Velké oznámení|Váš oblíbenec|Přidejte se k nám|Zpátky v nabídce|Jednoduše krásné|Dnes slavíme|Začněte s námi", "Váš další oblíbený okamžik.|Detaily, které stojí za pozornost.|Inspirace pro každý den.|Objevte něco nového."),
  },
  {
    slug: "instagram-story", name: "Příběh na Instagram", width: 1080, height: 1920, unit: "px", kind: "promo", accent: "#8c62df", kicker: "PRÁVĚ TEĎ", cta: "Přejet nahoru",
    topics: topics("Dnes začínáme|Nová epizoda|Živě v sedm|Hlasujte s námi|Jen dnes|Malá ochutnávka|Před a po|Za scénou|Vaše otázky|Odpočítáváme|Tři rychlé tipy|Pozvánka na akci|Tahle chvíle|Co chystáme|Nový příběh|Poslední šance|Pojďte dál|Den s námi|Nechte se inspirovat|Brzy se uvidíme", "Podívejte se, co je nového.|Zapojte se do dnešního příběhu.|Nenechte si ujít další krok.|Děkujeme, že jste u toho."),
  },
  {
    slug: "presentation", name: "Prezentace", width: 1920, height: 1080, unit: "px", kind: "promo", accent: "#4b86e8", kicker: "PREZENTACE", cta: "Další kapitola",
    topics: topics("Naše vize|Problém a řešení|Růst v číslech|Představení týmu|Plán na rok|Co jsme dokázali|Nový produkt|Mapa příležitostí|Výsledky výzkumu|Příběh značky|Strategie růstu|Klíčové poznatky|Pohled na trh|Cesta zákazníka|Rozpočet projektu|Další kroky|Nápad v praxi|Naše poslání|Technologie v pozadí|Závěrečné shrnutí", "Jasná myšlenka pro další rozhodnutí.|Data, souvislosti a konkrétní plán.|Společně posouváme věci kupředu.|Přehled toho, na čem záleží."),
  },
  {
    slug: "youtube", name: "Miniatura pro YouTube", width: 1280, height: 720, unit: "px", kind: "promo", accent: "#f05a48", kicker: "NOVÉ VIDEO", cta: "Pustit video",
    topics: topics("Tohle mě překvapilo|Návod krok za krokem|Upřímná recenze|Pět věcí, které fungují|Velký test|Co se změnilo?|Nejčastější chyby|Začínáme od nuly|Můj postup|Sedm rychlých tipů|Před a po|Týdenní výzva|Srovnání v praxi|Jak na to?|První dojmy|Otázky a odpovědi|Zkouším něco nového|Co bych udělal jinak|Vše na jednom místě|Tajný trik", "Celý příběh ve videu.|Výsledek vás možná překvapí.|Vyzkoušeno v praxi.|Jednoduchý postup pro každého."),
  },
  {
    slug: "logo", name: "Logo", width: 1000, height: 1000, unit: "px", kind: "logo", accent: "#258f81", kicker: "VIZUÁLNÍ IDENTITA", cta: "",
    topics: topics("AURORA|NORD|LUMEN|MIRA|ATELIER O|NOVUM|TERRA|SOLIS|FORMA|KRUH|VELA|NOVA|ALTO|PRAMEN|MONO|KORA|LÍPA|MARGO|RIVA|SFERA", "studio & design|prostor pro nápady|jednoduše jinak|značka s příběhem"),
  },
  {
    slug: "poster", name: "Plakát", width: toPx(297, "mm"), height: toPx(420, "mm"), unit: "mm", kind: "promo", accent: "#e48336", kicker: "PŘIJĎTE S NÁMI", cta: "Rezervovat místo",
    topics: topics("Hudba pod hvězdami|Letní kino|Noc v galerii|Festival chutí|Trhy ve městě|Koncert pro všechny|Týden designu|Divadlo na dvoře|Otevřený ateliér|Sousedská slavnost|Večer poezie|Setkání tvůrců|Běh pro dobrou věc|Knižní víkend|Jarní workshop|Taneční noc|Městské slavnosti|Dny architektury|Světla a stíny|Kreativní sobota", "Program pro všechny generace.|Jedinečný večer ve vašem městě.|Přijďte objevit něco nového.|Zapište si datum do kalendáře."),
  },
  {
    slug: "resume", name: "Životopis", width: toPx(210, "mm"), height: toPx(297, "mm"), unit: "mm", kind: "resume", accent: "#4b718e", kicker: "PROFESNÍ PROFIL", cta: "",
    topics: topics("Jana Nováková|Tomáš Dvořák|Eliška Svobodová|Adam Procházka|Klára Veselá|Jakub Malý|Tereza Horáková|Filip Beneš|Anna Králová|Matěj Pospíšil|Lucie Černá|Daniel Kučera|Nela Pokorná|Petr Marek|Karolína Hájková|Ondřej Fiala|Barbora Němcová|David Urban|Sára Šimková|Michal Růžička", "Produktová designérka|Projektový manažer|Specialistka marketingu|Vývojář aplikací|Datová analytička|Obchodní konzultant"),
  },
  {
    slug: "business-card", name: "Vizitka", width: toPx(85, "mm"), height: toPx(55, "mm"), unit: "mm", kind: "card", accent: "#b57943", kicker: "OSOBNÍ KONTAKT", cta: "",
    topics: topics("Studio Atlas|Ema Novotná|Jan Beneš|Ateliér List|Marta Design|Petr Král|Viktor Studio|Tereza Fotí|Kavárna Kruh|Nela Kovářová|Forma Lab|Ondřej Marek|Lípa Atelier|Lucie Veselá|Místo Studio|Mira Creative|Dům Nápadů|Adam Urban|Kora Design|Pramen Studio", "design a komunikace|architektura a interiéry|fotografie a příběhy|prostor pro nové nápady"),
  },
  {
    slug: "linkedin", name: "LinkedIn", width: 1200, height: 627, unit: "px", kind: "promo", accent: "#2d76b7", kicker: "PROFESNÍ SÍŤ", cta: "Přečíst příspěvek",
    topics: topics("Hledáme kolegy|Nový milník|Co jsme se naučili|Případová studie|Pozvánka na webinář|Náš tým roste|Čísla za tento rok|Představujeme projekt|Pohled ze zákulisí|Nová spolupráce|Tři praktické rady|Rozhovor s týmem|Cesta k výsledku|Společně pomáháme|Otevíráme pozice|Náš přístup|Zkušenost z praxe|Děkujeme partnerům|Příští událost|Budoucnost oboru", "Sdílíme zkušenosti z praxe.|Zajímavé souvislosti pro váš tým.|Přidejte se k diskuzi.|Další krok v našem příběhu."),
  },
  {
    slug: "education", name: "Vzdělávání", width: toPx(210, "mm"), height: toPx(297, "mm"), unit: "mm", kind: "education", accent: "#b05bc0", kicker: "PRACOVNÍ LIST", cta: "",
    topics: topics("Můj denní plán|Slovní druhy|Počítáme do sta|Mapa nápadů|Čteme s porozuměním|Naše planeta|Základy geometrie|Rozvrh hodin|Historie kolem nás|Pokus a pozorování|Týdenní úkoly|Anglická slovíčka|Barevný svět|Moje cíle|Přírodní vědy|Kreativní psaní|Cesta časem|Zdravý život|Logické hádanky|Projektový den", "Jméno: __________  Datum: __________|Procvičte si nové dovednosti.|Zapište své odpovědi.|Objevujte krok za krokem."),
  },
];

type Region = { x: number; y: number; w: number; h: number };
type Layout = { words: Region; visual: Region; name: string };

/** Ten different compositions, each reflected in four spatial treatments. */
const layouts: Layout[] = [
  { name: "Dvojí plocha", words: { x: .07, y: .08, w: .42, h: .80 }, visual: { x: .55, y: .12, w: .38, h: .76 } },
  { name: "Horní sdělení", words: { x: .08, y: .07, w: .84, h: .40 }, visual: { x: .16, y: .52, w: .68, h: .39 } },
  { name: "Spodní sdělení", words: { x: .08, y: .55, w: .79, h: .36 }, visual: { x: .11, y: .07, w: .74, h: .40 } },
  { name: "Úzký obraz", words: { x: .07, y: .12, w: .51, h: .75 }, visual: { x: .65, y: .18, w: .27, h: .64 } },
  { name: "Široký obraz", words: { x: .07, y: .10, w: .37, h: .76 }, visual: { x: .50, y: .06, w: .43, h: .86 } },
  { name: "Středový nadpis", words: { x: .11, y: .10, w: .70, h: .43 }, visual: { x: .25, y: .62, w: .49, h: .29 } },
  { name: "Středový obraz", words: { x: .10, y: .51, w: .76, h: .41 }, visual: { x: .19, y: .06, w: .64, h: .36 } },
  { name: "Diagonála", words: { x: .06, y: .08, w: .47, h: .44 }, visual: { x: .51, y: .55, w: .42, h: .37 } },
  { name: "Protipól", words: { x: .45, y: .10, w: .48, h: .43 }, visual: { x: .08, y: .56, w: .40, h: .34 } },
  { name: "Pás a karta", words: { x: .07, y: .30, w: .86, h: .45 }, visual: { x: .31, y: .04, w: .38, h: .18 } },
];

function reflect(region: Region, treatment: number): Region {
  return {
    x: treatment === 1 || treatment === 3 ? 1 - region.x - region.w : region.x,
    y: treatment === 2 || treatment === 3 ? 1 - region.y - region.h : region.y,
    w: region.w,
    h: region.h,
  };
}

function pixels(region: Region, width: number, height: number): Region {
  return { x: region.x * width, y: region.y * height, w: region.w * width, h: region.h * height };
}

function mixWithWhite(color: string, whitePart: number): string {
  const value = color.slice(1).match(/../g)!.map((part) => parseInt(part, 16));
  return `#${value.map((channel) => Math.round(channel * (1 - whitePart) + 255 * whitePart).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(color: string): number {
  const channels = color.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function readableAccent(color: string, background: string): string {
  const surface = luminance(background);
  for (let step = 0; step <= 10; step++) {
    const fraction = step / 10;
    const candidate = surface < .3 ? mixWithWhite(color, fraction) : mixWithWhite(color, 0);
    const shaded = surface < .3 ? candidate : `#${color.slice(1).match(/../g)!.map((part) => Math.round(parseInt(part, 16) * (1 - fraction)).toString(16).padStart(2, "0")).join("")}`;
    const a = luminance(shaded);
    if ((Math.max(a, surface) + .05) / (Math.min(a, surface) + .05) >= 4.5) return shaded;
  }
  return surface < .3 ? "#ffffff" : "#000000";
}

function actionTextColor(color: string): string {
  const channels = color.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  const lightContrast = 1.05 / (luminance + .05);
  const darkContrast = (luminance + .05) / .05;
  return lightContrast >= darkContrast ? "#ffffff" : "#000000";
}

function make(category: Category, layoutIndex: number, style: 1 | 2 | 3): BuiltInTemplate {
  const layout = layouts[Math.floor(layoutIndex / 4)];
  const treatment = layoutIndex % 4;
  const words = pixels(reflect(layout.words, treatment), category.width, category.height);
  const visual = pixels(reflect(layout.visual, treatment), category.width, category.height);
  const topic = category.topics[layoutIndex % category.topics.length];
  const dark = style === 1;
  const background = dark ? "#121b2b" : style === 2 ? "#faf8f3" : mixWithWhite(category.accent, .83);
  const ink = dark ? "#ffffff" : "#18222e";
  const secondary = dark ? "#c8d3e2" : "#3f5368";
  const surface = dark ? "#29394e" : style === 2 ? "#eee9df" : mixWithWhite(category.accent, .68);
  const accent = category.accent;
  const labelAccent = readableAccent(accent, background);
  const slug = `library-${category.slug}-l${String(layoutIndex + 1).padStart(2, "0")}-s${style}`;
  const p = new PageBuilder(`${slug}-p1`, category.width, category.height).background(background);

  const motif = Math.min(category.width, category.height) * .15;
  const mx = treatment === 1 || treatment === 3 ? category.width * .08 : category.width * .92;
  const my = treatment === 2 || treatment === 3 ? category.height * .9 : category.height * .1;
  p.circle("Barevný akcent", { cx: mx, cy: my, r: motif, fill: accent, opacity: dark ? .28 : .18 });
  if (treatment % 2 === 0) p.rect("Okrajový pruh", { x: 0, y: 0, w: Math.max(4, category.width * .012), h: category.height, fill: accent });
  else p.rect("Okrajový pruh", { x: 0, y: category.height - Math.max(4, category.height * .014), w: category.width, h: Math.max(4, category.height * .014), fill: accent });
  if (category.kind === "promo") {
    const family = Math.floor(layoutIndex / 4);
    if (family % 3 === 0) {
      [0, 1, 2].forEach((index) => p.circle(`Bodový motiv ${index + 1}`, { cx: visual.x + visual.w * (.13 + index * .12), cy: visual.y + visual.h * .9, r: Math.max(3, motif * .065), fill: accent, opacity: .8 }));
    } else if (family % 3 === 1) {
      p.polygon("Rohový motiv", { points: [[visual.x + visual.w * .76, visual.y], [visual.x + visual.w, visual.y], [visual.x + visual.w, visual.y + visual.h * .29]], fill: accent, opacity: .65 });
      p.rect("Tenká linka", { x: words.x, y: words.y + words.h * .13, w: words.w * .16, h: Math.max(3, category.height * .006), fill: accent });
    } else {
      [0, 1, 2].forEach((index) => p.rect(`Rytmická linka ${index + 1}`, { x: visual.x + visual.w * (.77 + index * .06), y: visual.y + visual.h * .08, w: Math.max(3, visual.w * .018), h: visual.h * (.12 + index * .06), r: 2, fill: accent, opacity: .85 }));
    }
  }

  const visualInset = Math.max(3, Math.min(category.width, category.height) * .018);
  p.rect("Obrazové pole", { x: visual.x, y: visual.y, w: visual.w, h: visual.h, r: Math.min(22, motif * .15), fill: surface });
  if (category.kind === "logo" || category.kind === "card") {
    const size = Math.min(visual.w, visual.h) * .48;
    const cx = visual.x + visual.w / 2, cy = visual.y + visual.h / 2;
    const mark = layoutIndex % 5;
    if (mark === 0) p.circle("Znak – kruh", { cx, cy, r: size / 2, fill: accent });
    if (mark === 1) p.rect("Znak – čtverec", { x: cx - size / 2, y: cy - size / 2, w: size, h: size, r: size * .15, fill: accent, angle: 25 });
    if (mark === 2) p.polygon("Znak – trojúhelník", { points: [[cx, cy - size * .6], [cx + size * .55, cy + size * .45], [cx - size * .55, cy + size * .45]], fill: accent });
    if (mark === 3) {
      p.circle("Znak – prstenec", { cx, cy, r: size / 2, fill: null, stroke: accent, strokeWidth: Math.max(3, size * .11) });
      p.circle("Znak – střed", { cx, cy, r: size * .13, fill: accent });
    }
    if (mark === 4) {
      p.rect("Znak – sloupec A", { x: cx - size * .35, y: cy - size * .5, w: size * .23, h: size, r: size * .1, fill: accent });
      p.rect("Znak – sloupec B", { x: cx + size * .12, y: cy - size * .32, w: size * .23, h: size * .82, r: size * .1, fill: accent });
    }
  } else if (category.kind === "resume" || category.kind === "education") {
    const pad = Math.min(visual.w, visual.h) * .08;
    const left = visual.x + pad, contentWidth = visual.w - pad * 2;
    const labelSize = Math.max(11, Math.min(category.width * .029, visual.h * .09));
    const compact = visual.h < category.height * .29;
    if (category.kind === "resume") {
      const sections = [
        ["Profil", "Zkušenosti, samostatnost a cit pro detail."],
        ["Praxe", "2022–2026 · Vedoucí projektu\n2019–2022 · Specialista týmu"],
        ["Dovednosti", "Výzkum · Plánování · Komunikace"],
        ["Vzdělání", "2016–2019 · Univerzita v Praze"],
      ] as const;
      sections.forEach(([name, value], index) => {
        const start = visual.y + visual.h * (compact ? .10 + index * .22 : .07 + index * .225);
        p.text(name, { x: left, y: start, w: contentWidth, text: name.toUpperCase(), size: compact ? labelSize * .78 : labelSize, font: "Inter", bold: true, color: labelAccent });
        if (!compact) p.text(`${name} – obsah`, { x: left, y: start + labelSize * 1.5, w: contentWidth, text: value, size: labelSize * .68, font: "Inter", color: ink, lineHeight: 1.22 });
        p.rect(`${name} – oddělovač`, { x: left, y: start + visual.h * (compact ? .16 : .195), w: contentWidth * .8, h: Math.max(1.5, visual.h * .003), fill: accent, opacity: .45 });
      });
    } else {
      p.text("Zadání", { x: left, y: visual.y + pad, w: contentWidth, text: "ZKUS SI TO", size: labelSize, font: "Inter", bold: true, color: labelAccent });
      ["1. Pozoruj a napiš odpověď.", "2. Propoj správné dvojice.", "3. Nakresli vlastní příklad."].forEach((task, index) =>
        p.text(`Úkol ${index + 1}`, { x: left, y: visual.y + visual.h * (.25 + index * .23), w: contentWidth, text: task, size: labelSize * .72, font: "Inter", color: ink }),
      );
      [0, 1, 2].forEach((index) => p.rect(`Řádek odpovědi ${index + 1}`, { x: left, y: visual.y + visual.h * (.39 + index * .23), w: contentWidth * .88, h: Math.max(1.5, visual.h * .004), fill: labelAccent, opacity: .65 }));
    }
  } else {
    const inset = Math.min(visualInset, visual.w * .06, visual.h * .06);
    const frameShapes = ["arch", "circle", "hexagon", "postage", "rounded", "diamond", "torn", "square"] as const;
    const shape = frameShapes[Math.floor(layoutIndex / 4) % frameShapes.length];
    if (treatment === 0) {
      p.rect("Fotografický podklad", { x: visual.x + visual.w * .08, y: visual.y + visual.h * .13, w: visual.w * .78, h: visual.h * .73, r: 12, fill: accent, opacity: .45 });
      p.frame("Fotografie – hlavní", { x: visual.x + visual.w * .14, y: visual.y + visual.h * .08, w: visual.w * .72, h: visual.h * .75, shape });
    } else if (treatment === 1) {
      p.circle("Fotografický kruh – podklad", { cx: visual.x + visual.w * .51, cy: visual.y + visual.h * .49, r: Math.min(visual.w, visual.h) * .38, fill: accent, opacity: .45 });
      p.frame("Fotografie – tvar", { x: visual.x + visual.w * .18, y: visual.y + visual.h * .13, w: visual.w * .65, h: visual.h * .7, shape });
    } else if (treatment === 2) {
      const tall = visual.h > visual.w * 1.15;
      if (tall) {
        p.frame("Fotografie – horní", { x: visual.x + visual.w * .12, y: visual.y + visual.h * .08, w: visual.w * .76, h: visual.h * .4, shape });
        p.frame("Fotografie – spodní", { x: visual.x + visual.w * .12, y: visual.y + visual.h * .53, w: visual.w * .76, h: visual.h * .37, shape: "rounded" });
      } else {
        p.frame("Fotografie – levá", { x: visual.x + visual.w * .07, y: visual.y + visual.h * .14, w: visual.w * .4, h: visual.h * .72, shape });
        p.frame("Fotografie – pravá", { x: visual.x + visual.w * .53, y: visual.y + visual.h * .14, w: visual.w * .4, h: visual.h * .72, shape: "rounded" });
      }
    } else {
      p.rect("Výrazná plocha", { x: visual.x + visual.w * .07, y: visual.y + visual.h * .12, w: visual.w * .82, h: visual.h * .76, r: 14, fill: accent, opacity: .55 });
      p.frame("Fotografie – vrstvená", { x: visual.x + visual.w * .12 + inset, y: visual.y + visual.h * .17, w: visual.w * .68 - inset, h: visual.h * .64, shape });
      p.circle("Odznak", { cx: visual.x + visual.w * .79, cy: visual.y + visual.h * .25, r: Math.min(visual.w, visual.h) * .1, fill: accent });
    }
  }

  const textPad = Math.min(words.w, words.h) * .06;
  const tx = words.x + textPad, tw = words.w - textPad * 2;
  const promo = category.kind === "promo";
  const headCap = promo ? .12 : category.kind === "card" ? .09 : category.kind === "logo" ? .14 : .095;
  const headSize = Math.max(promo ? Math.min(category.width, category.height) * .075 : 11,
    Math.min(category.width * headCap, category.height * (promo ? .18 : .13), words.h * (words.h < category.height * .5 ? .19 : .31), tw * (promo ? 3.6 : 3) / Math.max(8, topic.headline.length)));
  const smallBase = Math.max(8, Math.min(category.width * .04, category.height * .06, words.h * (words.h < category.height * .5 ? .08 : .11)));
  const small = promo ? smallBase : smallBase * (category.kind === "card" ? .76 : .85);
  p.text("Štítek", { x: tx, y: words.y + words.h * .06, w: tw, text: category.kicker, size: Math.max(7, small * .75), font: "Inter", bold: true, color: labelAccent, spacing: category.kind === "card" ? 70 : 170 });
  p.text("Nadpis", { x: tx, y: words.y + words.h * .25, w: tw, text: topic.headline, size: headSize, font: style === 2 ? "Playfair Display" : style === 3 ? "Outfit" : "Montserrat", bold: style !== 2, color: ink, lineHeight: 1.02 });
  p.text("Podnadpis", { x: tx, y: words.y + words.h * .67, w: tw, text: topic.subtitle, size: small, font: "Inter", color: secondary, lineHeight: 1.22 });
  if (category.kind === "resume") {
    p.text("Kontakt", { x: tx, y: words.y + words.h * .79, w: tw, text: "+420 600 000 000 · jmeno@example.com", size: small * .72, font: "Inter", color: secondary });
  } else if (category.kind === "card") {
    p.text("Kontakt", { x: tx, y: words.y + words.h * .79, w: tw, text: "+420 600 000 000 · studio@example.com", size: small * .8, font: "Inter", color: secondary });
  } else if (category.kind === "logo") {
    p.text("Poznámka", { x: tx, y: words.y + words.h * .79, w: tw, text: "ZNAČKA S PŘÍBĚHEM", size: small * .75, font: "Inter", color: secondary, spacing: 180 });
  } else if (category.kind === "education") {
    p.text("Pomůcka", { x: tx, y: words.y + words.h * .79, w: tw, text: "Jméno: __________", size: small * .9, font: "Inter", color: secondary });
  } else {
    const ctaWidth = tw * .7, ctaHeight = Math.min(words.h * .1, Math.max(26, small * 2.2));
    const ctaY = words.y + words.h * .88;
    p.rect("Výzva – plocha", { x: tx, y: ctaY, w: ctaWidth, h: ctaHeight, r: ctaHeight * .2, fill: accent });
    p.text("Výzva", { x: tx + ctaWidth * .04, y: ctaY + ctaHeight * .24, w: ctaWidth * .92, text: category.cta, size: Math.min(small * .9, ctaHeight * .52), font: "Inter", bold: true, color: actionTextColor(accent), align: "center" });
  }

  const styleName = style === 1 ? "Kontrastní" : style === 2 ? "Světlá" : "Barevná";
  return {
    slug, title: `${topic.headline} · ${layout.name} · ${styleName}`, category: category.name,
    width: category.width, height: category.height, unit: category.unit,
    tags: [category.name, topic.headline, layout.name, styleName, "editovatelná", "česky"],
    pages: [p.build()],
  };
}

export function generateLibraryTemplates(): BuiltInTemplate[] {
  return categories.flatMap((category) =>
    Array.from({ length: 40 }, (_, layoutIndex) => [1, 2, 3].map((style) => make(category, layoutIndex, style as 1 | 2 | 3))).flat(),
  );
}
