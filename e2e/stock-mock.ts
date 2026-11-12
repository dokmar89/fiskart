/**
 * Stands in for the Pexels and Iconify APIs during e2e runs (started by playwright.config.ts), so
 * the stock tabs can be tested without internet or a real key. Answers like the real APIs, in the
 * parts the app reads.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { makePngFrom } from "./png";
import { AI_TEST_KEY, STOCK_MOCK_PORT, STOCK_TEST_KEY } from "./stock-config";

const base = `http://localhost:${STOCK_MOCK_PORT}`;
const COLOURS: Record<number, [number, number, number]> = { 101: [220, 40, 40], 102: [40, 160, 60], 103: [40, 80, 220] };

function photo(id: number) {
  const image = `${base}/images/${id}.png`;
  return {
    id,
    width: 600,
    height: 400,
    url: `${base}/photo/${id}`,
    photographer: `Photographer ${id}`,
    photographer_url: `${base}/@p${id}`,
    avg_color: "#888888",
    src: { original: image, large2x: image, medium: image, small: image },
    alt: `Test photo ${id}`,
  };
}

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24"><path fill="#000000" d="M2 2h20v20H2z"/></svg>`;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** What the Claude stand-in answers: a recognisable change of the text, per instruction. */
function rewrite(prompt: string): string {
  const text = prompt.split("\n\n").slice(1).join("\n\n");
  if (prompt.startsWith("Make this text shorter")) return `${text.split(" ").slice(0, 2).join(" ")}!`;
  if (prompt.startsWith("Make this text somewhat longer")) return `${text} and much more`;
  if (prompt.startsWith("Rewrite this text in a more formal")) return `Dear reader: ${text}`;
  if (prompt.startsWith("Correct the spelling")) return text.replace(/teh/g, "the");
  if (prompt.startsWith("Translate this text into Czech")) return "Velký letní výprodej";
  if (prompt.startsWith("Write text")) return "Summer is here";
  return text;
}

/** Stands in for Anthropic's Messages API and an OpenAI-compatible image API. */
async function ai(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
    return true;
  };
  if (url.pathname === "/anthropic/v1/messages" && req.method === "POST") {
    // The SDK sends the key as a bearer token (older versions used x-api-key).
    if (req.headers["x-api-key"] !== AI_TEST_KEY && req.headers.authorization !== `Bearer ${AI_TEST_KEY}`) return json(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
    const body = JSON.parse((await readBody(req)).toString("utf8")) as { model: string; messages: { content: string }[] };
    const reply = rewrite(String(body.messages[0]?.content ?? ""));
    return json(200, { id: "msg_test", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text: `"${reply}"` }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 } });
  }
  if (url.pathname.startsWith("/openai/v1/images/")) {
    if (req.headers.authorization !== `Bearer ${AI_TEST_KEY}`) return json(401, { error: { message: "bad key" } });
    const raw = await readBody(req);
    if (url.pathname.endsWith("/generations")) {
      const body = JSON.parse(raw.toString("utf8")) as { size: string };
      const [w, h] = body.size.split("x").map((n) => Number(n) / 8);
      return json(200, { data: [{ b64_json: makePngFrom(w, h, () => [130, 50, 200]).toString("base64") }] });
    }
    // Edits: a picture of the same size, green, so the test sees it was swapped in.
    const form = await new Response(new Uint8Array(raw), { headers: { "content-type": String(req.headers["content-type"]) } }).formData();
    const image = Buffer.from(await (form.get("image") as File).arrayBuffer());
    const mask = form.get("mask") as File | null;
    if (!mask || !form.get("prompt")) return json(400, { error: { message: "missing mask or prompt" } });
    return json(200, { data: [{ b64_json: makePngFrom(image.readUInt32BE(16), image.readUInt32BE(20), () => [20, 180, 60]).toString("base64") }] });
  }
  return false;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", base);
  if (await ai(req, res, url)) return;
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname.startsWith("/pexels/")) {
    if (req.headers.authorization !== STOCK_TEST_KEY) return json(401, { error: "Unauthorized" });
    const match = /^\/pexels\/v1\/photos\/(\d+)$/.exec(url.pathname);
    if (match) return COLOURS[Number(match[1])] ? json(200, photo(Number(match[1]))) : json(404, { error: "Not found" });
    if (url.pathname === "/pexels/v1/search" || url.pathname === "/pexels/v1/curated") {
      const page = Number(url.searchParams.get("page") ?? 1);
      const photos = page === 1 ? [photo(101), photo(102)] : [photo(103)];
      return json(200, { page, per_page: 2, photos, ...(page === 1 ? { next_page: `${base}/pexels/v1/search?page=2` } : {}) });
    }
    return json(404, { error: "Not found" });
  }
  const image = /^\/images\/(\d+)\.png$/.exec(url.pathname);
  if (image && COLOURS[Number(image[1])]) {
    const colour = COLOURS[Number(image[1])];
    res.writeHead(200, { "Content-Type": "image/png" });
    return res.end(makePngFrom(600, 400, () => colour));
  }
  if (url.pathname === "/iconify/search") {
    const many = url.searchParams.get("query") === "many";
    const start = Number(url.searchParams.get("start") ?? 0);
    const names = many
      ? (start === 0 ? Array.from({ length: 96 }, (_, index) => `test:icon-${index}`) : ["test:icon-96", "test:icon-97"])
      : ["test:square", "test:other"];
    return json(200, {
      icons: names,
      total: many ? 98 : 2,
      limit: many ? 96 : 64,
      start,
      collections: { test: { name: "Test icons", license: { title: "MIT" } } },
    });
  }
  if (/^\/iconify\/test\/[a-z0-9-]+\.svg$/.test(url.pathname)) {
    res.writeHead(200, { "Content-Type": "image/svg+xml" });
    return res.end(ICON);
  }
  json(404, { error: "Not found" });
});

server.listen(STOCK_MOCK_PORT, () => console.log(`Stock mock on ${base}`));
