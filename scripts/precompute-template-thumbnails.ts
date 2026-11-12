/** Visit every catalog page in Chromium so the existing Fabric renderer persists missing PNGs. */
import { chromium, type Page } from "@playwright/test";

type CatalogItem = { id: string; title: string; hasThumbnail: boolean };
type CatalogPage = { items: CatalogItem[]; total: number; page: number; pageSize: number };

const baseUrl = (process.env.TEMPLATE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const maxPagesRaw = Number(process.env.TEMPLATE_PREVIEW_MAX_PAGES ?? "0");
const maxPages = Number.isSafeInteger(maxPagesRaw) && maxPagesRaw > 0 ? maxPagesRaw : Number.POSITIVE_INFINITY;

async function catalog(page: Page, pageNumber: number): Promise<CatalogPage> {
  const response = await page.request.get(`${baseUrl}/api/templates/catalog?page=${pageNumber}`);
  if (!response.ok()) throw new Error(`Katalog, strana ${pageNumber}: HTTP ${response.status()}`);
  return (await response.json()) as CatalogPage;
}

async function waitForCards(page: Page, ids: string[]) {
  await page.waitForFunction((expected) => {
    const cards = [...document.querySelectorAll('[data-testid="template-card"]')];
    return cards.length === expected.length && cards.every((card, index) => card.getAttribute("data-template-id") === expected[index]);
  }, ids, { timeout: 30_000 });
}

async function waitForStoredThumbnails(page: Page, items: CatalogItem[]): Promise<void> {
  let pending = items.map(({ id }) => id);
  const deadline = Date.now() + 180_000;
  while (pending.length > 0 && Date.now() < deadline) {
    const failed = await page.locator('[data-testid="template-card"]').evaluateAll((cards) =>
      cards.filter((card) => card.textContent?.includes("Bez náhledu")).map((card) => card.getAttribute("data-template-id")),
    );
    if (failed.length > 0) throw new Error(`Vykreslení nebo uložení náhledu selhalo: ${failed.join(", ")}`);
    const status = await Promise.all(pending.map(async (id) => ({
      id,
      ok: (await page.request.get(`${baseUrl}/api/templates/${id}/thumbnail`)).ok(),
    })));
    pending = status.filter((entry) => !entry.ok).map((entry) => entry.id);
    if (pending.length > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (pending.length > 0) throw new Error(`Náhledy se neuložily: ${pending.join(", ")}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => console.error(`Prohlížeč: ${error.message}`));
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const first = await catalog(page, 1);
    const pageCount = Math.ceil(first.total / first.pageSize);
    for (let number = 1; number <= Math.min(pageCount, maxPages); number++) {
      const current = number === 1 ? first : await catalog(page, number);
      await waitForCards(page, current.items.map((item) => item.id));
      // Trigger lazy image loads too: a missing stored file then falls back to a fresh render.
      await page.locator('[data-testid="template-card"] img').evaluateAll((images) => {
        for (const image of images) (image as HTMLImageElement).loading = "eager";
      });
      await waitForStoredThumbnails(page, current.items);
      console.log(`Náhledy: strana ${number}/${pageCount}, ${current.items.length} šablon ověřeno.`);
      if (number < Math.min(pageCount, maxPages)) {
        await page.getByTestId("template-next-page").click();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
