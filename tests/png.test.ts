import { describe, expect, it } from "vitest";
import { pngDimensions, verifyPng } from "../src/png.js";

function pngHeader(width: number, height: number) {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
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
});
