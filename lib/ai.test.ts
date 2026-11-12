import { describe, expect, it } from "vitest";
import { cleanReply, expandedSize, isTextAction, MAX_TEXT, textPrompt } from "./ai";

describe("textPrompt", () => {
  it("words each action and keeps the text", () => {
    expect(textPrompt("shorter", "Big summer sale")).toMatch(/shorter[\s\S]*Big summer sale$/);
    expect(textPrompt("translate", "Hello", "Czech")).toContain("into Czech");
    expect(textPrompt("translate", "Hello")).toContain("into English");
    expect(textPrompt("spelling", "teh")).toContain("changing nothing else");
  });

  it("limits the text sent", () => {
    expect(textPrompt("formal", "x".repeat(MAX_TEXT + 500)).length).toBeLessThan(MAX_TEXT + 100);
  });
});

describe("cleanReply", () => {
  it("drops surrounding quotes and space", () => {
    expect(cleanReply('  "Summer sale"\n')).toBe("Summer sale");
    expect(cleanReply("“Hi”")).toBe("Hi");
    expect(cleanReply('He said "no"')).toBe('He said "no"');
  });
});

describe("helpers", () => {
  it("recognises actions and sizes the expanded canvas", () => {
    expect(isTextAction("shorter")).toBe(true);
    expect(isTextAction("delete")).toBe(false);
    expect(expandedSize(400, 200)).toEqual({ width: 600, height: 300, offsetX: 100, offsetY: 50 });
  });
});
