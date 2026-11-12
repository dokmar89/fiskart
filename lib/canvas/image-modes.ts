import { endCrop } from "./crop";
import { endReposition } from "./frames";

/** Ends cropping or moving an image inside its frame, whichever is on, before the page changes under it. */
export function endImageModes() {
  endCrop();
  endReposition();
}
