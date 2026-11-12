import { afterEach, describe, expect, it, vi } from "vitest";
import { useStockStore } from "./stock";

afterEach(() => vi.unstubAllGlobals());

const icon = (name: string) => ({ name, set: "Test", license: "MIT" });

describe("Iconify pages", () => {
  it("passes category and start, appends unique icons, and retains them after the last page", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return Response.json(calls.length === 1
        ? { icons: [icon("test:one"), icon("test:two")], previews: { "test:one": "/one" }, hasMore: true }
        : { icons: [icon("test:two"), icon("test:three")], previews: { "test:three": "/three" }, hasMore: false });
    });
    await useStockStore.getState().searchIcons("cat", "emoji");
    await useStockStore.getState().searchIcons("cat", "emoji", true);
    expect(calls[0]).toContain("category=emoji");
    expect(calls[1]).toContain("start=2");
    expect(useStockStore.getState().icons.icons.map((item) => item.name)).toEqual(["test:one", "test:two", "test:three"]);
    expect(useStockStore.getState().icons.previews["test:three"]).toBe("/three");
    expect(useStockStore.getState().icons.hasMore).toBe(false);
  });

  it("keeps prior results when loading another page fails", async () => {
    let step = 0;
    vi.stubGlobal("fetch", async () => {
      step++;
      return step === 1
        ? Response.json({ icons: [icon("test:one")], previews: {}, hasMore: true })
        : Response.json({ error: "Vytížené" }, { status: 429 });
    });
    await useStockStore.getState().searchIcons("dog", "all");
    await useStockStore.getState().searchIcons("dog", "all", true);
    expect(useStockStore.getState().icons.icons.map((item) => item.name)).toEqual(["test:one"]);
    expect(useStockStore.getState().icons.error).toBe("Vytížené");
  });
});
