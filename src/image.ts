/** One of the formats the verifier can recognize by signature. */
export type OutputFormat = "svg" | "png" | "jpeg" | "webp";

/** Structurally recognized raster formats. */
export type ImageFormat = "png" | "jpeg" | "webp";

export type ImageDimensions = {
  width: number;
  height: number;
  format: ImageFormat;
};

export function imageContentType(format: ImageFormat): string {
  switch (format) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
  }
}

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

function uint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! +
    bytes[offset + 1]! * 0x100 +
    bytes[offset + 2]! * 0x10000 +
    bytes[offset + 3]! * 0x1000000
  );
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

/**
 * PNG dimensions plus structural completeness. The chunk stream is walked
 * from IHDR (exactly 13 payload bytes) through at least one IDAT to a
 * zero-payload IEND that ends the file, so a truncated file fails even when
 * its dimension header survives.
 */
function pngSize(bytes: Uint8Array): ImageDimensions {
  if (bytes.byteLength < 24) throw new Error("Not a PNG: file is shorter than IHDR");
  if (ascii(bytes, 12, 4) !== "IHDR") throw new Error("Not a PNG: first chunk is not IHDR");
  if (uint32(bytes, 8) !== 13) {
    throw new Error("Not a PNG: IHDR must have exactly 13 bytes of payload");
  }

  const dimensions = {
    width: uint32(bytes, 16),
    height: uint32(bytes, 20),
    format: "png" as const,
  };
  let offset = 8 + 12 + 13;
  let sawIdat = false;

  while (offset + 12 <= bytes.byteLength) {
    const length = uint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);

    if (type === "IDAT") sawIdat = true;
    if (type === "IEND") {
      if (!sawIdat) throw new Error("Not a PNG: missing an IDAT image chunk");
      if (length !== 0) throw new Error("Not a PNG: IEND must have no payload");
      if (offset + 12 !== bytes.byteLength) {
        throw new Error("Not a PNG: trailing data after IEND");
      }
      return dimensions;
    }

    // Zero-length chunks are legal in PNG (the empty IDAT between siblings and
    // the zero-length IEND are both valid); the walk advances by 12 regardless,
    // so an empty chunk cannot loop forever.
    if (offset + 12 + length > bytes.byteLength) {
      throw new Error(`Not a PNG: ${type} chunk is truncated`);
    }

    offset += 12 + length;
  }

  throw new Error("Not a PNG: missing IEND terminator");
}

/**
 * JPEG dimensions plus structure. The segment chain is walked from SOI to the
 * frame header (SOF), then past the entropy-coded scan to a terminal EOI
 * marker, so a file truncated mid-scan fails even when its SOF header
 * survives.
 */
function jpegSize(bytes: Uint8Array): ImageDimensions {
  let offset = 2;
  let width = 0;
  let height = 0;
  let sawFrame = false;
  let sawScan = false;

  while (offset + 4 <= bytes.byteLength) {
    if (bytes[offset] !== 0xff) throw new Error("Not a JPEG: expected a segment marker");

    // Encoders may pad with extra 0xFF bytes before a marker.
    while (offset + 1 < bytes.byteLength && bytes[offset + 1] === 0xff) offset += 1;

    const marker = bytes[offset + 1]!;
    if (marker === 0xda) {
      sawScan = true;
      break;
    }
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const length = uint16(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.byteLength) {
      throw new Error("Not a JPEG: truncated segment");
    }

    // SOF0-SOF15 carry the frame header; 0xC4, 0xC8, and 0xCC are other tables.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      if (length < 8) throw new Error("Not a JPEG: truncated frame header");
      sawFrame = true;
      height = uint16(bytes, offset + 5);
      width = uint16(bytes, offset + 7);
    }

    offset += 2 + length;
  }

  // The scan's entropy-coded data is unstructured, so skip it byte-wise to
  // the EOI marker, honouring the 0xFF 0x00 stuffing that keeps 0xFF out of
  // the data proper.
  if (sawScan) {
    if (!sawFrame) throw new Error("Not a JPEG: no frame header found");
    let scan = offset + 2;
    while (scan + 1 < bytes.byteLength) {
      if (bytes[scan] === 0xff && bytes[scan + 1] === 0x00) {
        scan += 2;
        continue;
      }
      if (bytes[scan] === 0xff && bytes[scan + 1] === 0xd9) {
        if (scan + 2 !== bytes.byteLength) {
          throw new Error("Not a JPEG: trailing data after EOI");
        }
        return { width, height, format: "jpeg" };
      }
      scan += 1;
    }
    throw new Error("Not a JPEG: missing EOI marker after image data");
  }

  if (!sawFrame) throw new Error("Not a JPEG: no frame header found");
  throw new Error("Not a JPEG: missing image scan (SOS segment)");
}

/**
 * Reads the canvas size from a lossy, lossless, or extended WebP chunk and
 * walks every chunk inside the RIFF container, so a file truncated before its
 * declared RIFF size fails even when the dimension chunk survives.
 */
function webpSize(bytes: Uint8Array): ImageDimensions {
  if (bytes.byteLength < 30) throw new Error("Not a WebP: file is shorter than its header");

  const riffSize = uint32LE(bytes, 4);
  if (riffSize === 0) throw new Error("Not a WebP: RIFF size is zero");
  const expectedEnd = 8 + riffSize;
  if (expectedEnd !== bytes.byteLength) {
    throw new Error(
      expectedEnd < bytes.byteLength
        ? "Not a WebP: trailing data after declared RIFF size"
        : "Not a WebP: file is shorter than its declared RIFF size",
    );
  }

  const chunk = ascii(bytes, 12, 4);
  let dimensions: ImageDimensions;

  if (chunk === "VP8 ") {
    // Key frame: a 3-byte frame tag, the 0x9D012A start code, then 16-bit
    // little-endian width and height whose top two bits are a scale factor.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      throw new Error("Not a WebP: missing VP8 key frame start code");
    }
    dimensions = {
      width: uint16LE(bytes, 26) & 0x3fff,
      height: uint16LE(bytes, 28) & 0x3fff,
      format: "webp",
    };
  } else if (chunk === "VP8L") {
    const packed = bytes[21]! + bytes[22]! * 0x100 + bytes[23]! * 0x10000 + bytes[24]! * 0x1000000;
    dimensions = {
      width: (packed & 0x3fff) + 1,
      height: ((packed >>> 14) & 0x3fff) + 1,
      format: "webp",
    };
  } else if (chunk === "VP8X") {
    dimensions = {
      width: uint24LE(bytes, 24) + 1,
      height: uint24LE(bytes, 27) + 1,
      format: "webp",
    };
  } else {
    throw new Error(`Not a WebP: unsupported chunk ${chunk}`);
  }

  // An extended (VP8X) container must actually carry an image or animation
  // payload: a structurally complete RIFF holding only the origin/size header
  // reports dimensions yet no usable pixels, so it must not verify.
  const needsPayload = chunk === "VP8X";
  let sawPayload = false;

  // Walk the container so a chunk truncated against the declared RIFF size
  // (for example a missing ALPH or ANIM payload) is caught.
  let offset = 12;
  while (offset + 8 <= expectedEnd) {
    const child = ascii(bytes, offset, 4);
    if (needsPayload && (child === "VP8 " || child === "VP8L" || child === "ANMF")) {
      sawPayload = true;
    }
    const length = uint32LE(bytes, offset + 4);
    if (offset + 8 + length > expectedEnd) {
      throw new Error("Not a WebP: chunk is truncated");
    }
    offset += 8 + length + (length % 2);
  }
  if (offset !== expectedEnd) {
    throw new Error("Not a WebP: malformed chunk layout");
  }
  if (needsPayload && !sawPayload) {
    throw new Error("Not a WebP: VP8X container has no image or animation data");
  }

  return dimensions;
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

/** Throws when an image does not have the expected dimensions or format. */
export function verifyImage(
  input: ArrayBuffer | Uint8Array,
  expected: { width: number; height: number },
  expectedFormat?: ImageFormat,
): ImageDimensions {
  const actual = imageDimensions(input);
  if (expectedFormat && actual.format !== expectedFormat) {
    throw new Error(
      `Expected ${expectedFormat} ${expected.width}x${expected.height}, ` +
        `received ${actual.format} ${actual.width}x${actual.height}`,
    );
  }
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(
      `Expected ${expected.width}x${expected.height}, received ${actual.width}x${actual.height}`,
    );
  }
  return actual;
}

/** Detects a format from its signature without structural checks. */
export function detectFormat(input: ArrayBuffer | Uint8Array): OutputFormat | undefined {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength >= 8 && matches(bytes, PNG_SIGNATURE)) return "png";
  if (bytes.byteLength >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (
    bytes.byteLength >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "webp";
  }
  if (bytes.byteLength >= 4 && ascii(bytes, 0, 4) === "<svg") return "svg";
  return undefined;
}