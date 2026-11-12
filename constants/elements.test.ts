import { describe, expect, it } from "vitest";
import { GRAPHICS } from "@/lib/graphics";
import { ELEMENT_GROUPS } from "./elements";

describe("curated vector elements", () => {
  it("includes ten blobs, social marks and useful badges in the shipped catalog", () => {
    const ids = new Set(GRAPHICS.map((graphic) => graphic.id));
    for (let n = 1; n <= 10; n++) expect(ids.has(`blob-${n}`)).toBe(true);
    for (const id of ["social-instagram", "social-facebook", "social-tiktok", "social-youtube", "social-linkedin", "social-x", "social-whatsapp", "social-pinterest", "social-mail", "social-globe", "social-phone", "badge-sale-20", "badge-verified"]) expect(ids.has(id), id).toBe(true);
    expect(ELEMENT_GROUPS.every((group) => group.ids.every((id) => ids.has(id)))).toBe(true);
  });
});
