import type { Font, SatoriOptions } from "satori";
import {
  OG_SIZE,
  assertImageSize,
  socialImage,
  socialImageMetadata,
  type ImageSize,
} from "./core.js";
import { loadSatori } from "./peers.js";

export const SVG_CONTENT_TYPE = "image/svg+xml" as const;

export type StandaloneFontLoader = () =>
  | Promise<readonly Font[]>
  | readonly Font[];

/**
 * The element tree Satori walks: a `{ type, props }` element — React's JSX
 * elements are exactly that shape — or a text/fragment node. Declared here
 * instead of importing `ReactNode` so `metaplate/render` and
 * `metaplate/node` typecheck without React or @types/react installed; the
 * README's React-free plain-object authoring path is therefore typed, not
 * just runtime-supported.
 */
export type SatoriNode =
  | { type: unknown; props?: object | null }
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly SatoriNode[];

export type SvgOgDefinition<Copy> = {
  /** Satori-compatible JSX or a plain `{ type, props }` object tree. */
  component: (copy: Copy) => SatoriNode;
  alt: (copy: Copy) => string;
  /** Satori does not bundle a default font, so at least one face is required. */
  fonts: StandaloneFontLoader;
  /** One plate renders one size; `plate.size` is the size every render uses. */
  size?: ImageSize;
  imagePath?: string;
  basePath?: string;
  /** Scheme for absolute image URLs, such as `https://example.com`. */
  origin?: string;
  satori?: Omit<SatoriOptions, "width" | "height" | "fonts">;
};

/** Defines a framework-neutral social image renderer that emits SVG text. */
export function createSvgOg<Copy>(definition: SvgOgDefinition<Copy>) {
  const size = Object.freeze({ ...(definition.size ?? OG_SIZE) });
  assertImageSize(size);
  const imagePath = definition.imagePath ?? "og-image";
  const basePath = definition.basePath ?? "";
  const origin = definition.origin ?? "";

  async function renderSvg(copy: Copy) {
    const satori = await loadSatori();
    const fonts = await definition.fonts();
    if (fonts.length === 0) {
      throw new Error("Standalone Metaplate renderers require at least one font");
    }

    // SatoriNode is structurally what Satori walks; its own declarations
    // type the parameter as React's ReactNode, so the boundary cast keeps
    // this module's type surface free of React.
    return satori(definition.component(copy) as Parameters<typeof satori>[0], {
      ...definition.satori,
      width: size.width,
      height: size.height,
      fonts: [...fonts],
    });
  }

  return Object.freeze({
    size,
    contentType: SVG_CONTENT_TYPE,
    renderSvg,
    image: (route: string, copy: Copy) =>
      socialImage(route, definition.alt(copy), {
        size,
        imagePath,
        basePath,
        origin,
        type: SVG_CONTENT_TYPE,
      }),
    metadata: (route: string, copy: Copy) =>
      socialImageMetadata(route, definition.alt(copy), {
        size,
        imagePath,
        basePath,
        origin,
        type: SVG_CONTENT_TYPE,
      }),
  });
}

export type { Font as SatoriFont, SatoriOptions } from "satori";