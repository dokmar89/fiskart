"use client";

import { ChartColumn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/store/editor";

/** A chart's data and options are edited in the side panel. */
export function ChartTools() {
  return (
    <Button variant="ghost" size="sm" onClick={() => useEditorStore.setState({ activePanel: "chart" })}>
      <ChartColumn />
      Upravit graf
    </Button>
  );
}
