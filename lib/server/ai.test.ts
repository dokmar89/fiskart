import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { aiStatus, editImage, generateImage, rewriteText } = await import("./ai");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("without keys", () => {
  it("reports both tools as not set up and makes no request", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const calls: unknown[] = [];
    vi.stubGlobal("fetch", async (...args: unknown[]) => {
      calls.push(args);
      return new Response("{}");
    });
    expect(aiStatus()).toEqual({ text: false, image: false, textProvider: null, imageProvider: null });
    await expect(rewriteText("shorter", "x")).rejects.toMatchObject({ status: 503, message: "Není nastaven ANTHROPIC_API_KEY." });
    await expect(generateImage("x", "square")).rejects.toMatchObject({ status: 503 });
    await expect(editImage(new Uint8Array(), new Uint8Array(), "x")).rejects.toMatchObject({ status: 503 });
    expect(calls).toEqual([]);
  });
});

describe("with keys", () => {
  it("names the providers without the keys", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-secret");
    vi.stubEnv("OPENAI_API_KEY", "sk-other");
    vi.stubEnv("OPENAI_BASE_URL", "https://images.test/v1");
    const status = aiStatus();
    expect(status).toMatchObject({ text: true, image: true, textProvider: "Anthropic (claude-opus-5-5)", imageProvider: "images.test (gpt-image-1)" });
    expect(JSON.stringify(status)).not.toContain("sk-");
  });

  it("asks the image API for the shape's size with the key as a bearer token", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-other");
    vi.stubEnv("OPENAI_BASE_URL", "https://images.test/v1/");
    let seen: { url: string; init: RequestInit } | null = null;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen = { url, init };
      return Response.json({ data: [{ b64_json: Buffer.from("png").toString("base64") }] });
    });
    const bytes = await generateImage("a cat", "portrait");
    expect(Buffer.from(bytes).toString()).toBe("png");
    expect(seen!.url).toBe("https://images.test/v1/images/generations");
    expect(new Headers(seen!.init.headers).get("Authorization")).toBe("Bearer sk-other");
    expect(JSON.parse(String(seen!.init.body))).toMatchObject({ prompt: "a cat", size: "1024x1536", model: "gpt-image-1" });
  });

  it("explains refused keys and errors", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-other");
    vi.stubGlobal("fetch", async () => new Response("", { status: 401 }));
    await expect(generateImage("x", "square")).rejects.toMatchObject({ status: 503, message: "Služba pro obrázky odmítla klíč API." });
    vi.stubGlobal("fetch", async () => Response.json({ error: { message: "bad prompt" } }, { status: 400 }));
    await expect(generateImage("x", "square")).rejects.toMatchObject({ status: 422, message: "Služba pro obrázky odpověděla: bad prompt" });
  });
});
