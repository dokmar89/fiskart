import type { Size } from "./viewport-math";

/** Share of the page a newly placed image may take up at most, per side. */
const MAX_PAGE_SHARE = 0.6;

/**
 * Scale for a newly placed image: its natural size, or smaller so it fits within 60 % of the
 * page's width and height. Never enlarges.
 */
export function placeLargestFit(image: Size, page: Size): number {
  if (image.width <= 0 || image.height <= 0) return 1;
  return Math.min(1, (page.width * MAX_PAGE_SHARE) / image.width, (page.height * MAX_PAGE_SHARE) / image.height);
}
