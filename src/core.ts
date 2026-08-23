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
  /** Deployment prefix such as a GitHub Pages repository path. */
  basePath?: string;
};

function cleanPathPart(value: string): string {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === "/") {
    start += 1;
  }
  while (end > start && value[end - 1] === "/") {
    end -= 1;
  }

  return value.slice(start, end);
}

/** Returns a stable, extension-free pathname suitable for a Next route handler. */
export function socialImagePath(
  route: string,
  imagePath = "og-image",
  basePath = "",
): string {
  const basePart = cleanPathPart(basePath);
  const routePart = cleanPathPart(route);
  const imagePart = cleanPathPart(imagePath);

  if (!imagePart) {
    throw new Error("imagePath must contain at least one non-slash character");
  }

  return `/${[basePart, routePart, imagePart].filter(Boolean).join("/")}`;
}

/** Builds the image object shared by Next Open Graph and Twitter metadata. */
export function socialImage(
  route: string,
  alt: string,
  options: SocialImageOptions = {},
): SocialImageDescriptor {
  const size = options.size ?? OG_SIZE;
  return {
    url: socialImagePath(route, options.imagePath, options.basePath),
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
