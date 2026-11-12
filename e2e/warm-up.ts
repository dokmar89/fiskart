import type { FullConfig } from "@playwright/test";

/**
 * The dev server compiles each route on its first request, which can take seconds while several
 * workers wait on it. Requesting every route once here (Playwright starts the web server before
 * globalSetup) keeps that delay out of the tests' timing.
 */
export default async function warmUp(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  if (!baseURL) return;
  const missing = "warm-up-missing-id";
  const json = { "Content-Type": "application/json" };
  const requests: [string, RequestInit][] = [
    ["/", {}],
    [`/design/${missing}`, {}],
    ["/api/projects", { method: "POST", headers: json, body: "{}" }],
    [`/api/projects/${missing}`, { method: "PATCH", headers: json, body: "{}" }],
    [`/api/projects/${missing}`, { method: "DELETE" }],
    [`/api/projects/${missing}/duplicate`, { method: "POST" }],
    [`/api/projects/${missing}/thumbnail`, {}],
    [`/api/pages/${missing}`, {}],
    [`/api/pages/${missing}`, { method: "PUT", headers: json, body: "{}" }],
    [`/api/pages/${missing}`, { method: "DELETE" }],
    [`/api/projects/${missing}/pages`, {}],
    [`/api/projects/${missing}/pages`, { method: "POST", headers: json, body: "{}" }],
    [`/api/projects/${missing}/pages`, { method: "PUT", headers: json, body: "{}" }],
    ["/api/fonts", {}],
    ["/api/templates", {}],
    ["/api/templates", { method: "POST", headers: json, body: "{}" }],
    [`/api/templates/${missing}`, {}],
    [`/api/templates/${missing}`, { method: "DELETE" }],
    [`/api/templates/${missing}/thumbnail`, {}],
    [`/api/templates/${missing}/use`, { method: "POST" }],
    ["/api/fonts?family=warm-up-missing", { method: "DELETE" }],
    ["/api/stock/photos?q=warm-up", {}],
    ["/api/stock/photos/1", { method: "POST" }],
    ["/api/stock/icons?q=warm-up", {}],
    ["/api/stock/icons", { method: "POST", headers: json, body: "{}" }],
    ["/api/graphics/warm-up-missing", { method: "POST" }],
    ["/api/assets/video", { method: "POST" }],
    [`/api/assets/${missing}/poster`, {}],
    ["/api/ai/status", {}],
    ["/api/ai/text", { method: "POST", headers: json, body: "{}" }],
    ["/api/ai/image", { method: "POST", headers: json, body: "{}" }],
    ["/api/ai/image-edit", { method: "POST" }],
  ];
  for (const [path, init] of requests) {
    await fetch(new URL(path, baseURL), init).then((r) => r.arrayBuffer());
  }
}
