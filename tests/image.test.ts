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

  it("accepts a zero-length IDAT chunk", () => {
    // A legal empty IDAT between real siblings must not fail structural checks.
    const base = completePng(1200, 630);
    const withEmptyIdat = Uint8Array.from([
      ...base.subarray(0, 8 + 12 + 13),
      ...pngChunk("IDAT", []),
      ...base.subarray(8 + 12 + 13),
    ]);
    expect(imageDimensions(withEmptyIdat)).toEqual({
      width: 1200,
      height: 630,
      format: "png",
    });
  });

  it("rejects a VP8X container with no image data", () => {
    // A structurally complete RIFF holding only the VP8X origin/size header
    // must not verify: it has dimensions but no usable pixels.
    const canvas = (value: number) => [
      value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff,
    ];
    const payload = [0, 0, 0, 0, ...canvas(1199), ...canvas(629)];
    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x16, 0x00, 0x00, 0x00, // declared size: 30 - 8
      0x57, 0x45, 0x42, 0x50, // "WEBP"
      0x56, 0x50, 0x38, 0x58, // "VP8X"
      0x0a, 0x00, 0x00, 0x00, // chunk length 10
      ...payload,
    ]);
    expect(() => imageDimensions(webp)).toThrow(/no image or animation data/);
  });

  it("accepts a VP8X container that carries a VP8 payload", () => {
    // card-alpha.webp is VP8X (extended) with an ALPH and a VP8 lossy frame.
    expect(imageDimensions(fixture("card-alpha.webp"))).toEqual({
      width: 1200,
      height: 630,
      format: "webp",
    });
  });

  it("rejects a PNG whose entire IDAT stream is empty", () => {
    // A zero-length IDAT is legal between real siblings, but an image whose
    // only IDAT is empty carries no zlib stream and must not verify.
    const emptyStream = Uint8Array.from([
      ...completePng(1200, 630).subarray(0, 8 + 12 + 13),
      ...pngChunk("IDAT", []),
      ...pngChunk("IDAT", []),
      ...pngChunk("IEND", []),
    ]);
    expect(() => imageDimensions(emptyStream)).toThrow(/no image data/);
  });

  it("accepts an empty IDAT before the real image data", () => {
    const base = completePng(1200, 630);
    const withLeadingEmptyIdat = Uint8Array.from([
      ...base.subarray(0, 8 + 12 + 13),
      ...pngChunk("IDAT", []),
      ...base.subarray(8 + 12 + 13),
    ]);
    expect(imageDimensions(withLeadingEmptyIdat)).toEqual({
      width: 1200,
      height: 630,
      format: "png",
    });
  });

  it("rejects a PNG whose IDAT stream is not a zlib datastream", () => {
    // A single IDAT byte cannot be a zlib stream: no header, no trailer.
    const base = completePng(1200, 630);
    const oneByteIdat = Uint8Array.from([
      ...base.subarray(0, 8 + 12 + 13),
      ...pngChunk("IDAT", [0x78]),
      ...pngChunk("IEND", []),
    ]);
    expect(() => imageDimensions(oneByteIdat)).toThrow(/zlib datastream/);
  });

  it("rejects a VP8X container whose only payload chunk is empty", () => {
    // A zero-length VP8 header inside a VP8X container must not count as image
    // data, or the empty-chunk attitude would reopen the VP8X-only hole.
    const canvas = (value: number) => [
      value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff,
    ];
    const vp8x = [
      0x56, 0x50, 0x38, 0x58, // "VP8X"
      0x0a, 0x00, 0x00, 0x00, // chunk length 10
      0x00, 0x00, 0x00, 0x00, // flags + reserved
      ...canvas(1199), // width - 1
      ...canvas(629), // height - 1
    ];
    // body = "WEBP" (4) + vp8x (18) + empty "VP8 " chunk (8); RIFF size = body + 4.
    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x1e, 0x00, 0x00, 0x00, // declared RIFF size: 38 - 8
      0x57, 0x45, 0x42, 0x50, // "WEBP"
      ...vp8x,
      0x56, 0x50, 0x38, 0x20, // "VP8 "
      0x00, 0x00, 0x00, 0x00, // chunk length 0
    ]);
    expect(() => imageDimensions(webp)).toThrow(/no image or animation data/);
  });

  it("rejects a VP8X container with a stub VP8 frame", () => {
    // A ten-byte VP8 chunk of zeros claims the minimum frame header length but
    // carries no key-frame start code, so it must not count as image data.
    const canvas = (value: number) => [
      value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff,
    ];
    const vp8x = [
      0x56, 0x50, 0x38, 0x58, // "VP8X"
      0x0a, 0x00, 0x00, 0x00, // chunk length 10
      0x00, 0x00, 0x00, 0x00, // flags + reserved
      ...canvas(1199), // width - 1
      ...canvas(629), // height - 1
    ];
    const stubVp8 = [
      0x56, 0x50, 0x38, 0x20, // "VP8 "
      0x0a, 0x00, 0x00, 0x00, // chunk length 10
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // payload: ten zero bytes, no start code
    ];
    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x28, 0x00, 0x00, 0x00, // declared RIFF size: 48 - 8
      0x57, 0x45, 0x42, 0x50, // "WEBP"
      ...vp8x,
      ...stubVp8,
    ]);
    expect(() => imageDimensions(webp)).toThrow(/malformed VP8 frame/);
  });

  it("rejects a VP8X container with a junk VP8L payload", () => {
    // A five-byte VP8L chunk meets the old minimum-length gate, but its first
    // byte is not the 0x2F lossless signature, so it is not a VP8L bitstream.
    const canvas = (value: number) => [
      value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff,
    ];
    const vp8x = [
      0x56, 0x50, 0x38, 0x58, // "VP8X"
      0x0a, 0x00, 0x00, 0x00, // chunk length 10
      0x00, 0x00, 0x00, 0x00, // flags + reserved
      ...canvas(1199), // width - 1
      ...canvas(629), // height - 1
    ];
    const junkVp8l = [
      0x56, 0x50, 0x38, 0x4c, // "VP8L"
      0x05, 0x00, 0x00, 0x00, // chunk length 5
      0x00, 0xaf, 0x44, 0x9d, 0x00, // payload: wrong signature byte, then packed dims
    ];
    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // declared RIFF size: 44 - 8
      0x57, 0x45, 0x42, 0x50, // "WEBP"
      ...vp8x,
      ...junkVp8l,
      0x00, // pad the odd-length chunk to the declared RIFF size
    ]);
    expect(() => imageDimensions(webp)).toThrow(/malformed VP8L frame/);
  });

  it("rejects a VP8X container with a header-only ANMF frame", () => {
    // A 16-byte ANMF is only the frame header; without a nested VP8/VP8L
    // bitstream it carries no image data.
    const canvas = (value: number) => [
      value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff,
    ];
    const vp8x = [
      0x56, 0x50, 0x38, 0x58, // "VP8X"
      0x0a, 0x00, 0x00, 0x00, // chunk length 10
      0x00, 0x00, 0x00, 0x00, // flags + reserved
      ...canvas(1199), // width - 1
      ...canvas(629), // height - 1
    ];
    const headerOnlyAnmf = [
      0x41, 0x4e, 0x4d, 0x46, // "ANMF"
      0x10, 0x00, 0x00, 0x00, // chunk length 16
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16-byte frame header only
    ];
    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x2e, 0x00, 0x00, 0x00, // declared RIFF size: 54 - 8
      0x57, 0x45, 0x42, 0x50, // "WEBP"
      ...vp8x,
      ...headerOnlyAnmf,
    ]);
    expect(() => imageDimensions(webp)).toThrow(/no image or animation data/);
  });

  it("accepts a VP8X container whose ANMF frame nests a VP8L bitstream", () => {
    const canvas = (value: number) => [
      value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff,
    ];
    const vp8x = [
      0x56, 0x50, 0x38, 0x58, // "VP8X"
      0x0a, 0x00, 0x00, 0x00, // chunk length 10
      0x00, 0x00, 0x00, 0x00, // flags + reserved
      ...canvas(1199), // width - 1
      ...canvas(629), // height - 1
    ];
    const nestedVp8l = [
      0x56, 0x50, 0x38, 0x4c, // "VP8L"
      0x05, 0x00, 0x00, 0x00, // chunk length 5
      0x2f, 0xaf, 0x44, 0x9d, 0x00, // 0x2F signature + 1200x630 packed dims
    ];
    const anmf = [
      0x41, 0x4e, 0x4d, 0x46, // "ANMF"
      0x1d, 0x00, 0x00, 0x00, // chunk length 16 + 13
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16-byte frame header
      ...nestedVp8l,
    ];
    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x3c, 0x00, 0x00, 0x00, // declared RIFF size: 68 - 8
      0x57, 0x45, 0x42, 0x50, // "WEBP"
      ...vp8x,
      ...anmf,
      0x00, // pad the odd-length chunk to the declared RIFF size
    ]);
    expect(imageDimensions(webp)).toEqual({ width: 1200, height: 630, format: "webp" });
  });

  it("rejects a top-level VP8L missing its signature byte", () => {
    // A lossless WebP whose first payload byte is not 0x2F is not a VP8L
    // bitstream even though it is long enough to carry dimensions.
    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x16, 0x00, 0x00, 0x00, // declared RIFF size: 30 - 8
      0x57, 0x45, 0x42, 0x50, // "WEBP"
      0x56, 0x50, 0x38, 0x4c, // "VP8L"
      0x0a, 0x00, 0x00, 0x00, // chunk length 10
      0x00, 0xaf, 0x44, 0x9d, 0x00, 0, 0, 0, 0, 0, // payload: wrong signature, then dims
    ]);
    expect(() => imageDimensions(webp)).toThrow(/missing VP8L signature/);
  });

  it("rejects a JPEG whose SOS segment is bare", () => {
    // A frame header followed by a complaint `FF DA 00 00` SOS (no declared
    // length or component count) and then EOI has no scan to decode, so it
    // must fail rather than pass on a bare SOS marker.
    const withSof = [
      0xff, 0xd8, // SOI
      0xff, 0xc0, // SOF0
      0x00, 0x0b, // length 11 (Nf=1)
      0x08, 0x02, 0x76, 0x04, 0xb0, 0x01, 0x01, 0x22, 0x00, // precision/height/width/Nf/component
    ];
    const bareSos = Uint8Array.from([
      ...withSof,
      0xff, 0xda, 0x00, 0x00, // SOS marker with a zero length
      0xff, 0xd9, // EOI
    ]);
    expect(() => imageDimensions(bareSos)).toThrow(/SOS segment/);
  });

  it("rejects a JPEG whose scan contains no entropy-coded data", () => {
    // A well-formed SOS followed immediately by EOI has a valid header but an
    // empty scan: there is nothing to decode, so it must not verify.
    const withSof = [
      0xff, 0xd8, // SOI
      0xff, 0xc0, // SOF0
      0x00, 0x0b, // length 11 (Nf=1)
      0x08, 0x02, 0x76, 0x04, 0xb0, 0x01, 0x01, 0x22, 0x00, // precision/height/width/Nf/component
    ];
    const emptyScan = Uint8Array.from([
      ...withSof,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, // SOS: length 8, 1 component
      0xff, 0xd9, // EOI immediately after the SOS segment
    ]);
    expect(() => imageDimensions(emptyScan)).toThrow(/no entropy-coded data/);
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
