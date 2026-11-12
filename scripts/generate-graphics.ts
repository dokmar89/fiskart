/**
 * Draws the bundled graphics library (phase 15): about a hundred simple shapes, lines, badges,
 * arrows and decorations, all generated here from geometry, so every one is original to this
 * project. Writes public/graphics/<id>.svg and lib/graphics-catalog.json.
 *
 *   pnpm graphics:generate
 *
 * Every graphic paints with plain hex fills and strokes, so phase 10's SVG recolouring works on it.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type Graphic = { id: string; name: string; category: string; tags: string[]; svg: string };

const root = path.resolve(__dirname, "..");
const INK = "#18181b";
const A = "#2563eb";
const B = "#f59e0b";
const C = "#10b981";
const D = "#ef4444";
const E = "#8b5cf6";
const LIGHT = "#e0e7ff";

const f = (n: number) => String(Math.round(n * 100) / 100);
const svg = (body: string, w = 200, h = 200) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const poly = (points: [number, number][]) => points.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");

/** A small deterministic random generator, so the generated files do not change between runs. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function regular(n: number, r: number, cx = 100, cy = 100, rotate = -Math.PI / 2): [number, number][] {
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rotate + (i * 2 * Math.PI) / n), cy + r * Math.sin(rotate + (i * 2 * Math.PI) / n)]);
}

function star(n: number, outer: number, inner: number, cx = 100, cy = 100): [number, number][] {
  return Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/** A smooth closed curve through points (Catmull-Rom as cubic Béziers). */
function smoothClosed(points: [number, number][]): string {
  const n = points.length;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

function blob(seed: number, points = 8): string {
  const random = rng(seed);
  return smoothClosed(Array.from({ length: points }, (_, i) => {
    const a = (i * 2 * Math.PI) / points;
    const r = 60 + random() * 30;
    return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
  }));
}

function wave(amplitude: number, wavelength: number, y: number, width = 400): string {
  let d = `M0 ${y}`;
  for (let x = 0; x < width; x += wavelength) {
    d += ` q${f(wavelength / 4)} ${f(-amplitude)} ${f(wavelength / 2)} 0 t${f(wavelength / 2)} 0`;
  }
  return d;
}

function scalloped(bumps: number, r: number, depth: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < bumps * 8; i++) {
    const a = (i * 2 * Math.PI) / (bumps * 8);
    const rr = r + depth * Math.cos(a * bumps);
    points.push([100 + rr * Math.cos(a), 100 + rr * Math.sin(a)]);
  }
  return `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")} Z`;
}

const graphics: Graphic[] = [];
const add = (id: string, name: string, category: string, tags: string[], body: string, w?: number, h?: number) =>
  graphics.push({ id, name, category, tags, svg: svg(body, w, h) });

// Shapes
const polygonNames: Record<number, string> = { 3: "Trojúhelník", 4: "Kosočtverec", 5: "Pětiúhelník", 6: "Šestiúhelník", 7: "Sedmiúhelník", 8: "Osmiúhelník", 9: "Devítiúhelník", 10: "Desetiúhelník" };
for (const n of [3, 4, 5, 6, 7, 8, 9, 10]) {
  add(`polygon-${n}`, polygonNames[n], "Tvary", ["polygon", "shape", polygonNames[n].toLowerCase()], `<polygon points="${poly(regular(n, 90))}" fill="${A}"/>`);
}
for (const [n, inner] of [[4, 0.38], [5, 0.45], [6, 0.55], [7, 0.55], [8, 0.62], [12, 0.75]] as const) {
  add(`star-${n}`, `${n}cípá hvězda`, "Tvary", ["star", "shape"], `<polygon points="${poly(star(n, 92, 92 * inner))}" fill="${B}"/>`);
}
add("star-soft", "Měkká hvězda", "Tvary", ["star", "rounded", "shape"], `<path d="${smoothClosed(star(5, 92, 50))}" fill="${B}"/>`);
for (const rays of [12, 16, 24]) {
  add(`burst-${rays}`, `Výbuch (${rays})`, "Tvary", ["burst", "sale", "explosion", "shape"], `<polygon points="${poly(star(rays, 95, 72))}" fill="${D}"/>`);
}
for (let i = 1; i <= 10; i++) add(`blob-${i}`, `Skvrna ${i}`, "Tvary", ["blob", "organic", "abstract", "shape"], `<path d="${blob(i * 97, 6 + (i % 3))}" fill="${[A, B, C, D, E, LIGHT][(i - 1) % 6]}"/>`);
add("half-circle", "Půlkruh", "Tvary", ["semicircle", "arch", "shape"], `<path d="M10 140 A90 90 0 0 1 190 140 Z" fill="${C}"/>`);
add("quarter-circle", "Čtvrtkruh", "Tvary", ["quarter", "corner", "shape"], `<path d="M20 180 L20 20 A160 160 0 0 1 180 180 Z" fill="${E}"/>`);
add("ring", "Prstenec", "Tvary", ["circle", "donut", "ring", "shape"], `<path d="M100 10 A90 90 0 1 1 99.99 10 Z M100 50 A50 50 0 1 0 100.01 50 Z" fill="${A}" fill-rule="evenodd"/>`);
add("pill", "Pilulka", "Tvary", ["capsule", "rounded", "shape"], `<rect x="10" y="60" width="180" height="80" rx="40" fill="${C}"/>`);

// Lines and dividers
add("divider-wave", "Vlnovka", "Čáry", ["wave", "divider", "line"], `<path d="${wave(14, 50, 30)}" fill="none" stroke="${A}" stroke-width="6" stroke-linecap="round"/>`, 400, 60);
add("divider-wave-soft", "Mírná vlna", "Čáry", ["wave", "divider", "line"], `<path d="${wave(8, 100, 30)}" fill="none" stroke="${C}" stroke-width="5" stroke-linecap="round"/>`, 400, 60);
add("divider-wave-double", "Dvojitá vlna", "Čáry", ["wave", "divider", "line"], `<path d="${wave(10, 50, 22)}" fill="none" stroke="${E}" stroke-width="5"/><path d="${wave(10, 50, 40)}" fill="none" stroke="${B}" stroke-width="5"/>`, 400, 60);
add("divider-zigzag", "Klikatka", "Čáry", ["zigzag", "divider", "line"], `<polyline points="${poly(Array.from({ length: 21 }, (_, i) => [i * 20, i % 2 ? 15 : 45]))}" fill="none" stroke="${D}" stroke-width="6" stroke-linejoin="round"/>`, 400, 60);
add("divider-zigzag-fine", "Jemná klikatka", "Čáry", ["zigzag", "divider", "line"], `<polyline points="${poly(Array.from({ length: 41 }, (_, i) => [i * 10, i % 2 ? 22 : 38]))}" fill="none" stroke="${INK}" stroke-width="3"/>`, 400, 60);
add("divider-dots", "Tečkovaná čára", "Čáry", ["dots", "divider", "line"], Array.from({ length: 20 }, (_, i) => `<circle cx="${10 + i * 20}" cy="30" r="5" fill="${INK}"/>`).join(""), 400, 60);
add("divider-dots-large", "Velké tečky", "Čáry", ["dots", "divider", "line"], Array.from({ length: 10 }, (_, i) => `<circle cx="${20 + i * 40}" cy="30" r="10" fill="${B}"/>`).join(""), 400, 60);
add("divider-dashes", "Čárkovaná čára", "Čáry", ["dashes", "divider", "line"], `<line x1="5" y1="30" x2="395" y2="30" stroke="${A}" stroke-width="6" stroke-dasharray="24 14" stroke-linecap="round"/>`, 400, 60);
add("divider-double", "Dvojitá čára", "Čáry", ["double", "divider", "line"], `<rect x="0" y="20" width="400" height="5" fill="${INK}"/><rect x="0" y="35" width="400" height="5" fill="${INK}"/>`, 400, 60);
add("divider-diamond", "Čára s kosočtvercem", "Čáry", ["ornament", "divider", "line"], `<rect x="0" y="28" width="170" height="4" fill="${INK}"/><rect x="230" y="28" width="170" height="4" fill="${INK}"/><polygon points="200,10 220,30 200,50 180,30" fill="${B}"/>`, 400, 60);
add("divider-circles", "Čára s kroužky na koncích", "Čáry", ["divider", "line"], `<rect x="20" y="28" width="360" height="4" fill="${A}"/><circle cx="20" cy="30" r="10" fill="${A}"/><circle cx="380" cy="30" r="10" fill="${A}"/>`, 400, 60);
add("divider-scallop", "Vlnitý okraj", "Čáry", ["scallop", "edge", "divider"], `<path d="M0 40 ${Array.from({ length: 10 }, (_, i) => `A20 20 0 0 1 ${(i + 1) * 40} 40`).join(" ")} L400 60 L0 60 Z" fill="${LIGHT}"/>`, 400, 60);

// Badges and labels
add("badge-circle", "Kruhový odznak", "Odznaky", ["badge", "circle", "label"], `<circle cx="100" cy="100" r="92" fill="${A}"/><circle cx="100" cy="100" r="74" fill="none" stroke="${LIGHT}" stroke-width="4"/>`);
add("badge-circle-dots", "Tečkovaný odznak", "Odznaky", ["badge", "circle", "label"], `<circle cx="100" cy="100" r="92" fill="${D}"/>${regular(24, 80).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="#ffffff"/>`).join("")}`);
add("seal-16", "Pečeť", "Odznaky", ["seal", "certificate", "badge"], `<path d="${scalloped(16, 86, 8)}" fill="${B}"/><circle cx="100" cy="100" r="62" fill="none" stroke="#ffffff" stroke-width="4"/>`);
add("seal-24", "Jemná pečeť", "Odznaky", ["seal", "certificate", "badge"], `<path d="${scalloped(24, 88, 5)}" fill="${C}"/>`);
add("ribbon-banner", "Stuha", "Odznaky", ["ribbon", "banner", "label"], `<polygon points="0,30 40,30 40,90 0,90 20,60" fill="#1e40af"/><polygon points="400,30 360,30 360,90 400,90 380,60" fill="#1e40af"/><rect x="30" y="10" width="340" height="70" fill="${A}"/>`, 400, 100);
add("ribbon-folded", "Přeložená stuha", "Odznaky", ["ribbon", "banner", "label"], `<polygon points="10,40 60,40 60,100 10,100 30,70" fill="#b91c1c"/><polygon points="390,40 340,40 340,100 390,100 370,70" fill="#b91c1c"/><polygon points="60,100 80,85 80,100" fill="#7f1d1d"/><polygon points="340,100 320,85 320,100" fill="#7f1d1d"/><rect x="60" y="20" width="280" height="65" fill="${D}"/>`, 400, 110);
add("ribbon-flag", "Vlaječka", "Odznaky", ["flag", "label", "banner"], `<polygon points="0,10 380,10 350,50 380,90 0,90" fill="${E}"/>`, 400, 100);
add("shield", "Štít", "Odznaky", ["shield", "crest", "badge"], `<path d="M100 8 L180 36 L180 100 C180 150 140 180 100 194 C60 180 20 150 20 100 L20 36 Z" fill="${A}"/>`);
add("shield-split", "Dělený štít", "Odznaky", ["shield", "crest", "badge"], `<path d="M100 8 L180 36 L180 100 C180 150 140 180 100 194 Z" fill="${B}"/><path d="M100 8 L20 36 L20 100 C20 150 60 180 100 194 Z" fill="${A}"/>`);
add("tag", "Visačka", "Odznaky", ["tag", "price", "label"], `<path d="M20 60 L120 60 L180 100 L120 140 L20 140 Z" fill="${B}"/><circle cx="125" cy="100" r="8" fill="#ffffff"/>`);
add("tag-rounded", "Zaoblená visačka", "Odznaky", ["tag", "price", "label"], `<path d="M40 50 L130 50 L185 100 L130 150 L40 150 Q20 150 20 130 L20 70 Q20 50 40 50 Z" fill="${C}"/><circle cx="135" cy="100" r="8" fill="#ffffff"/>`);
add("rosette", "Rozeta", "Odznaky", ["rosette", "award", "prize"], `<polygon points="70,120 50,195 80,180 95,200 105,125" fill="#1e40af"/><polygon points="130,120 150,195 120,180 105,200 95,125" fill="#1e40af"/><path d="${scalloped(12, 70, 8)}" transform="translate(0 -20)" fill="${A}"/><circle cx="100" cy="80" r="45" fill="${LIGHT}"/>`);
add("label-rounded", "Zaoblený štítek", "Odznaky", ["label", "button"], `<rect x="10" y="40" width="380" height="80" rx="40" fill="${INK}"/>`, 400, 160);
add("ticket", "Vstupenka", "Odznaky", ["ticket", "coupon", "label"], `<path d="M20 40 H380 V75 A25 25 0 0 0 380 125 V160 H20 V125 A25 25 0 0 0 20 75 Z" fill="${B}"/><line x1="290" y1="45" x2="290" y2="155" stroke="#ffffff" stroke-width="4" stroke-dasharray="10 8"/>`, 400, 200);
add("badge-hexagon", "Šestiúhelníkový odznak", "Odznaky", ["hexagon", "badge"], `<polygon points="${poly(regular(6, 92, 100, 100, 0))}" fill="${E}"/><polygon points="${poly(regular(6, 72, 100, 100, 0))}" fill="none" stroke="#ffffff" stroke-width="4"/>`);
add("badge-burst-label", "Hvězdicový štítek", "Odznaky", ["burst", "sale", "badge"], `<polygon points="${poly(star(20, 95, 80))}" fill="${D}"/><circle cx="100" cy="100" r="62" fill="#ffffff"/>`);
add("badge-square", "Razítko", "Odznaky", ["stamp", "badge", "square"], `<rect x="15" y="15" width="170" height="170" rx="10" fill="none" stroke="${D}" stroke-width="8"/><rect x="32" y="32" width="136" height="136" rx="6" fill="none" stroke="${D}" stroke-width="3"/>`);
add("badge-sale-20", "Sleva 20 %", "Odznaky", ["sale", "discount", "20%", "badge"], `<path d="${scalloped(12, 88, 8)}" fill="${D}"/><text x="100" y="118" text-anchor="middle" font-size="54" font-weight="700" fill="#ffffff">20%</text>`);
add("badge-verified", "Ověřeno", "Odznaky", ["verified", "check", "badge"], `<circle cx="100" cy="100" r="88" fill="${A}"/><path d="M52 100 L84 132 L150 66" fill="none" stroke="#ffffff" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>`);

// Small locally bundled symbols, drawn from simple editable geometry rather than external URLs.
const social = (id: string, name: string, body: string) => add(`social-${id}`, name, "Sociální ikony", [id, "social", "icon"], body);
social("instagram", "Instagram", `<rect x="25" y="25" width="150" height="150" rx="42" fill="none" stroke="${E}" stroke-width="16"/><circle cx="100" cy="100" r="35" fill="none" stroke="${E}" stroke-width="16"/><circle cx="145" cy="55" r="10" fill="${E}"/>`);
social("facebook", "Facebook", `<circle cx="100" cy="100" r="90" fill="${A}"/><path d="M116 190 V106 H145 L150 76 H116 V61 Q116 48 130 48 H150 V20 H124 Q82 20 82 62 V76 H58 V106 H82 V190" fill="#ffffff"/>`);
social("tiktok", "TikTok", `<path d="M108 25 V125 A30 30 0 1 1 80 96 V124 A5 5 0 1 0 93 126 V25 Z M108 25 Q112 57 155 59 V87 Q128 85 108 69" fill="${INK}"/>`);
social("youtube", "YouTube", `<rect x="10" y="40" width="180" height="120" rx="35" fill="${D}"/><polygon points="80,70 145,100 80,130" fill="#ffffff"/>`);
social("linkedin", "LinkedIn", `<rect x="15" y="15" width="170" height="170" rx="18" fill="${A}"/><circle cx="55" cy="61" r="14" fill="#ffffff"/><rect x="42" y="85" width="25" height="72" fill="#ffffff"/><path d="M85 85 H110 V96 Q121 80 143 83 Q168 87 168 116 V157 H143 V119 Q143 107 131 107 Q110 107 110 130 V157 H85 Z" fill="#ffffff"/>`);
social("x", "X", `<path d="M35 25 L165 175 M165 25 L35 175" fill="none" stroke="${INK}" stroke-width="25" stroke-linecap="round"/>`);
social("whatsapp", "WhatsApp", `<circle cx="100" cy="95" r="82" fill="${C}"/><path d="M45 143 L35 188 L78 166" fill="${C}"/><path d="M65 62 Q59 88 83 113 Q108 140 137 132 L150 118 L126 103 L115 114 Q96 108 84 89 L93 78 L79 56 Z" fill="#ffffff"/>`);
social("pinterest", "Pinterest", `<circle cx="100" cy="100" r="90" fill="${D}"/><path d="M76 166 L92 84 Q98 56 119 63 Q149 73 130 109 Q119 130 100 121 M85 142 Q46 125 52 85 Q58 38 105 35 Q156 35 160 85 Q164 137 112 143" fill="none" stroke="#ffffff" stroke-width="13" stroke-linecap="round"/>`);
social("mail", "E-mail", `<rect x="20" y="48" width="160" height="110" rx="12" fill="none" stroke="${A}" stroke-width="12"/><path d="M25 55 L100 112 L175 55" fill="none" stroke="${A}" stroke-width="12"/>`);
social("globe", "Globus", `<circle cx="100" cy="100" r="82" fill="none" stroke="${A}" stroke-width="12"/><ellipse cx="100" cy="100" rx="35" ry="82" fill="none" stroke="${A}" stroke-width="9"/><path d="M20 100 H180 M38 60 H162 M38 140 H162" stroke="${A}" stroke-width="9"/>`);
social("phone", "Telefon", `<path d="M60 25 Q48 25 48 40 V160 Q48 175 63 175 H137 Q152 175 152 160 V40 Q152 25 137 25 Z" fill="none" stroke="${A}" stroke-width="12"/><circle cx="100" cy="155" r="6" fill="${A}"/>`);

// Arrows
add("arrow-right", "Šipka", "Šipky", ["arrow", "right", "direction"], `<path d="M10 85 H140 V50 L195 100 L140 150 V115 H10 Z" fill="${A}"/>`);
add("arrow-double", "Dvojitá šipka", "Šipky", ["arrow", "both", "direction"], `<path d="M5 100 L55 55 V82 H145 V55 L195 100 L145 145 V118 H55 V145 Z" fill="${C}"/>`);
add("arrow-chevron", "Klínová šipka", "Šipky", ["chevron", "next", "direction"], `<polygon points="40,20 110,20 170,100 110,180 40,180 100,100" fill="${B}"/>`);
add("arrow-chevrons", "Dvojitá klínová šipka", "Šipky", ["chevron", "fast", "direction"], `<polygon points="10,30 60,30 120,100 60,170 10,170 70,100" fill="${D}"/><polygon points="80,30 130,30 190,100 130,170 80,170 140,100" fill="${D}"/>`);
add("arrow-curved", "Zahnutá šipka", "Šipky", ["arrow", "curve", "direction"], `<path d="M30 160 Q40 50 150 60" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><polygon points="145,30 190,62 145,92" fill="${INK}"/>`);
add("arrow-curved-down", "Šipka dolů", "Šipky", ["arrow", "curve", "down"], `<path d="M40 30 Q170 40 150 140" fill="none" stroke="${A}" stroke-width="10" stroke-linecap="round"/><polygon points="120,135 152,190 182,135" fill="${A}"/>`);
add("arrow-circular", "Kruhová šipka", "Šipky", ["refresh", "cycle", "arrow"], `<path d="M160 100 A60 60 0 1 1 130 48" fill="none" stroke="${C}" stroke-width="14" stroke-linecap="round"/><polygon points="115,20 165,45 120,75" fill="${C}"/>`);
add("arrow-in-circle", "Šipka v kruhu", "Šipky", ["arrow", "button", "next"], `<circle cx="100" cy="100" r="90" fill="${A}"/><path d="M55 92 H120 V65 L160 100 L120 135 V108 H55 Z" fill="#ffffff"/>`);
add("arrow-bent", "Lomená šipka", "Šipky", ["arrow", "turn", "direction"], `<path d="M30 180 V90 Q30 60 60 60 H140 V30 L190 75 L140 120 V90 H70 Q60 90 60 100 V180 Z" fill="${E}"/>`);
add("arrow-u-turn", "Šipka zpět", "Šipky", ["arrow", "back", "return"], `<path d="M150 180 V80 A50 50 0 0 0 50 80 V120" fill="none" stroke="${D}" stroke-width="16"/><polygon points="20,115 80,115 50,170" fill="${D}"/>`);
add("arrow-thin", "Tenká šipka", "Šipky", ["arrow", "pointer", "line"], `<line x1="10" y1="100" x2="180" y2="100" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><polyline points="150,70 185,100 150,130" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
add("arrow-hand-drawn", "Ručně kreslená šipka", "Šipky", ["arrow", "doodle", "hand drawn"], `<path d="M20 150 C60 140 70 80 120 90 S170 60 175 45" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M150 40 L177 42 L170 70" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`);

// Speech and callouts
add("speech-round", "Bublina", "Bubliny", ["speech", "bubble", "talk", "quote"], `<path d="M100 20 C150 20 190 50 190 90 C190 130 150 160 100 160 C88 160 77 158 67 155 L30 185 L42 145 C20 130 10 112 10 90 C10 50 50 20 100 20 Z" fill="${A}"/>`);
add("speech-rect", "Hranatá bublina", "Bubliny", ["speech", "bubble", "talk"], `<path d="M20 20 H180 Q190 20 190 30 V130 Q190 140 180 140 H80 L45 180 L52 140 H20 Q10 140 10 130 V30 Q10 20 20 20 Z" fill="${C}"/>`);
add("thought", "Myšlenková bublina", "Bubliny", ["thought", "think", "cloud", "bubble"], `<path d="${blob(4242, 10)}" fill="${LIGHT}"/><circle cx="40" cy="170" r="12" fill="${LIGHT}"/><circle cx="20" cy="190" r="7" fill="${LIGHT}"/>`);
add("callout-box", "Popisek", "Bubliny", ["callout", "note", "box"], `<path d="M10 10 H190 V140 H120 L100 180 L80 140 H10 Z" fill="${B}"/>`);
add("shout", "Výkřik", "Bubliny", ["shout", "exclamation", "burst", "comic"], `<polygon points="${poly(star(14, 95, 60).map(([x, y], i) => [x + (i % 3) * 3, y - (i % 2) * 4]))}" fill="${D}"/>`);
add("speech-pair", "Dvě bubliny", "Bubliny", ["chat", "conversation", "speech"], `<path d="M20 20 H120 Q130 20 130 30 V90 Q130 100 120 100 H60 L40 125 L45 100 H20 Q10 100 10 90 V30 Q10 20 20 20 Z" fill="${A}"/><path d="M80 90 H180 Q190 90 190 100 V160 Q190 170 180 170 H160 L165 195 L140 170 H80 Q70 170 70 160 V100 Q70 90 80 90 Z" fill="${B}"/>`);

// Nature and decorations
add("sun", "Slunce", "Dekorace", ["sun", "weather", "summer"], `${regular(12, 85).map(([x, y]) => `<line x1="100" y1="100" x2="${f(x)}" y2="${f(y)}" stroke="${B}" stroke-width="10" stroke-linecap="round"/>`).join("")}<circle cx="100" cy="100" r="50" fill="${B}"/>`);
add("moon", "Půlměsíc", "Dekorace", ["moon", "night", "sky"], `<path d="M120 15 A85 85 0 1 0 185 130 A70 70 0 1 1 120 15 Z" fill="#facc15"/>`);
add("cloud", "Mrak", "Dekorace", ["cloud", "weather", "sky"], `<path d="M50 150 A35 35 0 0 1 50 80 A45 45 0 0 1 130 60 A40 40 0 0 1 165 150 Z" fill="${LIGHT}"/>`);
add("cloud-rain", "Dešťový mrak", "Dekorace", ["rain", "cloud", "weather"], `<path d="M50 120 A30 30 0 0 1 50 60 A40 40 0 0 1 125 45 A35 35 0 0 1 160 120 Z" fill="#94a3b8"/>${[60, 95, 130].map((x) => `<line x1="${x}" y1="140" x2="${x - 10}" y2="175" stroke="${A}" stroke-width="7" stroke-linecap="round"/>`).join("")}`);
add("drop", "Kapka", "Dekorace", ["water", "drop", "rain"], `<path d="M100 15 C130 70 160 100 160 135 A60 60 0 0 1 40 135 C40 100 70 70 100 15 Z" fill="${A}"/>`);
add("leaf", "List", "Dekorace", ["leaf", "nature", "plant"], `<path d="M30 170 C30 80 90 30 175 25 C170 110 120 170 30 170 Z" fill="${C}"/><path d="M30 170 Q90 110 150 50" fill="none" stroke="#065f46" stroke-width="4"/>`);
add("leaf-round", "Kulatý list", "Dekorace", ["leaf", "nature", "plant"], `<path d="M100 190 C40 150 30 80 100 15 C170 80 160 150 100 190 Z" fill="#84cc16"/><line x1="100" y1="185" x2="100" y2="40" stroke="#3f6212" stroke-width="4"/>`);
add("leaves-sprig", "Větvička", "Dekorace", ["leaves", "branch", "nature"], `<path d="M100 195 V30" stroke="#166534" stroke-width="5" fill="none"/>${[50, 85, 120, 155].map((y, i) => `<ellipse cx="${i % 2 ? 125 : 75}" cy="${y}" rx="28" ry="12" transform="rotate(${i % 2 ? -30 : 30} ${i % 2 ? 125 : 75} ${y})" fill="${C}"/>`).join("")}`);
for (const [petals, color] of [[5, D], [6, E], [8, B]] as const) {
  add(`flower-${petals}`, `Květina (${petals} okvětních lístků)`, "Dekorace", ["flower", "nature", "spring"], `${regular(petals, 52).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="38" fill="${color}"/>`).join("")}<circle cx="100" cy="100" r="30" fill="#facc15"/>`);
}
add("heart", "Srdce", "Dekorace", ["heart", "love", "valentine"], `<path d="M100 180 C30 130 10 95 10 65 C10 35 35 15 60 15 C80 15 92 27 100 42 C108 27 120 15 140 15 C165 15 190 35 190 65 C190 95 170 130 100 180 Z" fill="${D}"/>`);
add("heart-outline", "Obrys srdce", "Dekorace", ["heart", "love", "outline"], `<path d="M100 170 C35 125 18 95 18 67 C18 40 40 22 62 22 C80 22 92 33 100 47 C108 33 120 22 138 22 C160 22 182 40 182 67 C182 95 165 125 100 170 Z" fill="none" stroke="${D}" stroke-width="10"/>`);
for (const [i, [w, color]] of ([[0.18, B], [0.3, A], [0.1, E]] as const).entries()) {
  add(`sparkle-${i + 1}`, `Jiskra ${i + 1}`, "Dekorace", ["sparkle", "shine", "star", "magic"], `<path d="M100 5 Q${f(100 + 95 * w)} ${f(100 - 95 * w)} 195 100 Q${f(100 + 95 * w)} ${f(100 + 95 * w)} 100 195 Q${f(100 - 95 * w)} ${f(100 + 95 * w)} 5 100 Q${f(100 - 95 * w)} ${f(100 - 95 * w)} 100 5 Z" fill="${color}"/>`);
}
{
  const random = rng(7);
  const pieces = Array.from({ length: 24 }, (_, i) => {
    const x = 15 + random() * 170;
    const y = 15 + random() * 170;
    const color = [A, B, C, D, E][i % 5];
    return i % 3 === 0
      ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(4 + random() * 4)}" fill="${color}"/>`
      : `<rect x="${f(x)}" y="${f(y)}" width="${f(6 + random() * 6)}" height="${f(3 + random() * 3)}" transform="rotate(${f(random() * 180)} ${f(x)} ${f(y)})" fill="${color}"/>`;
  });
  add("confetti", "Konfety", "Dekorace", ["confetti", "party", "celebration"], pieces.join(""));
}
add("mountains", "Hory", "Dekorace", ["mountain", "landscape", "nature"], `<polygon points="0,180 70,60 140,180" fill="#64748b"/><polygon points="70,180 140,40 210,180" fill="#475569"/><polygon points="140,40 122,77 140,70 158,77" fill="#ffffff"/>`, 210, 200);
add("tree", "Strom", "Dekorace", ["tree", "nature", "forest"], `<rect x="90" y="140" width="20" height="50" fill="#92400e"/><polygon points="100,10 170,150 30,150" fill="${C}"/>`);
add("snowflake", "Vločka", "Dekorace", ["snow", "winter", "christmas"], `${regular(6, 85).map(([x, y]) => `<line x1="100" y1="100" x2="${f(x)}" y2="${f(y)}" stroke="#38bdf8" stroke-width="8" stroke-linecap="round"/>`).join("")}${regular(6, 50).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="9" fill="#38bdf8"/>`).join("")}`);
add("lightning", "Blesk", "Dekorace", ["lightning", "energy", "bolt"], `<polygon points="115,5 40,110 95,110 80,195 165,80 110,80" fill="#facc15"/>`);
add("planet", "Planeta", "Dekorace", ["planet", "space", "saturn"], `<circle cx="100" cy="100" r="55" fill="${E}"/><ellipse cx="100" cy="100" rx="95" ry="25" fill="none" stroke="${B}" stroke-width="8" transform="rotate(-20 100 100)"/>`);

// Frames and corners
add("corner-bracket", "Rohové závorky", "Rámečky", ["corner", "frame", "border"], `<path d="M10 60 V10 H60 M140 10 H190 V60 M190 140 V190 H140 M60 190 H10 V140" fill="none" stroke="${INK}" stroke-width="8"/>`);
add("corner-ornament", "Rohový ornament", "Rámečky", ["corner", "ornament", "decoration"], `<path d="M10 190 V10 H190" fill="none" stroke="${B}" stroke-width="6"/><path d="M30 170 V30 H170" fill="none" stroke="${B}" stroke-width="3"/><circle cx="30" cy="30" r="10" fill="${B}"/>`);
add("frame-rounded", "Zaoblený rámeček", "Rámečky", ["frame", "border", "outline"], `<rect x="10" y="10" width="180" height="180" rx="30" fill="none" stroke="${A}" stroke-width="8"/>`);
add("frame-double", "Dvojitý rámeček", "Rámečky", ["frame", "border", "outline"], `<rect x="8" y="8" width="184" height="184" fill="none" stroke="${INK}" stroke-width="5"/><rect x="22" y="22" width="156" height="156" fill="none" stroke="${INK}" stroke-width="2"/>`);
add("frame-dotted-circle", "Tečkovaný kruh", "Rámečky", ["circle", "frame", "dots"], regular(36, 88).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="4" fill="${E}"/>`).join(""));
add("frame-circle-outline", "Obrys kruhu", "Rámečky", ["circle", "frame", "outline"], `<circle cx="100" cy="100" r="88" fill="none" stroke="${C}" stroke-width="8"/>`);
add("laurel", "Vavřín", "Rámečky", ["laurel", "award", "wreath"], [...Array.from({ length: 7 }, (_, i) => {
  const a = Math.PI * (0.62 + i * 0.1);
  const x = 100 + 80 * Math.cos(a);
  const y = 100 + 80 * Math.sin(a);
  return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="16" ry="7" transform="rotate(${f((a * 180) / Math.PI + 60)} ${f(x)} ${f(y)})" fill="${C}"/><ellipse cx="${f(200 - x)}" cy="${f(y)}" rx="16" ry="7" transform="rotate(${f(-((a * 180) / Math.PI + 60))} ${f(200 - x)} ${f(y)})" fill="${C}"/>`;
})].join(""));
add("frame-polaroid", "Fotorámeček", "Rámečky", ["photo", "polaroid", "frame"], `<path d="M10 10 H190 V190 H10 Z M25 25 V145 H175 V25 Z" fill="#ffffff" stroke="#d4d4d8" stroke-width="2" fill-rule="evenodd"/>`);

// Patterns and dots
add("dot-grid", "Tečková mřížka", "Vzory", ["dots", "grid", "pattern"], Array.from({ length: 36 }, (_, i) => `<circle cx="${25 + (i % 6) * 30}" cy="${25 + Math.floor(i / 6) * 30}" r="6" fill="${A}"/>`).join(""));
add("halftone", "Rastr", "Vzory", ["halftone", "dots", "pattern"], Array.from({ length: 64 }, (_, i) => `<circle cx="${12.5 + (i % 8) * 25}" cy="${12.5 + Math.floor(i / 8) * 25}" r="${f(2 + ((i % 8) + Math.floor(i / 8)) * 0.6)}" fill="${INK}"/>`).join(""));
add("stripes", "Pruhy", "Vzory", ["stripes", "lines", "pattern"], Array.from({ length: 10 }, (_, i) => `<rect x="0" y="${i * 20}" width="200" height="10" fill="${i % 2 ? B : D}"/>`).join(""));
add("checker", "Šachovnice", "Vzory", ["checker", "squares", "pattern"], Array.from({ length: 25 }, (_, i) => ((i % 5) + Math.floor(i / 5)) % 2 ? "" : `<rect x="${(i % 5) * 40}" y="${Math.floor(i / 5) * 40}" width="40" height="40" fill="${INK}"/>`).join(""));
add("plus-grid", "Plusy", "Vzory", ["plus", "grid", "pattern"], Array.from({ length: 16 }, (_, i) => {
  const x = 25 + (i % 4) * 50;
  const y = 25 + Math.floor(i / 4) * 50;
  return `<rect x="${x - 10}" y="${y - 3}" width="20" height="6" fill="${E}"/><rect x="${x - 3}" y="${y - 10}" width="6" height="20" fill="${E}"/>`;
}).join(""));
add("circles-cluster", "Shluk kruhů", "Vzory", ["circles", "bubbles", "abstract"], `<circle cx="70" cy="80" r="50" fill="${A}"/><circle cx="135" cy="70" r="30" fill="${B}"/><circle cx="125" cy="140" r="40" fill="${C}"/><circle cx="55" cy="155" r="20" fill="${D}"/>`);
add("squiggle", "Čmáranice", "Vzory", ["squiggle", "doodle", "abstract"], `<path d="M15 100 C35 40 55 40 65 100 S95 160 110 100 S145 40 160 100 S180 150 190 120" fill="none" stroke="${D}" stroke-width="12" stroke-linecap="round"/>`);
add("rings-concentric", "Kruhy", "Vzory", ["rings", "circles", "abstract"], [90, 70, 50, 30].map((r, i) => `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${[A, B, C, D][i]}" stroke-width="8"/>`).join(""));

async function main() {
  const dir = path.join(root, "public", "graphics");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const ids = new Set<string>();
  for (const g of graphics) {
    if (ids.has(g.id)) throw new Error(`Duplicate graphic id ${g.id}`);
    ids.add(g.id);
    await writeFile(path.join(dir, `${g.id}.svg`), `${g.svg}\n`);
  }
  const catalog = graphics.map(({ id, name, category, tags }) => ({ id, name, category, tags }));
  await writeFile(path.join(root, "lib", "graphics-catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Wrote ${graphics.length} graphics.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
