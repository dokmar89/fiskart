/** Darkens RGB radially; alpha remains untouched. Shared by Fabric's 2D filter and unit tests. */
export function vignetteFactor(x: number, y: number, width: number, height: number, strength: number): number {
  if (strength <= 0) return 1;
  const dx = ((x + 0.5) / Math.max(1, width) - 0.5) * 2;
  const dy = ((y + 0.5) / Math.max(1, height) - 0.5) * 2;
  const distance = Math.hypot(dx, dy) / Math.SQRT2;
  const edge = Math.min(1, Math.max(0, (distance - 0.14) / 0.86));
  return 1 - Math.min(1, Math.max(0, strength)) * edge ** 1.7 * 0.75;
}

export function shadeVignette(data: Uint8ClampedArray, width: number, height: number, strength: number): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!data[i + 3]) continue;
      const factor = vignetteFactor(x, y, width, height, strength);
      data[i] *= factor;
      data[i + 1] *= factor;
      data[i + 2] *= factor;
    }
  }
}
