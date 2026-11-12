import { describe, expect, it } from "vitest";
import { iconifySvgPath, isIconName, pexelsDownloadUrl, readIconifySearch, readPexelsPage, readPexelsPhoto, stockKey } from "./stock";

const photo = {
  id: 2014422,
  width: 3024,
  height: 3024,
  url: "https://www.pexels.com/photo/brown-rocks-during-golden-hour-2014422/",
  photographer: "Joey Farina",
  photographer_url: "https://www.pexels.com/@joey",
  avg_color: "#978E82",
  src: {
    original: "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg",
    large2x: "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    medium: "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg?auto=compress&cs=tinysrgb&h=350",
  },
  alt: "Brown Rocks During Golden Hour",
};

describe("Pexels", () => {
  it("reads a photo", () => {
    expect(readPexelsPhoto(photo)).toEqual({
      id: 2014422,
      width: 3024,
      height: 3024,
      alt: "Brown Rocks During Golden Hour",
      photographer: "Joey Farina",
      photographerUrl: "https://www.pexels.com/@joey",
      pageUrl: "https://www.pexels.com/photo/brown-rocks-during-golden-hour-2014422/",
      thumb: photo.src.medium,
      color: "#978E82",
    });
    expect(readPexelsPhoto({ id: 1 })).toBeNull();
    expect(readPexelsPhoto(null)).toBeNull();
  });

  it("reads a page and whether there is another", () => {
    expect(readPexelsPage({ photos: [photo, { junk: true }], next_page: "https://api.pexels.com/v1/search?page=2" }, 1)).toMatchObject({
      page: 1,
      hasMore: true,
      photos: [{ id: 2014422 }],
    });
    expect(readPexelsPage({ photos: [] }, 3)).toEqual({ photos: [], page: 3, hasMore: false });
  });

  it("downloads a large rendition rather than the original", () => {
    const url = new URL(pexelsDownloadUrl(photo)!);
    expect(url.origin + url.pathname).toBe(photo.src.original);
    expect(url.searchParams.get("w")).toBe("2400");
    expect(pexelsDownloadUrl({ src: { large2x: "https://x/y.jpg" } })).toBe("https://x/y.jpg");
    expect(pexelsDownloadUrl({})).toBeNull();
  });
});

describe("Iconify", () => {
  it("accepts icon names only", () => {
    expect(isIconName("mdi:home")).toBe(true);
    expect(isIconName("fluent-emoji-flat:red-heart")).toBe(true);
    expect(isIconName("mdi:home/../x")).toBe(false);
    expect(isIconName("../etc:passwd")).toBe(false);
    expect(isIconName("home")).toBe(false);
  });

  it("reads a search with each icon's set and licence", () => {
    const result = readIconifySearch(
      {
        icons: ["mdi:home", "bad name", "tabler:home"],
        total: 2,
        collections: { mdi: { name: "Material Design Icons", license: { title: "Apache 2.0" } }, tabler: { name: "Tabler Icons" } },
      },
      64,
    );
    expect(result).toEqual({
      hasMore: false,
      icons: [
        { name: "mdi:home", set: "Material Design Icons", license: "Apache 2.0" },
        { name: "tabler:home", set: "Tabler Icons", license: "Neznámá licence" },
      ],
    });
  });

  it("determines whether a later Iconify page is available", () => {
    expect(readIconifySearch({ icons: ["mdi:home", "mdi:star"], total: 200, start: 96 }, 96).hasMore).toBe(true);
    expect(readIconifySearch({ icons: ["mdi:home"], total: 96, start: 96 }, 96, 96).hasMore).toBe(false);
    expect(readIconifySearch({ icons: ["mdi:home", "mdi:star"], total: 2, start: 0 }, 2).hasMore).toBe(true);
  });

  it("rejects invalid icon names and removes duplicates from a provider response", () => {
    expect(readIconifySearch({ icons: ["mdi:home", "mdi:home", "../bad", 5], total: 2, collections: {} }, 96).icons.map((icon) => icon.name)).toEqual(["mdi:home"]);
  });

  it("asks for a black icon so it can be recoloured", () => {
    expect(iconifySvgPath("mdi:home")).toBe("/mdi/home.svg?color=%23000000&height=256");
  });

  it("keys stock copies by source", () => {
    expect(stockKey("pexels", 12)).toBe("pexels:12");
    expect(stockKey("iconify", "mdi:home")).toBe("iconify:mdi:home");
  });
});
