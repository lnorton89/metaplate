export type ImageFormat = "png" | "jpeg" | "webp";

export type ImageDimensions = {
  width: number;
  height: number;
  format: ImageFormat;
};

function uint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! * 0x1000000 +
    bytes[offset + 1]! * 0x10000 +
    bytes[offset + 2]! * 0x100 +
    bytes[offset + 3]!
  );
}

function uint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! * 0x100 + bytes[offset + 1]!;
}

function uint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + bytes[offset + 1]! * 0x100;
}

function uint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + bytes[offset + 1]! * 0x100 + bytes[offset + 2]! * 0x10000;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function matches(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function pngSize(bytes: Uint8Array): ImageDimensions {
  if (bytes.byteLength < 24) throw new Error("Not a PNG: file is shorter than IHDR");
  if (ascii(bytes, 12, 4) !== "IHDR") throw new Error("Not a PNG: first chunk is not IHDR");
  return { width: uint32(bytes, 16), height: uint32(bytes, 20), format: "png" };
}

/**
 * Reads dimensions from the frame header. Every JPEG carries one, but its
 * offset depends on how many metadata segments an encoder wrote first, so the
 * segment chain has to be walked rather than indexed.
 */
function jpegSize(bytes: Uint8Array): ImageDimensions {
  let offset = 2;

  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) throw new Error("Not a JPEG: expected a segment marker");

    // Encoders may pad with extra 0xFF bytes before a marker.
    while (bytes[offset + 1] === 0xff) offset += 1;

    const marker = bytes[offset + 1]!;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // SOF0-SOF15 carry the frame header; 0xC4, 0xC8, and 0xCC are other tables.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      return {
        height: uint16(bytes, offset + 5),
        width: uint16(bytes, offset + 7),
        format: "jpeg",
      };
    }

    offset += 2 + uint16(bytes, offset + 2);
  }

  throw new Error("Not a JPEG: no frame header found");
}

/** Reads the canvas size from a lossy, lossless, or extended WebP chunk. */
function webpSize(bytes: Uint8Array): ImageDimensions {
  if (bytes.byteLength < 30) throw new Error("Not a WebP: file is shorter than its header");

  const chunk = ascii(bytes, 12, 4);

  if (chunk === "VP8 ") {
    // Key frame: a 3-byte frame tag, the 0x9D012A start code, then 16-bit
    // little-endian width and height whose top two bits are a scale factor.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      throw new Error("Not a WebP: missing VP8 key frame start code");
    }

    return {
      width: uint16LE(bytes, 26) & 0x3fff,
      height: uint16LE(bytes, 28) & 0x3fff,
      format: "webp",
    };
  }

  if (chunk === "VP8L") {
    const packed = bytes[21]! + bytes[22]! * 0x100 + bytes[23]! * 0x10000 + bytes[24]! * 0x1000000;
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >>> 14) & 0x3fff) + 1,
      format: "webp",
    };
  }

  if (chunk === "VP8X") {
    return {
      width: uint24LE(bytes, 24) + 1,
      height: uint24LE(bytes, 27) + 1,
      format: "webp",
    };
  }

  throw new Error(`Not a WebP: unsupported chunk ${chunk}`);
}

/** Reads dimensions from a PNG, JPEG, or WebP without decoding the image. */
export function imageDimensions(input: ArrayBuffer | Uint8Array): ImageDimensions {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 16) throw new Error("Unrecognized image: file is too short");

  if (matches(bytes, PNG_SIGNATURE)) return pngSize(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes);
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return webpSize(bytes);

  throw new Error("Unrecognized image: expected a PNG, JPEG, or WebP signature");
}

/** Throws when an image does not have the expected dimensions. */
export function verifyImage(
  input: ArrayBuffer | Uint8Array,
  expected: { width: number; height: number },
): ImageDimensions {
  const actual = imageDimensions(input);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(
      `Expected ${expected.width}x${expected.height}, received ${actual.width}x${actual.height}`,
    );
  }
  return actual;
}
