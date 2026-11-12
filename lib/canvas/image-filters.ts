import { classRegistry, type FabricImage, type filters } from "fabric";
import { adjustmentsOf, filtersFor, type Adjustments } from "@/lib/image-adjust";

type FilterClass = new (options: Record<string, unknown>) => filters.BaseFilter<string>;

export function imageAdjustments(image: FabricImage): Adjustments {
  return adjustmentsOf(image.filters.filter(Boolean).map((f) => f.toObject()));
}

/** Replaces the image's filters with the ones for these adjustments and redraws it. */
export function applyAdjustments(image: FabricImage, adjustments: Adjustments) {
  image.filters = filtersFor(adjustments).map(({ type, ...options }) => {
    const Filter = classRegistry.getClass<FilterClass>(type);
    return new Filter(options);
  });
  image.applyFilters();
  image.set({ dirty: true });
}
