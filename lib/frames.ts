/**
 * Frame shapes: outlines an image is clipped by. Each is an SVG path for a box of any size, centred
 * on the origin (the way Fabric positions an object's clip path). Pure, unit tested.
 */

export const FRAME_SHAPES = [
  "square", "rounded", "circle", "arch", "triangle", "diamond", "hexagon", "star", "heart", "phone", "laptop", "torn", "postage",
  "tablet", "smartwatch", "browser", "pentagon", "octagon", "heptagon", "burst8", "burst12",
  "blob1", "blob2", "blob3", "blob4", "blob5", "blob6", "filmstrip", "ticket", "shield", "rosette", "ribbon", "cloud", "speech", "cross", "drop",
  "rounded-pentagon", "rounded-hexagon", "rounded-octagon",
] as const;
export type FrameShape = (typeof FRAME_SHAPES)[number];

export const FRAME_LABELS: Record<FrameShape, string> = {
  square: "Čtverec",
  rounded: "Zaoblený",
  circle: "Kruh",
  arch: "Oblouk",
  triangle: "Trojúhelník",
  diamond: "Kosočtverec",
  hexagon: "Šestiúhelník",
  star: "Hvězda",
  heart: "Srdce",
  phone: "Telefon",
  laptop: "Notebook",
  torn: "Utržený papír",
  postage: "Poštovní známka",
  tablet: "Tablet",
  smartwatch: "Chytré hodinky",
  browser: "Okno prohlížeče",
  pentagon: "Pětiúhelník",
  octagon: "Osmiúhelník",
  heptagon: "Sedmiúhelník",
  burst8: "Osmicípý odznak",
  burst12: "Dvanácticípý odznak",
  blob1: "Organický tvar 1",
  blob2: "Organický tvar 2",
  blob3: "Organický tvar 3",
  blob4: "Organický tvar 4",
  blob5: "Organický tvar 5",
  blob6: "Organický tvar 6",
  filmstrip: "Filmový pás",
  ticket: "Vstupenka",
  shield: "Štít",
  rosette: "Rozeta",
  ribbon: "Stuha",
  cloud: "Mrak",
  speech: "Komiksová bublina",
  cross: "Kříž",
  drop: "Kapka",
  "rounded-pentagon": "Zaoblený pětiúhelník",
  "rounded-hexagon": "Zaoblený šestiúhelník",
  "rounded-octagon": "Zaoblený osmiúhelník",
};

export function isFrameShape(value: unknown): value is FrameShape {
  return typeof value === "string" && (FRAME_SHAPES as readonly string[]).includes(value);
}

const f = (n: number) => String(Math.round(n * 1000) / 1000);

/** Polygon through points given in a unit box (0..1), mapped onto a w × h box centred on the origin. */
function polygon(points: [number, number][], w: number, h: number): string {
  return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${f((x - 0.5) * w)} ${f((y - 0.5) * h)}`).join(" ")} Z`;
}

function starUnitPoints(spikes: number, inner: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.5 * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    points.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  // Stretched to touch every side of the box, as the other shapes do.
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return points.map(([x, y]) => [(x - minX) / (maxX - minX), (y - minY) / (maxY - minY)]);
}

function regularUnitPoints(sides: number, rotation = -Math.PI / 2): [number, number][] {
  const points = Array.from({ length: sides }, (_, i): [number, number] => {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const dx = Math.max(...xs) - minX, dy = Math.max(...ys) - minY;
  return points.map(([x, y]) => [(x - minX) / dx, (y - minY) / dy]);
}

/** Rounded corners keep the original polygon vertices as quadratic controls. */
function roundedPolygon(points: [number, number][], w: number, h: number, amount = 0.12): string {
  const xy = ([x, y]: [number, number]) => `${f((x - 0.5) * w)} ${f((y - 0.5) * h)}`;
  const towards = (a: [number, number], b: [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
  const before = (i: number) => towards(points[i], points[(i + points.length - 1) % points.length]);
  const after = (i: number) => towards(points[i], points[(i + 1) % points.length]);
  return [`M ${xy(before(0))}`, ...points.flatMap((point, i) => [`Q ${xy(point)} ${xy(after(i))}`, `L ${xy(before((i + 1) % points.length))}`]), "Z"].join(" ");
}

/** Six smooth, deterministic blob silhouettes; controls stay inside the normalized box. */
function blobPath(seed: number, w: number, h: number): string {
  const raw = Array.from({ length: 12 }, (_, i): [number, number] => {
    const a = (i * 2 * Math.PI) / 12 - Math.PI / 2;
    const r = 0.76 + 0.16 * Math.sin(i * (seed + 2) * 1.17) + 0.08 * Math.cos(i * (seed + 3) * 0.83);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  const xs = raw.map(([x]) => x), ys = raw.map(([, y]) => y);
  const points: [number, number][] = raw.map(([x, y]) => [(x - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs)), (y - Math.min(...ys)) / (Math.max(...ys) - Math.min(...ys))]);
  const xy = ([x, y]: [number, number]) => `${f((x - 0.5) * w)} ${f((y - 0.5) * h)}`;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return [`M ${xy(mid(points.at(-1)!, points[0]))}`, ...points.map((point, i) => `Q ${xy(point)} ${xy(mid(point, points[(i + 1) % points.length]))}`), "Z"].join(" ");
}

function notchedSides(w: number, h: number, slots: number): string {
  const points: [number, number][] = [[0, 0], [1, 0]];
  for (let i = 1; i < slots * 2; i++) points.push([i % 2 ? 0.94 : 1, i / (slots * 2)]);
  points.push([1, 1], [0, 1]);
  for (let i = slots * 2 - 1; i > 0; i--) points.push([i % 2 ? 0.06 : 0, i / (slots * 2)]);
  return polygon(points, w, h);
}

/** Ellipse as four cubic arcs (k is the usual circle approximation constant). */
function ellipse(w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  const k = 0.5522847498;
  return [
    `M ${f(-rx)} 0`,
    `C ${f(-rx)} ${f(-ry * k)} ${f(-rx * k)} ${f(-ry)} 0 ${f(-ry)}`,
    `C ${f(rx * k)} ${f(-ry)} ${f(rx)} ${f(-ry * k)} ${f(rx)} 0`,
    `C ${f(rx)} ${f(ry * k)} ${f(rx * k)} ${f(ry)} 0 ${f(ry)}`,
    `C ${f(-rx * k)} ${f(ry)} ${f(-rx)} ${f(ry * k)} ${f(-rx)} 0 Z`,
  ].join(" ");
}

function roundedRect(w: number, h: number, r: number): string {
  const x = -w / 2;
  const y = -h / 2;
  const k = 0.5522847498 * r;
  return [
    `M ${f(x + r)} ${f(y)}`,
    `L ${f(x + w - r)} ${f(y)}`,
    `C ${f(x + w - r + k)} ${f(y)} ${f(x + w)} ${f(y + r - k)} ${f(x + w)} ${f(y + r)}`,
    `L ${f(x + w)} ${f(y + h - r)}`,
    `C ${f(x + w)} ${f(y + h - r + k)} ${f(x + w - r + k)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}`,
    `L ${f(x + r)} ${f(y + h)}`,
    `C ${f(x + r - k)} ${f(y + h)} ${f(x)} ${f(y + h - r + k)} ${f(x)} ${f(y + h - r)}`,
    `L ${f(x)} ${f(y + r)}`,
    `C ${f(x)} ${f(y + r - k)} ${f(x + r - k)} ${f(y)} ${f(x + r)} ${f(y)} Z`,
  ].join(" ");
}

/** The outline of a frame shape filling a w × h box centred on the origin. */
export function framePath(shape: FrameShape, w: number, h: number, cornerFraction = 0): string {
  switch (shape) {
    case "square":
      return cornerFraction > 0 ? roundedRect(w, h, Math.min(w, h) * Math.min(0.5, cornerFraction)) : polygon([[0, 0], [1, 0], [1, 1], [0, 1]], w, h);
    case "rounded":
      return roundedRect(w, h, Math.min(w, h) * 0.12);
    case "circle":
      return ellipse(w, h);
    case "arch": {
      // A semicircle (as wide as the box) on top of a rectangle.
      const rx = w / 2;
      const ry = Math.min(h, w / 2);
      const k = 0.5522847498;
      const top = -h / 2;
      const spring = top + ry;
      return [
        `M ${f(-rx)} ${f(h / 2)}`,
        `L ${f(-rx)} ${f(spring)}`,
        `C ${f(-rx)} ${f(spring - ry * k)} ${f(-rx * k)} ${f(top)} 0 ${f(top)}`,
        `C ${f(rx * k)} ${f(top)} ${f(rx)} ${f(spring - ry * k)} ${f(rx)} ${f(spring)}`,
        `L ${f(rx)} ${f(h / 2)} Z`,
      ].join(" ");
    }
    case "triangle":
      return polygon([[0.5, 0], [1, 1], [0, 1]], w, h);
    case "diamond":
      return polygon([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h);
    case "hexagon":
      return polygon([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]], w, h);
    case "star":
      return polygon(starUnitPoints(5, 0.45), w, h);
    case "heart": {
      const p = (x: number, y: number) => `${f((x - 0.5) * w)} ${f((y - 0.5) * h)}`;
      return [
        `M ${p(0.5, 0.25)}`,
        `C ${p(0.5, 0.1)} ${p(0.35, 0)} ${p(0.25, 0)}`,
        `C ${p(0.1, 0)} ${p(0, 0.12)} ${p(0, 0.3)}`,
        `C ${p(0, 0.55)} ${p(0.25, 0.75)} ${p(0.5, 1)}`,
        `C ${p(0.75, 0.75)} ${p(1, 0.55)} ${p(1, 0.3)}`,
        `C ${p(1, 0.12)} ${p(0.9, 0)} ${p(0.75, 0)}`,
        `C ${p(0.65, 0)} ${p(0.5, 0.1)} ${p(0.5, 0.25)} Z`,
      ].join(" ");
    }
    case "phone":
      return roundedRect(w, h, Math.min(w, h) * 0.18);
    case "laptop":
      return polygon([[0.08, 0], [0.92, 0], [0.92, 0.82], [1, 0.93], [1, 1], [0, 1], [0, 0.93], [0.08, 0.82]], w, h);
    case "torn": {
      const points: [number, number][] = [[0, 0], [1, 0], [1, 1]];
      for (let i = 9; i >= 1; i--) points.push([i / 10, i % 2 ? 0.96 : 1]);
      points.push([0, 1]);
      return polygon(points, w, h);
    }
    case "postage": {
      const points: [number, number][] = [[0, 0]];
      for (let i = 1; i < 12; i++) points.push([i / 12, i % 2 ? 0.025 : 0]);
      points.push([1, 0]);
      for (let i = 1; i < 12; i++) points.push([i % 2 ? 0.975 : 1, i / 12]);
      points.push([1, 1]);
      for (let i = 11; i > 0; i--) points.push([i / 12, i % 2 ? 0.975 : 1]);
      points.push([0, 1]);
      for (let i = 11; i > 0; i--) points.push([i % 2 ? 0.025 : 0, i / 12]);
      return polygon(points, w, h);
    }
    case "tablet":
      return roundedRect(w, h, Math.min(w, h) * 0.09);
    case "smartwatch":
      return roundedRect(w, h, Math.min(w, h) * 0.28);
    case "browser":
      return roundedRect(w, h, Math.min(w, h) * 0.035);
    case "pentagon":
      return polygon(regularUnitPoints(5), w, h);
    case "heptagon":
      return polygon(regularUnitPoints(7), w, h);
    case "octagon":
      return polygon(regularUnitPoints(8), w, h);
    case "rounded-pentagon":
      return roundedPolygon(regularUnitPoints(5), w, h);
    case "rounded-hexagon":
      return roundedPolygon(regularUnitPoints(6), w, h);
    case "rounded-octagon":
      return roundedPolygon(regularUnitPoints(8), w, h);
    case "burst8":
      return polygon(starUnitPoints(8, 0.67), w, h);
    case "burst12":
      return polygon(starUnitPoints(12, 0.72), w, h);
    case "blob1": case "blob2": case "blob3": case "blob4": case "blob5": case "blob6":
      return blobPath(Number(shape.slice(-1)), w, h);
    case "filmstrip":
      return notchedSides(w, h, 5);
    case "ticket":
      return polygon([[0, 0], [1, 0], [1, 0.4], [0.94, 0.5], [1, 0.6], [1, 1], [0, 1], [0, 0.6], [0.06, 0.5], [0, 0.4]], w, h);
    case "shield":
      return polygon([[0, 0], [1, 0], [1, 0.58], [0.84, 0.84], [0.5, 1], [0.16, 0.84], [0, 0.58]], w, h);
    case "rosette":
      return polygon(starUnitPoints(14, 0.78), w, h);
    case "ribbon":
      return polygon([[0, 0], [1, 0], [1, 1], [0.5, 0.74], [0, 1]], w, h);
    case "cloud":
      return roundedPolygon([[0, 0.44], [0.14, 0.34], [0.28, 0.15], [0.51, 0], [0.7, 0.21], [0.91, 0.27], [1, 0.52], [0.96, 0.79], [0.76, 1], [0.23, 1], [0.03, 0.82]], w, h, 0.26);
    case "speech":
      return roundedPolygon([[0.14, 0], [0.86, 0], [1, 0.15], [1, 0.66], [0.84, 0.82], [0.37, 0.82], [0.11, 1], [0.16, 0.82], [0, 0.68], [0, 0.15]], w, h, 0.09);
    case "cross":
      return polygon([[0.34, 0], [0.66, 0], [0.66, 0.34], [1, 0.34], [1, 0.66], [0.66, 0.66], [0.66, 1], [0.34, 1], [0.34, 0.66], [0, 0.66], [0, 0.34], [0.34, 0.34]], w, h);
    case "drop":
      return roundedPolygon([[0.5, 0], [0.65, 0.26], [0.86, 0.52], [1, 0.74], [0.86, 0.94], [0.5, 1], [0.14, 0.94], [0, 0.74], [0.14, 0.52], [0.35, 0.26]], w, h, 0.25);
  }
}

/** Numbers in a path, in pairs: enough to check where a path reaches in tests. */
export function pathExtent(d: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export type Region = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

const clampTo = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max));

/**
 * The part of an image (natural size) shown in a frame of the given aspect ratio at a zoom level:
 * zoom 1 is the largest region that fills the frame, 2 shows half as much. The region keeps its
 * centre where it can and never leaves the image.
 */
export function frameCrop(natural: Size, aspect: number, zoom: number, center?: { x: number; y: number }): Region {
  const baseWidth = Math.min(natural.width, natural.height * aspect);
  const width = baseWidth / Math.max(1, zoom);
  const height = width / aspect;
  const c = center ?? { x: natural.width / 2, y: natural.height / 2 };
  return { x: clampTo(c.x - width / 2, natural.width - width), y: clampTo(c.y - height / 2, natural.height - height), width, height };
}

/** Zoom of a region within a frame: 1 when it is the largest that fits the image. */
export function frameZoom(natural: Size, crop: Size): number {
  const aspect = crop.width / crop.height;
  return Math.min(natural.width, natural.height * aspect) / crop.width;
}

/** The region moved by (dx, dy) image pixels, kept inside the image. */
export function panCrop(crop: Region, natural: Size, dx: number, dy: number): Region {
  return { ...crop, x: clampTo(crop.x + dx, natural.width - crop.width), y: clampTo(crop.y + dy, natural.height - crop.height) };
}
