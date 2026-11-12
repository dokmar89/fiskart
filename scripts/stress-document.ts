/**
 * Creates a "Stress test (200 objects)" design through the running app's API, for checking by
 * hand that dragging stays smooth. Usage: pnpm stress-doc [base URL, default http://localhost:3000]
 */
import { STRESS_PAGE, stressObjects } from "./stress-data";

async function main() {
  const base = process.argv[2] ?? "http://localhost:3000";
  const created = await fetch(new URL("/api/projects", base), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Stress test (200 objects)", ...STRESS_PAGE, unit: "px" }),
  });
  if (!created.ok) throw new Error(`Creating the project failed: ${created.status} ${await created.text()}`);
  const { id } = (await created.json()) as { id: string };

  const pages = (await (await fetch(new URL(`/api/projects/${id}/pages`, base))).json()) as { id: string }[];
  const pageId = pages[0]?.id;
  if (!pageId) throw new Error("Could not find the page id of the new design");

  const saved = await fetch(new URL(`/api/pages/${pageId}`, base), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schemaVersion: 1, canvasData: { objects: stressObjects() } }),
  });
  if (!saved.ok) throw new Error(`Saving the page failed: ${saved.status} ${await saved.text()}`);
  console.log(`Created ${new URL(`/design/${id}`, base).href}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
