export type PngDimensions = {
  width: number;
  height: number;
};

const PNG_SIGNATURE = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function uint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! * 0x1000000 +
    bytes[offset + 1]! * 0x10000 +
    bytes[offset + 2]! * 0x100 +
    bytes[offset + 3]!
  );
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + 4));
}

/**
 * Reads and validates the PNG signature and IHDR dimensions, then walks the
 * chunk stream to confirm the file is structurally complete: IHDR comes
 * first with exactly 13 bytes of payload, at least one IDAT follows, and the
 * file ends with its IEND terminator. A truncated file fails even when its
 * dimension header survives.
 */
export function pngDimensions(input: ArrayBuffer | Uint8Array): PngDimensions {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 24) throw new Error("Not a PNG: file is shorter than IHDR");

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error("Not a PNG: invalid signature");
    }
  }

  if (chunkType(bytes, 12) !== "IHDR") {
    throw new Error("Not a PNG: first chunk is not IHDR");
  }
  if (chunkLength(bytes, 8) !== 13) {
    throw new Error("Not a PNG: IHDR must have exactly 13 bytes of payload");
  }

  const dimensions = { width: uint32(bytes, 16), height: uint32(bytes, 20) };
  let offset = 8 + 12 + 13;
  let sawIdat = false;

  while (offset + 12 <= bytes.byteLength) {
    const length = chunkLength(bytes, offset);
    const type = chunkType(bytes, offset + 4);

    if (type === "IDAT") sawIdat = true;
    if (type === "IEND") {
      if (!sawIdat) throw new Error("Not a PNG: missing an IDAT image chunk");
      if (length !== 0) throw new Error("Not a PNG: IEND must have no payload");
      if (offset + 12 !== bytes.byteLength) {
        throw new Error("Not a PNG: trailing data after IEND");
      }
      return dimensions;
    }

    // A zero-length payload here can only be a chunk that claims to end where
    // it starts; rejecting it keeps the walk from looping forever.
    if (length === 0) throw new Error(`Not a PNG: ${type} has an empty or truncated payload`);
    if (offset + 12 + length > bytes.byteLength) {
      throw new Error(`Not a PNG: ${type} chunk is truncated`);
    }

    offset += 12 + length;
  }

  throw new Error("Not a PNG: missing IEND terminator");
}

function chunkLength(bytes: Uint8Array, offset: number): number {
  return uint32(bytes, offset);
}

/** Throws when a PNG does not have the expected dimensions. */
export function verifyPng(
  input: ArrayBuffer | Uint8Array,
  expected: PngDimensions,
): PngDimensions {
  const actual = pngDimensions(input);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(
      `Expected ${expected.width}x${expected.height}, received ${actual.width}x${actual.height}`,
    );
  }
  return actual;
}