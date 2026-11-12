import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { download, photoDownloadUrl, searchIcons, searchPhotos, StockError } = await import("./stock");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  });
  return calls;
}

describe("photos", () => {
  it("asks for the key before calling Pexels", async () => {
    vi.stubEnv("PEXELS_API_KEY", "");
    const calls = stubFetch(() => new Response("{}"));
    await expect(searchPhotos("cat", 1)).rejects.toMatchObject({ code: "missing-key" });
    expect(calls).toHaveLength(0);
  });

  it("sends the key in a header to the configured API, and searches or lists curated photos", async () => {
    vi.stubEnv("PEXELS_API_KEY", "secret");
    vi.stubEnv("PEXELS_API_URL", "http://pexels.test/v1/");
    const calls = stubFetch(() => Response.json({ photos: [], page: 1 }));
    await searchPhotos("red cat", 2);
    await searchPhotos("", 1);
    expect(calls[0].url).toBe("http://pexels.test/v1/search?per_page=30&page=2&query=red+cat");
    expect(calls[1].url).toBe("http://pexels.test/v1/curated?per_page=30&page=1");
    expect(new Headers(calls[0].init?.headers).get("Authorization")).toBe("secret");
  });

  it("treats a refused key like a missing one", async () => {
    vi.stubEnv("PEXELS_API_KEY", "wrong");
    stubFetch(() => new Response("", { status: 401 }));
    await expect(searchPhotos("x", 1)).rejects.toMatchObject({ code: "missing-key" });
  });

  it("looks the download up by photo id", async () => {
    vi.stubEnv("PEXELS_API_KEY", "secret");
    vi.stubEnv("PEXELS_API_URL", "http://pexels.test/v1");
    const calls = stubFetch(() => Response.json({ src: { large2x: "http://img.test/1.jpg" } }));
    expect(await photoDownloadUrl(7)).toBe("http://img.test/1.jpg");
    expect(calls[0].url).toBe("http://pexels.test/v1/photos/7");
  });
});

describe("icons", () => {
  it("searches Iconify and gives preview URLs", async () => {
    vi.stubEnv("ICONIFY_API_URL", "http://iconify.test");
    stubFetch(() => Response.json({ icons: ["mdi:home"], total: 1, collections: {} }));
    const result = await searchIcons("home");
    expect(result.previews).toEqual({ "mdi:home": "http://iconify.test/mdi/home.svg?color=%23000000&height=256" });
  });

  it("passes pagination and collection prefixes to Iconify", async () => {
    vi.stubEnv("ICONIFY_API_URL", "http://iconify.test");
    const calls = stubFetch(() => Response.json({ icons: [], total: 0, collections: {} }));
    await searchIcons("star", 96, "emoji");
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("query")).toBe("star");
    expect(url.searchParams.get("start")).toBe("96");
    expect(url.searchParams.get("prefixes")).toContain("twemoji");
    expect(url.searchParams.get("limit")).toBe("96");
  });

  it("reports an unreachable service", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    await expect(searchIcons("home")).rejects.toBeInstanceOf(StockError);
  });

  it("explains rate limiting and malformed JSON without returning broken icons", async () => {
    stubFetch(() => new Response("", { status: 429 }));
    await expect(searchIcons("star")).rejects.toMatchObject({ code: "unavailable", message: expect.stringContaining("vytížené") });
    vi.unstubAllGlobals();
    stubFetch(() => new Response("not json"));
    await expect(searchIcons("star")).rejects.toMatchObject({ code: "unavailable", message: expect.stringContaining("neplatnou odpověď") });
  });
});

describe("download", () => {
  it("refuses files over the limit", async () => {
    stubFetch(() => new Response(new Uint8Array(100)));
    await expect(download("http://x.test/a", 50)).rejects.toMatchObject({ code: "unavailable" });
    expect((await download("http://x.test/a", 100)).byteLength).toBe(100);
  });
});
