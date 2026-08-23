import type { Metadata } from "next";
import { og, type OgCopy } from "./og";

/** Site-level fields the root layout spreads into its own `openGraph`. */
export const openGraph = {
  siteName: "Metaplate example",
  type: "website",
  locale: "en_US",
};

/**
 * Next shallow-merges metadata, so a page that sets `openGraph` replaces the
 * layout's rather than extending it. Composing here keeps every route's tags
 * complete instead of repeating a spread that one page will eventually miss.
 */
export function pageMetadata(route: string, copy: OgCopy): Metadata {
  const social = og.metadata(route, copy);

  return {
    title: copy.title,
    description: copy.description,
    openGraph: {
      ...openGraph,
      // Per-route, so it cannot live in the shared constant above.
      url: route,
      // Without this, Next fills `og:title` from the document title, including
      // any `title.template` suffix the layout defines.
      title: copy.title,
      description: copy.description,
      images: social.openGraph.images,
    },
    twitter: social.twitter,
  };
}
