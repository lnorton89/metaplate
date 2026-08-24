import type { ResvgRenderOptions } from "@resvg/resvg-js";
import { OG_CONTENT_TYPE } from "./core.js";
import { loadPeerPair } from "./optional-peer.js";
import { loadResvg, loadSatori } from "./peers.js";
import {
  createSvgOg,
  type SvgOgDefinition,
  type SvgRenderOptions,
} from "./render.js";

function describe(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  return value.constructor?.name ?? "an object";
}

/** Raw RGBA output, ready for an encoder such as sharp or @jsquash/jpeg. */
export type RenderedPixels = {
  /** Row-major RGBA bytes, `width * height * 4` long. */
  pixels: Uint8Array;
  width: number;
  height: number;
};

/**
 * Replaces PNG output. Metaplate ships no image encoder, so the encoder and
 * the media type it produces are declared together and cannot disagree.
 */
export type OutputEncoder = {
  /** Media type of the encoded bytes, such as `image/jpeg`. */
  contentType: string;
  encode: (image: RenderedPixels) => Promise<Uint8Array> | Uint8Array;
};

export type NodeOgDefinition<Copy> = SvgOgDefinition<Copy> & {
  /** Resvg rendering controls such as background and font configuration. */
  resvg?: ResvgRenderOptions;
  /** Headers added to Web Responses returned by `response` and `handler`. */
  headers?: HeadersInit;
  /** Encodes something other than PNG, and declares what that something is. */
  output?: OutputEncoder;
};

/**
 * Defines a Node renderer that emits PNG bytes and Fetch API Responses for
 * Astro, SvelteKit, Remix, Express adapters, build scripts, and other runtimes.
 */
export function createNodeOg<Copy>(definition: NodeOgDefinition<Copy>) {
  const svg = createSvgOg(definition);
  const contentType = definition.output?.contentType ?? OG_CONTENT_TYPE;

  async function rasterize(copy: Copy, options: SvgRenderOptions) {
    // Both peers resolve before rendering so an install missing both is told
    // to add both, rather than reporting them one run at a time.
    const [, Resvg] = await loadPeerPair(loadSatori, loadResvg, "metaplate/node");
    const source = await svg.renderSvg(copy, options);
    return new Resvg(source, definition.resvg).render();
  }

  async function render(copy: Copy, options: SvgRenderOptions = {}): Promise<Uint8Array> {
    const image = await rasterize(copy, options);
    if (!definition.output) return image.asPng();

    const encoded = await definition.output.encode({
      pixels: image.pixels,
      width: image.width,
      height: image.height,
    });

    // Without this, a wrong return type surfaces further downstream as a
    // property access on undefined inside `response`, which reads as a bug in
    // Metaplate rather than in the encoder the consumer supplied.
    if (!(encoded instanceof Uint8Array)) {
      throw new TypeError(
        `output.encode must return a Uint8Array; received ${describe(encoded)}`,
      );
    }

    return encoded;
  }

  /**
   * Renders raw RGBA bytes rather than PNG. A card compositing a photograph
   * encodes far smaller as JPEG or WebP, and returning the pixmap keeps an
   * image encoder out of this package.
   */
  async function renderPixels(
    copy: Copy,
    options: SvgRenderOptions = {},
  ): Promise<RenderedPixels> {
    const image = await rasterize(copy, options);
    return { pixels: image.pixels, width: image.width, height: image.height };
  }

  async function response(copy: Copy, options: SvgRenderOptions = {}) {
    const headers = new Headers(definition.headers);
    headers.set("Content-Type", contentType);
    const bytes = await render(copy, options);
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return new Response(body, { headers });
  }

  return Object.freeze({
    ...svg,
    contentType,
    render,
    renderPixels,
    response,
    handler: (copy: Copy) => () => response(copy),
  });
}

export type { ResvgRenderOptions } from "@resvg/resvg-js";
