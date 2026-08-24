import { describe, expect, it } from "vitest";
import { pngDimensions, verifyPng } from "../src/png.js";

function pngChunk(type: string, payload: number[]): number[] {
  const data = payload.length;
  const length = [
    (data >>> 24) & 0xff, (data >>> 16) & 0xff, (data >>> 8) & 0xff, data & 0xff,
  ];
  return [...length, ...type.split("").map((c) => c.charCodeAt(0)), ...payload, 0, 0, 0, 0];
}

function pngHeader(width: number, height: number) {
  const ihdr = [
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
    8, 6, 0, 0, 0,
  ];
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk("IHDR", ihdr),
    ...pngChunk("IDAT", [0x78, 0x9c, 0x01, 0x00, 0x00, 0xff, 0xff]),
    ...pngChunk("IEND", []),
  ]);
}

describe("PNG verification", () => {
  it("reads IHDR dimensions", () => {
    expect(pngDimensions(pngHeader(1200, 630))).toEqual({ width: 1200, height: 630 });
  });

  it("rejects non-PNG input", () => {
    expect(() => pngDimensions(new Uint8Array(24))).toThrow(/invalid signature/);
  });

  it("reports dimension mismatches", () => {
    expect(() => verifyPng(pngHeader(600, 315), { width: 1200, height: 630 })).toThrow(
      "Expected 1200x630, received 600x315",
    );
  });

  it("rejects a header-only truncated PNG", () => {
    const headerOnly = Uint8Array.from(pngHeader(1200, 630).subarray(0, 24));
    expect(() => pngDimensions(headerOnly)).toThrow(/missing IEND/);
  });
});
