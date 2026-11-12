import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTemplatesStore } from "./templates";

const catalog = (total: number) => ({ items: [], total, page: 1, pageSize: 24, categories: ["Životopis"] });
const response = (total: number) => new Response(JSON.stringify(catalog(total)), { status: 200 });

describe("paged template store", () => {
  beforeEach(() => {
    useTemplatesStore.setState({
      templates: null, categories: [], total: 0, page: 1, pageSize: 24,
      query: "", category: null, preferredWidth: null, preferredHeight: null, loading: false, error: null,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("requests only the selected catalog page and stores its count", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toContain("/api/templates/catalog?");
      return response(42);
    });
    vi.stubGlobal("fetch", fetcher);
    await useTemplatesStore.getState().load({ query: "zivotopis", page: 2, preferredWidth: 1920, preferredHeight: 1080 });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("page=2&query=zivotopis");
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("preferredWidth=1920&preferredHeight=1080");
    expect(useTemplatesStore.getState()).toMatchObject({ total: 42, page: 1, categories: ["Životopis"], loading: false });
  });

  it("ignores an older search response after a newer request has finished", async () => {
    let finishOld!: (value: Response) => void;
    const old = new Promise<Response>((resolve) => { finishOld = resolve; });
    const fetcher = vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce(response(2));
    vi.stubGlobal("fetch", fetcher);
    const pendingOld = useTemplatesStore.getState().load({ query: "old", page: 1 });
    await useTemplatesStore.getState().load({ query: "new", page: 1 });
    finishOld(response(1));
    await pendingOld;
    expect(useTemplatesStore.getState()).toMatchObject({ query: "new", total: 2, loading: false });
  });
});
