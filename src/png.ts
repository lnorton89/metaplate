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

/** Reads and validates the PNG signature and IHDR dimensions. */
export function pngDimensions(input: ArrayBuffer | Uint8Array): PngDimensions {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 24) throw new Error("Not a PNG: file is shorter than IHDR");

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error("Not a PNG: invalid signature");
    }
  }

  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk !== "IHDR") throw new Error("Not a PNG: first chunk is not IHDR");

  return { width: uint32(bytes, 16), height: uint32(bytes, 20) };
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
