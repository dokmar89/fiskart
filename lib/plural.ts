/** Czech plural form: 1 stránka, 2–4 stránky, 0 or 5+ stránek. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}
