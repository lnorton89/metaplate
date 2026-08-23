/** The standard 1.91:1 social-card canvas. */
export const OG_SIZE = Object.freeze({ width: 1200, height: 630 });

export const OG_CONTENT_TYPE = "image/png" as const;

export type ImageSize = {
  width: number;
  height: number;
};

export type SocialImageDescriptor = ImageSize & {
  url: string;
  alt: string;
};

export type SocialImageMetadata = {
  openGraph: { images: SocialImageDescriptor[] };
  twitter: {
    card: "summary_large_image";
    images: SocialImageDescriptor[];
  };
};

export type SocialImageOptions = {
  size?: ImageSize;
  imagePath?: string;
};

function cleanPathPart(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

/** Returns a stable, extension-free pathname suitable for a Next route handler. */
export function socialImagePath(route: string, imagePath = "og-image"): string {
  const routePart = cleanPathPart(route);
  const imagePart = cleanPathPart(imagePath);

  if (!imagePart) {
    throw new Error("imagePath must contain at least one non-slash character");
  }

  return routePart ? `/${routePart}/${imagePart}` : `/${imagePart}`;
}

/** Builds the image object shared by Next Open Graph and Twitter metadata. */
export function socialImage(
  route: string,
  alt: string,
  options: SocialImageOptions = {},
): SocialImageDescriptor {
  const size = options.size ?? OG_SIZE;
  return {
    url: socialImagePath(route, options.imagePath),
    width: size.width,
    height: size.height,
    alt,
  };
}

/** Builds matching Open Graph and large-card Twitter metadata. */
export function socialImageMetadata(
  route: string,
  alt: string,
  options: SocialImageOptions = {},
): SocialImageMetadata {
  const image = socialImage(route, alt, options);
  return {
    openGraph: { images: [image] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}
