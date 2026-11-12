/** Shared between the font routes and the editor. No server or Fabric imports. */

export const MAX_FONT_BYTES = 10 * 1024 * 1024;

export const FONT_FILE_ACCEPT = ".ttf,.otf,.woff2,font/ttf,font/otf,font/woff2";

/** One uploaded font file: one face of a family. */
export type CustomFontDto = {
  id: string;
  family: string;
  weight: "400" | "700";
  style: "normal" | "italic";
  url: string;
  fileName: string;
};
