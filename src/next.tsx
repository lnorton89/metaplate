import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  socialImage,
  socialImageMetadata,
  type ImageSize,
} from "./core.js";

type ImageResponseOptions = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>;
type ImageResponseFont = NonNullable<ImageResponseOptions["fonts"]>[number];

export type FontLoader = () =>
  | Promise<readonly ImageResponseFont[]>
  | readonly ImageResponseFont[];

export type NextOgDefinition<Copy> = {
  /** Satori-compatible JSX. Every element with multiple children should use flex. */
  component: (copy: Copy) => ReactElement;
  /** Derives accessible alternative text from the same page-owned copy. */
  alt: (copy: Copy) => string;
  size?: ImageSize;
  imagePath?: string;
  basePath?: string;
  fonts?: FontLoader;
  response?: Omit<ImageResponseOptions, "width" | "height" | "fonts">;
};

export type RenderOptions = {
  size?: ImageSize;
};

/**
 * Defines one branded image system and returns the renderer, route handler,
 * and metadata helpers that consume it.
 */
export function createNextOg<Copy>(definition: NextOgDefinition<Copy>) {
  const size = Object.freeze({ ...(definition.size ?? OG_SIZE) });
  const imagePath = definition.imagePath ?? "og-image";
  const basePath = definition.basePath ?? "";

  async function render(copy: Copy, options: RenderOptions = {}) {
    const renderSize = options.size ?? size;
    const fonts = definition.fonts ? await definition.fonts() : undefined;
    const responseOptions: ImageResponseOptions = {
      ...definition.response,
      width: renderSize.width,
      height: renderSize.height,
      ...(fonts ? { fonts: [...fonts] } : {}),
    };

    return new ImageResponse(definition.component(copy), responseOptions);
  }

  return Object.freeze({
    size,
    contentType: OG_CONTENT_TYPE,
    render,
    handler: (copy: Copy) => () => render(copy),
    image: (route: string, copy: Copy) =>
      socialImage(route, definition.alt(copy), { size, imagePath, basePath }),
    metadata: (route: string, copy: Copy) =>
      socialImageMetadata(route, definition.alt(copy), { size, imagePath, basePath }),
  });
}

export { ImageResponse };
