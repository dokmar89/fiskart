"use client";

import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CaseUpper, Italic, LetterText, List, ListOrdered, Spline, Underline } from "lucide-react";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isMixed } from "@/lib/canvas/mixed";
import { changeSelection, endGesture } from "@/lib/canvas/props";
import type { SelectionSnapshot } from "@/lib/canvas/selection";
import { curveToDegrees, degreesToCurve } from "@/lib/curve-math";
import { ColorPicker } from "./color-picker";
import { NumberField, pressedState, SliderField, ToolButton } from "./controls";
import { FontPicker } from "./font-picker";
import { TextEffects } from "./text-effects";

const ALIGNMENTS = [
  { value: "left", label: "Zarovnat vlevo", icon: AlignLeft },
  { value: "center", label: "Zarovnat na střed", icon: AlignCenter },
  { value: "right", label: "Zarovnat vpravo", icon: AlignRight },
  { value: "justify", label: "Zarovnat do bloku", icon: AlignJustify },
] as const;

/** The words of a curved text, typed here rather than on the page. Applied on Enter or when leaving the field. */
function CurvedTextField({ value }: { value: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const text = draft.replace(/\s+/g, " ");
    if (text.trim() && text !== value) void changeSelection({ text });
    else setDraft(value);
  };
  return (
    <input
      aria-label="Zakřivený text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          requestAnimationFrame(() => e.currentTarget?.blur());
        }
      }}
      className="h-8 w-40 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring dark:bg-input/30"
    />
  );
}

function CurveControl({ value }: { value: SelectionSnapshot["curve"] }) {
  const degrees = typeof value === "number" ? Math.max(-180, Math.min(180, Math.round(curveToDegrees(value)))) : value;
  return (
    <Popover onOpenChange={(open) => !open && endGesture()}>
      <PopoverTrigger asChild>
        <ToolButton label="Zakřivení">
          <Spline />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent className="grid w-64 gap-2" align="start">
        <SliderField
            label="Zakřivení (°)"
            value={degrees}
            min={-180}
            max={180}
            onLive={(angle) => void changeSelection({ curve: degreesToCurve(angle) }, "live")}
            onCommit={(angle) => void changeSelection({ curve: degreesToCurve(angle) })}
        />
        <p className="text-xs text-muted-foreground">Kladná hodnota ohne text do oblouku nahoru, záporná dolů.</p>
      </PopoverContent>
    </Popover>
  );
}

export function TextTools({ selection }: { selection: SelectionSnapshot }) {
  const curved = selection.curve !== undefined;
  const alignIndex = ALIGNMENTS.findIndex((a) => a.value === selection.textAlign);
  const align = ALIGNMENTS[alignIndex] ?? ALIGNMENTS[0];
  const nextAlign = ALIGNMENTS[(alignIndex + 1) % ALIGNMENTS.length];
  const AlignIcon = align.icon;
  const list = selection.listStyle;
  // One button cycles none → bullets → numbers → none, as the alignment button cycles alignments.
  const nextList = isMixed(list) || list === null || list === undefined ? "bullet" : list === "bullet" ? "number" : null;
  const ownsColor = !isMixed(selection.effect) && (selection.effect?.type === "hollow" || selection.effect?.type === "neon");

  return (
    <>
      {selection.curvedText !== undefined && <CurvedTextField value={selection.curvedText} />}
      {curved && <CurveControl value={selection.curve} />}
      <FontPicker value={selection.fontFamily} onChange={(fontFamily) => void changeSelection({ fontFamily })} />
      <NumberField label="Velikost písma" value={selection.fontSize} min={1} max={2000} onCommit={(fontSize) => void changeSelection({ fontSize })} />
      <ColorPicker
        label="Barva textu"
        value={selection.fill}
        allowGradient={!ownsColor}
        onChange={(fill, mode) => fill !== null && void changeSelection({ fill }, mode)}
      />
      <ToolButton label="Tučné" pressed={pressedState(selection.bold)} onClick={() => void changeSelection({ bold: selection.bold !== true })}>
        <Bold />
      </ToolButton>
      <ToolButton label="Kurzíva" pressed={pressedState(selection.italic)} onClick={() => void changeSelection({ italic: selection.italic !== true })}>
        <Italic />
      </ToolButton>
      {!curved && (
        <ToolButton
          label="Podtržení"
          pressed={pressedState(selection.underline)}
          onClick={() => void changeSelection({ underline: selection.underline !== true })}
        >
          <Underline />
        </ToolButton>
      )}
      {!curved && (
        <ToolButton
          label={isMixed(selection.textAlign) ? "Zarovnání: různé" : `${align.label} (kliknutím ${nextAlign.label.toLowerCase()})`}
          pressed={isMixed(selection.textAlign) ? "mixed" : undefined}
          onClick={() => void changeSelection({ textAlign: nextAlign.value })}
        >
          <AlignIcon />
        </ToolButton>
      )}
      {!curved && (
        <ToolButton
          label={list === "number" ? "Číslovaný seznam (kliknutím zrušit)" : list === "bullet" ? "Odrážkový seznam (kliknutím číslovat)" : "Odrážkový seznam"}
          pressed={isMixed(list) ? "mixed" : Boolean(list)}
          onClick={() => void changeSelection({ listStyle: nextList })}
        >
          {list === "number" ? <ListOrdered /> : <List />}
        </ToolButton>
      )}
      <ToolButton
        label="Velká písmena"
        pressed={pressedState(selection.uppercase)}
        onClick={() => void changeSelection({ uppercase: selection.uppercase !== true })}
      >
        <CaseUpper />
      </ToolButton>
      <Popover onOpenChange={(open) => !open && endGesture()}>
        <PopoverTrigger asChild>
          <ToolButton label="Mezery">
            <LetterText />
          </ToolButton>
        </PopoverTrigger>
        <PopoverContent className="grid w-64 gap-4" align="start">
          <SliderField
            label="Mezery mezi písmeny"
            value={selection.charSpacing}
            min={-200}
            max={800}
            step={10}
            onLive={(charSpacing) => void changeSelection({ charSpacing }, "live")}
            onCommit={(charSpacing) => void changeSelection({ charSpacing })}
          />
          <SliderField
            label="Výška řádku"
            value={selection.lineHeight}
            min={0.5}
            max={3}
            step={0.05}
            onLive={(lineHeight) => void changeSelection({ lineHeight }, "live")}
            onCommit={(lineHeight) => void changeSelection({ lineHeight })}
          />
        </PopoverContent>
      </Popover>
      <TextEffects selection={selection} />
    </>
  );
}
