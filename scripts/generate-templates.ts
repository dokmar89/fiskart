/** Validate the deterministic generated library before seeding it into a database. */
import { generateTemplates } from "../prisma/templates/generated";
import { BUILT_IN_TEMPLATES } from "../prisma/templates/catalog";
import { generateLibraryTemplates } from "../prisma/templates/library";
import { SCHEMA_VERSION, validatePageData } from "../lib/page-data";
import { isBuiltInFamily } from "../lib/fonts";

const templates = generateTemplates();
const slugs = new Set(templates.map((template) => template.slug));
if (templates.length < 40 || slugs.size !== templates.length) throw new Error("Generated template count or slugs are invalid");
for (const template of templates) {
  if (template.pages.length === 0 || template.pages.some((page) => !page.objects.some((object) => object.frame))) throw new Error(`Template ${template.slug} has no editable photo frame`);
  if (template.pages.some((page) => page.objects.length < 8)) throw new Error(`Template ${template.slug} has too little content`);
}
const library = generateLibraryTemplates();
if (library.length !== 1_200) throw new Error(`Expected 1200 library templates, got ${library.length}`);
const allSlugs = new Set(BUILT_IN_TEMPLATES.map((template) => template.slug));
if (allSlugs.size !== BUILT_IN_TEMPLATES.length) throw new Error("Built-in template slugs collide");
for (const template of library) {
  if (template.pages.length !== 1 || template.pages[0].objects.length < 6) throw new Error(`Template ${template.slug} is incomplete`);
  if (validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData: template.pages[0] }) !== null) throw new Error(`Template ${template.slug} has invalid page data`);
  for (const object of template.pages[0].objects) {
    if (typeof object.fontFamily === "string" && !isBuiltInFamily(object.fontFamily)) throw new Error(`Template ${template.slug} uses an unbundled font: ${object.fontFamily}`);
  }
}
console.log(`Validated ${BUILT_IN_TEMPLATES.length} built-in templates (${library.length} in the new library) in ${new Set(BUILT_IN_TEMPLATES.map((template) => template.category)).size} categories.`);
