import type { TableModel } from "./table-math";

export const TABLE_PRESETS = [
  { id: "clean", label: "Čistá" },
  { id: "zebra", label: "Pruhovaná" },
  { id: "minimal", label: "Minimalistická" },
  { id: "pricing", label: "Ceník" },
] as const;

export type TablePreset = (typeof TABLE_PRESETS)[number]["id"];

/** Applies a visual template to existing data, preserving every cell's text. */
export function styleTable(model: TableModel, preset: TablePreset): { model: TableModel; borderColor: string; borderWidth: number; textColor: string } {
  const cells = model.cells.map((row, r) => row.map((cell, c) => {
    if (preset === "clean") return { ...cell, fill: r === 0 ? "#e4e4e7" : "#ffffff", textColor: "#18181b" };
    if (preset === "zebra") return { ...cell, fill: r === 0 ? "#dbeafe" : r % 2 ? "#f4f4f5" : "#ffffff", textColor: "#172554" };
    if (preset === "minimal") return { ...cell, fill: r === 0 ? "#f4f4f5" : null, textColor: "#18181b" };
    return { ...cell, fill: r === 0 ? "#18181b" : c === 1 ? "#dbeafe" : c === 0 ? "#f4f4f5" : "#ffffff", textColor: r === 0 ? "#ffffff" : "#18181b" };
  }));
  const borderWidth = preset === "minimal" ? 0 : 1;
  const borderColor = preset === "pricing" ? "#a1a1aa" : "#d4d4d8";
  return { model: { ...model, cells }, borderColor, borderWidth, textColor: "#18181b" };
}
