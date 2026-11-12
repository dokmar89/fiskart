/**
 * Image adjustments as the toolbar shows them (sliders from -100 to 100, a preset filter) and as
 * Fabric stores them (its own `filters` array on the image). Pure: no Fabric import, unit tested.
 */

export const FILTER_PRESETS = ["none", "grayscale", "sepia", "vintage", "kodachrome", "technicolor", "polaroid", "brownie", "pop", "sunset", "cyberpunk", "forest", "cherry", "amber", "monovy"] as const;
export type FilterPreset = (typeof FILTER_PRESETS)[number];

export const PRESET_LABELS: Record<FilterPreset, string> = {
  none: "Žádný",
  grayscale: "Černobílý",
  sepia: "Sépie",
  vintage: "Vintage",
  kodachrome: "Retro",
  technicolor: "Živý",
  polaroid: "Instantní",
  brownie: "Vybledlý",
  pop: "Pop",
  sunset: "Západ slunce",
  cyberpunk: "Cyberpunk",
  forest: "Lesní",
  cherry: "Třešňový",
  amber: "Jantarový",
  monovy: "Monový",
};

/** Fabric's class names for the presets. */
const PRESET_TYPES = {
  grayscale: "Grayscale",
  sepia: "Sepia",
  vintage: "Vintage",
  kodachrome: "Kodachrome",
  technicolor: "Technicolor",
  polaroid: "Polaroid",
  brownie: "Brownie",
} as const;

type BuiltInPreset = keyof typeof PRESET_TYPES;

/** A 4×5 colour matrix: the same values are used in canvas, reload and export. */
function grade(r: number, g: number, b: number, rb = 0, gb = 0, bb = 0): number[] {
  return [r, 0, 0, 0, rb, 0, g, 0, 0, gb, 0, 0, b, 0, bb, 0, 0, 0, 1, 0];
}

function duotone(shadow: [number, number, number], light: [number, number, number]): number[] {
  const weights = [0.2126, 0.7152, 0.0722];
  return [
    ...weights.map((w) => w * (light[0] - shadow[0]) / 255), 0, shadow[0] / 255,
    ...weights.map((w) => w * (light[1] - shadow[1]) / 255), 0, shadow[1] / 255,
    ...weights.map((w) => w * (light[2] - shadow[2]) / 255), 0, shadow[2] / 255,
    0, 0, 0, 1, 0,
  ];
}

const MATRIX_PRESETS = {
  pop: grade(1.12, 1.12, 1.12, -0.035, -0.035, -0.035),
  sunset: grade(1.12, 1.01, 0.82, 0.015, 0.005, 0),
  cyberpunk: duotone([32, 17, 74], [54, 239, 228]),
  forest: grade(0.88, 1.11, 0.88, 0, 0.012, -0.005),
  cherry: grade(1.13, 0.89, 0.98, 0.015, 0, 0.004),
  amber: duotone([56, 27, 12], [255, 210, 107]),
  monovy: duotone([27, 30, 37], [231, 232, 222]),
} as const satisfies Record<Exclude<FilterPreset, "none" | BuiltInPreset>, number[]>;

type MatrixPreset = keyof typeof MATRIX_PRESETS;
const isBuiltIn = (preset: FilterPreset): preset is BuiltInPreset => preset in PRESET_TYPES;
const isMatrix = (preset: FilterPreset): preset is MatrixPreset => preset in MATRIX_PRESETS;

export type Adjustments = {
  /** -100 to 100. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** 0 to 100. */
  blur: number;
  /** -100 to 100: warm/cool and green/magenta balance. */
  temperature: number;
  tint: number;
  /** 0 to 100: convolution and edge darkening. */
  sharpness: number;
  vignette: number;
  preset: FilterPreset;
};

export const NO_ADJUSTMENTS: Adjustments = { brightness: 0, contrast: 0, saturation: 0, blur: 0, temperature: 0, tint: 0, sharpness: 0, vignette: 0, preset: "none" };

/**
 * Fabric value at the slider's end. Fabric's full ranges are harsh (brightness 1 is white), so the
 * sliders cover the useful part. Blur is a share of the image's width, so it looks the same at any
 * resolution.
 */
const SCALE = { brightness: 0.5, contrast: 0.6, saturation: 1, blur: 0.25 } as const;

type SliderKey = keyof typeof SCALE;
const FABRIC_TYPE: Record<SliderKey, string> = { brightness: "Brightness", contrast: "Contrast", saturation: "Saturation", blur: "Blur" };
const SLIDERS = Object.keys(SCALE) as SliderKey[];

export type FilterJson = { type: string } & Record<string, unknown>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (n: number) => Math.round(n * 1e6) / 1e6;

function whiteBalance(temperature: number, tint: number): number[] {
  const warm = clamp(temperature, -100, 100) / 100;
  const magenta = clamp(tint, -100, 100) / 100;
  return grade(round(1 + warm * 0.12 + magenta * 0.05), round(1 - magenta * 0.1), round(1 - warm * 0.12 + magenta * 0.05));
}

const sameMatrix = (a: unknown, b: readonly number[]) => Array.isArray(a) && a.length === b.length && a.every((v, i) => typeof v === "number" && Math.abs(v - b[i]) < 1e-6);

/** Fabric filters for the adjustments: the preset first, then each slider that is not at zero. */
export function filtersFor(adjustments: Adjustments): FilterJson[] {
  const filters: FilterJson[] = [];
  if (isBuiltIn(adjustments.preset)) filters.push({ type: PRESET_TYPES[adjustments.preset] });
  else if (isMatrix(adjustments.preset)) filters.push({ type: "ColorMatrix", matrix: MATRIX_PRESETS[adjustments.preset] });
  for (const key of SLIDERS) {
    const value = clamp(adjustments[key], key === "blur" ? 0 : -100, 100);
    if (value !== 0) filters.push({ type: FABRIC_TYPE[key], [key]: round((value / 100) * SCALE[key]) });
  }
  if (adjustments.temperature || adjustments.tint) filters.push({ type: "ColorMatrix", matrix: whiteBalance(adjustments.temperature, adjustments.tint) });
  if (adjustments.sharpness) {
    const strength = round(clamp(adjustments.sharpness, 0, 100) / 100);
    filters.push({ type: "Convolute", matrix: [0, -strength, 0, -strength, 1 + strength * 4, -strength, 0, -strength, 0], opaque: false });
  }
  if (adjustments.vignette) filters.push({ type: "Vignette", strength: round(clamp(adjustments.vignette, 0, 100) / 100) });
  return filters;
}

/** The adjustments stored filters stand for; filters it does not know are ignored. */
export function adjustmentsOf(filters: readonly unknown[] | undefined): Adjustments {
  const result: Adjustments = { ...NO_ADJUSTMENTS };
  for (const filter of filters ?? []) {
    if (!filter || typeof filter !== "object") continue;
    const f = filter as FilterJson;
    const preset = (Object.keys(PRESET_TYPES) as BuiltInPreset[]).find((p) => PRESET_TYPES[p] === f.type);
    if (preset) {
      result.preset = preset;
      continue;
    }
    if (f.type === "ColorMatrix") {
      const matrixPreset = (Object.keys(MATRIX_PRESETS) as MatrixPreset[]).find((p) => sameMatrix(f.matrix, MATRIX_PRESETS[p]));
      if (matrixPreset) { result.preset = matrixPreset; continue; }
      if (Array.isArray(f.matrix) && f.matrix.length === 20) {
        const m = f.matrix as number[];
        if (m[1] === 0 && m[2] === 0 && m[5] === 0 && m[7] === 0 && m[10] === 0 && m[11] === 0) {
          const magenta = (1 - m[6]) / 0.1;
          result.tint = Math.round(magenta * 100);
          result.temperature = Math.round(((m[0] - m[12]) / 0.24) * 100);
          continue;
        }
      }
    }
    if (f.type === "Convolute" && Array.isArray(f.matrix) && typeof f.matrix[1] === "number") { result.sharpness = Math.round(-f.matrix[1] * 100); continue; }
    if (f.type === "Vignette" && typeof f.strength === "number") { result.vignette = Math.round(f.strength * 100); continue; }
    const key = SLIDERS.find((k) => FABRIC_TYPE[k] === f.type);
    if (key && typeof f[key] === "number") result[key] = Math.round(((f[key] as number) / SCALE[key]) * 100);
  }
  return result;
}

export function hasAdjustments(adjustments: Adjustments): boolean {
  return filtersFor(adjustments).length > 0;
}
