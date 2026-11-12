/** Messages between the editor and the background removal worker. */
export type BgRemovalRequest = { id: number; image: Blob; publicPath: string };

export type BgRemovalResponse =
  | { id: number; type: "progress"; stage: "download" | "process"; current: number; total: number }
  | { id: number; type: "done"; result: Blob }
  | { id: number; type: "error"; message: string };
