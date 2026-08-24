import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { imageDimensions, verifyImage } from "../src/image.js";

// Fixtures are real encoder output rather than hand-built headers, so a
// misreading of a format cannot be encoded into both parser and test.
function fixture(name: string) {
  return readFileSync(path.join(import.meta.dirname, "fixtures", name));
}

// A complete minimal PNG: signature, IHDR, one IDAT, and IEND. The zero CRC
// passes structural validation, which deliberately does not re-implement the
// CRC-32 algorithm.
function pngChunk(type: string, payload: number[]): number[] {
  const data = payload.length;
  const length = [
    (data >>> 24) & 0xff, (data >>> 16) & 0xff, (data >>> 8) & 0xff, data & 0xff,
  ];
  return [...length, ...type.split("").map((c) => c.charCodeAt(0)), ...payload, 0, 0, 0, 0];
}

function completePng(width: number, height: number): Uint8Array {
  const ihdr = [
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
    8, 6, 0, 0, 0,
  ];
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk("IHDR", ihdr),
    ...pngChunk("IDAT", [0x78, 0x9c, 0x01, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01]),
    ...pngChunk("IEND", []),
  ]);
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
    const png = completePng(1200, 630);
    expect(imageDimensions(png)).toEqual({ width: 1200, height: 630, format: "png" });
  });

  it("rejects a PNG truncated to its IHDR header", () => {
    const truncated = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
      0x49, 0x48, 0x44, 0x52, 0, 0, 0x04, 0xb0, 0, 0, 0x02, 0x76,
    ]);
    expect(() => imageDimensions(truncated)).toThrow(/missing IEND/);
  });

  it("rejects an unrecognized signature", () => {
    expect(() => imageDimensions(new Uint8Array(32))).toThrow(/Unrecognized image/);
  });

  it("rejects a truncated file", () => {
    expect(() => imageDimensions(Uint8Array.of(0xff, 0xd8))).toThrow(/too short/);
  });

  it("rejects a JPEG truncated before its scan data", () => {
    const bytes = fixture("card.jpg");
    // Cut immediately before the SOS segment: frame header intact, scan gone.
    const truncated = bytes.subarray(0, 248);
    expect(() => imageDimensions(truncated)).toThrow(/missing image scan/);
  });

  it("rejects a JPEG truncated inside its scan data", () => {
    const bytes = fixture("card.jpg");
    // Cut after SOS at 248+2, well before the EOI at 4764.
    const truncated = bytes.subarray(0, 500);
    expect(() => imageDimensions(truncated)).toThrow(/missing EOI/);
  });

  it("rejects a WebP truncated before its declared RIFF size", () => {
    const bytes = fixture("card-lossy.webp");
    const truncated = bytes.subarray(0, 300);
    expect(() => imageDimensions(truncated)).toThrow(/shorter than its declared RIFF size/);
  });

  it("rejects WebP whose chunk overruns the container", () => {
    const bytes = Uint8Array.from(fixture("card-lossless.webp"));
    // Bump the VP8L chunk length beyond the RIFF boundary.
    bytes[16] = 0xff;
    expect(() => imageDimensions(bytes)).toThrow(/truncated/);
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
