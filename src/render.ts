import type { ReactNode } from "react";
import type { Font, SatoriOptions } from "satori";
import {
  OG_SIZE,
  socialImage,
  socialImageMetadata,
  type ImageSize,
} from "./core.js";
import { loadSatori } from "./peers.js";

export const SVG_CONTENT_TYPE = "image/svg+xml" as const;

export type StandaloneFontLoader = () =>
  | Promise<readonly Font[]>
  | readonly Font[];

export type SvgOgDefinition<Copy> = {
  /** Satori-compatible JSX or a React-shaped element tree. */
  component: (copy: Copy) => ReactNode;
  alt: (copy: Copy) => string;
  /** Satori does not bundle a default font, so at least one face is required. */
  fonts: StandaloneFontLoader;
  size?: ImageSize;
  imagePath?: string;
  basePath?: string;
  satori?: Omit<SatoriOptions, "width" | "height" | "fonts">;
};

export type SvgRenderOptions = {
  size?: ImageSize;
};

/** Defines a framework-neutral social image renderer that emits SVG text. */
export function createSvgOg<Copy>(definition: SvgOgDefinition<Copy>) {
  const size = Object.freeze({ ...(definition.size ?? OG_SIZE) });
  const imagePath = definition.imagePath ?? "og-image";
  const basePath = definition.basePath ?? "";

  async function renderSvg(copy: Copy, options: SvgRenderOptions = {}) {
    const renderSize = options.size ?? size;
    const satori = await loadSatori();
    const fonts = await definition.fonts();
    if (fonts.length === 0) {
      throw new Error("Standalone Metaplate renderers require at least one font");
    }

    return satori(definition.component(copy), {
      ...definition.satori,
      width: renderSize.width,
      height: renderSize.height,
      fonts: [...fonts],
    });
  }

  return Object.freeze({
    size,
    contentType: SVG_CONTENT_TYPE,
    renderSvg,
    image: (route: string, copy: Copy) =>
      socialImage(route, definition.alt(copy), { size, imagePath, basePath }),
    metadata: (route: string, copy: Copy) =>
      socialImageMetadata(route, definition.alt(copy), { size, imagePath, basePath }),
  });
}

export type { Font as SatoriFont, SatoriOptions } from "satori";
