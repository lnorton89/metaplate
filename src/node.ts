import type { ResvgRenderOptions } from "@resvg/resvg-js";
import { OG_CONTENT_TYPE } from "./core.js";
import { optionalPeer } from "./optional-peer.js";
import {
  createSvgOg,
  type SvgOgDefinition,
  type SvgRenderOptions,
} from "./render.js";

const loadResvg = optionalPeer(
  { package: "@resvg/resvg-js", entries: "metaplate/node" },
  async (): Promise<typeof import("@resvg/resvg-js").Resvg> =>
    (await import("@resvg/resvg-js")).Resvg,
);

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

  async function render(copy: Copy, options: SvgRenderOptions = {}) {
    const source = await svg.renderSvg(copy, options);
    const Resvg = await loadResvg();
    return new Resvg(source, definition.resvg).render().asPng();
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
    response,
    handler: (copy: Copy) => () => response(copy),
  });
}

export type { ResvgRenderOptions } from "@resvg/resvg-js";
