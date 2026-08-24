import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { imageDimensions, verifyImage } from "../src/image.js";

// Fixtures are real encoder output rather than hand-built headers, so a
// misreading of a format cannot be encoded into both parser and test.
function fixture(name: string) {
  return readFileSync(path.join(import.meta.dirname, "fixtures", name));
}

describe("imageDimensions", () => {
  it.each([
    ["card.jpg", 1200, 630, "jpeg"],
    ["icon.jpg", 512, 512, "jpeg"],
    ["card-lossy.webp", 1200, 630, "webp"],
    ["card-lossless.webp", 1200, 630, "webp"],
    ["card-alpha.webp", 1200, 630, "webp"],
  ])("reads %s as %ix%i", (name, width, height, format) => {
    expect(imageDimensions(fixture(name as string))).toEqual({ width, height, format });
  });

  it("still reads PNG", () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
      0x49, 0x48, 0x44, 0x52, 0, 0, 0x04, 0xb0, 0, 0, 0x02, 0x76,
    ]);
    expect(imageDimensions(png)).toEqual({ width: 1200, height: 630, format: "png" });
  });

  it("rejects an unrecognized signature", () => {
    expect(() => imageDimensions(new Uint8Array(32))).toThrow(/Unrecognized image/);
  });

  it("rejects a truncated file", () => {
    expect(() => imageDimensions(Uint8Array.of(0xff, 0xd8))).toThrow(/too short/);
  });
});

describe("verifyImage", () => {
  it("returns the format it verified", () => {
    expect(verifyImage(fixture("card.jpg"), { width: 1200, height: 630 })).toEqual({
      width: 1200,
      height: 630,
      format: "jpeg",
    });
  });

  it("reports a mismatch against the expected size", () => {
    expect(() => verifyImage(fixture("icon.jpg"), { width: 1200, height: 630 })).toThrow(
      "Expected 1200x630, received 512x512",
    );
  });
});
