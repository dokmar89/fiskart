"use client";

import { addCurvedText, addText, type TextPreset } from "@/lib/canvas/elements";
import { addTextCombo, TEXT_COMBOS } from "@/lib/canvas/text-combos";

const PRESETS: { preset: TextPreset; label: string; className: string }[] = [
  { preset: "heading", label: "Přidat nadpis", className: "text-xl font-bold" },
  { preset: "subheading", label: "Přidat podnadpis", className: "text-base font-semibold" },
  { preset: "body", label: "Přidat trochu běžného textu", className: "text-xs" },
];

export function TextPanel() {
  return (
    <div className="grid gap-2 p-3">
      <h2 className="text-xs font-medium text-muted-foreground">Výchozí styly textu</h2>
      {PRESETS.map(({ preset, label, className }) => (
        <button
          key={preset}
          type="button"
          onClick={() => void addText(preset)}
          className={`rounded-md border bg-muted/40 px-3 py-3 text-left hover:bg-accent ${className}`}
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => void addCurvedText()}
        className="flex items-center justify-center rounded-md border bg-muted/40 px-3 py-2 hover:bg-accent"
        aria-label="Přidat zakřivený text"
      >
        <svg viewBox="0 0 160 44" className="h-9 w-40" aria-hidden>
          <path id="curved-text-preview" d="M 10 40 Q 80 -8 150 40" fill="none" />
          <text className="fill-current text-[15px] font-semibold">
            <textPath href="#curved-text-preview" startOffset="50%" textAnchor="middle">
              Přidat zakřivený text
            </textPath>
          </text>
        </svg>
      </button>
      <p className="text-xs text-muted-foreground">Text na stránce upravíte dvojklikem. Zakřivený text se upravuje v panelu nástrojů.</p>
      <h2 className="mt-2 text-xs font-medium text-muted-foreground">Kombinace</h2>
      <div className="grid grid-cols-2 gap-2">
        {TEXT_COMBOS.map((combo) => (
          <button
            key={combo.id}
            type="button"
            aria-label={`Přidat text: ${combo.name}`}
            onClick={() => void addTextCombo(combo.id)}
            className="grid gap-1 rounded-md border bg-muted/40 px-2 py-3 text-center hover:bg-accent"
          >
            <span className="truncate text-base leading-tight" style={{ fontFamily: `"${combo.lines[0].family}"`, fontWeight: Number(combo.lines[0].weight), fontStyle: combo.lines[0].italic ? "italic" : undefined, textTransform: combo.lines[0].upper ? "uppercase" : undefined, color: combo.lines[0].color }}>
              {combo.lines[0].text}
            </span>
            <span className="truncate text-[10px] text-muted-foreground" style={{ fontFamily: `"${combo.lines[1].family}"` }}>
              {combo.lines[1].text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
