import type { ResvgRenderOptions } from "@resvg/resvg-js";
import { OG_CONTENT_TYPE } from "./core.js";
import { loadPeerPair } from "./optional-peer.js";
import { loadResvg, loadSatori } from "./peers.js";
import {
  createSvgOg,
  type SvgOgDefinition,
  type SvgRenderOptions,
} from "./render.js";

/** Raw RGBA output, ready for an encoder such as sharp or @jsquash/jpeg. */
export type RenderedPixels = {
  /** Row-major RGBA bytes, `width * height * 4` long. */
  pixels: Uint8Array;
  width: number;
  height: number;
};

export type NodeOgDefinition<Copy> = SvgOgDefinition<Copy> & {
  /** Resvg rendering controls such as background and font configuration. */
  resvg?: ResvgRenderOptions;
  /** Headers added to Web Responses returned by `response` and `handler`. */
  headers?: HeadersInit;
};

/**
 * Defines a Node renderer that emits PNG bytes and Fetch API Responses for
 * Astro, SvelteKit, Remix, Express adapters, build scripts, and other runtimes.
 */
export function createNodeOg<Copy>(definition: NodeOgDefinition<Copy>) {
  const svg = createSvgOg(definition);

  async function rasterize(copy: Copy, options: SvgRenderOptions) {
    // Both peers resolve before rendering so an install missing both is told
    // to add both, rather than reporting them one run at a time.
    const [, Resvg] = await loadPeerPair(loadSatori, loadResvg, "metaplate/node");
    const source = await svg.renderSvg(copy, options);
    return new Resvg(source, definition.resvg).render();
  }

  async function render(copy: Copy, options: SvgRenderOptions = {}) {
    return (await rasterize(copy, options)).asPng();
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
    headers.set("Content-Type", OG_CONTENT_TYPE);
    const png = await render(copy, options);
    const body = png.buffer.slice(
      png.byteOffset,
      png.byteOffset + png.byteLength,
    ) as ArrayBuffer;
    return new Response(body, { headers });
  }

  return Object.freeze({
    ...svg,
    contentType: OG_CONTENT_TYPE,
    render,
    renderPixels,
    response,
    handler: (copy: Copy) => () => response(copy),
  });
}

export type { ResvgRenderOptions } from "@resvg/resvg-js";
