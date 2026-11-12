/** Curated graphic IDs shown through the existing searchable vector library. */
export const ELEMENT_GROUPS = [
  { name: "Organické tvary", ids: Array.from({ length: 10 }, (_, index) => `blob-${index + 1}`) },
  { name: "Sociální ikony", ids: ["social-instagram", "social-facebook", "social-tiktok", "social-youtube", "social-linkedin", "social-x", "social-whatsapp", "social-pinterest", "social-mail", "social-globe", "social-phone"] },
  { name: "Odznaky", ids: ["badge-sale-20", "badge-verified", "ribbon-banner", "tag"] },
  { name: "Dekorace", ids: ["star-4", "star-5", "star-8", "heart", "arrow-right", "divider-zigzag"] },
] as const;
